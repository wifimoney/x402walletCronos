"use client";

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

export default function CostBox({ amount, fee, balance, sufficientForTotal, decimals = 6 }: CostBoxProps) {
    const amountBig = BigInt(amount || "0");
    const feeBig = BigInt(fee || "0");
    const totalRequired = amountBig + feeBig;

    let isUnknown = false;
    let isSufficient = sufficientForTotal;

    if (!balance || balance === "unknown (wallet not connected in preflight)") {
        isUnknown = true;
    }

    return (
        <div className="bg-black/40 border border-white/10 rounded-lg p-3 space-y-2 text-xs font-mono">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Cost Breakdown</div>

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
                <span className="text-white">{formatUnits(totalRequired.toString(), decimals)} USDC.e</span>
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
