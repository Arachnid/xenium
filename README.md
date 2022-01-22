# Xenium
Xenium is a noninteractive protocol for producing and redeeming single-use claim codes.

What this means in practice is that you can have a device - software or hardware - that produces a (potentially) infinite sequence of unique URLs. Each URL can be used for a single 'claim' - which can have an effect such as transferring a token (ERC20, ERC721, ERC1155...) or anything else you like. Once a claim code is used, it can't be used again, and the protocol is noninteractive - meaning that the device doing the issuing doesn't need two-way communcation with the device and user making the claim.

Claim codes are commonly displayed as QR codes or transmitted over NFC, but any system that allows sending a link to someone will work. You can even print claim codes off on paper and hand them out.

The main components of a Xenium deployment are:

 - An issuer, which produces claim codes.
 - A claimant, who takes a claim code, converts it into a valid claim, and submits it to the blockchain.
 - A validator, a smart contract that verifies a claim and acts on it.

## [xenium-js](packages/Xenium-js)

Xenium-js is a Typescript library that provides functionality for two use-cases:

 - Claim code generation - this functionality lets you implement a Xenium 'issuer' that generates claim codes using a signing key.
 - Claim code redemption - this functionality lets you convert a claim code into a valid claim transaction that can be submitted to the blockchain.

## [validator](packages/validator)

The validator package implements a kind of 'construction kit' for building validator smart contracts. It consists of a set of building blocks that handle specific parts of the validation process - determining which issuers are allowed to issue claims, checking uniqueness of claims, and acting on them - and makes it easy to combine the primitives that suit your application to create a validator that meets your needs.

The library also includes a set of 'factory' contracts that produce commonly used validator types. These will be deployed on Ethereum and other Ethereum-compatible networks for general use once they are mature.

## [arm32-issuer](packages/arm32-issuer)

The arm32-issuer repository contains firmware for a physical claim code issuer. The code is written for the STM32L4x3 series of microcontrollers, but should be easily ported to any other system that supports the MBED platform.
