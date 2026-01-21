import { NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
    intent: z.any(),
    preflight: z.any(),
    userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ ok: false, error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
    }

    const intent = parsed.data.intent;
    const preflight = parsed.data.preflight;

    // transfer: preflight ok is enough (no quote info needed for simple transfer)
    if (!preflight.ok) {
        return NextResponse.json({ ok: false, error: "Preflight not OK" }, { status: 400 });
    }

    return NextResponse.json({
        ok: true,
        payload: {
            token: intent.params.token,
            to: intent.params.to,
            amount: intent.params.amount,
            intentId: intent.id,
        },
    });
}
