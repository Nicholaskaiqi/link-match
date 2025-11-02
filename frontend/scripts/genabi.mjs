import fs from "fs";
import path from "path";

// Simple ABI generator - reads from backend deployments
const BACKEND_DEPLOYMENTS_PATH = path.join(
  process.cwd(),
  "../backend/deployments"
);

const CONTRACT_NAME = "LinkMatch";

// Network configuration with chain IDs
const NETWORKS = [
  { name: "sepolia", chainId: 11155111 },
  { name: "localhost", chainId: 31337 },
  { name: "hardhat", chainId: 31337 },
];

/**
 * Get deployment info for all available networks
 * Automatically skips networks that don't have deployments
 */
function getAllDeploymentInfo() {
  const deployments = {};
  
  for (const network of NETWORKS) {
    const deploymentPath = path.join(
      BACKEND_DEPLOYMENTS_PATH,
      network.name,
      `${CONTRACT_NAME}.json`
    );
    
    if (fs.existsSync(deploymentPath)) {
      try {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
        const chainId = deployment.chainId || network.chainId;
        
        deployments[chainId.toString()] = {
          address: deployment.address,
          chainId: chainId,
          chainName: network.name,
        };
        
        console.log(`Found deployment for ${network.name} (chainId: ${chainId}): ${deployment.address}`);
      } catch (error) {
        console.warn(`Failed to read deployment for ${network.name}: ${error.message}`);
      }
    } else {
      console.log(`Skipping ${network.name} - no deployment found`);
    }
  }
  
  return deployments;
}

/**
 * Get ABI from any available deployment
 * Tries networks in order of priority: sepolia > localhost > hardhat
 */
function getABI() {
  const priorityNetworks = ["sepolia", "localhost", "hardhat"];
  
  for (const networkName of priorityNetworks) {
    const artifactPath = path.join(
      BACKEND_DEPLOYMENTS_PATH,
      networkName,
      `${CONTRACT_NAME}.json`
    );
    
    if (fs.existsSync(artifactPath)) {
      try {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
        if (artifact.abi && artifact.abi.length > 0) {
          console.log(`Using ABI from ${networkName} deployment`);
          return artifact.abi;
        }
      } catch (error) {
        console.warn(`Failed to read ABI from ${networkName}: ${error.message}`);
      }
    }
  }
  
  console.warn("No ABI found in any deployment. Using empty ABI.");
  return [];
}

const deployments = getAllDeploymentInfo();
const abi = getABI();

const abiPath = path.join(process.cwd(), "abi", "LinkMatchABI.ts");
const addressesPath = path.join(process.cwd(), "abi", "LinkMatchAddresses.ts");

// Create abi directory if it doesn't exist
const abiDir = path.dirname(abiPath);
if (!fs.existsSync(abiDir)) {
  fs.mkdirSync(abiDir, { recursive: true });
}

// Write ABI file
const abiContent = `export const LinkMatchABI = {
  abi: ${JSON.stringify(abi, null, 2)},
} as const;
`;

fs.writeFileSync(abiPath, abiContent);

// Write addresses file with all found deployments
const addressesContent = `export const LinkMatchAddresses: Record<string, { address: string; chainId: number; chainName: string }> = ${JSON.stringify(deployments, null, 2)};
`;

fs.writeFileSync(addressesPath, addressesContent);

const deploymentCount = Object.keys(deployments).length;
console.log(`\nABI and addresses generated successfully!`);
console.log(`Found ${deploymentCount} deployment(s) across ${deploymentCount > 0 ? Object.values(deployments).map(d => d.chainName).join(", ") : "no networks"}`);

