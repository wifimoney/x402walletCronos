"use client";

import { useEffect, useState } from "react";
import { Clock, RefreshCw } from "lucide-react";

interface ExpiryCountdownProps {
    expiryUnix: number; // Unix timestamp in seconds
    onExpired?: () => void;
}

export function ExpiryCountdown({ expiryUnix, onExpired }: ExpiryCountdownProps) {
    const [secondsLeft, setSecondsLeft] = useState<number>(0);

    useEffect(() => {
        function update() {
            const now = Math.floor(Date.now() / 1000);
            const remaining = expiryUnix - now;
            setSecondsLeft(Math.max(0, remaining));

            if (remaining <= 0 && onExpired) {
                onExpired();
            }
        }

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [expiryUnix, onExpired]);

    if (!expiryUnix || expiryUnix <= 0) return null;

    const isExpired = secondsLeft <= 0;
    const isWarning = secondsLeft > 0 && secondsLeft <= 30;
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;

    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono transition-all ${isExpired
                ? "bg-red-500/10 border border-red-500/30 text-red-400"
                : isWarning
                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse"
                    : "bg-blue-500/10 border border-blue-500/30 text-blue-400"
            }`}>
            {isExpired ? (
                <>
                    <RefreshCw className="w-3 h-3" />
                    <span>Expired – Regenerate</span>
                </>
            ) : (
                <>
                    <Clock className="w-3 h-3" />
                    <span>Expires in {minutes}:{seconds.toString().padStart(2, "0")}</span>
                </>
            )}
        </div>
    );
}
