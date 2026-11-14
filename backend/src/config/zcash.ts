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
  zingoBinPath?: string;
  lightwalletdServer: string;
  watchOnlyUfvk?: string;
  walletBirthday?: number;
  dataDir?: string;
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
  zingoBinPath: process.env.ZINGO_BIN_PATH || "zingo-cli",
  lightwalletdServer:
    process.env.ZINGO_LIGHTWALLETD_SERVER || "https://testnet.zec.rocks:443",
  watchOnlyUfvk: process.env.ZINGO_WATCH_ONLY_UFVK || undefined,
  walletBirthday: Number(process.env.ZINGO_WALLET_BIRTHDAY) || 2800000,
  dataDir: process.env.ZINGO_DATA_DIR || undefined,
};
