import { NextPage } from "next";
import Head from "next/head";
import CreateValidator from "../components/CreateValidator";
import Web3Layout from "../components/Web3Layout";
import styles from '../styles/Home.module.css'

const Configure: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>Create or Configure a Validator</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Web3Layout>
        <main className={styles.main}>
          <h1 className={styles.title}>
            Create or Configure a Validator
          </h1>
          <CreateValidator />
          {/* <ConfigureValidator /> */}
        </main>
      </Web3Layout>
    </div>
  );
}

export default Configure;
