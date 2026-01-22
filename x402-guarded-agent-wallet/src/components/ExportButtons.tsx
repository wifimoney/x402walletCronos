"use client";

import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";

interface ExportButtonsProps {
    runReceipt: any;
}

export function ExportButtons({ runReceipt }: ExportButtonsProps) {
    const [copied, setCopied] = useState<string | null>(null);

    function copyToClipboard(text: string, label: string) {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    }

    if (!runReceipt) return null;

    const facilitatorUrl = "https://facilitator.cronoslabs.org";

    // Build cURL for verify
    const verifyBody = runReceipt.x402 ? {
        x402Version: 1,
        paymentHeader: runReceipt.payment?.paymentHeader || "<payment_header>",
        paymentRequirements: {
            scheme: "exact",
            network: "cronos-testnet",
            payTo: runReceipt.intent?.params?.to || "<recipient>",
            asset: "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0",
            maxAmountRequired: runReceipt.intent?.fee || "1000000",
        },
    } : null;

    const curlVerify = verifyBody ? `curl -X POST "${facilitatorUrl}/v2/x402/verify" \\
  -H "Content-Type: application/json" \\
  -H "X402-Version: 1" \\
  -d '${JSON.stringify(verifyBody, null, 2)}'` : null;

    const curlSettle = verifyBody ? `curl -X POST "${facilitatorUrl}/v2/x402/settle" \\
  -H "Content-Type: application/json" \\
  -H "X402-Version: 1" \\
  -d '${JSON.stringify(verifyBody, null, 2)}'` : null;

    // Extract payment header if available
    const paymentHeader = runReceipt.payment?.paymentHeader || null;

    return (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-white/5">
            {curlVerify && (
                <button
                    onClick={() => copyToClipboard(curlVerify, "verify")}
                    className="px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded flex items-center gap-1.5 text-zinc-400 transition-colors"
                    title="Copy cURL for /verify endpoint"
                >
                    {copied === "verify" ? <Check className="w-3 h-3 text-emerald-400" /> : <Terminal className="w-3 h-3" />}
                    Copy cURL (verify)
                </button>
            )}

            {curlSettle && (
                <button
                    onClick={() => copyToClipboard(curlSettle, "settle")}
                    className="px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded flex items-center gap-1.5 text-zinc-400 transition-colors"
                    title="Copy cURL for /settle endpoint"
                >
                    {copied === "settle" ? <Check className="w-3 h-3 text-emerald-400" /> : <Terminal className="w-3 h-3" />}
                    Copy cURL (settle)
                </button>
            )}

            {paymentHeader && (
                <button
                    onClick={() => copyToClipboard(paymentHeader, "header")}
                    className="px-2 py-1 text-[10px] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded flex items-center gap-1.5 text-amber-400 transition-colors"
                    title="Copy x402 payment header (base64)"
                >
                    {copied === "header" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    Copy x402 Header
                </button>
            )}

            <button
                onClick={() => copyToClipboard(JSON.stringify(runReceipt, null, 2), "json")}
                className="px-2 py-1 text-[10px] bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded flex items-center gap-1.5 text-blue-400 transition-colors"
                title="Copy full receipt JSON"
            >
                {copied === "json" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                Copy Receipt
            </button>
        </div>
    );
}
