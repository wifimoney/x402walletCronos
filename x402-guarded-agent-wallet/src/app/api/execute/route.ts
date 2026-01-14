import { NextResponse } from "next/server";
import { z } from "zod";
import type { ActionIntent } from "@/lib/types";
import { evaluatePolicy } from "@/lib/policy";
import { runPreflight } from "@/lib/preflight";
import { buildRunReceipt, trace } from "@/lib/receipt";
import { getPaid } from "@/lib/store";

const BodySchema = z.object({
  intent: z.any(),
  dryRun: z.boolean().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const intent = parsed.data.intent as ActionIntent;
  const dryRun = !!parsed.data.dryRun;

  const t: any[] = [];
  t.push(trace("policy", true, "Evaluating policy..."));
  const policy = evaluatePolicy(intent, { dryRun });
  t.push(trace("policy", policy.allowed, policy.allowed ? "Policy allowed" : "Policy denied"));

  t.push(trace("preflight", true, "Running preflight checks..."));
  const preflight = await runPreflight(intent);
  t.push(trace("preflight", preflight.ok, preflight.ok ? "Preflight OK" : `Preflight failed: ${preflight.error ?? "unknown"}`));

  // If policy or preflight fails, return receipt early.
  if (!policy.allowed || !preflight.ok) {
    const rr = buildRunReceipt({
      intent,
      policy,
      preflight,
      dryRun,
      payment: null,
      execution: null,
      trace: t,
    });
    return NextResponse.json({ ok: true, runReceipt: rr });
  }

  // Payment gate (only in real mode)
  let payment: any = null;
  if (!dryRun) {
    t.push(trace("pay", true, "Checking payment gate..."));
    const paid = getPaid((intent as any).id ?? ""); // if you later add intent.id, use it here
    if (!paid) {
      t.push(trace("pay", false, "No payment found for intent (run dry-run or pay first)."));
      const rr = buildRunReceipt({
        intent,
        policy,
        preflight,
        dryRun,
        payment: { ok: false, error: "NOT_PAID" },
        execution: null,
        trace: t,
      });
      return NextResponse.json({ ok: true, runReceipt: rr });
    }
    payment = { ok: true, txHash: paid.settledTxHash, receiptId: paid.nonce };
    t.push(trace("pay", true, "Payment found ✅"));
  }

  // Execution (P3 = dry-run execution only)
  // P4 will replace this with real swap tx execution.
  t.push(trace("execute", true, dryRun ? "Dry-run execution (no chain tx)" : "Execution stub"));
  const execution = {
    txHash: dryRun ? "dry-run" : "stub",
    status: "success" as const,
    logsSummary: [
      dryRun
        ? `Dry-run: expectedOut=${preflight.quote?.expectedOut ?? "n/a"}`
        : "Execution not implemented in P3",
    ],
  };

  const rr = buildRunReceipt({
    intent,
    policy,
    preflight,
    dryRun,
    payment,
    execution,
    trace: t,
  });

  return NextResponse.json({ ok: true, runReceipt: rr });
}