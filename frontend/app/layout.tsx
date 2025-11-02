import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MetaMaskProvider } from "@/hooks/metamask/useMetaMaskProvider";
import { MetaMaskEthersSignerProvider } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { InMemoryStorageProvider } from "@/hooks/useInMemoryStorage";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LinkMatch - Privacy-Preserving Memory Game",
  description: "Play LinkMatch: A privacy-preserving memory matching game powered by Fully Homomorphic Encryption (FHEVM) technology. Your scores are encrypted on the blockchain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialMockChains: Record<number, string> = {
    31337: "http://localhost:8545",
  };

  return (
    <html lang="en">
      <body className={inter.className}>
        <MetaMaskProvider>
          <MetaMaskEthersSignerProvider initialMockChains={initialMockChains}>
            <InMemoryStorageProvider>
              {children}
            </InMemoryStorageProvider>
          </MetaMaskEthersSignerProvider>
        </MetaMaskProvider>
      </body>
    </html>
  );
}

