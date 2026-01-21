export type CronosNetwork = "cronos-testnet" | "cronos-mainnet";

export type ActionIntent = {
  id: string;                  // unique intent identifier
  idempotencyKey?: string;     // hash(params + seller + chainId) for deduplication
  createdAt: number;           // unix seconds
  action: "transfer";
  params: {
    token: `0x${string}`;   // USDC.e
    to: `0x${string}`;      // Recipient
    amount: string;         // base units (wei-like string)
  };
  fee: string;                // USDC.e base units
  requiredTotal: string;      // amount + fee
  sessionExpiry: number;       // unix seconds
};

export type PreflightReceipt = {
  ok: boolean;
  health: {
    facilitatorUp: boolean;
    supportedOk: boolean;
    supported?: { network: string; scheme: string; x402Version: number } | null;
    rpcUp: boolean;
    latencyMs: { facilitator?: number; rpc?: number };
  };
  data?: {
    balance: string;         // User's balance of token
    sufficient: boolean;     // balance >= amount
    sufficientForTotal: boolean; // balance >= amount + fee
    requiredTotal: string;   // amount + fee
  };
  simulation?: {
    success: boolean;
    notes?: string;
    revertReason?: string | null;
  };
  error?: string;
  changes?: string[];      // List of things changed since last run (if retrying)
  ts: number;
};

export type X402PaymentRequirements = {
  scheme: "exact";
  network: CronosNetwork;
  payTo: `0x${string}`;
  asset: `0x${string}`; // USDC.e
  maxAmountRequired: string;
  maxTimeoutSeconds: number;
};

export type X402DecodedPaymentHeader = {
  x402Version: 1;
  scheme: "exact";
  network: CronosNetwork;
  payload: {
    from: `0x${string}`;
    to: `0x${string}`;
    value: string;
    validAfter: number;
    validBefore: number;
    nonce: `0x${string}`;
    signature: `0x${string}`;
    asset: `0x${string}`;
  };
};

import { RiskAnalysis } from "./risk-constants";

export type RunReceipt = {
  receiptVersion: "1.0";
  x402Version: 1;
  schemaHash?: string;         // Hash of schema for validation
  idempotencyKey?: string;     // From intent
  deduped?: boolean;           // True if this was a duplicate run
  intent: ActionIntent;
  policy: { allowed: boolean; rulesTriggered: string[]; reason?: string };
  risk?: RiskAnalysis; // Added RiskAnalysis
  preflight: PreflightReceipt;
  dryRun: boolean;
  payment: { ok: boolean; error?: string; txHash?: string; receiptId?: string } | null;
  x402?: {
    verify: { isValid: boolean; timestamp?: number };
    settle: { txHash?: string; link?: string; timestamp?: number };
    trace?: { step: "verify" | "settle"; ok: boolean; timestamp: number }[]; // Explicit trace
  };
  execution: {
    txHash: string;
    status: "success" | "reverted" | "failed";
    approveTxHash?: string | null;
    links?: { approve?: string | null; swap?: string | null };
    balanceDeltas?: { token: string };
    enforced?: { amount: string };
    logsSummary: string[];
    workflowPath?: string[]; // Added workflowPath
  } | null;
  trace: any[];
};