"use client";

import { useState } from "react";

interface RecipientSelectorProps {
    sellerAddress: string;
    userAddress?: string;
    value: string;
    onChange: (address: string) => void;
}

export default function RecipientSelector({
    sellerAddress,
    userAddress,
    value,
    onChange,
}: RecipientSelectorProps) {
    const [mode, setMode] = useState<"fee" | "self" | "custom">("fee");
    const [customAddress, setCustomAddress] = useState("");

    const handleModeChange = (newMode: "fee" | "self" | "custom") => {
        setMode(newMode);
        if (newMode === "fee") {
            onChange(sellerAddress);
        } else if (newMode === "self" && userAddress) {
            onChange(userAddress);
        } else if (newMode === "custom") {
            onChange(customAddress || sellerAddress);
        }
    };

    const handleCustomChange = (addr: string) => {
        setCustomAddress(addr);
        if (mode === "custom" && addr.startsWith("0x") && addr.length === 42) {
            onChange(addr);
        }
    };

    return (
        <div className="bg-black/40 border border-white/10 rounded-lg p-3 space-y-2 text-xs">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Recipient</div>

            <div className="flex gap-2">
                <button
                    onClick={() => handleModeChange("fee")}
                    className={`flex-1 py-2 px-3 rounded-md border text-[10px] font-medium uppercase tracking-wide transition-all ${mode === "fee"
                        ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                        : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400"
                        }`}
                >
                    Fee Wallet
                </button>
                <button
                    onClick={() => handleModeChange("self")}
                    disabled={!userAddress}
                    className={`flex-1 py-2 px-3 rounded-md border text-[10px] font-medium uppercase tracking-wide transition-all ${mode === "self"
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                        : !userAddress
                            ? "border-gray-800 text-gray-700 cursor-not-allowed"
                            : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400"
                        }`}
                >
                    Self
                </button>
                <button
                    onClick={() => handleModeChange("custom")}
                    className={`flex-1 py-2 px-3 rounded-md border text-[10px] font-medium uppercase tracking-wide transition-all ${mode === "custom"
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                        : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400"
                        }`}
                >
                    Custom
                </button>
            </div>

            {mode === "custom" && (
                <input
                    type="text"
                    placeholder="0x..."
                    value={customAddress}
                    onChange={(e) => handleCustomChange(e.target.value)}
                    className="w-full bg-black/50 border border-gray-700 rounded-md px-3 py-2 text-xs font-mono text-gray-300 focus:border-amber-500/50 focus:outline-none"
                />
            )}

            <div className="text-[10px] text-gray-600 font-mono truncate">
                → {value?.slice(0, 10)}...{value?.slice(-8)}
            </div>
            <div className="text-[9px] text-gray-600 italic mt-1">
                Fee wallet receives x402 fee. Transfer recipient is separate.
            </div>
        </div>
    );
}
