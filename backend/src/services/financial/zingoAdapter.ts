/**
 * Zingo CLI Shielded Wallet Scanning Adapter
 *
 * Implements an interface to zingo-cli / zingolib for watch-only
 * shielded wallet initialization, synchronization, and incoming transaction observation.
 *
 * SECURITY INVARIANTS:
 * - Operates strictly as a watch-only client via Unified Full Viewing Key (UFVK).
 * - Never accepts or stores spending keys, seed phrases, or private keys.
 * - Sanitizes process arguments and execution errors (prevents viewing key leakage in logs).
 * - Enforces timeouts and safe process execution (no shell interpolation).
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { zcashConfig } from "../../config/zcash.js";

export class ZingoError extends Error {
  constructor(message: string, public readonly code: string = "ZINGO_ERROR") {
    super(message);
    this.name = "ZingoError";
  }
}

export class ZingoUnavailableError extends ZingoError {
  constructor(message: string = "Zingo CLI binary is not installed or available on PATH") {
    super(message, "ZINGO_UNAVAILABLE");
  }
}

export class ZingoSyncError extends ZingoError {
  constructor(message: string) {
    super(`Zingo wallet synchronization failed: ${message}`, "ZINGO_SYNC_FAILED");
  }
}

export interface ZingoTransactionObservation {
  txid: string;
  outputIndex: number;
  blockHeight: number;
  confirmations: number;
  amountZat: bigint;
  memo?: string;
  recipientAddress?: string;
}

export interface ZingoExecutionOptions {
  timeoutMs?: number;
}

export class ZingoAdapter {
  private readonly binPath: string;
  private readonly lightwalletdServer: string;
  private readonly network: "testnet" | "mainnet";
  private readonly dataDir?: string;

  constructor(
    binPath: string = zcashConfig.zingoBinPath || "zingo-cli",
    lightwalletdServer: string = zcashConfig.lightwalletdServer || "https://testnet.zec.rocks:443",
    network: "testnet" | "mainnet" = zcashConfig.network || "testnet",
    dataDir?: string
  ) {
    this.binPath = binPath;
    this.lightwalletdServer = lightwalletdServer;
    this.network = network;
    this.dataDir = dataDir || zcashConfig.dataDir;
  }

  /**
   * Checks whether the Zingo CLI binary is available on the system.
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const result = await this.execute(["--help"], { timeoutMs: 3000 });
      return result.includes("zingo") || result.includes("Usage");
    } catch {
      return false;
    }
  }

  /**
   * Initializes or opens a watch-only wallet using a Unified Full Viewing Key (UFVK).
   *
   * SECURITY:
   * Rejects spending keys (seeds). Only permits watch-only viewing keys (`uview...`).
   */
  public async initWatchOnlyWallet(
    ufvk: string,
    birthday: number = zcashConfig.walletBirthday || 2800000,
    targetDataDir?: string
  ): Promise<{ initialized: boolean; dataDir: string }> {
    if (!ufvk || typeof ufvk !== "string" || !ufvk.startsWith("uview")) {
      throw new ZingoError(
        "Invalid viewing key format. Only Unified Full Viewing Keys (uview...) are permitted.",
        "INVALID_VIEWING_KEY"
      );
    }

    const dir = targetDataDir || this.dataDir || path.resolve(process.cwd(), ".zingo-watch-only");

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Call zingo-cli to restore watch-only state
    try {
      await this.execute([
        "--chain",
        this.network,
        "--server",
        this.lightwalletdServer,
        "--data-dir",
        dir,
        "--viewkey",
        ufvk,
        "--birthday",
        String(birthday),
        "addresses",
      ]);
      return { initialized: true, dataDir: dir };
    } catch (err: unknown) {
      // Sanitize any key leakage in error
      const msg = err instanceof Error ? err.message.replace(ufvk, "[REDACTED_UFVK]") : "Initialization error";
      throw new ZingoError(`Failed to initialize watch-only wallet: ${msg}`, "INIT_FAILED");
    }
  }

  /**
   * Synchronizes the watch-only wallet with lightwalletd.
   */
  public async syncWallet(dataDir?: string): Promise<{ synced: boolean; latestBlock?: number }> {
    const dir = dataDir || this.dataDir;
    const args = ["--chain", this.network, "--server", this.lightwalletdServer];
    if (dir) {
      args.push("--data-dir", dir);
    }
    args.push("sync");

    try {
      const output = await this.execute(args, { timeoutMs: 30_000 });
      let latestBlock: number | undefined;
      const match = output.match(/latest block[:\s]+(\d+)/i) || output.match(/synced to[:\s]+(\d+)/i);
      if (match) {
        latestBlock = Number(match[1]);
      }
      return { synced: true, latestBlock };
    } catch (err: unknown) {
      throw new ZingoSyncError(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Retrieves incoming transactions from the watch-only wallet.
   * Parses structured records and filters observations.
   */
  public async getIncomingTransactions(dataDir?: string): Promise<ZingoTransactionObservation[]> {
    const dir = dataDir || this.dataDir;
    const args = ["--chain", this.network, "--server", this.lightwalletdServer];
    if (dir) {
      args.push("--data-dir", dir);
    }
    args.push("transactions");

    const rawOutput = await this.execute(args);
    return ZingoAdapter.parseTransactionsOutput(rawOutput);
  }

  /**
   * Parses raw zingo-cli transaction output into normalized observations.
   */
  public static parseTransactionsOutput(output: string): ZingoTransactionObservation[] {
    if (!output || typeof output !== "string") {
      return [];
    }

    const trimmed = output.trim();
    // 1. If output is JSON
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        return list
          .filter((tx: any) => tx && tx.txid)
          .map((tx: any, idx: number) => ({
            txid: String(tx.txid),
            outputIndex: Number(tx.output_index ?? tx.index ?? idx),
            blockHeight: Number(tx.block_height ?? tx.height ?? 0),
            confirmations: Number(tx.confirmations ?? 0),
            amountZat: BigInt(tx.amount_zat ?? tx.value_zat ?? Math.round(Number(tx.amount ?? 0) * 1e8)),
            memo: tx.memo ? String(tx.memo) : undefined,
            recipientAddress: tx.address ? String(tx.address) : undefined,
          }));
      } catch {
        // Fall back to text parsing if JSON parse fails
      }
    }

    // 2. Structured text / line-by-line fallback
    const observations: ZingoTransactionObservation[] = [];
    const txBlocks = output.split(/Transaction\s+ID:|txid:/i);

    for (let i = 1; i < txBlocks.length; i++) {
      const block = txBlocks[i];
      const txidMatch = block.match(/([0-9a-fA-F]{64})/);
      if (!txidMatch) continue;

      const txid = txidMatch[1];
      const heightMatch = block.match(/(?:block_height|height|block):\s*(\d+)/i);
      const confMatch = block.match(/confirmations:\s*(\d+)/i);
      const amountMatch = block.match(/(?:amount|value|amount_zat):\s*([\d.]+)/i);
      const memoMatch = block.match(/memo:\s*([^\r\n]+)/i);

      observations.push({
        txid,
        outputIndex: 0,
        blockHeight: heightMatch ? Number(heightMatch[1]) : 0,
        confirmations: confMatch ? Number(confMatch[1]) : 0,
        amountZat: amountMatch ? BigInt(Math.round(Number(amountMatch[1]) * (amountMatch[1].includes(".") ? 1e8 : 1))) : 0n,
        memo: memoMatch ? memoMatch[1].trim() : undefined,
      });
    }

    return observations;
  }

  /**
   * Executes a zingo-cli process safely without shell interpolation.
   */
  public async execute(args: string[], options: ZingoExecutionOptions = {}): Promise<string> {
    const timeoutMs = options.timeoutMs ?? zcashConfig.timeoutMs ?? 15_000;

    return new Promise((resolve, reject) => {
      let child: ReturnType<typeof spawn>;
      try {
        child = spawn(this.binPath, args, {
          shell: false,
          windowsHide: true,
        });
      } catch (err: unknown) {
        if ((err as any)?.code === "ENOENT") {
          return reject(new ZingoUnavailableError());
        }
        return reject(err);
      }

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        reject(new ZingoError(`Zingo CLI command timed out after ${timeoutMs}ms`, "TIMEOUT"));
      }, timeoutMs);

      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (err: any) => {
        clearTimeout(timer);
        if (err.code === "ENOENT") {
          reject(new ZingoUnavailableError());
        } else {
          reject(new ZingoError(`Process execution error: ${err.message}`));
        }
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (timedOut) return;

        if (code !== 0) {
          const safeStderr = stderr.replace(/uview[0-9a-zA-Z]+/g, "[REDACTED_UFVK]");
          reject(new ZingoError(`Zingo CLI exited with code ${code}: ${safeStderr.trim()}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }
}

export const zingoAdapter = new ZingoAdapter();
