import { expect } from "chai";
import { ContractFactory, ContractTransaction } from "ethers";

export function parseMetadata(datauri: string) {
    expect(datauri).to.match(/^data:application\/json;base64,/);
    return JSON.parse(atob(datauri.split(',')[1]));
}
export async function getClone<F extends ContractFactory>(call: Promise<ContractTransaction>, factory: F): Promise<ReturnType<F['attach']>> {
    const tx = await call;
    const receipt = await tx.wait();
    let address = null;
    if (receipt.events) {
        for (const event of receipt.events) {
            if (event.event === "Cloned") {
                address = event ?.args ?.instance;
                break;
            }
        }
    }
    if (address !== null) {
        return factory.attach(address) as ReturnType<F['attach']>;
    }
    throw new Error("Not a clone creation transaction");
}
