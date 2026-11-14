/**
 * Zcash JSON-RPC Client for QuickNode Testnet
 *
 * Implements standard Zcash JSON-RPC (based on zcashd/zebra RPC specifications).
 * Provides robust timeout handling, abort controllers, retry mechanisms,
 * and strongly typed response models.
 *
 * SECURITY:
 * Never logs or serializes sensitive cryptographic material (keys, viewing keys).
 */

import { zcashConfig, ZcashConfig } from "../../config/zcash.js";

export class ZcashRpcError extends Error {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(message: string, code: number = -1, data?: unknown) {
    super(`Zcash RPC Error [${code}]: ${message}`);
    this.name = "ZcashRpcError";
    this.code = code;
    this.data = data;
  }
}

export class ZcashNetworkError extends Error {
  constructor(message: string) {
    super(`Zcash Network Error: ${message}`);
    this.name = "ZcashNetworkError";
  }
}

export interface ZcashBlockchainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  verificationprogress: number;
  pruned: boolean;
  commitments?: number;
  valuePools?: Array<{
    id: "sprout" | "sapling" | "orchard";
    monitored: boolean;
    chainValue?: number;
    chainValueZat?: number;
  }>;
}

export interface ZcashTransactionInfo {
  txid: string;
  confirmations: number;
  blockhash?: string;
  blockindex?: number;
  blocktime?: number;
  time?: number;
  vReceived?: Array<{
    address: string;
    amount: number;
    memo?: string;
  }>;
  value?: number;
}

export class ZcashRpcClient {
  private readonly config: ZcashConfig;

  constructor(config: ZcashConfig = zcashConfig) {
    this.config = config;
  }

  /**
   * Executes a typed JSON-RPC call against the QuickNode endpoint.
   */
  public async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (this.config.rpcUser && this.config.rpcPassword) {
      const auth = Buffer.from(
        `${this.config.rpcUser}:${this.config.rpcPassword}`
      ).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    }

    let lastError: Error | null = null;
    const maxAttempts = Math.max(1, this.config.maxRetries + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await fetch(this.config.rpcUrl, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new ZcashNetworkError(
            `HTTP ${response.status} ${response.statusText} from Zcash RPC endpoint`
          );
        }

        const data = (await response.json()) as {
          result?: T;
          error?: { code: number; message: string; data?: unknown } | null;
          id: string;
        };

        if (data.error) {
          throw new ZcashRpcError(
            data.error.message || "Unknown RPC error",
            data.error.code,
            data.error.data
          );
        }

        return data.result as T;
      } catch (err: unknown) {
        clearTimeout(timeout);
        if (err instanceof ZcashRpcError) {
          // Do not retry domain RPC errors (e.g. invalid txid, method not found)
          throw err;
        }

        if (err instanceof Error && err.name === "AbortError") {
          lastError = new ZcashNetworkError(
            `Zcash RPC request timed out after ${this.config.timeoutMs}ms for method ${method}`
          );
        } else {
          lastError = err instanceof Error ? err : new ZcashNetworkError(String(err));
        }

        if (attempt < maxAttempts) {
          // Linear backoff between network attempts
          await new Promise((resolve) => setTimeout(resolve, attempt * 300));
        }
      }
    }

    throw lastError || new ZcashNetworkError("Failed to execute Zcash RPC request");
  }

  /**
   * Retrieves testnet blockchain synchronization state and details.
   */
  public async getBlockchainInfo(): Promise<ZcashBlockchainInfo> {
    return this.call<ZcashBlockchainInfo>("getblockchaininfo");
  }

  /**
   * Retrieves the current block count (height) of the chain.
   */
  public async getBlockCount(): Promise<number> {
    return this.call<number>("getblockcount");
  }

  /**
   * Retrieves raw transaction details by transaction ID (txid).
   * verbosity=1 returns decoded JSON format.
   */
  public async getRawTransaction(
    txid: string,
    verbosity: number = 1
  ): Promise<ZcashTransactionInfo> {
    return this.call<ZcashTransactionInfo>("getrawtransaction", [txid, verbosity]);
  }
}

export const zcashRpcClient = new ZcashRpcClient();
