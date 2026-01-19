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
      payment: args.payment ?? undefined,
      execution: args.execution ?? undefined,
      trace: args.trace,
      dryRun: args.dryRun,
    };
  }