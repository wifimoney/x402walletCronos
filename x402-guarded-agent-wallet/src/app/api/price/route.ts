import { NextResponse } from "next/server";

// Crypto.com MCP-style price context endpoint
// Returns live CRO/USD price and stable USDC.e price

const COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price";

export async function GET() {
    try {
        // Fetch CRO price from CoinGecko (free tier)
        const res = await fetch(
            `${COINGECKO_API}?ids=crypto-com-chain&vs_currencies=usd`,
            { next: { revalidate: 60 } } // Cache 60 seconds
        );

        let croUsd = 0.10; // Fallback
        if (res.ok) {
            const data = await res.json();
            croUsd = data["crypto-com-chain"]?.usd ?? 0.10;
        }

        return NextResponse.json({
            ok: true,
            priceContext: {
                croUsd,
                usdceUsd: 1.0, // Stablecoin pegged to USD
                source: "coingecko",
                updatedAt: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error("Price fetch error:", error);
        return NextResponse.json({
            ok: true,
            priceContext: {
                croUsd: 0.10, // Fallback
                usdceUsd: 1.0,
                source: "fallback",
                updatedAt: new Date().toISOString(),
            },
        });
    }
}
