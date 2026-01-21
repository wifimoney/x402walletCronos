import { NextResponse } from "next/server";
import { CRONOS_NETWORK } from "@/lib/constants";

export async function GET() {
    return NextResponse.json({
        kinds: [
            {
                x402Version: 1,
                scheme: "exact",
                network: CRONOS_NETWORK,
            },
            // Fallback for generic testnet match if needed
            {
                x402Version: 1,
                scheme: "exact",
                network: "cronos-testnet",
            }
        ],
    });
}
