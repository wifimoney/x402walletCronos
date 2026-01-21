
const { createPublicClient, http, parseAbi } = require('viem');

const RPC = "https://evm-t3.cronos.org";

const client = createPublicClient({
    transport: http(RPC)
});

async function check() {
    // 1. Check Router
    try {
        const ROUTER = "0x2ffa3085d833c5c9ec6cdcf08480f53f33a1d42a"; // lowercase
        console.log(`Checking Router at ${ROUTER}...`);
        const code = await client.getBytecode({ address: ROUTER });
        console.log(`Router Code Length: ${code ? code.length : 0}`);

        if (code && code.length > 0) {
            const abi = parseAbi([
                "function factory() view returns (address)",
                "function WETH() view returns (address)"
            ]);
            const w = await client.readContract({
                address: ROUTER,
                abi: abi,
                functionName: "WETH"
            });
            console.log(`Router WETH: ${w}`);
        } else {
            console.log("Router is NOT a contract.");
        }
    } catch (e) {
        console.error("Router error:", e.shortMessage || e.message);
    }

    // 2. Check USDC
    try {
        const usdc = "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";
        console.log(`Checking USDC at ${usdc}...`);
        const symbol = await client.readContract({
            address: usdc,
            abi: parseAbi(["function symbol() view returns (string)"]),
            functionName: "symbol"
        });
        console.log(`USDC Symbol: ${symbol}`);
    } catch (e) {
        console.error("USDC Error:", e.shortMessage || e.message);
    }

    // 3. Check WCRO
    try {
        const wcro = "0x6a3173618859c7cd8452b20fb5deab01d4d64006";
        console.log(`Checking WCRO at ${wcro}...`);
        const sym = await client.readContract({
            address: wcro,
            abi: parseAbi(["function symbol() view returns (string)"]),
            functionName: "symbol"
        });
        console.log(`WCRO Symbol: ${sym}`);
    } catch (e) {
        console.error("WCRO Error:", e.shortMessage || e.message);
    }
}

check();
