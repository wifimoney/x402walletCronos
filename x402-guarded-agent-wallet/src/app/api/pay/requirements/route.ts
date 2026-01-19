import { NextResponse } from "next/server";
import { RequirementsReqSchema, buildPaymentRequirements } from "@/lib/x402";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = RequirementsReqSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const { requirements, typedData, nonce } = await buildPaymentRequirements(parsed.data.amount);
    return NextResponse.json({
      ok: true,
      requirements,
      typedData,
      nonce,
      expiresInSeconds: 60,
      intentId: parsed.data.intentId,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}