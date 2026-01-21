
const { isAddress } = require('viem');
const tOut = "0x6a3173618859C7cd8452b20fb5deAB01d4D64006";
console.log(`Address: ${tOut}`);
console.log(`isAddress: ${isAddress(tOut)}`);
