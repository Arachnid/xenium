#include "EventQueue.h"
#include "Kernel.h"
#include "ThisThread.h"
#include "cmsis_os2.h"
#include "kv_config.h"
#include "mbed.h"
#include "mbed_error.h"
#include "mbed_events.h"
#include "mbed_shared_queues.h"
#include "DeviceKey.h"

#include <chrono>
#include <cstring>
#include <ratio>

#include "ethers.h"
#include "base32.h"
#include "types.h"
#include "helpers.h"
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

uint8_t ROOT_OF_TRUST[] = {0x5b, 0x22, 0x26, 0xba, 0x20, 0x3d, 0x95, 0x1e, 0xfb, 0x88, 0x20, 0xb8, 0x6f, 0x6b, 0x72, 0x61};

#define EEPROM_END_OF_MEM 0xF
#define ENDA1 0xB // End of first data area (11 * 32 + 31 = byte 383)
#define MLEN 32 // 32 * 8 byte words (256 bytes)
#define CONFIG_ADDRESS 0x1A0
#define ACTIVE_TIMEOUT chrono::duration<uint32_t,std::milli>(1000) // milliseconds to wait after tag becomes active before starting a new write
#define CLAIM_PATH "c#"
#define FLAG_GPO_INTERRUPT 0x1
#define FLAGS_ALL FLAG_GPO_INTERRUPT

typedef struct {
    char magic_number[8];       // Identifies if this device has been initialised
    address_t validator;        // Address of the validator contract
    address_t issuer;           // This issuer's address
    char url_string[32];        // URL prefix. Null terminated if <32 chars.
    uint32_t claim_interval;    // Interval between claim codes (seconds).
    uint32_t claim_count;       // Max number of claims that can be 'in the bucket'
} config_t;

const config_t DEFAULT_CONFIG = {
    "XENI003",
    {0xf2, 0x1a, 0x71, 0xd2, 0x67, 0x5d, 0xa8, 0x3e, 0xd2, 0xda, 0x08, 0x38, 0x17, 0x21, 0x4b, 0x81, 0x5f, 0x09, 0xb1, 0x3b},
    {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
    "\x04xenium.link/mainnet/",
    1,
    1
};

uint8_t EEPROM_REGISTER_INIT[][2] = {
    {ST25_REG_GPO,          ST25_GPO_RF_ACTIVITY_EN | ST25_GPO_RF_WRITE_EN | ST25_GPO_EN},
    {ST25_REG_IT_TIME,      0},
    {ST25_REG_EH_MODE,      ST25_EH_ON_DEMAND},
    {ST25_REG_RF_MNGT,      0},
    {ST25_REG_RFA1SS,       ST25_R_OPEN_W_AUTH},
    {ST25_REG_RFA2SS,       ST25_R_OPEN_W_AUTH | 1},
    {ST25_REG_I2CSS,        0},
    {ST25_REG_LOCK_CCFILE,  0},
    {ST25_REG_MB_MODE,      ST25_MB_MODE_OFF},
    {ST25_REG_MB_WDG,       0},
    {ST25_REG_LOCK_CFG,     ST25_CONFIG_LOCKED},
    {0,0}
};

int write_claim_code(void);

InterruptIn gpo(MBED_CONF_APP_INT, PullUp);
ST25 st25(MBED_CONF_APP_SDA, MBED_CONF_APP_SCL);
EventFlags event_flags;

privkey_t issuer_key;
config_t config;
uint32_t claims_left;
std::chrono::time_point<Kernel::Clock> claims_last_updated;

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
    char claimcode[CLAIMCODE_LEN + urllen + sizeof(CLAIM_PATH)];
    uint32_t nonce;

    int ret = get_next_nonce(&nonce);
    if(ret != MBED_SUCCESS) {
        return ret;
    }

    strncat(claimcode, config.url_string, urllen);
    strcat(claimcode, CLAIM_PATH);
    ret = generate_claim_code(issuer_key, config.validator, nonce, claimcode + urllen + sizeof(CLAIM_PATH) - 1);
    if(ret != MBED_SUCCESS) {
        return ret;
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

    claims_left -= 1;

    return MBED_SUCCESS;
}

int write_empty_ndef(void) {
    uint8_t buffer[512];
    int size = write_ndef_record(
        buffer,
        sizeof(buffer),
        NDEF_MESSAGE_BEGIN | NDEF_MESSAGE_END | NDEF_TNF_EMPTY,
        Span<uint8_t>(),
        Span<uint8_t>(),
        Span<uint8_t>());
    
    return st25.write_ndef(Span<uint8_t>(buffer, size));
}

void initialize_device() {
    // Authenticate with the eeprom for settings access
    int ret = st25.unlock(0);
    if(ret != 0) {
        MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Unlocking registers");
    }

    st25.read((uint8_t*)&config, sizeof(config), CONFIG_ADDRESS);
    if(memcmp(config.magic_number, DEFAULT_CONFIG.magic_number, sizeof(DEFAULT_CONFIG.magic_number)) != 0) {
        // Delete issuer key and nonce if they exist
        ret = reset_store();
        if(ret != MBED_SUCCESS) {
            MBED_ERROR(ret, "Resetting datastore");
        }

        // Initialise with default config
        memcpy((uint8_t*)&config, &DEFAULT_CONFIG, sizeof(DEFAULT_CONFIG));

        // Format the NDEF part of the memory
        ret = st25.format(MLEN, true /* readonly */, true /* mbread */);
        if(ret != 0) {
            MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Formatting EEPROM");
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
    }

    // Set up devicekey
    DeviceKey::get_instance().device_inject_root_of_trust((uint32_t*)ROOT_OF_TRUST, sizeof(ROOT_OF_TRUST));

    // Write the issuer address to the config
    ret = get_issuer_address(config.issuer);
    if(ret != MBED_SUCCESS) {
        MBED_ERROR(ret, "Writing issuer address");
    }

    // Write the config to storage
    ret = write_config();
    if(ret != 0) {
        MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Writing default config");
    }

    claims_left = 0;
    claims_last_updated = Kernel::Clock::now();
}

void handle_gpo(void) {
    event_flags.set(FLAG_GPO_INTERRUPT);
}

void update_claim_counter() {
    auto now = Kernel::Clock::now();
    auto elapsed = now - claims_last_updated;
    uint32_t intervals = elapsed / (config.claim_interval * 1s);
    claims_left = min(config.claim_count, claims_left + intervals);
    claims_last_updated += intervals * config.claim_interval * 1s;
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
    int ret = st25.write_dynamic_register(ST25_RF_SLEEP, ST25_DYN_RF_MNGT);
    if(ret != MBED_SUCCESS) {
        MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "RF sleep");
    }
    ret = write_claim_code();
    if(ret != MBED_SUCCESS) {
        MBED_ERROR(ret, "Writing claim code");
    }
    ret = st25.write_dynamic_register(0, ST25_DYN_RF_MNGT);
    if(ret != MBED_SUCCESS) {
        MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "RF wake");
    }
    return {&state_idle};
}

struct next_state_t state_delay() {
    // On entering this state, claims_left is 0, and claims_last_updated is in the future
    // On exiting, claims_left is 1 and claims_last_updated is now
    printf("State: DELAY\n");
    // Replace the tag with empty data
    st25.write_dynamic_register(ST25_RF_SLEEP, ST25_DYN_RF_MNGT);
    write_empty_ndef();
    st25.write_dynamic_register(0, ST25_DYN_RF_MNGT);

    // Wait until the end of the delay
    std::chrono::time_point<Kernel::Clock> wait_until = claims_last_updated + config.claim_interval * 1s;
    ThisThread::sleep_until(wait_until);

    // Clear any interrupts that happened while we were waiting
    st25.read_dynamic_register(ST25_DYN_IT_STS);

    // Add one claim to the counter
    claims_left = 1;
    claims_last_updated = Kernel::Clock::now();
    return {&state_write_tag};
}

struct next_state_t state_active() {
    printf("State: ACTIVE\n");
    while(true) {
        int reg = st25.read_dynamic_register(ST25_DYN_IT_STS);
        if(reg & ST25_IT_RF_WRITE) {
            return {&state_reinitialize};
        }
        
        int flags = event_flags.wait_any_for(FLAG_GPO_INTERRUPT, ACTIVE_TIMEOUT);
        if(flags == osFlagsErrorTimeout) {
            if(claims_left > 0) {
                return {&state_write_tag};
            } else {
                return {&state_delay};
            }
        }

        // Otherwise, it was the GPO interrupt; loop around again
    }
}

struct next_state_t state_idle() {
    printf("State: IDLE\n");
    int flags = event_flags.wait_any(FLAG_GPO_INTERRUPT);
    update_claim_counter();
    return {&state_active};
}

int main() {
    // rng_init();
    kv_init_storage_config();
    initialize_device();
    gpo.rise(handle_gpo);

    struct next_state_t state = {&state_delay};
    while(true) {
        state = state.func();
    }
}
