import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as fs from "fs";
import * as path from "path";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedLinkMatch = await deploy("LinkMatch", {
    from: deployer,
    log: true,
  });

  console.log(`LinkMatch contract: `, deployedLinkMatch.address);

  // Export deployed address to frontend
  try {
    const networkName = hre.network.name;
    const chainIdStr = await hre.getChainId();
    const chainId = Number(chainIdStr);

    const outFile = path.resolve(__dirname, "../../frontend/abi/LinkMatchAddresses.ts");

    // Ensure directory exists
    fs.mkdirSync(path.dirname(outFile), { recursive: true });

    const fileContent =
      `export const LinkMatchAddresses: Record<string, { address: string; chainId: number; chainName: string }> = {\n` +
      `  "${chainId}": { address: "${deployedLinkMatch.address}", chainId: ${chainId}, chainName: "${networkName}" }\n` +
      `};\n`;

    fs.writeFileSync(outFile, fileContent, { encoding: "utf8" });
    console.log(`Exported LinkMatch address to ${outFile}`);
  } catch (e) {
    console.warn("Failed to export address to frontend:", e);
  }
};
export default func;
func.id = "deploy_linkMatch"; // id required to prevent reexecution
func.tags = ["LinkMatch"];

