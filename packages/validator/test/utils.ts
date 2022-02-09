import { ContractFactory, ContractTransaction } from "ethers";

export async function getClone<F extends ContractFactory>(call: Promise<ContractTransaction>, factory: F): Promise<ReturnType<F['attach']>> {
    const tx = await call;
    const receipt = await tx.wait();
    let address = null;
    if (receipt.events) {
        for (const event of receipt.events) {
            if (event.event === "Cloned") {
                address = event?.args?.instance;
                break;
            }
        }
    }
    if (address !== null) {
        return factory.attach(address) as ReturnType<F['attach']>;
    }
    throw new Error("Not a clone creation transaction");
}
