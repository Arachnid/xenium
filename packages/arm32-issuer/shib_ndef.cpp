#include "shib_ndef.h"

#define NDEF_SHORT_RECORD 0x10
#define NDEF_ID_LENGTH_PRESENT 0x08

using mbed::Span;

int write_ndef_record(uint8_t *out, int outlen, uint8_t flags, Span<uint8_t> type, Span<uint8_t> payload, Span<uint8_t> id) {
    int off = 0;
    if(payload.size() < 256) {
        if(outlen < 4) return -1;
        out[0] = flags | NDEF_SHORT_RECORD | (id.size() > 0 ? NDEF_ID_LENGTH_PRESENT : 0);
        out[1] = type.size();
        out[2] = payload.size();
        off += 3;
        if(id.size() > 0) {
            out[3] = id.size();
            off += 1;
        }
    } else {
        if(outlen < 7) return -1;
        out[0] = flags | (id.size() > 0 ? NDEF_ID_LENGTH_PRESENT : 0);
        int payload_length = payload.size();
        out[1] = type.size();
        out[2] = payload_length >> 24;
        out[3] = (payload_length >> 16) & 0xff;
        out[4] = (payload_length >> 8) & 0xff;
        out[5] = payload_length & 0xff;
        off += 6;
        if(id.size() > 0) {
            out[6] = id.size();
            off += 1;
        }
    }
    if(outlen < off + type.size() + payload.size() + id.size()) return -1;
    memcpy(out + off, type.data(), type.size());
    off += type.size();
    memcpy(out + off, payload.data(), payload.size());
    off += payload.size();
    memcpy(out + off, id.data(), id.size());
    off += id.size();
    return off;
}
