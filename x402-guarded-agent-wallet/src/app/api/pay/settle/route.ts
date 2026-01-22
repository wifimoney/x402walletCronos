import { NextResponse } from "next/server";
import { SettleReqSchema, verifyAndSettle } from "@/lib/x402";
import { markPaid, getPaid } from "@/lib/store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SettleReqSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Check if already paid (idempotency)
  const existingPayment = getPaid(parsed.data.intentId);
  if (existingPayment && existingPayment.settled) {
    return NextResponse.json({
      ok: true,
      alreadyPaid: true,
      message: "Payment already settled",
      verify: { isValid: true },
      settle: {
        event: "payment.already_settled",
        txHash: existingPayment.settledTxHash
      }
    });
  }

  let out: any;
  try {
    out = await verifyAndSettle({
      paymentHeader: parsed.data.paymentHeader,
      paymentRequirements: parsed.data.paymentRequirements as any,
    });
  } catch (error: any) {
    // Handle "Authorization already used" error from facilitator
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes("already used") || errorMsg.includes("Authorization")) {
      // Try to find existing payment
      if (existingPayment) {
        return NextResponse.json({
          ok: true,
          alreadyPaid: true,
          message: "Authorization already used - payment was previously settled",
          verify: { isValid: true },
          settle: {
            event: "payment.already_settled",
            txHash: existingPayment.settledTxHash
          }
        });
      }
      // Unknown prior settlement
      return NextResponse.json({
        ok: false,
        error: "Authorization already used",
        hint: "This payment signature was already submitted. Check your history for the prior transaction.",
      }, { status: 409 });
    }
    // Other errors
    console.error("Settle error:", error);
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }

  // Cache payment by intentId if settled
  try {
    const decoded = JSON.parse(
      Buffer.from(parsed.data.paymentHeader, "base64").toString("utf8")
    );
    const nonce = decoded?.payload?.nonce as string | undefined;

    if (out.verify?.isValid) {
      const settled = (out.settle as any)?.event === "payment.settled";
      markPaid({
        intentId: parsed.data.intentId,
        nonce,
        settledTxHash: (out.settle as any)?.txHash,
        receipt: out.settle,
        verified: out.verify.isValid,
        settled,
        ts: Date.now(),
      });
    }
  } catch (e) { console.error("Settle route cache error", e); }

  return NextResponse.json({ ok: true, ...out });
}