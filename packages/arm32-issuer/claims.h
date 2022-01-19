#ifndef CLAIMS_H
#define CLAIMS_H

#include <stddef.h>
#include <stdint.h>
#include "types.h"

typedef struct {
    address_t validator;
    seed_t claimseed;
    sig_t auth_sig;
    uint8_t data[48];
    size_t datalen;
} claimcode_t;

#define BASE32_LEN(len)  (((len)/5)*8 + ((len) % 5 ? 8 : 0))
#define CLAIMCODE_LEN BASE32_LEN(sizeof(claimcode_t) - 4)

int generate_claim_code(privkey_t issuer_key, uint8_t claim_type, uint32_t nonce, char *claimcode);

#endif
