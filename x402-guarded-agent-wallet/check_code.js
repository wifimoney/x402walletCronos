
const { createPublicClient, http } = require('viem');

const RPC = "https://evm-t3.cronos.org";
const ADDR = "0x2ffa3085d833c5c9ec6cdcf08480f53f33a1d42a";

const client = createPublicClient({ transport: http(RPC) });

async function checkCode() {
    const code = await client.getBytecode({ address: ADDR });
    console.log(`Code length: ${code ? code.length : 0}`);
}
checkCode();
