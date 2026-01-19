import { NextResponse } from "next/server";

export async function POST() {
  // Stub: implement verify/settle + retries + idempotency in P2
  return NextResponse.json({
    ok: true,
    receiptId: "stub",
  });
}