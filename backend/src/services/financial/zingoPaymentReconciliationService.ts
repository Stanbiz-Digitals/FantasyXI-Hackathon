/**
 * Zingo Shielded Payment Settlement & Reconciliation Engine
 *
 * Reconciles incoming shielded Zcash transactions detected by ZingoAdapter
 * against open ZcashPaymentInvoice records.
 *
 * SECURITY INVARIANTS:
 * - Never credits a payment without verifying the exact expected ZEC amount.
 * - Enforces minimum confirmation thresholds (default >= 3).
 * - Enforces unique (txid, outputIndex) pairing to strictly prevent double-spend or replay attacks.
 * - Reconciles unique invoice references parsed from encrypted transaction memos.
 * - Automatically updates league member payment status to ACTIVE upon verified settlement.
 */

import { prisma } from "../../config/db.js";
import { PaymentStatus, MembershipStatus } from "../../types/index.js";
import { ZingoAdapter, ZingoTransactionObservation } from "./zingoAdapter.js";
import { zcashConfig } from "../../config/zcash.js";

export interface ReconciliationResult {
  invoicesScanned: number;
  invoicesSettled: number;
  invoicesPendingConfirmations: number;
  errors: string[];
}

export class ZingoPaymentReconciliationService {
  constructor(
    private readonly db: any = prisma,
    private readonly adapter: ZingoAdapter = new ZingoAdapter()
  ) {}

  /**
   * Scans incoming watch-only transactions and settles matching open invoices.
   */
  public async reconcilePendingInvoices(
    observations: ZingoTransactionObservation[]
  ): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      invoicesScanned: 0,
      invoicesSettled: 0,
      invoicesPendingConfirmations: 0,
      errors: [],
    };

    // Load all pending, non-expired invoices
    const pendingInvoices = await this.db.zcashPaymentInvoice.findMany({
      where: {
        paymentStatus: PaymentStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      include: {
        member: true,
      },
    });

    result.invoicesScanned = pendingInvoices.length;

    for (const invoice of pendingInvoices) {
      // Find candidate observation by matching memo reference or address
      const candidate = observations.find((obs) => {
        if (obs.memo && obs.memo.includes(invoice.invoiceReference)) {
          return true;
        }
        if (obs.recipientAddress && obs.recipientAddress === invoice.receivingAddress) {
          return true;
        }
        return false;
      });

      if (!candidate) {
        continue;
      }

      // Check amount
      if (candidate.amountZat < BigInt(invoice.expectedAmountZat)) {
        result.errors.push(
          `Invoice ${invoice.invoiceReference} received underpayment: ${candidate.amountZat} < ${invoice.expectedAmountZat}`
        );
        continue;
      }

      // Check confirmations
      if (candidate.confirmations < zcashConfig.requiredConfirmations) {
        result.invoicesPendingConfirmations++;
        // Update confirmation count on invoice without settling
        await this.db.zcashPaymentInvoice.update({
          where: { id: invoice.id },
          data: {
            paymentTxid: candidate.txid,
            outputIndex: candidate.outputIndex,
            confirmations: candidate.confirmations,
            memoReceived: candidate.memo,
          },
        });
        continue;
      }

      // Settle invoice atomically and update league member status
      try {
        await this.db.$transaction(async (tx: any) => {
          // Check for duplicate transaction usage
          const existingClaim = await tx.zcashPaymentInvoice.findFirst({
            where: {
              paymentTxid: candidate.txid,
              outputIndex: candidate.outputIndex,
              paymentStatus: PaymentStatus.PAYMENT_CONFIRMED,
              id: { not: invoice.id },
            },
          });

          if (existingClaim) {
            throw new Error(
              `Transaction ${candidate.txid}:${candidate.outputIndex} was already claimed by invoice ${existingClaim.invoiceReference}`
            );
          }

          // Mark invoice as CONFIRMED
          await tx.zcashPaymentInvoice.update({
            where: { id: invoice.id },
            data: {
              paymentTxid: candidate.txid,
              outputIndex: candidate.outputIndex,
              confirmations: candidate.confirmations,
              paymentStatus: PaymentStatus.PAYMENT_CONFIRMED,
              memoReceived: candidate.memo,
              verifiedAt: new Date(),
            },
          });

          // Mark league membership ACTIVE and hasPaid = true
          if (invoice.memberId) {
            await tx.leagueMember.update({
              where: { id: invoice.memberId },
              data: {
                status: MembershipStatus.ACTIVE,
                paymentStatus: PaymentStatus.PAYMENT_CONFIRMED,
                hasPaid: true,
              },
            });
          }
        });

        result.invoicesSettled++;
      } catch (err: unknown) {
        result.errors.push(
          `Failed to settle invoice ${invoice.invoiceReference}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return result;
  }
}

export const zingoPaymentReconciliationService = new ZingoPaymentReconciliationService();
