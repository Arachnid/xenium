#ifndef NDEF_H
#define NDEF_H

#include <stdint.h>
#include <Span.h>

using mbed::Span;

#define NDEF_MESSAGE_BEGIN 0x80
#define NDEF_MESSAGE_END 0x40
#define NDEF_CHUNKED 0x20

#define NDEF_TNF_EMPTY 0x00
#define NDEF_TNF_WELL_KNOWN 0x01
#define NDEF_TNF_MIME 0x02
#define NDEF_TNF_URI 0x03
#define NDEF_TNF_EXTERNAL 0x04
#define NDEF_TNF_UNCHANGED 0x06

int write_ndef_record(uint8_t *out, int outlen, uint8_t flags, Span<uint8_t> type, Span<uint8_t> payload, Span<uint8_t> id);

#endif