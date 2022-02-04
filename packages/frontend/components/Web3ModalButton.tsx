import React, { useEffect, useState } from 'react'
import { useEthers, shortenAddress, useLookupAddress } from '@usedapp/core'
import { Button } from 'antd'
import styled from 'styled-components'
import Web3Modal from 'web3modal'

import WalletConnectProvider from '@walletconnect/web3-provider'
import { NETWORKS } from '../config';

export const Web3ModalButton = (props: {network: string}) => {
  const { account, activate, deactivate } = useEthers()
  const ens = useLookupAddress()
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
      network: props.network,
      providerOptions,
    })
    const provider = await web3Modal.connect()
    await activate(provider)
  }

  return (
    <Account>
      <ErrorWrapper>{activateError}</ErrorWrapper>
      {account ? (
        <>
          <AccountLabel>{ens ?? shortenAddress(account)}</AccountLabel>
          <LoginButton onClick={() => deactivate()}>Disconnect</LoginButton>
        </>
      ) : (
        <LoginButton onClick={activateProvider}>Connect</LoginButton>
      )}
    </Account>
  )
}

const ErrorWrapper = styled.div`
  color: #ff3960;
  margin-right: 40px;
  margin-left: 40px;
  overflow: auto;
`

const Account = styled.div`
  display: flex;
  align-items: center;
`

const LoginButton = styled(Button)`
  background-color: #FFF4D4;
`

const AccountLabel = styled(Button)`
  height: 32px;
  margin-right: -40px;
  padding-right: 40px;
  padding-left: 8px;
  background-color: #FFF4D4;
  font-size: 12px;
`