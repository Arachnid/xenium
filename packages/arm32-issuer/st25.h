#ifndef ST25_H
#define ST25_H

#import "mbed.h"

// EEPROM registers
#define ST25_REG_GPO            0x0000
#define ST25_REG_IT_TIME        0x0001
#define ST25_REG_EH_MODE        0x0002
#define ST25_REG_RF_MNGT        0x0003
#define ST25_REG_RFA1SS         0x0004
#define ST25_REG_ENDA1          0x0005
#define ST25_REG_RFA2SS         0x0006
#define ST25_REG_ENDA2          0x0007
#define ST25_REG_RFA3SS         0x0008
#define ST25_REG_ENDA3          0x0009
#define ST25_REG_RFA4SS         0x000A
#define ST25_REG_I2CSS          0x000B
#define ST25_REG_LOCK_CCFILE    0x000C
#define ST25_REG_MB_MODE        0x000D
#define ST25_REG_MB_WDG         0x000E
#define ST25_REG_LOCK_CFG       0x000F
#define ST25_REG_LOCK_DSFID     0x0010
#define ST25_REG_LOCK_AFI       0x0011
#define ST25_REG_DSFID          0x0012
#define ST25_REG_AFI            0x0013
#define ST25_REG_MEM_SIZE       0x0014
#define ST25_REG_BLK_SIZE       0x0016
#define ST25_REG_IC_REF         0x0017
#define ST25_REG_UID            0x0018
#define ST25_REG_IC_REV         0x0020
#define ST25_REG_I2C_PWD        0x0900

// Dynamic memory registers
#define ST25_DYN_GPO_CTRL       0x2000
#define ST25_DYN_EH_CTRL        0x2002
#define ST25_DYN_RF_MNGT        0x2003
#define ST25_DYN_I2C_SSO        0x2004
#define ST25_DYN_IT_STS         0x2005
#define ST25_DYN_MB_CTRL        0x2006
#define ST25_DYN_MB_LEN         0x2007

// Flags for GPO register
#define ST25_GPO_RF_USER_EN         0x01
#define ST25_GPO_RF_ACTIVITY_EN     0x02
#define ST25_GPO_RF_INTERRUPT_EN    0x04
#define ST25_GPO_FIELD_CHANGE_EN    0x08
#define ST25_GPO_RF_PUT_MSG_EN      0x10
#define ST25_GPO_RF_GET_MSG_EN      0x20
#define ST25_GPO_RF_WRITE_EN        0x40
#define ST25_GPO_EN                 0x80

// EH_MODE
#define ST25_EH_ON_DEMAND           0x01

// RF_MNGT
#define ST25_RF_DISABLE             0x01
#define ST25_RF_SLEEP               0x02

// IT_STS_DYN
#define ST25_IT_RF_USER             0x01
#define ST25_IT_RF_ACTIVITY         0x02
#define ST25_IT_RF_INTERRUPT        0x04
#define ST25_IT_FIELD_FALLING       0x08
#define ST25_IT_FIELD_RISING        0x10
#define ST25_IT_RF_PUT_MSG          0x20
#define ST25_IT_RF_GET_MSG          0x40
#define ST25_IT_RF_WRITE            0x80

// Flags for RFAxSS registers
#define ST25_RW                     0x00
#define ST25_R_OPEN_W_AUTH          0x04
#define ST25_RW_AUTH                0x08
#define ST25_R_AUTH                 0x0C

// LOCK_CCFILE
#define ST25_CCFILE_LCKBCK0         0x01
#define ST25_CCFILE_LCKBCK1         0x02

// MB_MODE
#define ST25_MB_MODE_OFF            0x00
#define ST25_MB_MODE_ON             0x01

// LOCK_CFG
#define ST25_CONFIG_UNLOCKED        0x00
#define ST25_CONFIG_LOCKED          0x01

// LOCK_DSFID
#define ST25_DSFID_UNLOCKED         0x00
#define ST25_DSFID_LOCKED           0x01

// LOCK_AFI
#define ST25_AFI_UNLOCKED           0x00
#define ST25_AFI_LOCKED             0x01

class ST25 {
    I2C i2c;
    uint8_t cc[8];
    
public:
    ST25(PinName sda, PinName scl);
    void wait();
    int format(uint16_t mlen, bool readonly, bool mbread);
    int read(uint8_t *data, uint16_t len, uint16_t addr);
    int read_register(uint16_t addr);
    int read_dynamic_register(uint16_t addr);
    int write(const Span<const uint8_t> &data, uint16_t addr);
    int write_register(uint8_t data, uint16_t addr);
    int write_dynamic_register(uint8_t data, uint16_t addr);
    int write_ndef(const Span<const uint8_t> &data);
    int unlock(uint64_t passcode);

private:
    int write(const Span<const uint8_t> &data, uint16_t addr, uint8_t i2c_addr);
    int read(uint8_t *data, uint16_t len, uint16_t addr, uint8_t i2c_addr);
    int cc_length();
    int read_cc();
};

#endif