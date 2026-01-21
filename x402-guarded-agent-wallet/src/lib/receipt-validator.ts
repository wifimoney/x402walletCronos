import { z } from "zod";
import { createHash } from "crypto";

// Zod schema for RunReceipt validation
export const RunReceiptSchema = z.object({
    receiptVersion: z.literal("1.0"),
    x402Version: z.literal(1),
    schemaHash: z.string().optional(),
    idempotencyKey: z.string().optional(),
    deduped: z.boolean().optional(),
    intent: z.object({
        id: z.string(),
        idempotencyKey: z.string().optional(),
        createdAt: z.number(),
        action: z.literal("transfer"),
        params: z.object({
            token: z.string().startsWith("0x"),
            to: z.string().startsWith("0x"),
            amount: z.string(),
        }),
        fee: z.string(),
        sessionExpiry: z.number(),
    }),
    policy: z.object({
        allowed: z.boolean(),
        rulesTriggered: z.array(z.string()),
        reason: z.string().optional(),
    }),
    risk: z.object({
        score: z.number(),
        flags: z.array(z.string()),
        reason: z.string().optional(),
    }).optional(),
    preflight: z.object({
        ok: z.boolean(),
        health: z.object({
            facilitatorUp: z.boolean(),
            supportedOk: z.boolean(),
            rpcUp: z.boolean(),
            latencyMs: z.object({
                facilitator: z.number().optional(),
                rpc: z.number().optional(),
            }),
        }),
        ts: z.number(),
    }),
    dryRun: z.boolean(),
    payment: z.object({
        ok: z.boolean(),
        error: z.string().optional(),
        txHash: z.string().optional(),
        receiptId: z.string().optional(),
    }).nullable(),
    execution: z.object({
        txHash: z.string(),
        status: z.enum(["success", "reverted", "failed"]),
        logsSummary: z.array(z.string()),
    }).nullable(),
    trace: z.array(z.any()),
});

export type ValidatedReceipt = z.infer<typeof RunReceiptSchema>;

export function validateReceipt(receipt: unknown): {
    valid: boolean;
    errors: string[];
    schemaHash: string;
} {
    const schemaHash = createHash("sha256")
        .update(JSON.stringify(RunReceiptSchema.shape))
        .digest("hex")
        .slice(0, 12);

    const result = RunReceiptSchema.safeParse(receipt);

    if (result.success) {
        return {
            valid: true,
            errors: [],
            schemaHash,
        };
    }

    const errors = result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
    );

    return {
        valid: false,
        errors,
        schemaHash,
    };
}
