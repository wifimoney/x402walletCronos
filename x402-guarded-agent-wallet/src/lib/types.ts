export type CronosNetwork = "cronos-testnet" | "cronos-mainnet";

export type ActionIntent = {
  id: string;                  // unique intent identifier
  createdAt: number;           // unix seconds
  action: "swap";
  params: {
    tokenIn: `0x${string}`;   // USDC.e
    tokenOut: `0x${string}`;  // WCRO (for now)
    amountIn: string;         // base units (wei-like string)
    maxSlippageBps: number;   // e.g. 50 = 0.50%
    deadline: number;         // unix seconds
  };
  fee: string;                // USDC.e base units
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
  quote?: {
    expectedOut: string;
    minOut: string;
    path: string[];          // The successful path
    pathUsed: string[];      // Alias for path, for explicit tracking
    pathsTried: string[][];  // History of paths attempted
  };
  simulation?: {
    success: boolean;
    notes?: string;
    revertReason?: string | null;
  };
  error?: string;
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

export type RunReceipt = {
  intent: ActionIntent;
  policy: { allowed: boolean; rulesTriggered: string[]; reason?: string };
  preflight: PreflightReceipt;
  dryRun: boolean;
  payment: { ok: boolean; error?: string; txHash?: string; receiptId?: string } | null;
  x402?: {
    verify: { isValid: boolean };
    settle: { txHash?: string; link?: string };
  };
  execution: {
    txHash: string;
    status: "success" | "reverted" | "failed";
    approveTxHash?: string | null;
    links?: { approve?: string | null; swap?: string | null };
    beforeBalances?: { tokenIn: string; tokenOut: string };
    afterBalances?: { tokenIn: string; tokenOut: string };
    balanceDeltas?: { tokenIn: string; tokenOut: string };
    enforced?: { amountOutMin: string; deadline: number; path: `0x${string}`[] };
    logsSummary: string[];
  } | null;
  trace: any[];
};