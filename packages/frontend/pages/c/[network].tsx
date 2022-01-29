import { NextPage } from 'next'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import styles from '../../styles/Home.module.css'
import { ClaimCode, buildClaim } from '@xenium-eth/xenium-js';
import { Button } from 'antd';
import { abi as IValidator_abi } from '@xenium-eth/validator/artifacts/contracts/IValidator.sol/IValidator.json';
import { useContractFunction, useEthers } from '@usedapp/core';
import { ethers } from 'ethers';
import { Web3ModalButton } from '../../components/Web3ModalButton';
import { useRouter } from 'next/router';

const DEFAULT_VALIDATOR = "0x0000000000000000000000000000000000000000";
const IValidator = new ethers.Contract(DEFAULT_VALIDATOR, IValidator_abi);

const Home: NextPage = () => {
  const router = useRouter();
  const [claimCode, setClaimCode] = useState<ClaimCode|undefined>(undefined);
  const { account } = useEthers();
  const { send } = useContractFunction(IValidator.attach(claimCode?.validator || DEFAULT_VALIDATOR), 'claim');
  useEffect(() => {
    try {
      setClaimCode(ClaimCode.fromString(window.location.hash.slice(1)));
    } catch(e) {
      console.log(e);
    }
  }, []);

  function makeClaim() {
    const claim = buildClaim(account as string, claimCode as ClaimCode);
    send(...claim);
  }

  let content: JSX.Element;
  if(claimCode === undefined) {
    content = <div>Invalid claim code</div>;
  } else {
    content = <Button type="primary" onClick={makeClaim}>Claim</Button>;
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Xenium Token Claim</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Web3ModalButton network={router.query.network} />
      <main className={styles.main}>
        <h1 className={styles.title}>
          Token Claim
        </h1>
        {content}
      </main>
    </div>
  )
}

export default Home
