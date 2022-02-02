#ifndef STORAGE_H
#define STORAGE_H
#include "types.h"
#include <stdint.h>

int reset_store();

int get_issuer_key(privkey_t privkey);

int get_issuer_address(address_t address);

int get_next_nonce(uint32_t *nonce);

#endif