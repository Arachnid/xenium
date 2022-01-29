import { Mainnet, DAppProvider, useEtherBalance, useEthers, Config, Rinkeby } from '@usedapp/core'
import '../styles/globals.css'
import 'antd/dist/antd.css';
import type { AppProps } from 'next/app'

const config: Config = {
  readOnlyChainId: Rinkeby.chainId,
  readOnlyUrls: {
    [Rinkeby.chainId]: 'https://rinkeby.infura.io/v3/f8f5536553f5466ba66ad3f0cb384b5e',
  },
}

function MyApp({ Component, pageProps }: AppProps) {
  return <DAppProvider config={config}><Component {...pageProps} /></DAppProvider>
}

export default MyApp
