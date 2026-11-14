"use client";

import React from "react";
import { CiceroProvider } from "@cicero-zcash/react";
import "@cicero-zcash/react/styles.css";

export interface ZcashProvidersProps {
  children: React.ReactNode;
}

/**
 * Zcash / Cicero Provider Wrapper
 * Configured with Testnet as initial network for hackathon shielded payments.
 */
export const ZcashProviders: React.FC<ZcashProvidersProps> = ({ children }) => {
  return (
    <CiceroProvider
      initialNetwork="testnet"
      appName="FantasyXI Shielded Leagues"
      autoConnect={false}
    >
      {children}
    </CiceroProvider>
  );
};
