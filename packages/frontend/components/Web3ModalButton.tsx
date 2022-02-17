import React, { useEffect, useState } from 'react'
import { useEthers, getChainById } from '@usedapp/core'
import { Alert, Button, ButtonProps } from '@mui/material'
import Web3Modal from 'web3modal'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { NetworkInfo, NETWORKS } from '../config';

export const Web3ModalButton = (props: {network: NetworkInfo, message: string, buttonProps?: Partial<ButtonProps>}) => {
  const { account, activate, deactivate } = useEthers()
  const [activateError, setActivateError] = useState('')
  const { error } = useEthers()
  useEffect(() => {
    if (error) {
      setActivateError(error.message)
    }
  }, [error])

  const activateProvider = async () => {
    const providerOptions = {
      injected: {
        display: {
          name: 'Metamask',
          description: 'Connect with the provider in your Browser',
        },
        package: null,
      },
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          bridge: 'https://bridge.walletconnect.org',
          rpc: NETWORKS,
        },
      },
    }

    const web3Modal = new Web3Modal({
      network: getChainById(props.network.chainId)?.chainName,
      providerOptions,
    })
    const provider = await web3Modal.connect()
    await activate(provider)
  }

  return (
    <>
      {activateError && <Alert severity="error">{activateError}</Alert>}
      {account ? (
        <Button onClick={() => deactivate()} {...props.buttonProps}>Disconnect</Button>
      ) : (
        <Button onClick={activateProvider} {...props.buttonProps}>{props.message}</Button>
      )}
    </>
  )
}
