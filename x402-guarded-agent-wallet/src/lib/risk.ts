import { ActionIntent, PreflightReceipt } from "./types";
import {
    RISK_FLAGS,
    RiskAnalysis,
    RiskFlag,
    MAX_SAFE_SLIPPAGE_BPS,
    SLOW_RPC_THRESHOLD_MS,
    SLOW_FACILITATOR_THRESHOLD_MS,
} from "./risk-constants";

export function evaluateRisk(
    intent: ActionIntent,
    preflight: PreflightReceipt,
    policyAllowed: boolean
): RiskAnalysis {
    let score = 0;
    const flags: RiskFlag[] = [];
    let reason: string | undefined;

    // 1. Critical Failures (Score 100)
    if (!policyAllowed) {
        score = 100;
        flags.push(RISK_FLAGS.POLICY_DENIED);
        reason = "Policy denied execution.";
        return { score, flags, reason };
    }

    if (!preflight.ok) {
        score = 100;
        flags.push(RISK_FLAGS.PREFLIGHT_FAILED);
        reason = "Preflight checks failed.";
        return { score, flags, reason };
    }

    // 2. Slippage Risk (Skipped for Transfer)
    // if ((intent.params as any).maxSlippageBps > MAX_SAFE_SLIPPAGE_BPS) { ... }

    // 3. Liquidity / Simulation Risk
    if (!preflight.simulation && !preflight.data) {
        score += 50;
        flags.push(RISK_FLAGS.NO_LIQUIDITY); // Or NO_DATA
        reason = reason || "No valid balance data or simulation found.";
    } else if (preflight.simulation && !preflight.simulation.success) {
        score += 80;
        flags.push(RISK_FLAGS.SIMULATION_FAILED);
        reason = reason || "Simulation reverted (execution likely to fail).";
    }

    // 4. Infrastructure Latency Risk
    if (preflight.health.latencyMs.rpc && preflight.health.latencyMs.rpc > SLOW_RPC_THRESHOLD_MS) {
        score += 10;
        flags.push(RISK_FLAGS.RPC_SLOW);
    }

    if (preflight.health.latencyMs.facilitator && preflight.health.latencyMs.facilitator > SLOW_FACILITATOR_THRESHOLD_MS) {
        score += 10;
        flags.push(RISK_FLAGS.FACILITATOR_SLOW);
    }

    // Cap score at 100
    score = Math.min(score, 100);

    return {
        score,
        flags,
        reason,
    };
}
