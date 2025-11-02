"use client";

import { useFhevm } from "../fhevm/useFhevm";
import { useInMemoryStorage } from "../hooks/useInMemoryStorage";
import { useMetaMaskEthersSigner } from "../hooks/metamask/useMetaMaskEthersSigner";
import { useLinkMatch, GameResult } from "@/hooks/useLinkMatch";
import { LinkMatchGame } from "@/components/LinkMatchGame";
import { useState, useEffect, useRef } from "react";

// Contract address - should be set after deployment
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

export default function Home() {
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const {
    provider,
    chainId,
    accounts,
    isConnected,
    connect,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    initialMockChains,
  } = useMetaMaskEthersSigner();

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const linkMatch = useLinkMatch({
    instance: fhevmInstance,
    fhevmDecryptionSignatureStorage,
    eip1193Provider: provider,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    contractAddress: CONTRACT_ADDRESS,
  });

  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<boolean>(false);
  const prevIsSubmittingRef = useRef<boolean>(false);

  // Track when submission completes successfully
  useEffect(() => {
    if (prevIsSubmittingRef.current && !linkMatch.isSubmitting && linkMatch.hasSubmitted) {
      // Submission just completed successfully
      setJustSubmitted(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setJustSubmitted(false), 5000);
      return () => clearTimeout(timer);
    }
    prevIsSubmittingRef.current = linkMatch.isSubmitting;
  }, [linkMatch.isSubmitting, linkMatch.hasSubmitted]);

  const handleGameComplete = (matches: number, timeSeconds: number) => {
    // Calculate average matches (score) = matches / time
    const score = timeSeconds > 0 ? matches / timeSeconds : 0;
    setGameResult({ score, matches, timeSeconds });
  };

  const handleSubmit = () => {
    if (gameResult) {
      linkMatch.submitGameResult(gameResult);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-2xl w-full">
          <div className="card text-center">
            <div className="mb-8">
              <div className="inline-block bg-[#0F4C81] text-white px-8 py-4 rounded-2xl mb-6">
                <h1 className="text-5xl font-extrabold">🎮 LinkMatch</h1>
              </div>
              <p className="text-2xl text-gray-700 font-semibold mb-2">
                Privacy-Preserving Memory Game
              </p>
              <p className="text-lg text-gray-600">
                Powered by Fully Homomorphic Encryption (FHEVM)
              </p>
            </div>
            
            <div className="bg-blue-50 border-2 border-[#0F4C81] rounded-xl p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-3">🔐 How It Works</h2>
              <ul className="text-left text-gray-700 space-y-2">
                <li className="flex items-start">
                  <span className="text-[#065F46] font-bold mr-2">✓</span>
                  <span>Match identical tiles to earn points</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#065F46] font-bold mr-2">✓</span>
                  <span>Your scores are encrypted on the blockchain</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#065F46] font-bold mr-2">✓</span>
                  <span>Complete privacy with verifiable results</span>
                </li>
              </ul>
            </div>

            <button className="btn-primary text-xl py-4 w-full" onClick={connect}>
              🦊 Connect MetaMask to Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (linkMatch.isDeployed === false) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-xl w-full">
          <div className="card text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Contract Not Available</h1>
            <p className="text-lg text-gray-700 mb-2">
              The LinkMatch contract is not deployed on this network.
            </p>
            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Current Chain ID:</strong> {chainId}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#0F4C81] text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-extrabold">🎮 LinkMatch</h1>
              <p className="text-blue-200 mt-1">Privacy-Preserving Memory Game</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-200">Connected Account</div>
              <div className="font-mono text-sm bg-blue-900 px-3 py-1 rounded mt-1">
                {accounts?.[0] ? `${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}` : "N/A"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Game Section */}
        <section className="mb-8">
          <div className="card">
            <h2 className="card-header">🎯 Game Arena</h2>
            <LinkMatchGame
              onGameComplete={handleGameComplete}
              disabled={false}
            />
          </div>
        </section>

        {/* Results and Actions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Game Results */}
          <div className="card">
            <h2 className="card-header">📊 Your Results</h2>
            
            {gameResult ? (
              <div className="info-box mb-6">
                <h3 className="font-bold text-lg text-gray-900 mb-3">Latest Game Performance</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-[#0F4C81] rounded-lg p-3">
                    <div className="text-sm text-gray-600">Matches Made</div>
                    <div className="text-2xl font-bold text-[#0F4C81]">{gameResult.matches}</div>
                  </div>
                  <div className="bg-white border border-[#0F4C81] rounded-lg p-3">
                    <div className="text-sm text-gray-600">Time Elapsed</div>
                    <div className="text-2xl font-bold text-[#0F4C81]">{gameResult.timeSeconds}s</div>
                  </div>
                  <div className="col-span-2 bg-white border-2 border-[#065F46] rounded-lg p-3">
                    <div className="text-sm text-gray-600">Performance Score</div>
                    <div className="text-3xl font-bold text-[#065F46]">
                      {gameResult.score.toFixed(3)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      (Matches per Second)
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="info-box mb-6 text-center">
                <div className="text-4xl mb-3">🎲</div>
                <p className="text-gray-700 font-semibold">No game completed yet</p>
                <p className="text-sm text-gray-600 mt-2">
                  Play a game to see your results here
                </p>
              </div>
            )}

            {justSubmitted && (
              <div className="success-box mb-6">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">✅</span>
                  <div>
                    <p className="font-bold text-[#065F46] text-lg">
                      Score Submitted Successfully!
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      Your encrypted score has been recorded on the blockchain
                    </p>
                  </div>
                </div>
              </div>
            )}

            {linkMatch.clearResult && (
              <div className="success-box">
                <h3 className="font-bold text-lg text-gray-900 mb-3">🔓 Decrypted Score</h3>
                <div className="bg-white border border-[#065F46] rounded-lg p-4">
                  <div className="text-sm text-gray-600">Your Verified Score</div>
                  <div className="text-3xl font-bold text-[#065F46]">
                    {(Number(linkMatch.clearResult.score?.clear || 0) / 1000).toFixed(3)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions Panel */}
          <div className="card">
            <h2 className="card-header">⚡ Actions</h2>
            
            <div className="space-y-4 mb-6">
              <button
                className="btn-success w-full text-lg"
                disabled={!linkMatch.canSubmit || !gameResult}
                onClick={handleSubmit}
              >
                {linkMatch.isSubmitting ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    Submitting Score...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🔐</span>
                    Submit Encrypted Score
                  </>
                )}
              </button>

              <button
                className="btn-primary w-full text-lg"
                disabled={!linkMatch.canGetResult}
                onClick={linkMatch.refreshPlayerResult}
              >
                <span className="mr-2">🔄</span>
                Refresh My Result
              </button>

              <button
                className="btn-primary w-full text-lg"
                disabled={!linkMatch.canDecrypt}
                onClick={linkMatch.decryptPlayerResult}
              >
                {linkMatch.isDecrypted ? (
                  <>
                    <span className="mr-2">✓</span>
                    Already Decrypted
                  </>
                ) : linkMatch.isDecrypting ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⏳</span>
                    Decrypting...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🔓</span>
                    Decrypt My Result
                  </>
                )}
              </button>
            </div>

            {/* Status Information */}
            <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <span className="mr-2">ℹ️</span>
                System Status
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">FHEVM Status:</span>
                  <span className="status-badge bg-[#0F4C81] text-white">
                    {fhevmStatus}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Network Chain ID:</span>
                  <span className="font-mono font-semibold text-gray-900">{chainId}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-600 mb-1">Contract Address:</span>
                  <span className="font-mono text-xs bg-white border border-gray-300 rounded px-2 py-1 break-all">
                    {linkMatch.contractAddress || "Not Available"}
                  </span>
                </div>
              </div>
              {linkMatch.message && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <p className="text-sm text-gray-700">
                    <strong>Message:</strong> {linkMatch.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Leaderboard Section */}
        <section className="card">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center">
              <span className="mr-3">🏆</span>
              Global Leaderboard
            </h2>
            <button
              className="btn-primary"
              disabled={!linkMatch.contractAddress || linkMatch.isLoadingLeaderboard}
              onClick={linkMatch.fetchLeaderboard}
            >
              {linkMatch.isLoadingLeaderboard ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Loading...
                </>
              ) : (
                <>
                  <span className="mr-2">🔄</span>
                  Refresh Leaderboard
                </>
              )}
            </button>
          </div>

          {linkMatch.leaderboard.length === 0 ? (
            <div className="info-box text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-xl font-semibold text-gray-700 mb-2">
                No Leaderboard Data Available
              </p>
              <p className="text-gray-600">
                Click the refresh button above to load the top players
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="w-full">
                <thead className="bg-[#0F4C81] text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-bold text-lg">Rank</th>
                    <th className="px-6 py-4 text-left font-bold text-lg">Player Address</th>
                    <th className="px-6 py-4 text-left font-bold text-lg">Encrypted Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {linkMatch.leaderboard.map((entry, index) => (
                    <tr key={entry.address} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : ""}
                          </span>
                          <span className="text-lg font-bold text-gray-900">
                            #{index + 1}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded border border-gray-300">
                          {`${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-gray-600 break-all">
                          {entry.encryptedScore.slice(0, 32)}...
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

