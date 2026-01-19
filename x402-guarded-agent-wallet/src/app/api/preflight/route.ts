import { NextResponse } from "next/server";
import { PreflightResultSchema } from "@/lib/shared/schemas";
import { FACILITATOR_URL, CHAIN, NETWORK } from "@/lib/shared/constants";
import { z } from "zod";    
import { runPreflight, PreflightInputSchema } from "@/lib/preflight";  
import { evaluatePolicy } from "@/lib/policy";
import { trace } from "@/lib/receipt";
import type { ActionIntent } from "@/lib/types";

const BodySchema = z.object({
  intent: z.any(),
  dryRun: z.boolean().optional(),
});

export async function POST_OLD(req: Request) {
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

  return NextResponse.json({ ok: true, policy, preflight, trace: t });
}

export async function POST() {
  const now = Math.floor(Date.now() / 1000);

  // Stub: real checks in P2
  const result = {
    health: {
      facilitatorOk: true,
      facilitatorLatencyMs: 0,
      rpcOk: true,
      rpcLatencyMs: 0,
    },
    simulation: {
      success: true,
      expectedAmountOut: "0",
      gasEstimate: "0",
    },
  };

  const parsed = PreflightResultSchema.safeParse(result);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 500 });
  }

  return NextResponse.json({
    ...parsed.data,
    meta: {
      tsUnix: now,
      facilitator: FACILITATOR_URL,
      rpc: CHAIN[NETWORK].rpcUrl,
    },
  });
}

