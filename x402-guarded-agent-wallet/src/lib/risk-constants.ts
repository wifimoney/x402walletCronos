
export const RISK_FLAGS = {
    HIGH_SLIPPAGE: "HIGH_SLIPPAGE",
    NO_LIQUIDITY: "NO_LIQUIDITY",
    STALE_QUOTE: "STALE_QUOTE",
    RPC_SLOW: "RPC_SLOW",
    FACILITATOR_SLOW: "FACILITATOR_SLOW",
    SIMULATION_FAILED: "SIMULATION_FAILED",
    POLICY_DENIED: "POLICY_DENIED",
    PREFLIGHT_FAILED: "PREFLIGHT_FAILED",
} as const;

export type RiskFlag = keyof typeof RISK_FLAGS;

export type RiskAnalysis = {
    score: number; // 0-100, where 0 is safest
    flags: RiskFlag[];
    reason?: string;
};

export const MAX_SAFE_SLIPPAGE_BPS = 100; // 1%
export const SLOW_RPC_THRESHOLD_MS = 1000;
export const SLOW_FACILITATOR_THRESHOLD_MS = 2000;
