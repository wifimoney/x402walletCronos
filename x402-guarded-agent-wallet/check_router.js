
const { createPublicClient, http, parseAbi } = require('viem');

const RPC = "https://evm-t3.cronos.org";
const ROUTER = "0x2ffa3085d833c5c9ec6cdcf08480f53f33a1d42a"; // lowercase
console.log(`Checking Router at ${ROUTER}...`);

const abi = parseAbi([
    "function factory() view returns (address)",
    "function WETH() view returns (address)"
]);

const client = createPublicClient({
    transport: http(RPC)
});

async function check() {
    try {
        const f = await client.readContract({
            address: ROUTER,
            abi: abi,
            functionName: "factory"
        });
        console.log(`Factory: ${f}`);
        const w = await client.readContract({
            address: ROUTER,
            abi: abi,
            functionName: "WETH"
        });
        console.log(`WETH: ${w}`);
    } catch (e) {
        console.error("Router error:", e.shortMessage || e.message);
    }

    try {
        const usdc = "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";
        const symbol = await client.readContract({
            address: usdc,
            abi: parseAbi(["function symbol() view returns (string)"]),
            functionName: "symbol"
        });
        console.log(`USDC Symbol: ${symbol}`);
    } catch (e) {
        console.error("USDC Error:", e.shortMessage || e.message);
    }
}

check();
