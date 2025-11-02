import type {
  FhevmInstance,
  HandleContractPair,
  UserDecryptResults,
} from "@zama-fhe/relayer-sdk/bundle";
import type { FhevmInstanceConfig } from "@zama-fhe/relayer-sdk/web";

export type {
  FhevmInstance,
  FhevmInstanceConfig,
  HandleContractPair,
  UserDecryptResults,
};
// Backward compatibility alias
export type DecryptedResults = UserDecryptResults;

export type FhevmDecryptionSignatureType = {
  publicKey: string;
  privateKey: string;
  signature: string;
  startTimestamp: number; // Unix timestamp in seconds
  durationDays: number;
  userAddress: `0x${string}`;
  contractAddresses: `0x${string}`[];
  eip712: EIP712Type;
};

export type EIP712Type = {
  domain: {
    chainId: number;
    name: string;
    verifyingContract: `0x${string}`;
    version: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: any;
  primaryType: string;
  types: {
    [key: string]: {
      name: string;
      type: string;
    }[];
  };
};

export type FhevmRelayerSDKType = {
  initSDK: (options?: FhevmInitSDKOptions) => Promise<boolean>;
  createInstance: (config: FhevmInstanceConfig) => Promise<FhevmInstance>;
  // v0.2
  SepoliaConfig?: {
    aclContractAddress: string;
    inputVerifierContractAddress: string;
    kmsVerifierContractAddress: string;
  };
  // v0.3
  EthereumConfig?: {
    aclContractAddress: string;
    inputVerifierContractAddress: string;
    kmsVerifierContractAddress: string;
  };
  // some builds may expose ZamaEthereumConfig naming
  ZamaEthereumConfig?: {
    aclContractAddress: string;
    inputVerifierContractAddress: string;
    kmsVerifierContractAddress: string;
  };
  __initialized__?: boolean;
};

export type FhevmWindowType = {
  relayerSDK: FhevmRelayerSDKType;
};

export type FhevmInitSDKOptions = {
  network?: string | unknown;
};

export type FhevmInitSDKType = (
  options?: FhevmInitSDKOptions
) => Promise<boolean>;

export type FhevmLoadSDKType = () => Promise<void>;

