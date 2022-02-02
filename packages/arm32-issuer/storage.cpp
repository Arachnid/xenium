#include "storage.h"
#include "KVStore.h"
#include "kvstore_global_api.h"
#include "mbed.h"
#include "config.h"
#include "mbed_error.h"
#include "DeviceKey.h"

uint32_t next_nonce = 0xffffffff;

int get_issuer_key(privkey_t privkey) {
    uint8_t salt = 0;
    int ret = DeviceKey::get_instance().generate_derived_key(&salt, 1, privkey, 16);
    if(ret != MBED_SUCCESS) {
        return ret;
    }
    salt = 1;
    return DeviceKey::get_instance().generate_derived_key(&salt, 1, privkey + 16, 16);
/*    size_t key_size;
    int ret = kv_get(ISSUER_KEY_PATH, privkey, ETHERS_PRIVATEKEY_LENGTH, &key_size);
    if(ret == MBED_ERROR_ITEM_NOT_FOUND) {
        ret = rng(privkey, ETHERS_PRIVATEKEY_LENGTH);
        if(ret != MBED_SUCCESS) {
            return ret;
        }
        ret = kv_set(ISSUER_KEY_PATH, privkey, 32, 0);
    }
    return ret;*/
}

int get_issuer_address(address_t address) {
    privkey_t privkey;
    int ret = get_issuer_key(privkey);
    if(ret != MBED_SUCCESS) {
        return ret;
    }

    if(!ethers_privateKeyToAddress(privkey, address)) {
        return MBED_ERROR_FAILED_OPERATION;
    }
    return MBED_SUCCESS;
}

int get_stored_nonce(uint32_t *nonce) {
    size_t key_size;
    int ret = kv_get(NEXT_NONCE_KEY_PATH, nonce, sizeof(uint32_t), &key_size);
    if(ret == MBED_ERROR_ITEM_NOT_FOUND) {
        *nonce = 0;
        ret = MBED_SUCCESS;
    }
    return ret;
}

int set_stored_nonce(uint32_t nonce) {
    return kv_set(NEXT_NONCE_KEY_PATH, &nonce, sizeof(uint32_t), 0);
}

int reset_store() {
    return kv_reset("/kv");
}

int get_next_nonce(uint32_t *nonce) {
    if(next_nonce == 0xffffffff) {
        int ret = get_stored_nonce(&next_nonce);
        if(ret != MBED_SUCCESS) {
            return ret;
        }
    }

    *nonce = next_nonce;

    if((next_nonce & 0xff) == 0) {
        // We're about to start a new block of nonces; update storage
        int ret = set_stored_nonce(next_nonce + 256);
        if(ret != MBED_SUCCESS) {
            return ret;
        }
    }

    next_nonce++;

    return MBED_SUCCESS;
}
