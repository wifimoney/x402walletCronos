
const { isAddress } = require('viem');
const usdc = "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0";
const wcro = "0x6a3173618859C7cd8452b20fb5deAB01d4D64006";
console.log(`USDC: ${isAddress(usdc)}`);
console.log(`WCRO: ${isAddress(wcro)}`);
console.log(`USDC (lower): ${isAddress(usdc.toLowerCase())}`);
console.log(`WCRO (lower): ${isAddress(wcro.toLowerCase())}`);
