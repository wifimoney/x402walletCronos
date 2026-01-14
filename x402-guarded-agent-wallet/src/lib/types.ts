export type CronosNetwork = "cronos-testnet" | "cronos-mainnet";

export type ActionIntent = {
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
    rpcUp: boolean;
    latencyMs: { facilitator?: number; rpc?: number };
  };
  quote?: {
    expectedOut: string;
    path: string[];
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