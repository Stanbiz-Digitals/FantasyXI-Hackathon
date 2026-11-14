"use client";

import React, { useState } from "react";
import {
  useCicero,
  useAccount,
  useConnectModal,
  useAccountModal,
  generateZip321Uri,
  getWalletDeepLinks,
  truncateAddress,
  CiceroQRCode,
} from "@cicero-zcash/react";
import { Button } from "@/components/ui/Button";
import { IconCopy, IconCheck, IconShield, IconAlertCircle } from "@/components/ui/Icons";

export interface ZcashPaymentTabProps {
  leagueId: string;
  leagueName: string;
  entryFeeZec?: number;
  receivingAddress?: string;
  onPaymentSuccess?: () => void;
}

export const ZcashPaymentTab: React.FC<ZcashPaymentTabProps> = ({
  leagueId,
  leagueName,
  entryFeeZec = 0.05,
  receivingAddress = "utest1zcashshieldedreceiverfantasyxileaguestestnetaddress00000000000000000000000000000000",
}) => {
  const { sendPayment, network, switchNetwork } = useCicero();
  const { isConnected, isConnecting, address, wallet } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submittedTxId, setSubmittedTxId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  // Generate unique memo reference for this league entry
  const invoiceReference = `FANTASYXI:${leagueId.slice(0, 8)}:${entryFeeZec}`;

  // Build standard RFC-compliant ZIP-321 Payment URI & Mobile Deep Links
  const zip321Uri = generateZip321Uri({
    address: receivingAddress,
    amount: entryFeeZec,
    memo: invoiceReference,
    message: `Entry fee for ${leagueName}`,
  });
  const deepLinks = getWalletDeepLinks(zip321Uri);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSendPayment = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      if (network !== "testnet") {
        await switchNetwork("testnet");
      }

      const res = await sendPayment({
        recipient: receivingAddress,
        amount: entryFeeZec,
        memo: invoiceReference,
        message: `FantasyXI League: ${leagueName}`,
      });

      if (res.txId) {
        setSubmittedTxId(res.txId);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to broadcast payment request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pt-1 w-full max-w-full overflow-hidden">
      {/* Network Badge & Privacy Notice */}
      <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-3">
        <IconShield className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs text-purple-200">
          <div className="font-semibold text-purple-300">Zcash Shielded Payment (Testnet)</div>
          <div className="text-[11px] text-purple-300/80 mt-0.5 leading-relaxed">
            Powered by Cicero wallet adapter. Zero-knowledge shielded transfer with encrypted invoice reference memo.
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <IconAlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="break-words">{errorMsg}</span>
        </div>
      )}

      {submittedTxId ? (
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-center space-y-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
            <IconCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-300">Transaction Broadcast Submitted</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Your payment was transmitted to the network. The backend reconciliation service will verify on-chain confirmations and activate your league membership.
            </div>
          </div>
          <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 break-all select-all">
            TxID: {submittedTxId}
          </div>
        </div>
      ) : (
        <>
          {/* Amount and Invoice Memo */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Shielded Entry Fee
                </span>
                <div className="text-2xl font-black text-purple-400 font-mono">
                  {entryFeeZec} ZEC
                </div>
              </div>
              <div className="self-start sm:self-auto">
                <span className="px-2.5 py-1 rounded text-[10px] font-mono bg-purple-950/80 border border-purple-500/30 text-purple-300 font-semibold uppercase">
                  Zcash Testnet
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
              <span className="text-slate-400">Required Memo Reference:</span>
              <div className="flex items-center gap-1.5 font-mono text-purple-300 text-[11px] break-all">
                <span>{invoiceReference}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(invoiceReference, "memo")}
                  className="p-1 text-slate-400 hover:text-white shrink-0 transition-colors"
                  title="Copy memo"
                >
                  {copiedField === "memo" ? (
                    <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <IconCopy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Wallet Connection Bar via Cicero — Fully Responsive on Desktop & Mobile */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-purple-400 animate-pulse"}`} />
                <span>{isConnected ? `${wallet?.name || "Zcash Wallet"} Connected` : "Zcash Shielded Wallet"}</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate font-mono mt-0.5">
                {address ? truncateAddress(address, 10, 6) : "Zucchini (Extension), Zashi, or Ywallet"}
              </div>
            </div>

            <div className="shrink-0 w-full sm:w-auto">
              {isConnected ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={openAccountModal}
                    className="w-full sm:w-auto text-xs font-semibold py-1.5 px-3 bg-purple-950/60 border-purple-500/30 text-purple-200 hover:bg-purple-900/60"
                  >
                    Wallet Info
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={openConnectModal}
                  disabled={isConnecting}
                  className="w-full sm:w-auto text-xs font-semibold py-1.5 px-3.5 bg-purple-600 hover:bg-purple-500 text-white border-transparent"
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </Button>
              )}
            </div>
          </div>

          {/* Action Buttons: 1-Click Send or Mobile ZIP-321 QR */}
          <div className="space-y-2 pt-1">
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              onClick={handleSendPayment}
              className="w-full justify-center bg-purple-600 hover:bg-purple-500 border-purple-500 font-bold uppercase tracking-wide text-xs py-3.5 shadow-md shadow-purple-900/20"
            >
              Pay {entryFeeZec} ZEC via Cicero
            </Button>

            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="w-full text-center text-[11px] text-slate-400 hover:text-purple-300 underline py-1 transition-colors"
            >
              {showQr ? "Hide QR Code" : "Show ZIP-321 Payment QR Code & Mobile Links"}
            </button>

            {showQr && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-3 animate-fadeIn">
                <div className="p-3 bg-white rounded-xl inline-block mx-auto shadow-inner max-w-full">
                  <CiceroQRCode value={zip321Uri} size={160} />
                </div>
                <div className="text-[11px] text-slate-400 px-2 leading-relaxed">
                  Scan with <strong className="text-purple-300">Zashi</strong>, <strong className="text-purple-300">Ywallet</strong>, or tap below to open your mobile wallet directly.
                </div>

                {/* Mobile Deep Link Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <a
                    href={deepLinks.zashi}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-purple-200 text-xs font-semibold transition-colors"
                  >
                    Open in Zashi
                  </a>
                  <a
                    href={deepLinks.ywallet}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-purple-200 text-xs font-semibold transition-colors"
                  >
                    Open in Ywallet
                  </a>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => copyToClipboard(zip321Uri, "uri")}
                    className="w-full sm:w-auto text-[11px] py-1.5 px-3 bg-slate-900 border-slate-700 text-slate-300"
                  >
                    {copiedField === "uri" ? "URI Copied!" : "Copy ZIP-321 URI"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => copyToClipboard(receivingAddress, "address")}
                    className="w-full sm:w-auto text-[11px] py-1.5 px-3 bg-slate-900 border-slate-700 text-slate-300"
                  >
                    {copiedField === "address" ? "Address Copied!" : "Copy Address"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
