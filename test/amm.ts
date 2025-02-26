import { NATIVE_MINT } from "@solana/spl-token";
import { AccountInfo, clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";

import { Raydium } from "../src/index";

async function init() {
  const amountIn = 1000000000;
  const inputMint = NATIVE_MINT.toBase58();
  const raydium = await Raydium.load({});
  const poolId = "9PmjCWmNCk9jqMYqhWthqpgDzCyoDvk4UpHhJ2aZiNrm";
  const baseVaultId = "3sGri5fTycipA9pXo7oE7gf2HTXbz6kkUVHXaDYciAfC";
  const quoteVaultId = "Bmcy8xF7REKDu8LWLBUDYoscja258J3ru3sg5Wyku7MQ";
  const marketId = "BSNPzacW7NJQBKR18jqCGk5hxR9yvtoZ3kGh1Rk64YL2";
  const connection = new Connection("https://solana-mainnet.g.alchemy.com/v2/hYsxCHoEKYPm95tvntuud52cESGjJOj9");
  const publicKeys = [poolId, baseVaultId, quoteVaultId, marketId];

  // Fetch the accounts info
  const accounts = await connection.getMultipleAccountsInfo(publicKeys.map((key) => new PublicKey(key)));

  // Decompose accounts array into individual variables
  const [poolAccountData, baseVaultAccountData, quoteVaultAccountData, marketAccountData] = accounts;

  // Check if any account is null
  if (poolAccountData === null) {
    throw new Error(`Pool account not found: ${poolId}`);
  }
  if (baseVaultAccountData === null) {
    throw new Error(`Base vault account not found: ${baseVaultId}`);
  }
  if (quoteVaultAccountData === null) {
    throw new Error(`Quote vault account not found: ${quoteVaultId}`);
  }
  if (marketAccountData === null) {
    throw new Error(`Market account not found: ${marketId}`);
  }

  const { poolInfo, poolKeys, poolRpcData } = await raydium.liquidity.buildPoolInfoFromAccountsData({
    poolId: poolId,
    poolAccountData: poolAccountData,
    baseVaultId: baseVaultId,
    baseVaultAccountData: baseVaultAccountData,
    quoteVaultId: quoteVaultId,
    quoteVaultAccountData: quoteVaultAccountData,
    marketId: marketId,
    marketAccountData: marketAccountData,
  });

  const [baseReserve, quoteReserve, status] = [
    poolRpcData.baseReserve,
    poolRpcData.quoteReserve,
    poolRpcData.status.toNumber(),
  ];

  if (poolInfo.mintA.address !== inputMint && poolInfo.mintB.address !== inputMint)
    throw new Error("input mint does not match pool");

  const baseIn = inputMint === poolInfo.mintA.address;
  const [mintIn, mintOut] = baseIn ? [poolInfo.mintA, poolInfo.mintB] : [poolInfo.mintB, poolInfo.mintA];

  const out = raydium.liquidity.computeAmountOut({
    poolInfo: {
      ...poolInfo,
      baseReserve,
      quoteReserve,
      status,
      version: 4,
    },
    amountIn: new BN(amountIn),
    mintIn: mintIn.address,
    mintOut: mintOut.address,
    slippage: 0.001, // range: 1 ~ 0.0001, means 100% ~ 0.01%
  });

  console.log(`\n----- SWAP CALCULATION RESULTS -----`);
  console.log(`From: ${mintIn.symbol || mintIn.address}`);
  console.log(`To: ${mintOut.symbol || mintOut.address}`);
  console.log(
    `\nInput Amount: ${new Decimal(amountIn).div(10 ** mintIn.decimals).toFixed(mintIn.decimals)} ${
      mintIn.symbol || mintIn.address
    }`,
  );

  console.log(
    `\nOutput Amount: ${new Decimal(out.amountOut.toString()).div(10 ** mintOut.decimals).toFixed(mintOut.decimals)} ${
      mintOut.symbol || mintOut.address
    }`,
  );

  console.log(
    `Minimum Output (with slippage): ${new Decimal(out.minAmountOut.toString())
      .div(10 ** mintOut.decimals)
      .toFixed(mintOut.decimals)} ${mintOut.symbol || mintOut.address}`,
  );

  console.log(
    `\nFee Amount: ${new Decimal(out.fee.toString()).div(10 ** mintIn.decimals).toFixed(mintIn.decimals)} ${
      mintIn.symbol || mintIn.address
    }`,
  );

  console.log(
    `\nCurrent Pool Price: 1 ${baseIn ? "token A" : "token B"} = ${out.currentPrice.toFixed(6)} ${
      baseIn ? "token B" : "token A"
    }`,
  );

  console.log(
    `Execution Price: 1 ${mintIn.symbol || "input token"} = ${out.executionPrice.toFixed(6)} ${
      mintOut.symbol || "output token"
    }`,
  );

  console.log(`Price Impact: ${out.priceImpact.mul(100).toFixed(4)}%`);
  console.log(`------------------------------------`);
}

init();
