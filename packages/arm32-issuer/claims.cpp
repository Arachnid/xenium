#include "claims.h"
#include "helpers.h"
#include "mbed.h"
#include "mbed_error.h"
#include "ethers.h"
#include "base32.h"
#include "types.h"
#include "config.h"
#include "DeviceKey.h"

/**
 * RLE-encodes zero bytes in 'data', outputting the result to 'ret'.
 * 'ret' must be at least 1.5 times the length of 'data', rounding up.
 * 'ret' and 'data' may overlap as long as the first ceil(datalen/2)
 * elements of 'ret' do not overlap with 'data'.
 */
int rle_encode(uint8_t *ret, uint8_t *data, size_t datalen) {
    int count = 0;
    int idx = 0;
    for(int i = 0; i < datalen; i++) {
        if(data[i] == 0) {
            count++;
        }
        if((data[i] != 0 && count > 0) || count == 256) {
            ret[idx++] = 0;
            ret[idx++] = count - 1;
            count = 0;
        }
        if(data[i] != 0) {
            ret[idx++] = data[i];
        }
    }
    if(count > 0) {
        ret[idx++] = 0;
        ret[idx++] = count - 1;
    }
    return idx;
}

typedef struct {
    uint8_t prefix[2];
    address_t validator;
    hash_t datahash;
    address_t claimant;
} auth_message_t;

int get_auth_sig(privkey_t signer, address_t validator, uint8_t* data, size_t datalen, address_t claimant, sig_t sig) {
    auth_message_t message;
    hash_t messagehash;

    message.prefix[0] = 0x19;
    message.prefix[1] = 0x00;
    memcpy(&message.validator, validator, sizeof(address_t));
    ethers_keccak256(data, datalen, message.datahash);
    memcpy(&message.claimant, claimant, sizeof(address_t));

    ethers_keccak256((uint8_t*)&message, sizeof(auth_message_t), messagehash);

    if(!ethers_sign(signer, messagehash, sig)) {
        return MBED_ERROR_FAILED_OPERATION;
    }
    return MBED_SUCCESS;
}

int generate_claim_code(privkey_t issuer_key, address_t validator, uint32_t nonce, char *claimcode) {
    claimcode_t claim;
    privkey_t claimant_privkey;
    address_t claimant_address;

    // Copy the validator field into the claim code
    memcpy(claim.validator, validator, sizeof(address_t));

    // Generate a claim seed
    int ret = DeviceKey::get_instance().generate_derived_key((uint8_t*)&nonce, sizeof(nonce), claim.claimseed, SEED_LENGTH);
    if(ret != MBED_SUCCESS) {
        return ret;
    }

    // Convert the seed to a private key
    ethers_keccak256(claim.claimseed, SEED_LENGTH, claimant_privkey);

    // Obtain the address for the private key
    if(!ethers_privateKeyToAddress(claimant_privkey, claimant_address)) {
        return MBED_ERROR_FAILED_OPERATION;
    }

    // Retrieve and encode nonce in the data field.
    memset(claim.data, 0, 48);
    *((uint32_t*)(claim.data+44)) = __REV(nonce);
    claim.datalen = rle_encode(claim.data, claim.data + 16, 32);

    // Generate the auth sig
    ret = get_auth_sig(issuer_key, claim.validator, claim.data, claim.datalen, claimant_address, claim.auth_sig);
    if(ret != MBED_SUCCESS) {
        return ret;
    }

    int claim_len = sizeof(claimcode_t) - 52 + claim.datalen;
    base32_encode((uint8_t*)&claim, claim_len, (uint8_t*)claimcode, CLAIMCODE_LEN);
    printf("%s\n", claimcode);

    return MBED_SUCCESS;
}
