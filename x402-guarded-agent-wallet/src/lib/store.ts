// Simple in-memory store for hackathon/demo.
// Replace with SQLite/Prisma later if you want persistence.

type PaymentRecord = {
    intentId: string;
    nonce?: string;
    settledTxHash?: string;
    receipt?: unknown;
    ts: number;
  };
  
  const paidByIntent = new Map<string, PaymentRecord>();
  
  export function markPaid(record: PaymentRecord) {
    paidByIntent.set(record.intentId, record);
  }
  
  export function getPaid(intentId: string) {
    return paidByIntent.get(intentId) ?? null;
  }