/**
 * Zcash Network & QuickNode RPC Configuration
 *
 * Configures connection parameters for Zcash Testnet via QuickNode.
 *
 * SECURITY:
 * Never store private keys, spending keys, or viewing keys here or in the database.
 */

export interface ZcashConfig {
  network: "testnet" | "mainnet";
  rpcUrl: string;
  rpcUser?: string;
  rpcPassword?: string;
  timeoutMs: number;
  maxRetries: number;
  requiredConfirmations: number;
}

export const zcashConfig: ZcashConfig = {
  network: (process.env.ZCASH_NETWORK as "testnet" | "mainnet") || "testnet",
  rpcUrl:
    process.env.ZCASH_RPC_URL ||
    "https://example-zcash-testnet.quiknode.pro/mock-endpoint/",
  rpcUser: process.env.ZCASH_RPC_USER || undefined,
  rpcPassword: process.env.ZCASH_RPC_PASSWORD || undefined,
  timeoutMs: Number(process.env.ZCASH_RPC_TIMEOUT_MS) || 10_000,
  maxRetries: Number(process.env.ZCASH_RPC_MAX_RETRIES) || 2,
  requiredConfirmations: Number(process.env.ZCASH_CONFIRMATIONS_REQUIRED) || 3,
};
