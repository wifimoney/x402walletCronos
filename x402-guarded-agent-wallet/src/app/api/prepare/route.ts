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

    // enforce: must have minOut + path from preflight
    const minOut = preflight?.quote?.minOut;
    const path = preflight?.quote?.path;

    if (!minOut || !path) {
        return NextResponse.json({ ok: false, error: "Missing quote.minOut or quote.path in preflight" }, { status: 400 });
    }

    // You can also enforce "preflight-before-execution" here.
    if (!preflight.ok) {
        return NextResponse.json({ ok: false, error: "Preflight not OK" }, { status: 400 });
    }

    // Router is provided by env (public) or intent; prefer env
    const router = process.env.NEXT_PUBLIC_ROUTER_ADDRESS || intent?.params?.router;
    if (!router) {
        return NextResponse.json({ ok: false, error: "Router not configured" }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        payload: {
            router,
            tokenIn: intent.params.tokenIn,
            tokenOut: intent.params.tokenOut,
            amountIn: intent.params.amountIn,
            amountOutMin: minOut,
            path,
            to: parsed.data.userAddress,
            deadline: intent.params.deadline,
            intentId: intent.id,
        },
    });
}
