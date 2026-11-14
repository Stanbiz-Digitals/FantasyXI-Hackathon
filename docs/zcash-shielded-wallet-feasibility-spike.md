# FantasyXI — Zcash Shielded Wallet Feasibility Spike

This document summarizes the architectural feasibility investigation of integrating **Zallet** and **Zcash Shielded Payments** with our hosted **QuickNode Zcash Testnet RPC** foundation.

---

## 1. Zallet Assessment & Beta Limitations

### What Zallet Is
- `zallet` is an official, modern full-node wallet daemon written in Rust by the Electric Coin Company (`zcash/zallet`), built to replace the deprecated embedded `zcashd` wallet.
- It operates with a two-tier RPC architecture:
  1. **Client JSON-RPC (`[rpc]`)**: Port `28232` (or custom), serving wallet commands such as `z_getaddressforaccount`, `z_sendmany`, `z_sendfromaccount`, `z_viewtransaction`, and `listreceivedbyaddress`.
  2. **Validator / Indexer (`[indexer]`)**: Connects via `validator_address` to a full consensus node (`zebrad` or `zcashd`) to monitor mempool state and fetch blocks.

### Compatibility with QuickNode RPC
- **QuickNode's Role**: QuickNode provides hosted, scalable JSON-RPC endpoints for block querying (`getblock`, `getblockchaininfo`) and transaction broadcasting (`sendrawtransaction`).
- **Limitation**: QuickNode **does not** provide hosted wallet services, key management, or note decryption for third parties. Zallet cannot run purely on QuickNode without a local daemon process.
- **Zallet Connection**: Zallet's indexer is designed to pair directly with a node instance (typically with cookie auth or basic auth). Connecting Zallet across the public WAN to QuickNode can encounter latency during full sync/note trial-decryption unless an initial checkpoint is used.

---

## 2. Shielded Payment Lifecycle

### Address Generation
- **Unified Addresses (ZIP 316)**: Shielded testnet addresses start with `utest1...` and combine an Orchard receiver, Sapling receiver (`ztestsapling...`), and an optional transparent receiver (`tm...`).
- **Diversified Addresses**: Wallets can derive unique diversified addresses for each invoice or league entry from a single viewing key without leaking on-chain linkability.

### Payment Request URI (ZIP 321)
- Eliminates manual input errors by packaging address, required amount, and reference memo:
  ```text
  zcash:utest1example...?amount=10.00000000&memo=ZmFudGFzeXhpOmxlYWd1ZToxMDA6dXNlcjoyMDA=
  ```
  *(Memo: `fantasyxi:league:<leagueId>:user:<userId>`)*

### Shielded Transaction Construction & Broadcast
- The sender's client (e.g. Zallet, Zashi, YWallet) creates zero-knowledge proofs (zk-SNARKs), encrypts output notes, and signs spend authorizations locally.
- The raw transaction hex is submitted to QuickNode via `sendrawtransaction`.

---

## 3. Cryptographic Verification & Preventing the "Confirmed Txid" Exploit

> [!CAUTION]
> **Why Confirmations Alone Are Insufficient**:
> On transparent networks, `getrawtransaction txid 1` exposes the recipient and amount.
> On shielded Zcash, `getrawtransaction` exposes only encrypted commitments. If FantasyXI marked payments confirmed solely because `confirmations >= 3`, any malicious actor could submit a random, genuine transaction from a block explorer to claim free league entries.

### Legitimate Verification Options

1. **Option A: Incoming Viewing Key (IVK) in Backend Sidecar (Recommended)**:
   - FantasyXI backend runs a read-only wallet sidecar initialized **only with an Incoming Viewing Key (IVK)**.
   - **Zero spending authority**: The server cannot spend funds, even if compromised.
   - Decrypts incoming outputs sent to FantasyXI's address, validating exact amount and reference memo.
2. **Option B: Unique Diversified Addresses (ZIP 321)**:
   - Each league entry is assigned a unique diversified address.
   - The wallet engine monitors per-address balances. If the specific address receives the target funds, the payment is confirmed.
3. **Option C: ZIP 311 / ZIP 310 Payment Disclosures**:
   - The sender exports an ephemeral cryptographic proof of payment (`txid`, `recipient`, `amount`, `memo`, `esk`).
   - FantasyXI validates the proof cryptographically against the on-chain commitment without needing wallet custody.

---

## 4. Privacy Implications

- **Sender Privacy**: The sender's balance and address remain fully shielded. Observers cannot see where the payment originated.
- **League Privacy**: Using diversified addresses prevents third parties from clustering FantasyXI's league transactions on-chain.
- **Viewing Key Hygiene**: Using an IVK allows incoming payment accounting without exposing outbound transactions or balance history of unrelated accounts.

---

## 5. Security Invariants

- **No Spending Keys in Database**: Never store seed phrases, spending keys, or unencrypted wallet files on application servers.
- **Replay Protection**: Database must enforce unique constraints on `(txid, output_index)`.
- **Confirmation Requirement**: Minimum 3 block confirmations before marking league membership `ACTIVE`.
- **No Public Wallet RPC**: The wallet RPC port must bind strictly to `localhost` / private VPC network.
