#include "helpers.h"
#include "mbed.h"

// small helper functions that prints 
// data in hex to the serial port
void print_hex(const uint8_t * data, size_t data_len){
    for(int i=0; i<data_len; i++){
        printf("%02x", data[i]);
    }
}
// just adds a new line to the end of the data
void println_hex(const uint8_t * data, size_t data_len){
    print_hex(data, data_len);
    printf("\r\n");
}
// prints error and hangs forever
void err(const char * message, void * data){
    printf("ERROR: %s\r\n", message);
    while(1){
        sleep();
    }
}

void stop() {
    while(true) sleep();
}
