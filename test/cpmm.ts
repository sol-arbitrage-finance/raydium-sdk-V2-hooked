import { NATIVE_MINT } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";

import { Raydium } from "../src/index";

async function init() {
  const raydium = await Raydium.load({});
  const inputAmount = new BN(5000000000000);
  const inputMint = NATIVE_MINT.toBase58();

  // CPMM pool info
  const poolId = "HKuJrP5tYQLbEUdjKwjgnHs2957QKjR2iWhJKTtMa1xs"; // SOL-USDC CPMM pool
  const vaultAId = "7wMM5Tg7igkefH1T2TKqJBpYp5bQKPQjz7yTgvCUZY6Z"; // Token A vault
  const vaultBId = "Gy2JYhV9gAZUBrjq35St78VMrXiufU72Que26pmhMYob"; // Token B vault
  const configId = "D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2"; // Config account
  const mintAId = NATIVE_MINT.toBase58(); // SOL mint
  const mintBId = "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN"; // USDC mint
  const mintLpId = "agALzgtrW9Rronymq3e1R61Q9vSKDFZVTXaiLTzU9VP"; // LP mint

  const connection = new Connection("https://solana-mainnet.g.alchemy.com/v2/hYsxCHoEKYPm95tvntuud52cESGjJOj9");

  // Array of accounts to fetch
  const publicKeys = [poolId, vaultAId, vaultBId, configId, mintAId, mintBId, mintLpId].map(
    (key) => new PublicKey(key),
  );
  // Fetch all account data in a single call
  const accounts = await connection.getMultipleAccountsInfo(publicKeys);

  // Extract account data
  const [
    poolAccountData,
    vaultAAccountData,
    vaultBAccountData,
    configAccountData,
    mintAAccountData,
    mintBAccountData,
    mintLpAccountData,
  ] = accounts;

  // Check if any account is null
  if (
    !poolAccountData ||
    !vaultAAccountData ||
    !vaultBAccountData ||
    !configAccountData ||
    !mintAAccountData ||
    !mintBAccountData ||
    !mintLpAccountData
  ) {
    throw new Error("One or more accounts not found");
  }

  // Build pool info from account data (usando la versione estesa)
  const { poolInfo, poolKeys, rpcData, computeData } = await raydium.cpmm.buildPoolInfoFromAccountsData({
    poolId,
    poolAccountData,
    vaultAId,
    vaultAAccountData,
    vaultBId,
    vaultBAccountData,
    configId,
    configAccountData,
    mintAId,
    mintAAccountData,
    mintBId,
    mintBAccountData,
    mintLpId,
    mintLpAccountData,
  });

  if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address)
    throw new Error("Input mint does not match pool");

  const baseIn = inputMint === poolInfo.mintA.address;
  const outputMint = baseIn ? poolInfo.mintB.address : poolInfo.mintA.address;

  // Ora possiamo usare computeSwapAmount direttamente con computeData
  const swapResult = raydium.cpmm.computeSwapAmount({
    pool: computeData,
    amountIn: inputAmount,
    outputMint: outputMint,
    slippage: 0.001, // 1% slippage
  });

  // Utilizza il formato di log richiesto
  console.log(`\n----- SWAP CALCULATION RESULTS -----`);
  console.log(
    `From: ${
      baseIn ? poolInfo.mintA.symbol || poolInfo.mintA.address : poolInfo.mintB.symbol || poolInfo.mintB.address
    }`,
  );
  console.log(
    `To: ${baseIn ? poolInfo.mintB.symbol || poolInfo.mintB.address : poolInfo.mintA.symbol || poolInfo.mintA.address}`,
  );
  console.log(
    `\nInput Amount: ${new Decimal(inputAmount.toString())
      .div(10 ** (baseIn ? poolInfo.mintA.decimals : poolInfo.mintB.decimals))
      .toFixed(baseIn ? poolInfo.mintA.decimals : poolInfo.mintB.decimals)} ${
      baseIn ? poolInfo.mintA.symbol || poolInfo.mintA.address : poolInfo.mintB.symbol || poolInfo.mintB.address
    }`,
  );

  console.log(
    `\nOutput Amount: ${new Decimal(swapResult.amountOut.toString())
      .div(10 ** (baseIn ? poolInfo.mintB.decimals : poolInfo.mintA.decimals))
      .toFixed(baseIn ? poolInfo.mintB.decimals : poolInfo.mintA.decimals)} ${
      baseIn ? poolInfo.mintB.symbol || poolInfo.mintB.address : poolInfo.mintA.symbol || poolInfo.mintA.address
    }`,
  );

  console.log(
    `Minimum Output (with slippage): ${new Decimal(swapResult.minAmountOut.toString())
      .div(10 ** (baseIn ? poolInfo.mintB.decimals : poolInfo.mintA.decimals))
      .toFixed(baseIn ? poolInfo.mintB.decimals : poolInfo.mintA.decimals)} ${
      baseIn ? poolInfo.mintB.symbol || poolInfo.mintB.address : poolInfo.mintA.symbol || poolInfo.mintA.address
    }`,
  );

  console.log(
    `\nFee Amount: ${new Decimal(swapResult.fee.toString())
      .div(10 ** (baseIn ? poolInfo.mintA.decimals : poolInfo.mintB.decimals))
      .toFixed(baseIn ? poolInfo.mintA.decimals : poolInfo.mintB.decimals)} ${
      baseIn ? poolInfo.mintA.symbol || poolInfo.mintA.address : poolInfo.mintB.symbol || poolInfo.mintB.address
    }`,
  );

  console.log(
    `\nExecution Price: 1 ${
      baseIn ? poolInfo.mintA.symbol || "token A" : poolInfo.mintB.symbol || "token B"
    } = ${swapResult.executionPrice.toFixed(6)} ${
      baseIn ? poolInfo.mintB.symbol || "token B" : poolInfo.mintA.symbol || "token A"
    }`,
  );

  console.log(`Price Impact: ${swapResult.priceImpact.mul(100).toFixed(4)}%`);

  console.log(`All Trade Executed: ${swapResult.allTrade ? "Yes" : "No"}`);
  console.log(`------------------------------------`);
}

console.log("Starting...");
init();
