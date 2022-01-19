#include "EventQueue.h"
#include "Kernel.h"
#include "cmsis_os2.h"
#include "mbed.h"
#include "mbed_error.h"
#include "mbed_events.h"
#include "mbed_shared_queues.h"

#include <chrono>
#include <cstring>
#include <ratio>

#include "ethers.h"
#include "base32.h"
#include "types.h"
#include "helpers.h"
#include "rng.h"
#include "config.h"
#include "storage.h"
#include "claims.h"
#include "st25.h"
#include "shib_ndef.h"

/*
 * The NFC EEPROM is divided up as follows:
 *
 * ┌─┬────────────────┬─┐◄─── 0x000
 * │ │    CC File     │ │
 * │ ├────────────────┤ │◄─── 0x004
 * │ │                │ │
 * │ │    T5T Area    │ │
 * │ │                │ │
 * │ └────────────────┘ │◄─── 0x104
 * │                    │
 * │    Area 1 (R/O)    │
 * │                    │
 * ├─┬────────────────┬─┤◄─── 0x1A0
 * │ │ Configuration  │ │
 * │ └────────────────┘ │
 * │                    │
 * │    Area 2 (R/W)    │
 * │                    │
 * └────────────────────┘◄─── 0x1FF
 *
 * Area 1 contains the NDEF Capability Container and data, and is configured
 * to be Read-Only for RF devices.
 *
 * When multi-block reads are enabled, Android reads up to 32 blocks (128 bytes) at a time, and the ST25
 * series devices return an error if a read passes over a data area boundary, so per
 * https://www.st.com/resource/en/application_note/an4911-ndef-management-with-st25dvi2c-series-and-st25tv16k-and-st25tv64k-products-stmicroelectronics.pdf
 * when multi-block read is enabled, and more than one data area is used, there must be 128 bytes of empty
 * space between the end of the T5T area (where NDEF records can be written) and the end of Area 1.
 *
 * Area 2 contains configuration data (see the config_t struct below) and is configured for unauthenticated
 * read access, and write access with RF password 0. This password defaults to 0, but can be updated over RF.
 */

#define EEPROM_END_OF_MEM 0xF
#define ENDA1 0xB // End of first data area (11 * 32 + 31 = byte 383)
#define MLEN 32 // 32 * 8 byte words (256 bytes)
#define CONFIG_ADDRESS 0x1A0
#define ACTIVE_TIMEOUT chrono::duration<uint32_t,std::milli>(1000) // milliseconds to wait after tag becomes active before starting a new write

#define FLAG_BUTTON_PRESSED 0x1
#define FLAG_GPO_INTERRUPT 0x2
#define FLAGS_ALL (FLAG_BUTTON_PRESSED | FLAG_GPO_INTERRUPT)

typedef struct {
    char magic_number[8];       // Identifies if this device has been initialised
    uint8_t validator[20];      // Address of the validator contract
    char url_string[32];        // URL prefix. Null terminated if <32 chars.
    uint32_t claim_delay;       // Delay between claim codes (seconds).
    uint8_t claim_type;         // Shibboleth claim type. 0x00 = standard, 0x80 = set owner
    uint8_t next_claim_type;    // Message type for next message only.
} config_t;

const config_t DEFAULT_CONFIG = {
    "SHIB002",
    {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
    "\x04shibboleth.link/#/",
    30,
    0,
    0
};

uint8_t EEPROM_REGISTER_INIT[][2] = {
    {ST25_REG_GPO, ST25_GPO_RF_ACTIVITY_EN | ST25_GPO_RF_WRITE_EN | ST25_GPO_EN},
    {ST25_REG_IT_TIME, 0},
    {ST25_REG_EH_MODE, ST25_EH_ON_DEMAND},
    {ST25_REG_RF_MNGT, 0},
    {ST25_REG_RFA1SS, ST25_R_OPEN_W_AUTH},
    {ST25_REG_RFA2SS, ST25_R_OPEN_W_AUTH | 1},
    {ST25_REG_I2CSS, 0},
    {ST25_REG_LOCK_CCFILE, 0},
    {ST25_REG_MB_MODE, ST25_MB_MODE_OFF},
    {ST25_REG_MB_WDG, 0},
    {ST25_REG_LOCK_CFG, ST25_CONFIG_LOCKED},
    {0,0}
};

int write_claim_code(void);

InterruptIn button(BUTTON);
InterruptIn gpo(D12, PullUp);
ST25 st25(D14, D15);
EventFlags event_flags;

privkey_t issuer_key;
config_t config;

int strnlen(char *s, int maxlen) {
    for(int i = 0; i < maxlen; i++) {
        if(s[i] == 0) {
            return i;
        }
    }
    return maxlen;
}

int write_config() {
    return st25.write(Span<uint8_t>((uint8_t*)&config, sizeof(config)), CONFIG_ADDRESS);
}

int write_claim_code(void) {
    int urllen = strnlen(config.url_string, sizeof(config.url_string));
    char claimcode[CLAIMCODE_LEN + urllen];
    uint32_t nonce;

    int ret = get_next_nonce(&nonce);
    if(ret != MBED_SUCCESS) {
        return ret;
    }

    memcpy(claimcode, config.url_string, urllen);
    ret = generate_claim_code(issuer_key, config.next_claim_type, nonce, claimcode + urllen - 1);
    if(ret != MBED_SUCCESS) {
        return ret;
    }

    if(config.next_claim_type != config.claim_type) {
        config.next_claim_type = config.claim_type;
        ret = write_config();
        if(ret != 0) {
            return ret;
        }
    }

    uint8_t buffer[512];
    uint8_t urltype[] = {0x55};
    int size = write_ndef_record(
        buffer,
        sizeof(buffer),
        NDEF_MESSAGE_BEGIN | NDEF_MESSAGE_END | NDEF_TNF_WELL_KNOWN,
        Span<uint8_t>(urltype, 1),
        Span<uint8_t>((uint8_t*)claimcode, strlen(claimcode)),
        Span<uint8_t>());

    ret = st25.write_ndef(Span<uint8_t>(buffer, size));
    if(ret != 0) {
        return MBED_ERROR_FAILED_OPERATION;
    }
    return MBED_SUCCESS;
}

void initialize_device() {
    st25.read((uint8_t*)&config, sizeof(config), CONFIG_ADDRESS);
    if(memcmp(config.magic_number, DEFAULT_CONFIG.magic_number, sizeof(DEFAULT_CONFIG.magic_number)) != 0) {
        // Initialise with default config
        memcpy((uint8_t*)&config, &DEFAULT_CONFIG, sizeof(DEFAULT_CONFIG));

        // Format the NDEF part of the memory
        int ret = st25.format(MLEN, true /* readonly */, true /* mbread */);
        if(ret != 0) {
            MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Formatting EEPROM");
        }

        // Authenticate with the eeprom for settings access
        ret = st25.unlock(0);
        if(ret != 0) {
            MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Unlocking registers");
        }

        // Write default register settings
        for(int i = 0; EEPROM_REGISTER_INIT[i][0] != 0 || EEPROM_REGISTER_INIT[i][1] != 0; i++) {
            ret = st25.write_register(EEPROM_REGISTER_INIT[i][1], EEPROM_REGISTER_INIT[i][0]);
            if(ret != 0) {
                MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Writing registers");
            }
        }

        // Set up memory ranges
        ret = st25.read_register(ST25_REG_ENDA3);
        if(ret < 0) {
            MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Reading ENDA3");
        } else if(ret != EEPROM_END_OF_MEM) {
            ret = st25.write_register(EEPROM_END_OF_MEM, ST25_REG_ENDA3);
            if(ret != MBED_SUCCESS) {
                MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Writing ENDA3");
            }
        }

        ret = st25.read_register(ST25_REG_ENDA2);
        if(ret < 0) {
            MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Reading ENDA2");
        } else if(ret != EEPROM_END_OF_MEM) {
            ret = st25.write_register(EEPROM_END_OF_MEM, ST25_REG_ENDA2);
            if(ret != MBED_SUCCESS) {
                MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Writing ENDA2");
            }
        }

        ret = st25.read_register(ST25_REG_ENDA1);
        if(ret < 0) {
            MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Reading ENDA1");
        } else if(ret != ENDA1) {
            ret = st25.write_register(ENDA1, ST25_REG_ENDA1);
            if(ret != MBED_SUCCESS) {
                MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Writing ENDA1");
            }
        }

        // Generate an issuer key
        ret = create_issuer_key(issuer_key);
        if(ret != 0) {
            MBED_ERROR(ret, "Creating issuer key");
        }

        // Write the config to storage
        ret = write_config();
        if(ret != 0) {
            MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Writing default config");
        }
    }

    // Generate a new claim code
    int ret = write_claim_code();
    if(ret != MBED_SUCCESS) {
        MBED_ERROR(ret, "Writing claim code");
    }
}

void handle_button_press(void) {
    event_flags.set(FLAG_BUTTON_PRESSED);
}

void handle_gpo(void) {
    event_flags.set(FLAG_GPO_INTERRUPT);
}

#define STATE_IDLE 1
#define STATE_READ_GPO 2
#define STATE_ACTIVE 3
#define STATE_DELAY 4
#define STATE_WRITE_TAG 5
#define STATE_REINITIALIZE 6

struct next_state_t {
    struct next_state_t (*func)(void);
};

struct next_state_t state_idle();

struct next_state_t state_reinitialize() {
    printf("State: REINITIALIZE\n");
    while(true) {
        int flags = event_flags.wait_any_for(FLAG_GPO_INTERRUPT, ACTIVE_TIMEOUT);
        if(!(flags & FLAG_GPO_INTERRUPT)) {
            initialize_device();
            return {&state_idle};
        }
    }
}

struct next_state_t state_write_tag() {
    printf("State: WRITE_TAG\n");
    st25.write_dynamic_register(ST25_RF_SLEEP, ST25_DYN_RF_MNGT);
    write_claim_code();
    st25.write_dynamic_register(0, ST25_DYN_RF_MNGT);
    return {&state_idle};
}

struct next_state_t state_delay() {
    printf("State: DELAY\n");
    // Stop responding on NFC
    st25.write_dynamic_register(ST25_RF_SLEEP, ST25_DYN_RF_MNGT);
    event_flags.wait_any_for(FLAG_BUTTON_PRESSED, chrono::duration<uint32_t,std::milli>(config.claim_delay * 1000));
    return {&state_write_tag};
}

struct next_state_t state_active() {
    printf("State: ACTIVE\n");
    while(true) {
        int reg = st25.read_dynamic_register(ST25_DYN_IT_STS);
        if(reg & ST25_IT_RF_WRITE) {
            return {&state_reinitialize};
        }
        
        int flags = event_flags.wait_any_for(FLAGS_ALL, ACTIVE_TIMEOUT);
        if(flags == osFlagsErrorTimeout) {
            return {&state_delay};
        } else if(flags & FLAG_BUTTON_PRESSED) {
            return {&state_write_tag};
        }

        // Otherwise, it was the GPO interrupt; loop around again
    }
}

struct next_state_t state_idle() {
    printf("State: IDLE\n");
    int flags = event_flags.wait_any(FLAGS_ALL);
    if(flags & FLAG_BUTTON_PRESSED) {
        return {&state_write_tag};
    } else if(flags & FLAG_GPO_INTERRUPT) {
        return {&state_active};
    }
    return {&state_idle};
}

int main() {
    rng_init();
    initialize_device();
    gpo.rise(handle_gpo);
    button.fall(handle_button_press);

    struct next_state_t state = {&state_idle};
    while(true) {
        state = state.func();
    }
}
