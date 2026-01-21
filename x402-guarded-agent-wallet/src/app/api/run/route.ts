import { NextResponse } from "next/server";
import { z } from "zod";
import { buildIntent } from "@/lib/plan";
import { evaluatePolicy } from "@/lib/policy";
import { runPreflight } from "@/lib/preflight";
import { buildRunReceipt, trace } from "@/lib/receipt";
import { getPaid, isExecuted, markExecuted } from "@/lib/store";
import { evaluateRisk } from "@/lib/risk";

const BodySchema = z.object({
    prompt: z.string().optional(),
    intent: z.any().optional(), // allow resuming existing intent
    dryRun: z.boolean().optional(),
    simulateRpcDown: z.boolean().optional(),
    simulateExpired: z.boolean().optional(),
    recipient: z.string().optional(),
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
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
    const simulateRpcDown = !!parsed.data.simulateRpcDown;
    const simulateExpired = !!parsed.data.simulateExpired;
    let intent = parsed.data.intent;

    const t: any[] = [];

    // 1. Plan (or use existing)
    if (!intent) {
        if (!parsed.data.prompt) {
            return NextResponse.json({ ok: false, error: "Prompt required if no intent provided" }, { status: 400 });
        }
        t.push(trace("plan", true, "Building ActionIntent..."));
        const recipient = (parsed.data.recipient || "0x0000000000000000000000000000000000000000") as `0x${string}`;
        intent = buildIntent({ prompt: parsed.data.prompt, recipient });

        // Edge Case: Simulate Expired
        if (simulateExpired) {
            // Set expiry to 1 minute ago
            intent.sessionExpiry = Math.floor(Date.now() / 1000) - 60;
            t.push(trace("plan", true, `Simulating expired intent (expiry=${intent.sessionExpiry})`));
        }

        t.push(trace("plan", true, `Intent built (id=${intent.id})`));
    } else {
        t.push(trace("plan", true, `Resuming intent (id=${intent.id})`));
    }

    if (intent) {
        (intent as any).simulateRpcDown = simulateRpcDown;
    }

    // 2. Lifecycle Checks (Idempotency + Expiry)
    if (intent.id) {
        if (isExecuted(intent.id)) {
            const policy = evaluatePolicy(intent, { dryRun });
            const preflight = { ok: false, error: "ALREADY_EXECUTED", ts: Date.now(), health: { facilitatorUp: true, supportedOk: true, rpcUp: true, latencyMs: {} } };
            const risk = evaluateRisk(intent, preflight, policy.allowed);
            return NextResponse.json({
                ok: true,
                runReceipt: buildRunReceipt({
                    intent,
                    policy,
                    risk, // NEW
                    preflight,
                    dryRun,
                    payment: null,
                    execution: { txHash: "ALREADY_EXECUTED", status: "reverted", logsSummary: ["Intent already executed"] },
                    trace: [...t, trace("lifecycle", false, "Intent already executed")],
                })
            });
        }
        const now = Math.floor(Date.now() / 1000);
        if (intent.sessionExpiry && now > intent.sessionExpiry) {
            const policy = evaluatePolicy(intent, { dryRun });
            const preflight = { ok: false, error: "EXPIRED", ts: Date.now(), health: { facilitatorUp: true, supportedOk: true, rpcUp: true, latencyMs: {} } };
            const risk = evaluateRisk(intent, preflight, policy.allowed);
            return NextResponse.json({
                ok: true,
                runReceipt: buildRunReceipt({
                    intent,
                    policy,
                    risk, // NEW
                    preflight,
                    dryRun,
                    payment: null,
                    execution: { txHash: "EXPIRED", status: "reverted", logsSummary: ["Intent session expired"] },
                    trace: [...t, trace("lifecycle", false, "Intent expired")],
                })
            });
        }
    }

    // 3. Policy
    t.push(trace("policy", true, "Evaluating policy..."));
    const policy = evaluatePolicy(intent, { dryRun });
    t.push(trace("policy", policy.allowed, policy.allowed ? "Policy allowed" : "Policy denied"));

    // 4. Preflight
    t.push(trace("preflight", true, "Running preflight checks..."));
    const walletAddress = parsed.data.walletAddress as `0x${string}` | undefined;
    const preflight = await runPreflight(intent, { walletAddress });
    t.push(trace("preflight", preflight.ok, preflight.ok ? "Preflight OK" : `Preflight failed: ${preflight.error ?? "unknown"}`));

    // Evaluate Risk (always happen)
    const risk = evaluateRisk(intent, preflight, policy.allowed);
    t.push(trace("policy", true, `Risk Score: ${risk.score} (${risk.flags.join(", ")})`));

    // Early return if blocked
    if (!policy.allowed || !preflight.ok) {
        const rr = buildRunReceipt({
            intent,
            policy,
            risk, // NEW
            preflight,
            dryRun,
            payment: null,
            execution: null,
            trace: t,
        });
        return NextResponse.json({ ok: true, runReceipt: rr });
    }

    // 5. Payment Gate (Real mode only)
    let payment: any = null;
    if (!dryRun) {
        t.push(trace("pay", true, "Checking payment gate..."));
        const paid = getPaid(intent.id);
        if (!paid) {
            t.push(trace("pay", false, "No payment found. Pay fee first."));
            const rr = buildRunReceipt({
                intent,
                policy,
                risk, // NEW
                preflight,
                dryRun,
                payment: { ok: false, error: "NOT_PAID" }, // Critical signal to UI
                execution: null,
                trace: t,
            });
            return NextResponse.json({ ok: true, runReceipt: rr });
        }
        payment = { ok: true, txHash: paid.settledTxHash, receiptId: paid.nonce };
        t.push(trace("pay", true, "Payment found ✅"));
    }

    // 6. Execution Stub / Mark Executed
    t.push(trace("execute", true, dryRun ? "Dry-run execution" : "Execution stub/ready"));

    if (!dryRun && intent.id) {
        markExecuted(intent.id);
        t.push(trace("lifecycle", true, "Marked as executed"));
    }

    const execution = {
        txHash: dryRun ? "dry-run" : "stub",
        status: "success" as const,
        logsSummary: [
            dryRun ? `Dry-run balance: ${preflight.data?.balance}` : "Real execution ready (client-side sign needed)"
        ],
    };

    const rr = buildRunReceipt({
        intent,
        policy,
        risk, // NEW
        preflight,
        dryRun,
        payment,
        execution,
        trace: t,
    });

    return NextResponse.json({ ok: true, runReceipt: rr });
}

