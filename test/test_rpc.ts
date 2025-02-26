import { NATIVE_MINT } from "@solana/spl-token";
import { AccountInfo, clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";

async function test_rpc() {
  console.log("Starting RPC performance test...");
  const connection = new Connection("https://solana-mainnet.g.alchemy.com/v2/hYsxCHoEKYPm95tvntuud52cESGjJOj9");
  // Sample 10 account addresses to test with
  const testAccounts = [
    "9PmjCWmNCk9jqMYqhWthqpgDzCyoDvk4UpHhJ2aZiNrm", // poolId
    "3sGri5fTycipA9pXo7oE7gf2HTXbz6kkUVHXaDYciAfC", // baseVaultId
    "Bmcy8xF7REKDu8LWLBUDYoscja258J3ru3sg5Wyku7MQ", // quoteVaultId
    "BSNPzacW7NJQBKR18jqCGk5hxR9yvtoZ3kGh1Rk64YL2", // marketId
    NATIVE_MINT.toBase58(),
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
    "So11111111111111111111111111111111111111112", // SOL
    "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj", // stSOL
    "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // mSOL
  ];

  const publicKeys = testAccounts.map((key) => new PublicKey(key));

  // Test 1: Sequential getAccountInfo calls
  console.log("Testing 10 sequential getAccountInfo calls...");
  const sequentialStart = performance.now();

  for (const publicKey of publicKeys) {
    try {
      const accountInfo = await connection.getAccountInfo(publicKey);
    } catch (error) {}
  }

  const sequentialEnd = performance.now();
  const sequentialTime = sequentialEnd - sequentialStart;

  // Test 2: Single getMultipleAccountsInfo call
  console.log("Testing single getMultipleAccountsInfo call for 10 accounts...");
  const batchStart = performance.now();

  let batchResults;
  try {
    batchResults = await connection.getMultipleAccountsInfo(publicKeys);
  } catch (error) {
    batchResults = [];
  }

  const batchEnd = performance.now();
  const batchTime = batchEnd - batchStart;

  // Results
  console.log(`\nResults:`);
  console.log(`Sequential getAccountInfo: ${sequentialTime.toFixed(2)}ms`);
  console.log(`Batch getMultipleAccountsInfo: ${batchTime.toFixed(2)}ms`);
  console.log(`Difference: ${(sequentialTime - batchTime).toFixed(2)}ms`);
  console.log(`Batch is ${(sequentialTime / batchTime).toFixed(2)}x faster`);

  return {
    sequentialTime,
    batchTime,
    speedup: sequentialTime / batchTime,
  };
}

console.log(test_rpc());
