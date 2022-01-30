import { NextPage } from "next";
import { useRouter } from "next/router";
import { Web3ModalButton } from "./Web3ModalButton";

const Web3Layout : NextPage = ({ children }) => {
    const router = useRouter();
    const network = router.query.network;

    if(network) {
        return (<>
            <Web3ModalButton network={router.query.network as string} />
            {children}
        </>);
    } else {
        return (<>{children}</>);
    }
}

export default Web3Layout;
