#ifndef TYPES_H
#define TYPES_H
#include <stdint.h>
#include "ethers.h"

#define SEED_LENGTH 16

typedef uint8_t address_t[ETHERS_ADDRESS_LENGTH];
typedef uint8_t hash_t[ETHERS_KECCAK256_LENGTH];
typedef uint8_t privkey_t[ETHERS_PRIVATEKEY_LENGTH];
typedef uint8_t pubkey_t[ETHERS_PUBLICKEY_LENGTH];
typedef uint8_t sig_t[64];
typedef uint8_t seed_t[SEED_LENGTH];

#endif