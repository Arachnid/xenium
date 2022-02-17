import { NextPage } from 'next'
import Head from 'next/head'
import styles from '../../styles/Home.module.css'
import { ClaimCode } from '@xenium-eth/xenium-js';
import { useRouter } from 'next/router';
import { ClaimMetadata, useNetwork } from '../../lib';
import { NetworkInfo } from '../../config';
import { useCall, useContractFunction, useNetwork as useConnectedNetwork } from '@usedapp/core';
import { ethers } from 'ethers';
import { Alert, AlertTitle, Box, CircularProgress, Grid, Paper, Typography } from '@mui/material';
import UnknownClaimInfo from '../../components/claims/UnknownClaimInfo';
import cbor from 'cbor';
import IValidator_abi from '@xenium-eth/validator/artifacts/contracts/IValidator.sol/IValidator.json';
import ERC20ClaimInfo from '../../components/claims/ERC20ClaimInfo';

const Container = (props: {name: string, children: JSX.Element}) => {
  return (<div className={styles.container}>
    <Head>
      <title>{props.name}</title>
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <main className={styles.main}>
      <Box sx={{ maxWidth: 'md' }}>
        <Grid container rowSpacing={5}>
          <Grid item xs={12}>
            <Typography variant="h1">
              {props.name}
            </Typography>
          </Grid>
          {props.children}
        </Grid>
      </Box>
    </main>
  </div>);
}

const UnknownNetwork = () => {
  return (<Container name="Unknown Network">
    <Grid item xs={12}>
      <Alert severity="error">
        <AlertTitle>Error</AlertTitle>
        This claim URL specified a network that we do not recognise.
      </Alert>
    </Grid>
  </Container>);
}

const InvalidClaimCode = () => {
  return (<Container name="Invalid Claim Code">
    <Grid item xs={12}>
      <Alert severity="error">
        <AlertTitle>Error</AlertTitle>
        The provided claim code is missing or invalid.
      </Alert>
    </Grid>
  </Container>);
}

const InvalidMetadata = () => {
  return (<Container name="Invalid Metadata">
    <Grid item xs={12}>
      <Alert severity="error">
        <AlertTitle>Error</AlertTitle>
        The validator contract responded with metadata we could not parse.
      </Alert>
    </Grid>
  </Container>);
}

const WrongNetwork = (props: {network: NetworkInfo}) => {
  return (<Container name="Wrong Network">
    <Grid item xs={12}>
      <Alert severity="error">
        <AlertTitle>Wrong Network</AlertTitle>
        Please connect to the {props.network.name} network to continue.
      </Alert>
    </Grid>
  </Container>)
}

const MetadataLoading = () => {
  return (<Container name="...">
    <Grid item xs={12}>
      <CircularProgress />
    </Grid>
  </Container>);
}

const ClaimElement = (props: {claimCode: ClaimCode}) => {
  const { claimCode } = props;
  const validator = new ethers.Contract(claimCode.validator, IValidator_abi.abi);
  const { send } = useContractFunction(validator, 'claim');
  const expectedNetwork = useNetwork();
  const { network } = useConnectedNetwork();

  const encodedMetadata = useCall(claimCode && {
    contract: validator,
    method: 'metadata',
    args: [claimCode?.issuer, claimCode?.validator, claimCode?.data]
  });

  if(expectedNetwork !== undefined && network.chainId !== undefined && expectedNetwork?.chainId !== network.chainId) {
    return <WrongNetwork network={expectedNetwork} />;
  }

  if(encodedMetadata && !encodedMetadata.value) {
    return <InvalidMetadata />;
  }

  let metadata: ClaimMetadata | undefined;
  try {
    metadata = encodedMetadata ? cbor.decodeFirstSync(ethers.utils.arrayify(encodedMetadata.value[0])) : undefined;
  } catch (e) {
    return <InvalidMetadata />;
  }

  if(metadata) {
    metadata.claimtype = metadata?.claimtype || ("ERC" + (metadata as any)?.tokentype);
  }
  return (
    <Container name={metadata ? (metadata.title || "Unknown Claim") : "..."}><>
      {metadata && metadata.description && <Grid item xs={12}>{metadata.description}</Grid>}
      <Grid item xs={12}>
        <Alert severity="warning">
          Metadata is self-reported by the contract and may not be accurate.
        </Alert>
      </Grid>
      <Grid item xs={12}>
        <Paper sx={{padding: (theme) => theme.spacing(2)}}>
          {(() => {
            switch(metadata?.claimtype) {
            case undefined:
              return <CircularProgress />;
            case 'ERC20':
              return <ERC20ClaimInfo claimCode={claimCode} validator={validator} metadata={metadata!} />
            default:
              return <UnknownClaimInfo claimCode={claimCode} validator={validator} metadata={metadata!} />
            }
          })()}
        </Paper>
      </Grid>
    </></Container>
  );
};

const Home: NextPage = () => {
  const router = useRouter();

  const hash = router.asPath.match(/#[A-Z0-9]+/gi);
  if(!hash) {
    return <InvalidClaimCode />;
  }

  let claimCode: ClaimCode;
  try {
    claimCode = ClaimCode.fromString(hash[0].slice(1));
  } catch (e) {
    return <InvalidClaimCode />;
  }

  return <ClaimElement claimCode={claimCode} />;
}

export default Home
