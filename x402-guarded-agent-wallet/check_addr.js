
const { isAddress } = require('viem');
const addr = "0x2fFA3085D833C5c9ec6cdCF08480F53F33a1D42a";
console.log(`Address: ${addr}`);
console.log(`isAddress: ${isAddress(addr)}`);
