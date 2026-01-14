import { NextResponse } from "next/server";
import { SettleReqSchema, verifyAndSettle } from "@/lib/x402";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SettleReqSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const out = await verifyAndSettle({
    paymentHeader: parsed.data.paymentHeader,
    paymentRequirements: parsed.data.paymentRequirements as any,
  });

  return NextResponse.json({ ok: true, ...out });
}