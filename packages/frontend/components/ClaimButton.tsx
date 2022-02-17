import { ClaimCode } from "@xenium-eth/xenium-js";
import { Button } from "@mui/material";
import { ethers } from "ethers";
import { Web3ModalButton } from "./Web3ModalButton";
import { useEthers } from "@usedapp/core";
import { useNetwork } from "../lib";

interface Props {
  claimCode: ClaimCode;
  validator: ethers.Contract;
}

const ClaimButton = (props: Props) => {
  const { claimCode, validator } = props;
  const { account } = useEthers();
  const network = useNetwork();

  function onClick() {

  }

  if(!network) {
    return <div>Unknown Network</div>;
  } else if(account) {
    return <Button variant = "contained" onClick = { onClick }>Claim</Button>;
  } else {
    return <Web3ModalButton network={network} message="Connect to claim" buttonProps={{ variant: "contained" }} />;
  }
}

export default ClaimButton;
