"use client";

import { useState } from "react";

interface SupportTicketProps {
    runReceipt: any;
    chainId: number;
}

export default function SupportTicket({ runReceipt, chainId }: SupportTicketProps) {
    const [copied, setCopied] = useState(false);

    if (!runReceipt) return null;

    const generateTicket = () => {
        const lines = [
            "## x402 Support Request",
            `**Run ID:** \`${runReceipt.intent?.id || "unknown"}\``,
            `**Intent ID:** \`${runReceipt.intent?.id || "unknown"}\``,
            `**Idempotency Key:** \`${runReceipt.idempotencyKey || "N/A"}\``,
            `**Chain ID:** ${chainId}`,
            `**Timestamp:** ${new Date().toISOString()}`,
            "",
            "### Status",
            `- **Policy:** ${runReceipt.policy?.allowed ? "✅ Allowed" : "❌ Denied"}`,
            `- **Preflight:** ${runReceipt.preflight?.ok ? "✅ OK" : `❌ Failed (${runReceipt.preflight?.error})`}`,
            `- **Payment:** ${runReceipt.payment?.ok ? "✅ Paid" : "❌ Unpaid"}`,
            `- **Execution:** ${runReceipt.execution?.status || "Pending"}`,
            "",
            "### Latency Metrics",
            `- **Facilitator:** ${runReceipt.preflight?.health?.latencyMs?.facilitator ?? "?"}ms`,
            `- **RPC:** ${runReceipt.preflight?.health?.latencyMs?.rpc ?? "?"}ms`,
            "",
            "### Error Details",
            runReceipt.preflight?.error ? `> ${runReceipt.preflight.error}` : "No errors reported.",
        ];
        return lines.join("\n");
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generateTicket());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="mt-4 pt-4 border-t border-white/5">
            <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs font-mono text-gray-500 hover:text-white hover:border-gray-600 transition-all uppercase tracking-wide"
            >
                <span className="text-sm">🎫</span>
                {copied ? "Ticket Copied! 📋" : "Copy Support Ticket"}
            </button>
        </div>
    );
}
