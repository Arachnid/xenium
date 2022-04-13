import { getChainById } from "@usedapp/core";
import { NextPage } from "next";
import { useNetwork } from "../lib";
import { Web3ModalButton } from "./Web3ModalButton";

const Web3Layout : NextPage = ({ children }) => {
    const network = useNetwork();

    if(network) {
        return (<>
            <Web3ModalButton network={network} message="Connect" />
            {children}
        </>);
    } else {
        return (<>{children}</>);
    }
}

export default Web3Layout;
