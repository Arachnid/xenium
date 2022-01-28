#import "st25.h"
#include <arm_acle.h>
#include <alloca.h>

#define CC_MAGIC_NUMBER_SHORT 0xE1
#define CC_MAGIC_NUMBER_LONG 0xE2
#define CC_VERSION 0x40
#define CC_READONLY 0x03
#define CC_MBREAD 0x01
#define CC_ANDROID_RFU 0x04
#define CC_SPECIAL_FRAME 0x10

#define ADDRESS_USER_MEM 0xA6
#define ADDRESS_REGISTERS 0xAE

ST25::ST25(PinName sda, PinName scl) : i2c(sda, scl) {}

int write_capability_container(uint8_t *out, uint16_t mlen, bool readonly, bool mbread) {
    out[0] = CC_MAGIC_NUMBER_SHORT;
    out[1] = CC_VERSION | (readonly ? CC_READONLY : 0x00);
    out[3] = CC_SPECIAL_FRAME | CC_ANDROID_RFU | (mbread ? CC_MBREAD : 0x00);
    if(mlen <= 255) {
        out[2] = mlen;
        return 4;
    } else {
        out[2] = 0x00;
        out[4] = 0x00;
        out[5] = 0x00;
        out[6] = mlen >> 8;
        out[7] = mlen & 0xFF;
        return 8;
    }
}

int ST25::format(uint16_t mlen, bool readonly, bool mbread) {
    int len = write_capability_container(cc, mlen, readonly, mbread);
    return write(Span<uint8_t>(cc, len), 0x00);
}

int ST25::read(uint8_t *data, uint16_t len, uint16_t addr) {
    return read(data, len, addr, ADDRESS_REGISTERS);
}

int ST25::read_register(uint16_t addr) {
    uint8_t reg;
    int ret = read(&reg, 1, addr, ADDRESS_REGISTERS);
    if(ret < 0) {
        return ret;
    }
    return reg;
}

int ST25::read_dynamic_register(uint16_t addr) {
    uint8_t reg;
    int ret = read(&reg, 1, addr, ADDRESS_USER_MEM);
    if(ret < 0) {
        return ret;
    }
    return reg;
}

int ST25::write(const Span<const uint8_t> &data, uint16_t addr) {
    return write(data, addr, ADDRESS_USER_MEM);
}

int ST25::write_register(uint8_t data, uint16_t addr) {
    return write(Span<uint8_t>(&data, 1), addr, ADDRESS_REGISTERS);
}

int ST25::write_dynamic_register(uint8_t data, uint16_t addr) {
    return write(Span<uint8_t>(&data, 1), addr, ADDRESS_USER_MEM);
}

void ST25::wait() {
    while(true) {
        if(i2c.write(ADDRESS_USER_MEM, NULL, 0) == 0) {
            return;
        }
        sleep();
    }
}

int ST25::write_ndef(const Span<const uint8_t> &data) {
    int len = data.size();
    int cclen = cc_length();
    if(cclen <= 0) {
        return cclen;
    }
    if(len < 255) {
        uint8_t *buf = (uint8_t*)alloca(len + 3);
        buf[0] = 0x03;
        buf[1] = len;
        memcpy(buf + 2, data.data(), len);
        buf[len + 2] = 0xFE;
        return write(Span<uint8_t>(buf, len + 2), cclen);
    } else {
        uint8_t *buf = (uint8_t*)alloca(len + 5);
        buf[0] = 0x03;
        buf[1] = 0xFF;
        buf[2] = (len >> 8) & 0xFF;
        buf[3] = len & 0xFF;
        memcpy(buf + 4, data.data(), len);
        buf[len + 4] = 0xFE;
        return write(Span<uint8_t>(buf, len + 4), cclen);
    }
}


int ST25::unlock(uint64_t passcode) {
    uint8_t buf[17];
    memcpy(buf, &passcode, 8);
    buf[8] = 0x09;
    memcpy(buf + 9, &passcode, 8);
    return write(Span<uint8_t>(buf, sizeof(buf)), ST25_REG_I2C_PWD, ADDRESS_REGISTERS);
}

int ST25::read_cc() {
    if(cc[0] == 0) {
        int ret = read(cc, 8, 0x00);
        if(ret != 0) {
            return MBED_ERROR_READ_FAILED;
        }
    }
    return 0;
}

int ST25::cc_length() {
    int ret = read_cc();
    if(ret != 0) {
        return -1;
    }
    switch(cc[0]) {
    case CC_MAGIC_NUMBER_SHORT:
        return 4;
    case CC_MAGIC_NUMBER_LONG:
        return 8;
    default:
        return -1;
    }
}

int ST25::write(const Span<const uint8_t> &data, uint16_t addr, uint8_t i2c_addr) {
    char buf[258];
    uint16_t idx = 0;
    int len = data.size();
    while(len > 0) {
        uint16_t writelen = len < 256 ? len : 256;
        uint16_t st25_addr = __rev16(addr + idx);
        memcpy(buf, (char*)&st25_addr, 2);
        memcpy(buf + 2, data.data() + idx, writelen);
        int ret = i2c.write(i2c_addr, buf, writelen + 2);
        if(ret != 0) {
            return ret;
        }
        idx += writelen;
        len -= writelen;
        wait();
    }
    return 0;
}

int ST25::read(uint8_t *data, uint16_t len, uint16_t addr, uint8_t i2c_addr) {
    uint16_t st25_addr = __rev16(addr);
    int ret = i2c.write(i2c_addr, (char*)&st25_addr, 2);
    if(ret != 0) {
        return ret;
    }
    return i2c.read(i2c_addr, (char*)data, len);
}