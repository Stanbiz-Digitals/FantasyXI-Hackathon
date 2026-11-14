/**
 * Investigation & Technical Specification:
 * Supported Zcash Shielded Transactions & Wallet Methods
 *
 * Target Network: Zcash Testnet (via QuickNode RPC)
 *
 * 1. Background & Protocol Pools
 * --------------------------------
 * Zcash supports multiple value pools:
 * - Transparent (t-addresses, P2PKH / P2SH - Bitcoin-style)
 * - Sapling (z-addresses, `ztestsapling...` on testnet)
 * - Orchard (Unified Addresses, `utest1...` on testnet, introduced with NU5)
 *
 * 2. RPC Methods Investigation for QuickNode / zcashd / zebra
 * -----------------------------------------------------------
 * A. Node & Chain Introspection:
 *    - `getblockchaininfo`: Confirms active pools (Sprout, Sapling, Orchard) and chain sync.
 *    - `getnetworkinfo`: Reports supported subversions and relay fees.
 *    - `getblockcount`: Returns current block height for confirmation depth checks.
 *
 * B. Shielded Transaction Inspection & Verification:
 *    - Transparent verification: `getrawtransaction <txid> 1` returns decoded outputs.
 *    - Shielded verification considerations:
 *      * Shielded outputs encrypt recipients, amounts, and memos with zk-SNARKs.
 *      * Third-party nodes (including QuickNode) cannot inspect shielded note ciphertexts
 *        without the corresponding Incoming Viewing Key (IVK) or Full Viewing Key (FVK).
 *      * `z_getoperationresult` / `z_getoperationstatus`: Inspect status of asynchronous
 *        shielded operations (`opid`).
 *      * `z_listreceivedbyaddress`: Requires local wallet tracking on the node.
 *      * On hosted nodes like QuickNode where custodial keys are NOT stored on the server:
 *        Verification relies on:
 *        1) Transaction presence and confirmation depth in the blockchain:
 *           `getrawtransaction txid 1` confirms inclusion in a mined block (`confirmations >= N`).
 *        2) Cryptographic payment disclosure proofs (RFC / ZIP-310 payment disclosures)
 *           or client-side viewing key verification without server-side key retention.
 *
 * 3. Security Guidelines for Shielded Leagues:
 * --------------------------------------------
 * - RULE 1: Never store private spending keys (`sk`) or viewing keys (`fvk` / `ivk`) in the
 *   database, Redis, or application logs.
 * - RULE 2: No league payment must be marked as successful until on-chain verification
 *   satisfies `confirmations >= ZCASH_CONFIRMATIONS_REQUIRED` (default 3 blocks).
 * - RULE 3: Transactions submitted must be matched against unique league payment references
 *   (or deterministic memo identifiers) before credit.
 */

import { zcashRpcClient, ZcashRpcClient, ZcashTransactionInfo } from "./zcashRpcClient.js";
import { zcashConfig } from "../../config/zcash.js";

export interface ZcashPaymentVerificationResult {
  verified: boolean;
  txid: string;
  confirmations: number;
  blockhash?: string;
  amountZat?: number;
  reason?: string;
}

export class ZcashVerificationService {
  constructor(private readonly client: ZcashRpcClient = zcashRpcClient) {}

  /**
   * Verifies that a transaction exists on the Zcash testnet and meets the
   * required confirmation threshold before marking a payment as successful.
   *
   * SECURITY:
   * Rejects unconfirmed, mempool-only, or orphaned transactions.
   */
  public async verifyPaymentTransaction(
    txid: string,
    minConfirmations: number = zcashConfig.requiredConfirmations
  ): Promise<ZcashPaymentVerificationResult> {
    if (!txid || typeof txid !== "string" || !/^[0-9a-fA-F]{64}$/.test(txid)) {
      return {
        verified: false,
        txid,
        confirmations: 0,
        reason: "Invalid transaction ID format (must be 64-char hexadecimal string)",
      };
    }

    try {
      const txInfo: ZcashTransactionInfo = await this.client.getRawTransaction(txid, 1);

      if (!txInfo || !txInfo.txid) {
        return {
          verified: false,
          txid,
          confirmations: 0,
          reason: "Transaction was not found on the Zcash network",
        };
      }

      const confirmations = txInfo.confirmations || 0;

      if (confirmations < minConfirmations) {
        return {
          verified: false,
          txid,
          confirmations,
          reason: `Insufficient confirmations (${confirmations}/${minConfirmations}). Awaiting block depth.`,
        };
      }

      return {
        verified: true,
        txid: txInfo.txid,
        confirmations,
        blockhash: txInfo.blockhash,
      };
    } catch (err: unknown) {
      return {
        verified: false,
        txid,
        confirmations: 0,
        reason: err instanceof Error ? err.message : "Error querying Zcash RPC",
      };
    }
  }
}

export const zcashVerificationService = new ZcashVerificationService();
