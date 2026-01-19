import { NextResponse } from "next/server";
import { buildIntent } from "@/lib/plan";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt: string = body?.prompt || "";
  const recipient = (body?.recipient ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`;

  const intent = buildIntent({ prompt, recipient });
  return NextResponse.json({ ok: true, intent });
}