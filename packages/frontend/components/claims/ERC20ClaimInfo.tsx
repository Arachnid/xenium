import { useToken } from "@usedapp/core";
import { ClaimCode } from "@xenium-eth/xenium-js";
import { Grid } from "@mui/material";
import { ethers } from "ethers";
import { ClaimMetadata, useNetwork } from "../../lib";
import ClaimButton from "../ClaimButton";
import PropertiesCard, { Property } from "./PropertiesCard";

interface Props {
  claimCode: ClaimCode;
  validator: ethers.Contract;
  metadata: ClaimMetadata;
}

const ERC20ClaimInfo = (props: Props) => {
  const { claimCode, validator, metadata } = props;
  if (!metadata.resource) {
    metadata.resource = (metadata as any).token;
  }
  const tokenInfo = useToken(metadata.resource && ethers.utils.hexlify(metadata.resource));

  let properties: Property[] = [];

  if (tokenInfo) {
    properties.push({
      name: 'Token',
      value: <a href="https://etherscan.io/account/{metadata.resource}">{tokenInfo.symbol}</a>,
    });
    if (metadata.amount && tokenInfo.decimals) {
      properties.push({
        name: 'Amount',
        value: ethers.utils.formatUnits(metadata.amount, tokenInfo.decimals),
      })
    }
  }
  if (metadata.properties) {
    properties = properties.concat(metadata.properties);
  }

  return (
    <Grid container spacing={2}>
      <Grid item xs={6}>
        <PropertiesCard properties={properties} loading={tokenInfo === undefined} />
      </Grid>
      <Grid item xs={6} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <ClaimButton claimCode={claimCode} validator={validator} />
      </Grid>
    </Grid>
  );
}

export default ERC20ClaimInfo;