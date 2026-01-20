import type {
  ActionIntent,
  PreflightReceipt,
  RunReceipt,
} from "./types";

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
  preflight: PreflightReceipt;
  dryRun: boolean;
  payment?: { ok: boolean; receiptId?: string; txHash?: string; error?: string } | null;
  execution?: { txHash: string; status: "success" | "reverted"; logsSummary?: string[] } | null;
  trace: RunReceipt["trace"];
}): RunReceipt {
  return {
    intent: args.intent as any,
    policy: args.policy as any,
    preflight: args.preflight as any,
    payment: args.payment ?? null,
    x402: args.payment?.ok
      ? {
        verify: { isValid: true },
        settle: {
          txHash: args.payment.txHash,
          link: args.payment.txHash
            ? `https://explorer.cronos.org/testnet/tx/${args.payment.txHash}` // TODO: Use env/network aware link
            : undefined,
        },
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