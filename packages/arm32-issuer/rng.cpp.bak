#include "rng.h"
#include "hal/trng_api.h"
#include "mbed.h"

trng_t _rng;

int rng(uint8_t *dest, unsigned size) {
    int offset = 0;
    while(offset < size) {
        size_t output_length;
        int ret = trng_get_bytes(&_rng, dest, size - offset, &output_length);
        if(ret != MBED_SUCCESS) {
            return ret;
        }
        offset += output_length;
    }
    return MBED_SUCCESS;
}

void rng_init() {
    trng_init(&_rng);
}