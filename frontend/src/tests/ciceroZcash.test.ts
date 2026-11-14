import test from "node:test";
import assert from "node:assert/strict";
import {
  generateZip321Uri,
  parseZip321Uri,
  encodeBase64Url,
  decodeBase64Url,
} from "@cicero-zcash/react";
import {
  getDefaultWallets,
  zucchiniWallet,
  burnerWallet,
  zashiWallet,
  ywallet,
  viewingKeyWallet,
} from "@cicero-zcash/react";

test("Cicero Wallet Toolkit & ZIP-321 Integration Verification", async (t) => {
  await t.test("1. Confirm Cicero wallet adapters are registered and configured", () => {
    const wallets = getDefaultWallets();
    assert.ok(wallets.length >= 4, "Should have at least 4 registered wallets");

    const ids = wallets.map((w) => w.id);
    assert.ok(ids.includes("zucchini"), "Should include Zucchini wallet");
    assert.ok(ids.includes("zashi"), "Should include Zashi wallet");
    assert.ok(ids.includes("ywallet"), "Should include Ywallet");
    assert.ok(ids.includes("burner"), "Should include Dev Session Wallet (burner)");
    assert.ok(ids.includes("viewing-key"), "Should include Viewing Key wallet");
  });

  await t.test("2. Test Dev Session Wallet (burner) connection, network, and address", async () => {
    const session = await burnerWallet.connect({ network: "testnet" });
    assert.equal(session.connected, true, "Dev session wallet should connect immediately");
    assert.equal(session.network, "testnet", "Should connect to testnet");
    assert.ok(session.address?.startsWith("u1"), "Should provide a valid shielded address format");
  });

  await t.test("3. Test Zucchini availability check in non-extension environment", () => {
    // In node/headless test environment without chrome extension
    const isAvailable = zucchiniWallet.isAvailable();
    assert.equal(typeof isAvailable, "boolean", "isAvailable should return boolean");
  });

  await t.test("4. Test Base64URL encoding/decoding for ZIP-321 memo reference", () => {
    const memo = "FANTASYXI:lg_9921:0.05";
    const encoded = encodeBase64Url(memo);
    assert.ok(encoded.length > 0, "Encoded memo should not be empty");
    assert.ok(!encoded.includes("+") && !encoded.includes("/") && !encoded.includes("="), "Must be safe Base64URL");

    const decoded = decodeBase64Url(encoded);
    assert.equal(decoded, memo, "Decoded memo must match original memo reference");
  });

  await t.test("5. Generate and validate RFC-compliant ZIP-321 payment URI", () => {
    const address = "utest1zcashshieldedreceiverfantasyxileaguestestnetaddress00000000000000000000000000000000";
    const amount = 0.05;
    const memo = "FANTASYXI:league_123:0.05";
    const message = "FantasyXI League Entry";

    const uri = generateZip321Uri({
      address,
      amount,
      memo,
      message,
    });

    assert.ok(uri.startsWith(`zcash:${address}?`), "URI must start with zcash: address");
    assert.ok(uri.includes("amount=0.05"), "URI must include amount parameter");
    assert.ok(uri.includes("memo="), "URI must include memo parameter");
    assert.ok(uri.includes("message=FantasyXI+League+Entry") || uri.includes("message=FantasyXI%20League%20Entry"), "URI must include message");

    // Parse back
    const parsed = parseZip321Uri(uri);
    assert.equal(parsed.address, address, "Parsed address must match");
  });

  await t.test("6. Test Zashi and Ywallet payment URI generation through sendPayment", async () => {
    const params = {
      recipient: "utest1test",
      amount: 0.1,
      memo: "FANTASYXI:TEST",
      message: "Test League",
    };

    if (zashiWallet.sendPayment) {
      const zashiRes = await zashiWallet.sendPayment(params);
      assert.ok(zashiRes.rawUri?.startsWith("zcash:utest1test"), "Zashi should return valid ZIP-321 rawUri");
    }

    if (ywallet.sendPayment) {
      const ywalletRes = await ywallet.sendPayment(params);
      assert.ok(ywalletRes.rawUri?.startsWith("zcash:utest1test"), "Ywallet should return valid ZIP-321 rawUri");
    }
  });

  await t.test("7. Test Dev Session Wallet sendPayment simulation", async () => {
    if (burnerWallet.sendPayment) {
      const res = await burnerWallet.sendPayment({
        recipient: "utest1test",
        amount: 0.05,
        memo: "FANTASYXI:DEMO",
      });
      assert.equal(res.submitted, true, "Dev Session Wallet should simulate submitted=true");
      assert.ok(res.txId.startsWith("0x"), "Should return a mock transaction hash for UI flow");
    }
  });
});
