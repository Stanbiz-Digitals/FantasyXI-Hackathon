import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ZcashRpcClient, ZcashRpcError, ZcashNetworkError } from "../services/financial/zcashRpcClient.js";
import { ZcashVerificationService } from "../services/financial/zcashVerificationService.js";

describe("ZcashRpcClient and Verification with Mocked QuickNode RPC Responses", () => {
  const mockConfig = {
    network: "testnet" as const,
    rpcUrl: "https://mock-zcash-testnet.quiknode.pro/test-key/",
    timeoutMs: 1500,
    maxRetries: 1,
    requiredConfirmations: 3,
  };

  it("successfully retrieves blockchain info from testnet RPC", async () => {
    const mockBlockchainInfo = {
      chain: "test",
      blocks: 2854310,
      headers: 2854310,
      bestblockhash: "000000000123456789abcdef0123456789abcdef0123456789abcdef01234567",
      difficulty: 12.34,
      verificationprogress: 0.9999,
      pruned: false,
      valuePools: [
        { id: "sprout" as const, monitored: true, chainValue: 120.5 },
        { id: "sapling" as const, monitored: true, chainValue: 45000.2 },
        { id: "orchard" as const, monitored: true, chainValue: 128000.8 },
      ],
    };

    // Override global fetch with a mock for this test
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: "1", result: mockBlockchainInfo }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    try {
      const client = new ZcashRpcClient(mockConfig);
      const info = await client.getBlockchainInfo();
      assert.equal(info.chain, "test");
      assert.equal(info.blocks, 2854310);
      assert.equal(info.valuePools?.length, 3);
      assert.equal(info.valuePools?.[2].id, "orchard");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("properly surfaces Zcash RPC errors when a transaction or method fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "2",
          error: { code: -5, message: "No such mempool or blockchain transaction" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    try {
      const client = new ZcashRpcClient(mockConfig);
      await assert.rejects(
        () => client.getRawTransaction("a".repeat(64)),
        (err: Error) => {
          assert(err instanceof ZcashRpcError);
          assert.equal((err as ZcashRpcError).code, -5);
          assert.match(err.message, /No such mempool or blockchain transaction/);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles HTTP 5xx or network errors from QuickNode RPC", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response("Service Unavailable", { status: 503, statusText: "Service Unavailable" });

    try {
      const client = new ZcashRpcClient(mockConfig);
      await assert.rejects(
        () => client.getBlockCount(),
        (err: Error) => {
          assert(err instanceof ZcashNetworkError);
          assert.match(err.message, /HTTP 503/);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("ZcashVerificationService: rejects payment with insufficient confirmations", async () => {
    const mockTx = {
      txid: "b".repeat(64),
      confirmations: 1, // Only 1 confirmation (below required 3)
      blockhash: "000000000abc",
    };

    const mockClient = {
      getRawTransaction: async () => mockTx,
    } as unknown as ZcashRpcClient;

    const verificationService = new ZcashVerificationService(mockClient);
    const result = await verificationService.verifyPaymentTransaction("b".repeat(64), 3);

    assert.equal(result.verified, false);
    assert.equal(result.confirmations, 1);
    assert.match(result.reason || "", /Insufficient confirmations \(1\/3\)/);
  });

  it("ZcashVerificationService: verifies payment once required confirmations are met", async () => {
    const mockTx = {
      txid: "c".repeat(64),
      confirmations: 4, // Meets threshold of 3
      blockhash: "000000000def",
    };

    const mockClient = {
      getRawTransaction: async () => mockTx,
    } as unknown as ZcashRpcClient;

    const verificationService = new ZcashVerificationService(mockClient);
    const result = await verificationService.verifyPaymentTransaction("c".repeat(64), 3);

    assert.equal(result.verified, true);
    assert.equal(result.confirmations, 4);
    assert.equal(result.blockhash, "000000000def");
  });

  it("ZcashVerificationService: rejects malformed transaction hashes", async () => {
    const mockClient = {
      getRawTransaction: async () => assert.fail("Should not call RPC for invalid txid"),
    } as unknown as ZcashRpcClient;

    const verificationService = new ZcashVerificationService(mockClient);
    const result = await verificationService.verifyPaymentTransaction("invalid-tx-hash", 3);

    assert.equal(result.verified, false);
    assert.match(result.reason || "", /Invalid transaction ID format/);
  });
});
