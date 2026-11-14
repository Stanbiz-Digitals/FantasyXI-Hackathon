"use client";

import React, { useState } from "react";
import {
  useCicero,
  useAccount,
  useConnectModal,
  CiceroConnectButton,
  generateZip321Uri,
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
  const { isConnected, address, wallet } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submittedTxId, setSubmittedTxId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  // Generate unique memo reference for this league entry
  const invoiceReference = `FANTASYXI:${leagueId.slice(0, 8)}:${entryFeeZec}`;

  // Build standard RFC-compliant ZIP-321 Payment URI
  const zip321Uri = generateZip321Uri({
    address: receivingAddress,
    amount: entryFeeZec,
    memo: invoiceReference,
    message: `Entry fee for ${leagueName}`,
  });

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
    <div className="space-y-4 pt-2">
      {/* Network Badge & Privacy Notice */}
      <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-start gap-3">
        <IconShield className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs text-purple-200">
          <div className="font-semibold text-purple-300">Zcash Shielded Payment (Testnet)</div>
          <div className="text-[11px] text-purple-300/80 mt-0.5">
            Powered by Cicero wallet adapter. Zero-knowledge shielded transfer with encrypted invoice reference memo.
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <IconAlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
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
          <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 break-all">
            TxID: {submittedTxId}
          </div>
        </div>
      ) : (
        <>
          {/* Amount and Invoice Memo */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Shielded Entry Fee
                </span>
                <div className="text-2xl font-black text-purple-400 font-mono">
                  {entryFeeZec} ZEC
                </div>
              </div>
              <div className="text-right">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/60 border border-purple-500/30 text-purple-300 font-semibold uppercase">
                  Zcash Testnet
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Required Memo Reference</span>
              <div className="flex items-center gap-1.5 font-mono text-purple-300 text-[11px]">
                <span>{invoiceReference}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(invoiceReference, "memo")}
                  className="text-slate-400 hover:text-white"
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

          {/* Wallet Connection Bar via Cicero */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-300">
                {isConnected ? `${wallet?.name || "Zcash Wallet"} Connected` : "Zcash Wallet (Cicero)"}
              </div>
              <div className="text-[10px] text-slate-500 truncate font-mono mt-0.5">
                {address ? address : "Zucchini (Extension), Zashi, or Ywallet"}
              </div>
            </div>
            <div>
              {isConnected ? (
                <CiceroConnectButton />
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={openConnectModal}
                  className="text-xs font-semibold"
                >
                  Connect Wallet
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
              className="w-full justify-center bg-purple-600 hover:bg-purple-500 border-purple-500 font-bold uppercase tracking-wide text-xs py-3.5"
            >
              Pay {entryFeeZec} ZEC via Cicero
            </Button>

            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="w-full text-center text-[11px] text-slate-400 hover:text-purple-300 underline py-1"
            >
              {showQr ? "Hide QR Code" : "Show ZIP-321 Payment QR Code (Zashi / Ywallet)"}
            </button>

            {showQr && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-3 animate-fadeIn">
                <div className="p-3 bg-white rounded-lg inline-block mx-auto">
                  <CiceroQRCode value={zip321Uri} size={180} />
                </div>
                <div className="text-[10px] text-slate-400">
                  Scan with Zashi, Ywallet, or any ZIP-321 compatible shielded wallet to pay.
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => copyToClipboard(zip321Uri, "uri")}
                    className="text-[10px] py-1 px-2.5"
                  >
                    {copiedField === "uri" ? "URI Copied" : "Copy ZIP-321 URI"}
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
