"use client";

import { useEffect, useState } from "react";

interface CostBoxProps {
    amount: string;      // base units
    fee: string;         // base units
    balance: string;     // base units or "unknown..."
    sufficientForTotal: boolean;
    decimals?: number;
}

function formatUnits(value: string, decimals: number = 6): string {
    if (!value || value === "unknown (wallet not connected in preflight)") {
        return "?.??";
    }
    try {
        const num = BigInt(value);
        const divisor = BigInt(10 ** decimals);
        const whole = num / divisor;
        const frac = num % divisor;
        const fracStr = frac.toString().padStart(decimals, "0").slice(0, 2);
        return `${whole}.${fracStr}`;
    } catch {
        return "?.??";
    }
}

function toNumber(value: string, decimals: number = 6): number {
    try {
        const num = BigInt(value);
        const divisor = BigInt(10 ** decimals);
        return Number(num) / Number(divisor);
    } catch {
        return 0;
    }
}

export default function CostBox({ amount, fee, balance, sufficientForTotal, decimals = 6 }: CostBoxProps) {
    const [priceContext, setPriceContext] = useState<{ croUsd: number; usdceUsd: number } | null>(null);

    useEffect(() => {
        fetch("/api/price")
            .then(res => res.json())
            .then(data => {
                if (data.ok && data.priceContext) {
                    setPriceContext(data.priceContext);
                }
            })
            .catch(() => { });
    }, []);

    const amountBig = BigInt(amount || "0");
    const feeBig = BigInt(fee || "0");
    const totalRequired = amountBig + feeBig;

    let isUnknown = false;
    let isSufficient = sufficientForTotal;

    if (!balance || balance === "unknown (wallet not connected in preflight)") {
        isUnknown = true;
    }

    const totalUsd = priceContext ? toNumber(totalRequired.toString(), decimals) * priceContext.usdceUsd : null;

    return (
        <div className="bg-black/40 border border-white/10 rounded-lg p-3 space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Cost Breakdown</span>
                {priceContext && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-indigo-400">
                        💱 CRO: ${priceContext.croUsd.toFixed(3)}
                    </span>
                )}
            </div>

            <div className="flex justify-between">
                <span className="text-gray-400">Transfer Amount:</span>
                <span className="text-white">{formatUnits(amount, decimals)} USDC.e</span>
            </div>

            <div className="flex justify-between">
                <span className="text-gray-400">Agent Fee (x402):</span>
                <span className="text-blue-400">{formatUnits(fee, decimals)} USDC.e</span>
            </div>

            <div className="border-t border-white/10 my-2" />

            <div className="flex justify-between font-bold">
                <span className="text-gray-300">Total Required:</span>
                <div className="text-right">
                    <span className="text-white">{formatUnits(totalRequired.toString(), decimals)} USDC.e</span>
                    {totalUsd !== null && (
                        <span className="text-[10px] text-gray-500 ml-2">≈ ${totalUsd.toFixed(2)}</span>
                    )}
                </div>
            </div>

            <div className="flex justify-between">
                <span className="text-gray-400">Your Balance:</span>
                <span className={`flex items-center gap-1 ${isUnknown ? "text-gray-500" :
                    isSufficient ? "text-emerald-400" : "text-red-400"
                    }`}>
                    {isUnknown ? "Connect wallet" : `${formatUnits(balance, decimals)} USDC.e`}
                    {!isUnknown && (
                        <span className="text-sm">{isSufficient ? "✅" : "❌"}</span>
                    )}
                </span>
            </div>
        </div>
    );
}

