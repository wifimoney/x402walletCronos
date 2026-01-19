import { NextResponse } from "next/server";
import { z } from "zod";
import { buildIntent } from "@/lib/plan";
import { evaluatePolicy } from "@/lib/policy";
import { runPreflight } from "@/lib/preflight";
import { buildRunReceipt, trace } from "@/lib/receipt";
import { getPaid } from "@/lib/store";

const BodySchema = z.object({
    prompt: z.string().min(1),
    dryRun: z.boolean().optional(),
    recipient: z.string().optional(),
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

    const dryRun = !!parsed.data.dryRun;
    const recipient = (parsed.data.recipient ||
        "0x0000000000000000000000000000000000000000") as `0x${string}`;

    const t: any[] = [];
    t.push(trace("plan", true, "Building ActionIntent..."));
    const intent = buildIntent({ prompt: parsed.data.prompt, recipient });
    t.push(trace("plan", true, `Intent built (id=${intent.id})`));

    t.push(trace("policy", true, "Evaluating policy..."));
    const policy = evaluatePolicy(intent, { dryRun });
    t.push(trace("policy", policy.allowed, policy.allowed ? "Policy allowed" : "Policy denied"));

    t.push(trace("preflight", true, "Running preflight checks..."));
    const preflight = await runPreflight(intent);
    t.push(trace("preflight", preflight.ok, preflight.ok ? "Preflight OK" : `Preflight failed: ${preflight.error ?? "unknown"}`));

    // Early return if blocked
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

    // Pay gate only in real mode
    let payment: any = null;
    if (!dryRun) {
        t.push(trace("pay", true, "Checking payment gate..."));
        const paid = getPaid(intent.id);
        if (!paid) {
            t.push(trace("pay", false, "No payment found for this intentId. Pay fee first."));
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

    // Execution still dry-run in P4 (real swap in next step)
    t.push(trace("execute", true, dryRun ? "Dry-run execution (no chain tx)" : "Execution stub"));
    const execution = {
        txHash: dryRun ? "dry-run" : "stub",
        status: "success" as const,
        logsSummary: [
            dryRun
                ? `Dry-run: expectedOut=${preflight.quote?.expectedOut ?? "n/a"}`
                : "Execution not implemented yet",
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
