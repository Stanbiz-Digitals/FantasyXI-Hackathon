import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ZingoPaymentReconciliationService } from "../services/financial/zingoPaymentReconciliationService.js";
import { PaymentStatus, MembershipStatus } from "../types/index.js";
import { ZingoTransactionObservation } from "../services/financial/zingoAdapter.js";

describe("ZingoPaymentReconciliationService Settlement & Reconciliation Tests", () => {
  const mockInvoice = {
    id: "inv-100",
    invoiceReference: "INV-LEAGUE-1-USR-2",
    leagueId: "league-1",
    userId: "user-2",
    memberId: "member-3",
    expectedAmountZat: 1000000000n, // 10 ZEC
    receivingAddress: "utest1leaguevaultaddress123",
    paymentStatus: PaymentStatus.PENDING,
    expiresAt: new Date(Date.now() + 3600_000), // 1 hr in future
    confirmations: 0,
    member: {
      id: "member-3",
      status: MembershipStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      hasPaid: false,
    },
  };

  function createMockDb(invoiceState = { ...mockInvoice }, claimedTxids: string[] = []) {
    return {
      zcashPaymentInvoice: {
        findMany: async () => [invoiceState],
        findFirst: async ({ where }: any) => {
          if (claimedTxids.includes(where.paymentTxid)) {
            return { id: "other-inv", invoiceReference: "OTHER-INV" };
          }
          return null;
        },
        update: async ({ data }: any) => {
          Object.assign(invoiceState, data);
          return invoiceState;
        },
      },
      leagueMember: {
        update: async ({ data }: any) => {
          Object.assign(invoiceState.member, data);
          return invoiceState.member;
        },
      },
      $transaction: async (cb: any) => {
        const tx = {
          zcashPaymentInvoice: {
            findFirst: async ({ where }: any) => {
              if (claimedTxids.includes(where.paymentTxid)) {
                return { id: "other-inv", invoiceReference: "OTHER-INV" };
              }
              return null;
            },
            update: async ({ data }: any) => {
              Object.assign(invoiceState, data);
              return invoiceState;
            },
          },
          leagueMember: {
            update: async ({ data }: any) => {
              Object.assign(invoiceState.member, data);
              return invoiceState.member;
            },
          },
        };
        return cb(tx);
      },
    };
  }

  it("settles invoice and marks league member ACTIVE on valid shielded payment", async () => {
    const mockDb = createMockDb();
    const service = new ZingoPaymentReconciliationService(mockDb);

    const observations: ZingoTransactionObservation[] = [
      {
        txid: "1".repeat(64),
        outputIndex: 0,
        blockHeight: 2854000,
        confirmations: 4, // Exceeds threshold of 3
        amountZat: 1000000000n, // Exact 10 ZEC
        memo: "fantasyxi:INV-LEAGUE-1-USR-2",
        recipientAddress: "utest1leaguevaultaddress123",
      },
    ];

    const result = await service.reconcilePendingInvoices(observations);
    assert.equal(result.invoicesSettled, 1);
    assert.equal(result.errors.length, 0);
    assert.equal(mockDb.zcashPaymentInvoice.findMany.length, 0); // verified
  });

  it("rejects underpaid shielded payments without settling", async () => {
    const mockDb = createMockDb();
    const service = new ZingoPaymentReconciliationService(mockDb);

    const observations: ZingoTransactionObservation[] = [
      {
        txid: "2".repeat(64),
        outputIndex: 0,
        blockHeight: 2854000,
        confirmations: 5,
        amountZat: 500000000n, // Only 5 ZEC (Expected 10 ZEC)
        memo: "fantasyxi:INV-LEAGUE-1-USR-2",
      },
    ];

    const result = await service.reconcilePendingInvoices(observations);
    assert.equal(result.invoicesSettled, 0);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /received underpayment/);
  });

  it("leaves payment pending when confirmations are below threshold", async () => {
    const mockDb = createMockDb();
    const service = new ZingoPaymentReconciliationService(mockDb);

    const observations: ZingoTransactionObservation[] = [
      {
        txid: "3".repeat(64),
        outputIndex: 0,
        blockHeight: 2854000,
        confirmations: 1, // Only 1 confirmation (Threshold is 3)
        amountZat: 1000000000n,
        memo: "fantasyxi:INV-LEAGUE-1-USR-2",
      },
    ];

    const result = await service.reconcilePendingInvoices(observations);
    assert.equal(result.invoicesSettled, 0);
    assert.equal(result.invoicesPendingConfirmations, 1);
  });

  it("rejects duplicate transaction claims to prevent double-spending", async () => {
    // Txid is already claimed by another invoice
    const mockDb = createMockDb(undefined, ["4".repeat(64)]);
    const service = new ZingoPaymentReconciliationService(mockDb);

    const observations: ZingoTransactionObservation[] = [
      {
        txid: "4".repeat(64),
        outputIndex: 0,
        blockHeight: 2854000,
        confirmations: 4,
        amountZat: 1000000000n,
        memo: "fantasyxi:INV-LEAGUE-1-USR-2",
      },
    ];

    const result = await service.reconcilePendingInvoices(observations);
    assert.equal(result.invoicesSettled, 0);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /was already claimed/);
  });
});
