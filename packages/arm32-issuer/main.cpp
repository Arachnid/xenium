#include "Kernel.h"
#include "mbed.h"
#include "mbed_error.h"
#include "mbed_events.h"
#include "mbed_shared_queues.h"

#include <cstring>

#include "ethers.h"
#include "base32.h"
#include "qrcodegen.h"
#include "types.h"
#include "helpers.h"
#include "rng.h"
#include "config.h"
#include "storage.h"
#include "claims.h"

InterruptIn button(BUTTON);
privkey_t issuer_key;

int encode_qr_code(char *claimcode, uint8_t* qr) {
    uint8_t temp_buffer[qrcodegen_BUFFER_LEN_FOR_VERSION(7)];
    qrcodegen_Segment segments[3];
    int buffer_offset = 0;

    segments[0] = qrcodegen_makeAlphanumeric(BASE_URL, temp_buffer);
    buffer_offset += qrcodegen_calcSegmentBufferSize(qrcodegen_Mode_ALPHANUMERIC, sizeof(BASE_URL));
    segments[1] = qrcodegen_makeBytes((uint8_t*)"#", 1, temp_buffer + buffer_offset);
    buffer_offset += qrcodegen_calcSegmentBufferSize(qrcodegen_Mode_BYTE, 1);
    segments[2] = qrcodegen_makeAlphanumeric((char*)claimcode, temp_buffer + buffer_offset);

    return qrcodegen_encodeSegmentsAdvanced(segments, 3, qrcodegen_Ecc_LOW, 7, 7, qrcodegen_Mask_0, true, temp_buffer, qr);
}

void handle_button_press(void) {
    char claimcode[CLAIMCODE_LEN];
    uint8_t qr[qrcodegen_BUFFER_LEN_FOR_VERSION(7)];
    uint32_t nonce;

    uint64_t start = Kernel::get_ms_count();
    int ret = get_next_nonce(&nonce);
    if(ret != MBED_SUCCESS) {
        MBED_ERROR(ret, "Getting next nonce");
    }

    ret = generate_claim_code(issuer_key, nonce, claimcode);
    if(ret != MBED_SUCCESS) {
        MBED_ERROR(ret, "Generating claim code");
    }

    if(!encode_qr_code(claimcode, qr)) {
        MBED_ERROR(MBED_ERROR_FAILED_OPERATION, "Generating QR code");
    }

    printf("elapsed = %d\n", (int)(Kernel::get_ms_count() - start));
    
    for(int x = 0; x < 49; x++) {
        for(int y = 0; y < 49; y++) {
            if(qrcodegen_getModule(qr, x, y)) {
                printf("██");
            } else {
                printf("  ");
            }
        }
        printf("\n");
    }
}

int main(){
    EventQueue *queue = mbed_event_queue();

    rng_init();

    /* Create an issuer key if we don't have one already */
    int ret = get_issuer_key(issuer_key);
    if(ret != MBED_SUCCESS) {
        MBED_ERROR(ret, "Generating issuer key");
    }

    printf("issuer_key = ");
    println_hex(issuer_key, 32);

    button.fall(queue->event(handle_button_press));
    // queue->dispatch_forever();
    stop();
}