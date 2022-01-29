import { Mainnet, DAppProvider, useEtherBalance, useEthers, Config, Rinkeby } from '@usedapp/core'
import '../styles/globals.css'
import 'antd/dist/antd.css';
import type { AppProps } from 'next/app'
import { NETWORKS } from '../config';

const config: Config = {
  readOnlyChainId: Rinkeby.chainId,
  readOnlyUrls: NETWORKS,
  autoConnect: false,
}

function MyApp({ Component, pageProps }: AppProps) {
  return <DAppProvider config={config}><Component {...pageProps} /></DAppProvider>
}

export default MyApp
