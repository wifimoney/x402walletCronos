import { NextResponse } from "next/server";
import { SettleReqSchema, verifyAndSettle } from "@/lib/x402";
import { markPaid } from "@/lib/store";

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

  // Cache payment by intentId if settled
  try {
    const decoded = JSON.parse(
      Buffer.from(parsed.data.paymentHeader, "base64").toString("utf8")
    );
    const nonce = decoded?.payload?.nonce as string | undefined;

    if (out.settle && (out.settle as any).event === "payment.settled") {
      markPaid({
        intentId: parsed.data.intentId,
        nonce,
        settledTxHash: (out.settle as any).txHash,
        receipt: out.settle,
        ts: Date.now(),
      });
    }
  } catch { }

  return NextResponse.json({ ok: true, ...out });
}