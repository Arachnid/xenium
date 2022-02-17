import { DAppProvider, Config, Rinkeby } from '@usedapp/core'
import { EmotionCache } from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import '../styles/globals.css';
import "@fontsource/poppins";
import type { AppProps } from 'next/app'
import { NETWORKS } from '../config';
import createEmotionCache from '../lib/createEmotionCache';
import { ThemeProvider, CssBaseline } from '@mui/material';
import lightTheme from '../styles/theme/lightTheme';

const clientSideEmotionCache = createEmotionCache();

const config: Config = {
  readOnlyChainId: Rinkeby.chainId,
  readOnlyUrls: Object.fromEntries(Object.values(NETWORKS).map((network) => [network.chainId, network.provider])),
};

function MyApp({ Component, pageProps, emotionCache = clientSideEmotionCache }: AppProps & {emotionCache?: EmotionCache}) {
  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={lightTheme}>
        <CssBaseline />
        <DAppProvider config={config}>
          <Component {...pageProps} />
        </DAppProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}

export default MyApp
