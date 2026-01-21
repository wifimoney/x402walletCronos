import type {
  ActionIntent,
  PreflightReceipt,
  RunReceipt,
} from "./types";
import type { RiskAnalysis } from "./risk-constants";

export function trace(step: RunReceipt["trace"][number]["step"], ok: boolean, message: string) {
  return {
    tsUnix: Math.floor(Date.now() / 1000),
    step,
    ok,
    message,
  };
}

export function buildRunReceipt(args: {
  intent: ActionIntent;
  policy: { allowed: boolean; rulesTriggered: string[]; reason?: string };
  risk?: RiskAnalysis;
  preflight: PreflightReceipt;
  dryRun: boolean;
  payment?: { ok: boolean; receiptId?: string; txHash?: string; error?: string } | null;
  execution?: { txHash: string; status: "success" | "reverted"; logsSummary?: string[] } | null;
  trace: RunReceipt["trace"];
}): RunReceipt {
  return {
    intent: args.intent as any,
    policy: args.policy as any,
    risk: args.risk,
    preflight: args.preflight as any,
    payment: args.payment ?? null,
    x402: args.payment?.ok
      ? {
        verify: { isValid: true, timestamp: Date.now() },
        settle: {
          txHash: args.payment.txHash,
          link: args.payment.txHash
            ? `https://explorer.cronos.org/testnet/tx/${args.payment.txHash}`
            : undefined,
          timestamp: Date.now(),
        },
        trace: [
          { step: "verify", ok: true, timestamp: Date.now() },
          { step: "settle", ok: !!args.payment.txHash, timestamp: Date.now() }
        ]
      }
      : undefined,
    execution: args.execution
      ? {
        ...args.execution,
        logsSummary: args.execution.logsSummary ?? [],
        approveTxHash: args.execution.status === "success" || args.execution.status === "reverted" ? null : undefined, // quick fix to match implied type strictness if needed, or just let spread handle it if types align
      } as any // Cast to any to assume compatibility or fix strict types properly
      : null,
    trace: args.trace,
    dryRun: args.dryRun,
  };
}