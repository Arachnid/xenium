import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const factories = ['ERC20TransferUniqueNonceValidator'];

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployer} = await hre.getNamedAccounts();
    for(const factoryName of factories) {
        await hre.deployments.deploy(factoryName, {
            from: deployer,
            args: [],
            log: true,
        });
    }
};
func.tags = ['factories'];
export default func;
