import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicClient, http, formatEther, formatUnits } from "viem";
import { CRONOS_RPC_URL, USDC_E, CRONOS_NETWORK } from "@/lib/constants";

const QuerySchema = z.object({
    action: z.enum(["analyze_wallet", "network_status", "explain_tx"]),
    walletAddress: z.string().optional(),
    txHash: z.string().optional(),
});

const client = createPublicClient({
    transport: http(CRONOS_RPC_URL),
});

const ERC20_BALANCE_ABI = [
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const;

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = QuerySchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { ok: false, error: "Invalid request", issues: parsed.error.issues },
            { status: 400 }
        );
    }

    const { action, walletAddress, txHash } = parsed.data;

    try {
        switch (action) {
            case "analyze_wallet": {
                if (!walletAddress) {
                    return NextResponse.json({ ok: false, error: "walletAddress required" }, { status: 400 });
                }

                const address = walletAddress as `0x${string}`;

                // Fetch native balance, USDC.e balance, tx count
                const [nativeBalance, usdcBalance, txCount] = await Promise.all([
                    client.getBalance({ address }),
                    client.readContract({
                        address: USDC_E[CRONOS_NETWORK],
                        abi: ERC20_BALANCE_ABI,
                        functionName: "balanceOf",
                        args: [address],
                    }),
                    client.getTransactionCount({ address }),
                ]);

                const result = {
                    network: CRONOS_NETWORK,
                    address,
                    balances: {
                        CRO: formatEther(nativeBalance),
                        "USDC.e": formatUnits(usdcBalance, 6),
                    },
                    transactionCount: txCount,
                    summary: `Wallet ${address.slice(0, 8)}... has ${formatEther(nativeBalance)} CRO and ${formatUnits(usdcBalance, 6)} USDC.e with ${txCount} total transactions.`,
                };

                return NextResponse.json({ ok: true, action, result });
            }

            case "network_status": {
                const [blockNumber, gasPrice, block] = await Promise.all([
                    client.getBlockNumber(),
                    client.getGasPrice(),
                    client.getBlock({ blockTag: "latest" }),
                ]);

                const result = {
                    network: CRONOS_NETWORK,
                    rpcUrl: CRONOS_RPC_URL,
                    blockNumber: Number(blockNumber),
                    gasPrice: `${formatUnits(gasPrice, 9)} Gwei`,
                    lastBlockTime: new Date(Number(block.timestamp) * 1000).toISOString(),
                    health: "operational",
                    summary: `Cronos ${CRONOS_NETWORK} is at block ${blockNumber} with gas at ${formatUnits(gasPrice, 9)} Gwei. Last block: ${new Date(Number(block.timestamp) * 1000).toLocaleTimeString()}.`,
                };

                return NextResponse.json({ ok: true, action, result });
            }

            case "explain_tx": {
                if (!txHash) {
                    return NextResponse.json({ ok: false, error: "txHash required" }, { status: 400 });
                }

                const hash = txHash as `0x${string}`;

                const [tx, receipt] = await Promise.all([
                    client.getTransaction({ hash }).catch(() => null),
                    client.getTransactionReceipt({ hash }).catch(() => null),
                ]);

                if (!tx) {
                    return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 404 });
                }

                const status = receipt?.status === "success" ? "✅ Success" : receipt?.status === "reverted" ? "❌ Reverted" : "⏳ Pending";
                const valueEth = formatEther(tx.value);
                const gasUsed = receipt?.gasUsed ? Number(receipt.gasUsed) : null;
                const gasPrice = tx.gasPrice ? formatUnits(tx.gasPrice, 9) : "N/A";

                const isContractCall = tx.input && tx.input !== "0x";
                const txType = isContractCall ? "Contract Interaction" : "Native Transfer";

                const result = {
                    hash,
                    status,
                    type: txType,
                    from: tx.from,
                    to: tx.to || "Contract Creation",
                    value: `${valueEth} CRO`,
                    gasUsed,
                    gasPrice: `${gasPrice} Gwei`,
                    blockNumber: tx.blockNumber ? Number(tx.blockNumber) : null,
                    summary: `${status} ${txType} from ${tx.from.slice(0, 8)}... to ${tx.to?.slice(0, 8) || "Contract"}. Sent ${valueEth} CRO. ${gasUsed ? `Used ${gasUsed.toLocaleString()} gas at ${gasPrice} Gwei.` : ""}`,
                };

                return NextResponse.json({ ok: true, action, result });
            }

            default:
                return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
        }
    } catch (error: any) {
        console.error("Agent query error:", error);
        return NextResponse.json(
            { ok: false, error: error.message || "Query failed" },
            { status: 500 }
        );
    }
}
