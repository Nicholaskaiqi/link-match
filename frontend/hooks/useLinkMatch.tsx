"use client";

import { ethers } from "ethers";
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { LinkMatchABI } from "@/abi/LinkMatchABI";
import { LinkMatchAddresses } from "@/abi/LinkMatchAddresses";

// LinkMatch contract ABI
const LINKMATCH_ABI = LinkMatchABI.abi.length > 0 ? LinkMatchABI.abi : [
  "function submitGameResult(externalEuint32 encryptedScore, bytes calldata scoreProof) external",
  "function getPlayerResult(address player) external view returns (euint32 score)",
  "function getPlayerCount() external view returns (uint256)",
  "function getPlayerByIndex(uint256 index) external view returns (address)",
  "function hasSubmitted(address player) external view returns (bool)",
  "function getAllEncryptedScores() external view returns (address[] memory playerAddresses, euint32[] memory encryptedScores)",
];

export type GameResult = {
  score: number;        // Average matches per second (matches / timeSeconds)
  matches: number;      // Number of matches (for display only)
  timeSeconds: number;  // Time in seconds (for display only)
};

export type ClearValueType = {
  handle: string;
  clear: string | bigint | boolean;
};

type LinkMatchInfoType = {
  abi: typeof LINKMATCH_ABI;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

function getLinkMatchByChainId(
  chainId: number | undefined,
  contractAddress?: string
): LinkMatchInfoType {
  if (!chainId) {
    return { abi: LINKMATCH_ABI };
  }

  // First try to get address from LinkMatchAddresses by chainId
  const chainIdStr = chainId.toString();
  const deploymentInfo = LinkMatchAddresses[chainIdStr];
  
  // Use address from LinkMatchAddresses if available, otherwise use contractAddress parameter
  const address = deploymentInfo?.address || contractAddress;

  return {
    address: address as `0x${string}` | undefined,
    chainId,
    chainName: deploymentInfo?.chainName,
    abi: LINKMATCH_ABI,
  };
}

export const useLinkMatch = (parameters: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  eip1193Provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  sameChain: RefObject<(chainId: number | undefined) => boolean>;
  sameSigner: RefObject<
    (ethersSigner: ethers.JsonRpcSigner | undefined) => boolean
  >;
  contractAddress?: string;
}) => {
  const {
    instance,
    fhevmDecryptionSignatureStorage,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    contractAddress,
  } = parameters;

  const [playerResultHandle, setPlayerResultHandle] = useState<{
    score: string;
  } | undefined>(undefined);
  const [clearResult, setClearResult] = useState<{
    score: ClearValueType | undefined;
  } | undefined>(undefined);
  const clearResultRef = useRef<{
    score: ClearValueType | undefined;
  }>(undefined);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<Array<{
    address: string;
    encryptedScore: string;
  }>>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);

  const linkMatchRef = useRef<LinkMatchInfoType | undefined>(undefined);
  const isRefreshingRef = useRef<boolean>(isRefreshing);
  const isDecryptingRef = useRef<boolean>(isDecrypting);
  const isSubmittingRef = useRef<boolean>(isSubmitting);

  const linkMatch = useMemo(() => {
    const c = getLinkMatchByChainId(chainId, contractAddress);
    linkMatchRef.current = c;
    if (!c.address) {
      setMessage(`LinkMatch deployment not found for chainId=${chainId}.`);
    }
    return c;
  }, [chainId, contractAddress]);

  const isDeployed = useMemo(() => {
    if (!linkMatch) {
      return undefined;
    }
    return Boolean(linkMatch.address) && linkMatch.address !== ethers.ZeroAddress;
  }, [linkMatch]);

  const canGetResult = useMemo(() => {
    return linkMatch.address && ethersReadonlyProvider && !isRefreshing && ethersSigner;
  }, [linkMatch.address, ethersReadonlyProvider, isRefreshing, ethersSigner]);

  const refreshPlayerResult = useCallback(() => {
    if (isRefreshingRef.current) {
      return;
    }

    if (
      !linkMatchRef.current ||
      !linkMatchRef.current?.chainId ||
      !linkMatchRef.current?.address ||
      !ethersReadonlyProvider ||
      !ethersSigner
    ) {
      setPlayerResultHandle(undefined);
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    const thisChainId = linkMatchRef.current.chainId;
    const thisLinkMatchAddress = linkMatchRef.current.address;

    const thisLinkMatchContract = new ethers.Contract(
      thisLinkMatchAddress,
      linkMatchRef.current.abi,
      ethersReadonlyProvider
    );

    ethersSigner.getAddress().then((address) => {
      thisLinkMatchContract
        .getPlayerResult(address)
        .then((result: any) => {
          if (
            sameChain.current(thisChainId) &&
            thisLinkMatchAddress === linkMatchRef.current?.address
          ) {
            // Handle return value: may be string, array or bytes32
            let handleStr: string;
            if (Array.isArray(result)) {
              // If array, take the first element
              handleStr = result[0];
            } else if (typeof result === 'string') {
              handleStr = result;
            } else {
              // If bytes32 or other type, convert to hex string
              handleStr = ethers.hexlify(result);
            }
            
            // Ensure it's a valid hex string
            if (!handleStr || handleStr === '0x' || handleStr.length < 66) {
              setPlayerResultHandle(undefined);
            } else {
              setPlayerResultHandle({
                score: handleStr,
              });
            }
          }
          isRefreshingRef.current = false;
          setIsRefreshing(false);
        })
        .catch((e: Error) => {
          // If the player hasn't submitted yet, it's expected; do not show an error
          if (e.message && (e.message.includes("not submitted") || e.message.includes("revert"))) {
            setPlayerResultHandle(undefined);
          } else {
            setMessage("LinkMatch.getPlayerResult() call failed! error=" + e);
          }
          isRefreshingRef.current = false;
          setIsRefreshing(false);
        });
    });
  }, [ethersReadonlyProvider, ethersSigner, sameChain]);

  useEffect(() => {
    if (linkMatch.address && ethersSigner) {
      const contract = new ethers.Contract(
        linkMatch.address,
        linkMatch.abi,
        ethersReadonlyProvider || ethersSigner
      );
      ethersSigner.getAddress().then((address) => {
        contract.hasSubmitted(address).then((submitted: boolean) => {
          setHasSubmitted(submitted);
        });
      });
    }
  }, [linkMatch.address, ethersSigner, ethersReadonlyProvider]);

  const canDecrypt = useMemo(() => {
    return (
      linkMatch.address &&
      instance &&
      ethersSigner &&
      !isRefreshing &&
      !isDecrypting &&
      playerResultHandle &&
      playerResultHandle.score !== ethers.ZeroHash
    );
  }, [
    linkMatch.address,
    instance,
    ethersSigner,
    isRefreshing,
    isDecrypting,
    playerResultHandle,
  ]);

  const decryptPlayerResult = useCallback(() => {
    if (isRefreshingRef.current || isDecryptingRef.current) {
      return;
    }

    if (!linkMatch.address || !instance || !ethersSigner || !playerResultHandle) {
      return;
    }

    if (
      playerResultHandle.score === clearResultRef.current?.score?.handle
    ) {
      return;
    }

    if (!playerResultHandle.score) {
      setClearResult(undefined);
      clearResultRef.current = undefined;
      return;
    }

    const thisChainId = chainId;
    const thisLinkMatchAddress = linkMatch.address;
    const thisScoreHandle = playerResultHandle.score;
    const thisEthersSigner = ethersSigner;

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    setMessage("Start decrypt");

    const run = async () => {
      const isStale = () =>
        thisLinkMatchAddress !== linkMatchRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        const sig: FhevmDecryptionSignature | null =
          await FhevmDecryptionSignature.loadOrSign(
            instance,
            [linkMatch.address as `0x${string}`],
            ethersSigner,
            fhevmDecryptionSignatureStorage
          );

        if (!sig) {
          setMessage("Unable to build FHEVM decryption signature");
          return;
        }

        if (isStale()) {
          setMessage("Ignore FHEVM decryption");
          return;
        }

        setMessage("Call FHEVM userDecrypt...");

        // Ensure handle is in string format
        let handleStr: string;
        if (Array.isArray(thisScoreHandle)) {
          handleStr = thisScoreHandle[0];
        } else if (typeof thisScoreHandle === 'string') {
          handleStr = thisScoreHandle;
        } else {
          handleStr = ethers.hexlify(thisScoreHandle);
        }
        
        // Validate handle format
        if (!handleStr || handleStr === '0x' || handleStr.length < 66) {
          setMessage("Invalid handle format");
          return;
        }

        const res = await instance.userDecrypt(
          [
            { handle: handleStr, contractAddress: thisLinkMatchAddress },
          ],
          sig.privateKey,
          sig.publicKey,
          sig.signature,
          sig.contractAddresses,
          sig.userAddress,
          sig.startTimestamp,
          sig.durationDays
        );

        setMessage("FHEVM userDecrypt completed!");

        if (isStale()) {
          setMessage("Ignore FHEVM decryption");
          return;
        }

        const values = res as unknown as Record<string, string | bigint | boolean>;
        const decryptedValue =
          values[handleStr] ?? values[String(thisScoreHandle as unknown as string)];
        setClearResult({
          score: { handle: handleStr, clear: decryptedValue },
        });
        clearResultRef.current = {
          score: { handle: handleStr, clear: decryptedValue },
        };
      } finally {
        isDecryptingRef.current = false;
        setIsDecrypting(false);
      }
    };

    run();
  }, [
    fhevmDecryptionSignatureStorage,
    ethersSigner,
    linkMatch.address,
    instance,
    playerResultHandle,
    chainId,
    sameChain,
    sameSigner,
  ]);

  const fetchLeaderboard = useCallback(async () => {
    if (!linkMatch.address || !ethersReadonlyProvider) {
      return;
    }

    setIsLoadingLeaderboard(true);
    setMessage("Loading leaderboard...");

    try {
      const contract = new ethers.Contract(
        linkMatch.address,
        linkMatch.abi,
        ethersReadonlyProvider
      );

      // Fetch all players' ciphertext scores using a standalone Interface to avoid relying on main ABI
      const iface = new ethers.Interface([
        "function getAllEncryptedScores() view returns (address[] playerAddresses, bytes32[] encryptedScores)"
      ]);

      const data = iface.encodeFunctionData("getAllEncryptedScores", []);
      if (!ethersReadonlyProvider || !ethersReadonlyProvider.call) {
        setMessage("Provider not available");
        setIsLoadingLeaderboard(false);
        return;
      }
      const raw = await ethersReadonlyProvider.call({
        to: linkMatch.address!,
        data,
      });
      const decoded = iface.decodeFunctionResult("getAllEncryptedScores", raw);
      const playerAddresses: string[] = decoded[0];
      const encryptedScores: string[] = decoded[1].map((h: any) =>
        typeof h === "string" ? h : ethers.hexlify(h)
      );

      if (playerAddresses.length === 0) {
        setLeaderboard([]);
        setMessage("No players found");
        return;
      }

      // Compose address and ciphertext score without decryption; keep order; take top 10
      const leaderboardData = playerAddresses.map((address: string, index: number) => ({
        address,
        encryptedScore: encryptedScores[index],
      }));
      const top10 = leaderboardData.slice(0, 10);

      setLeaderboard(top10);
      setMessage(`Leaderboard loaded (ciphertext): ${top10.length} players`);
    } catch (e) {
      setMessage(`Failed to load leaderboard: ${e}`);
      setLeaderboard([]);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, [
    linkMatch.address,
    ethersReadonlyProvider,
  ]);

  const canSubmit = useMemo(() => {
    return (
      linkMatch.address &&
      instance &&
      ethersSigner &&
      !isRefreshing &&
      !isSubmitting
    );
  }, [linkMatch.address, instance, ethersSigner, isRefreshing, isSubmitting]);

  const submitGameResult = useCallback(
    (result: GameResult) => {
      if (isRefreshingRef.current || isSubmittingRef.current) {
        return;
      }

      if (!linkMatch.address || !instance || !ethersSigner) {
        return;
      }

      const thisChainId = chainId;
      const thisLinkMatchAddress = linkMatch.address;
      const thisEthersSigner = ethersSigner;
      const thisLinkMatchContract = new ethers.Contract(
        thisLinkMatchAddress,
        linkMatch.abi,
        thisEthersSigner
      );

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setMessage(`Start submitting game result...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisLinkMatchAddress !== linkMatchRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          // Convert score to integer (x1000 to keep 3 decimal places)
          const scoreInt = Math.floor(result.score * 1000);
          
          const scoreInput = instance.createEncryptedInput(
            thisLinkMatchAddress,
            thisEthersSigner.address
          );
          scoreInput.add32(scoreInt);

          const encScore = await scoreInput.encrypt();

          if (isStale()) {
            setMessage(`Ignore submit`);
            return;
          }

          setMessage(`Call submitGameResult...`);

          const tx: ethers.TransactionResponse =
            await thisLinkMatchContract.submitGameResult(
              encScore.handles[0],
              encScore.inputProof
            );

          setMessage(`Wait for tx:${tx.hash}...`);

          const receipt = await tx.wait();

          setMessage(`Submit completed status=${receipt?.status}`);

          if (isStale()) {
            setMessage(`Ignore submit`);
            return;
          }

          // After successful submit, refresh state but allow resubmission
          refreshPlayerResult();
        } catch (e) {
          setMessage(`Submit Failed! ${e}`);
        } finally {
          isSubmittingRef.current = false;
          setIsSubmitting(false);
        }
      };

      run();
    },
    [
      ethersSigner,
      linkMatch.address,
      linkMatch.abi,
      instance,
      chainId,
      refreshPlayerResult,
      sameChain,
      sameSigner,
    ]
  );

  return {
    contractAddress: linkMatch.address,
    canDecrypt,
    canGetResult,
    canSubmit,
    submitGameResult,
    decryptPlayerResult,
    refreshPlayerResult,
    fetchLeaderboard,
    isDecrypted: Boolean(clearResult?.score),
    message,
    clearResult,
    playerResultHandle,
    isDecrypting,
    isRefreshing,
    isSubmitting,
    isDeployed,
    hasSubmitted,
    leaderboard,
    isLoadingLeaderboard,
  };
};

