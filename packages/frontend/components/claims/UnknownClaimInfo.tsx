import { useEthers } from "@usedapp/core";
import { ClaimCode } from "@xenium-eth/xenium-js";
import { Grid, Paper } from "@mui/material";
import { ethers } from "ethers";
import { ClaimMetadata, useNetwork } from "../../lib";
import ClaimButton from "../ClaimButton";
import { Web3ModalButton } from "../Web3ModalButton";
import PropertiesCard from "./PropertiesCard";

interface Props {
    claimCode: ClaimCode;
    validator: ethers.Contract;
    metadata: ClaimMetadata;
}

const UnknownClaimInfo = (props: Props) => {
    const { claimCode, validator, metadata } = props;
    const network = useNetwork();
    const { account } = useEthers();
    
    return (<Paper>
        <Grid container spacing={2}>
            <Grid item xs={6}>
                <PropertiesCard properties={metadata.properties} loading={false} />
            </Grid>
            <Grid item xs={6}>
                {account
                    ? <ClaimButton claimCode={claimCode} validator={validator} />
                    : (network
                        ? <Web3ModalButton network={network} message="Connect to claim" buttonProps={{variant: "contained"}} />
                        : <div>Unknown Network</div>
                    )
                }
            </Grid>
        </Grid>
    </Paper>);
}

export default UnknownClaimInfo;