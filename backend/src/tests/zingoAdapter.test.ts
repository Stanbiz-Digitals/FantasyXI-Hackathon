import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ZingoAdapter,
  ZingoError,
  ZingoUnavailableError,
  ZingoSyncError,
} from "../services/financial/zingoAdapter.js";

describe("ZingoAdapter Watch-Only Shielded Scanning Engine", () => {
  it("correctly identifies when Zingo CLI is unavailable", async () => {
    // Non-existent binary path
    const adapter = new ZingoAdapter("non-existent-zingo-bin-12345");
    const available = await adapter.isAvailable();
    assert.equal(available, false);
  });

  it("throws ZingoUnavailableError when attempting execution with missing binary", async () => {
    const adapter = new ZingoAdapter("non-existent-zingo-bin-12345");
    await assert.rejects(
      () => adapter.execute(["addresses"]),
      (err: Error) => {
        assert(err instanceof ZingoUnavailableError);
        assert.equal((err as ZingoError).code, "ZINGO_UNAVAILABLE");
        return true;
      }
    );
  });

  it("rejects invalid viewing key formats and spending seeds", async () => {
    const adapter = new ZingoAdapter();
    // Attempting to supply a spending seed or invalid key format
    await assert.rejects(
      () => adapter.initWatchOnlyWallet("secret-seed-phrase-which-is-forbidden"),
      (err: Error) => {
        assert(err instanceof ZingoError);
        assert.equal((err as ZingoError).code, "INVALID_VIEWING_KEY");
        assert.match(err.message, /Only Unified Full Viewing Keys/);
        return true;
      }
    );
  });

  it("handles wallet synchronization failure", async () => {
    const adapter = new ZingoAdapter();
    // Mock execute to simulate sync failure
    adapter.execute = async () => {
      throw new Error("Connection refused by lightwalletd endpoint: 443");
    };

    await assert.rejects(
      () => adapter.syncWallet(),
      (err: Error) => {
        assert(err instanceof ZingoSyncError);
        assert.match(err.message, /Connection refused/);
        return true;
      }
    );
  });

  it("parses structured JSON transactions into normalized observations", () => {
    const mockJsonOutput = JSON.stringify([
      {
        txid: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        output_index: 0,
        block_height: 2850120,
        confirmations: 6,
        amount_zat: 1000000000, // 10 ZEC
        memo: "fantasyxi:league:lg-100:user:usr-200",
        address: "utest1leaguevaultaddress...",
      },
    ]);

    const observations = ZingoAdapter.parseTransactionsOutput(mockJsonOutput);
    assert.equal(observations.length, 1);
    assert.equal(observations[0].txid, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    assert.equal(observations[0].outputIndex, 0);
    assert.equal(observations[0].confirmations, 6);
    assert.equal(observations[0].amountZat, 1000000000n);
    assert.equal(observations[0].memo, "fantasyxi:league:lg-100:user:usr-200");
  });

  it("parses structured text transaction blocks into normalized observations", () => {
    const mockTextOutput = `
      Transaction ID: 4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b
      Height: 2850150
      Confirmations: 2
      Amount: 5.5
      Memo: fantasyxi:league:lg-500:user:usr-600
    `;

    const observations = ZingoAdapter.parseTransactionsOutput(mockTextOutput);
    assert.equal(observations.length, 1);
    assert.equal(observations[0].txid, "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b");
    assert.equal(observations[0].blockHeight, 2850150);
    assert.equal(observations[0].confirmations, 2);
    assert.equal(observations[0].amountZat, 550000000n); // 5.5 ZEC in zatoshis
    assert.equal(observations[0].memo, "fantasyxi:league:lg-500:user:usr-600");
  });
});
