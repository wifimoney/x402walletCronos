/**
 * x402 Payment Test Script
 * 
 * Usage: PRIVATE_KEY=0x... node test_x402_payment.js
 * 
 * This script:
 * 1. Generates payment requirements
 * 2. Signs the EIP-712 message
 * 3. Submits to the Facilitator for verification and settlement
 */

const { ethers } = require('ethers');

const API_BASE = 'http://localhost:3000';
const INTENT_ID = 'cliTestIntent_' + Date.now();

async function main() {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error('ERROR: Set PRIVATE_KEY env var');
        process.exit(1);
    }

    const wallet = new ethers.Wallet(privateKey);
    console.log('Wallet address:', wallet.address);

    // Step 1: Get requirements
    console.log('\n--- Step 1: Get Payment Requirements ---');
    const reqRes = await fetch(`${API_BASE}/api/pay/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            amount: '1000000', // 1 USDC.e
            intentId: INTENT_ID
        })
    });
    const reqData = await reqRes.json();

    if (!reqData.ok) {
        console.error('Requirements failed:', reqData);
        process.exit(1);
    }

    console.log('Requirements:', JSON.stringify(reqData.requirements, null, 2));
    console.log('Intent ID:', reqData.intentId);

    // Step 2: Sign EIP-712
    console.log('\n--- Step 2: Sign EIP-712 ---');
    const typedData = reqData.typedData;
    typedData.message.from = wallet.address;

    const signature = await wallet.signTypedData(
        typedData.domain,
        { TransferWithAuthorization: typedData.types.TransferWithAuthorization },
        typedData.message
    );
    console.log('Signature:', signature.slice(0, 20) + '...');

    // Step 3: Build payment header
    const paymentHeader = Buffer.from(JSON.stringify({
        x402Version: 1,
        scheme: reqData.requirements.scheme,
        network: reqData.requirements.network,
        payload: {
            from: wallet.address,
            to: reqData.requirements.payTo,
            value: reqData.requirements.maxAmountRequired,
            validAfter: typedData.message.validAfter,
            validBefore: typedData.message.validBefore,
            nonce: typedData.message.nonce,
            signature: signature,
            asset: reqData.requirements.asset
        }
    })).toString('base64');

    console.log('Payment Header:', paymentHeader.slice(0, 50) + '...');

    // Step 4: Settle
    console.log('\n--- Step 3: Settle Payment ---');
    const settleRes = await fetch(`${API_BASE}/api/pay/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            intentId: INTENT_ID,
            paymentHeader: paymentHeader,
            paymentRequirements: reqData.requirements
        })
    });
    const settleData = await settleRes.json();

    console.log('Settle Response:', JSON.stringify(settleData, null, 2));

    if (settleData.ok) {
        console.log('\n✅ x402 Payment SUCCESSFUL!');
        console.log('TX Hash:', settleData.txHash);
    } else {
        console.log('\n❌ x402 Payment FAILED');
    }
}

main().catch(console.error);
