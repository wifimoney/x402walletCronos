"use client";

type StepStatus = "pending" | "active" | "success" | "error";

interface Step {
    id: string;
    label: string;
    status: StepStatus;
    tooltip?: string;
}

function getStepIcon(status: StepStatus) {
    switch (status) {
        case "success": return "✅";
        case "error": return "❌";
        case "active": return "⏳";
        default: return "○";
    }
}

function getStepColor(status: StepStatus) {
    switch (status) {
        case "success": return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
        case "error": return "text-red-400 border-red-500/30 bg-red-500/10";
        case "active": return "text-blue-400 border-blue-500/30 bg-blue-500/10 animate-pulse";
        default: return "text-gray-600 border-gray-700 bg-gray-900/50";
    }
}

export default function StepTimeline({ receipt }: { receipt: any }) {
    if (!receipt) return null;

    const intentCreated = !!receipt.intent?.id;
    const policyOk = receipt.policy?.allowed === true;
    const policyError = receipt.policy?.allowed === false;
    const preflightOk = receipt.preflight?.ok === true;
    const preflightError = receipt.preflight?.ok === false;
    const paymentOk = receipt.payment?.ok === true;
    const paymentPending = !receipt.payment?.ok && !receipt.dryRun;
    const executionOk = receipt.execution?.status === "success" &&
        receipt.execution?.txHash !== "dry-run" &&
        receipt.execution?.txHash !== "stub";
    const isDryRun = receipt.dryRun;

    const steps: Step[] = [
        {
            id: "intent",
            label: "Intent",
            status: intentCreated ? "success" : "pending",
            tooltip: intentCreated ? `Created: ${receipt.intent.id}` : "Waiting for intent",
        },
        {
            id: "policy",
            label: "Policy",
            status: policyError ? "error" : policyOk ? "success" : "pending",
            tooltip: policyOk
                ? `Allowed (${receipt.policy?.rulesTriggered?.length || 0} rules)`
                : receipt.policy?.reason || "Pending",
        },
        {
            id: "preflight",
            label: "Preflight",
            status: preflightError ? "error" : preflightOk ? "success" : "pending",
            tooltip: preflightOk
                ? `OK (Facilitator: ${receipt.preflight?.health?.latencyMs?.facilitator || 0}ms)`
                : receipt.preflight?.error || "Pending",
        },
        {
            id: "payment",
            label: isDryRun ? "x402 (Dry)" : "x402 Paid",
            status: isDryRun ? "success" : paymentOk ? "success" : paymentPending ? "active" : "pending",
            tooltip: isDryRun
                ? "Dry-run mode - payment skipped"
                : paymentOk
                    ? `Verified: ${receipt.payment?.verified ? '✅' : '❌'} • Settled: ${receipt.payment?.settled ? '✅' : '❌'}`
                    : "Awaiting payment",
        },
        {
            id: "execute",
            label: "Execute",
            status: executionOk ? "success" : (preflightOk && (paymentOk || isDryRun)) ? "active" : "pending",
            tooltip: executionOk
                ? `TX: ${receipt.execution?.txHash?.slice(0, 10)}...`
                : "Ready for execution",
        },
        {
            id: "receipt",
            label: "Receipt",
            status: executionOk ? "success" : "pending",
            tooltip: executionOk ? "Complete" : "Pending execution",
        },
    ];

    return (
        <div className="flex items-center justify-between gap-1 p-4 bg-black/30 rounded-xl border border-white/5 overflow-x-auto">
            {steps.map((step, i) => (
                <div key={step.id} className="flex items-center gap-1 flex-shrink-0">
                    {/* Step Node */}
                    <div className="group relative">
                        <div
                            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${getStepColor(step.status)}`}
                        >
                            {getStepIcon(step.status)}
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 border border-white/10 rounded text-[10px] text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {step.tooltip}
                        </div>
                        {/* Label */}
                        <div className={`text-[9px] text-center mt-1 font-medium uppercase tracking-wide ${step.status === "success" ? "text-emerald-400" :
                            step.status === "error" ? "text-red-400" :
                                step.status === "active" ? "text-blue-400" :
                                    "text-gray-600"
                            }`}>
                            {step.label}
                        </div>
                    </div>
                    {/* Connector */}
                    {i < steps.length - 1 && (
                        <div className={`w-6 h-0.5 ${step.status === "success" ? "bg-emerald-500/50" :
                            step.status === "active" ? "bg-blue-500/30" :
                                "bg-gray-800"
                            }`} />
                    )}
                </div>
            ))}
        </div>
    );
}
