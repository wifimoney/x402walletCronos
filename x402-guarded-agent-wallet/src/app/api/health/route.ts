
import { NextResponse } from "next/server";
import { FACILITATOR_BASE_URL } from "@/lib/constants";

export async function GET() {
    try {
        const res = await fetch(`${FACILITATOR_BASE_URL}/v2/x402/supported`, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
            next: { revalidate: 60 }, // Cache for 60 seconds
        });

        if (!res.ok) {
            throw new Error(`Facilitator check failed: ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json({
            status: "ok",
            facilitator: FACILITATOR_BASE_URL,
            supported: data
        });
    } catch (error: any) {
        console.error("Health Check Error:", error);
        return NextResponse.json(
            {
                status: "error",
                message: error.message,
                facilitator: FACILITATOR_BASE_URL
            },
            { status: 500 }
        );
    }
}
