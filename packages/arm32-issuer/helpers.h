#ifndef HELPERS_H
#define HELPERS_H

#include <stdio.h>
#include <stdint.h>

// small helper functions that prints 
// data in hex to the serial port
void print_hex(const uint8_t * data, size_t data_len);

// just adds a new line to the end of the data
void println_hex(const uint8_t * data, size_t data_len);

// prints error and hangs forever
void err(const char * message, void * data = NULL);

void stop();

#endif