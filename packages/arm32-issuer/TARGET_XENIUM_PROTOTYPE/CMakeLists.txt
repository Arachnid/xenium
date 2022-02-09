# Copyright (c) 2020 ARM Limited. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

add_library(mbed-xenium-prototype INTERFACE)

target_include_directories(mbed-xenium-prototype
    INTERFACE
        .
)

target_sources(mbed-xenium-prototype
    INTERFACE
        PeripheralPins.c
)

target_link_libraries(mbed-xenium-prototype INTERFACE mbed-stm32f411xe)
