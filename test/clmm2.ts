import { NATIVE_MINT } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";

import { ApiV3PoolInfoConcentratedItem, ClmmKeys } from "../src/api";
import { Raydium } from "../src/index";
import { ComputeClmmPoolInfo, PoolUtils, ReturnTypeFetchMultiplePoolTickArrays } from "../src/raydium/clmm";

// Cache per memorizzare informazioni tra le chiamate
let poolCache = {
  currentTick: null as number | null,
  tickArrayIds: [] as string[],
};

async function init(useCache = false) {
  const raydium = await Raydium.load({
    connection: new Connection("https://solana-mainnet.g.alchemy.com/v2/hYsxCHoEKYPm95tvntuud52cESGjJOj9"),
  });
  const inputAmount = new BN(100000000000);
  const inputMint = NATIVE_MINT.toBase58();
  let poolInfo: ApiV3PoolInfoConcentratedItem;
  let poolKeys: ClmmKeys | undefined;
  let clmmPoolInfo: ComputeClmmPoolInfo;
  let tickCache: ReturnTypeFetchMultiplePoolTickArrays;
  const poolId = "3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv";

  const data = await raydium.clmm.getPoolInfoFromRpc(poolId);
  poolInfo = data.poolInfo;
  poolKeys = data.poolKeys;
  clmmPoolInfo = data.computePoolInfo;
  tickCache = data.tickData;

  if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address)
    throw new Error("input mint does not match pool");

  const baseIn = inputMint === poolInfo.mintA.address;

  const result = await PoolUtils.computeAmountOutFormat({
    poolInfo: clmmPoolInfo,
    tickArrayCache: tickCache[poolId],
    amountIn: inputAmount,
    tokenOut: poolInfo[baseIn ? "mintB" : "mintA"],
    slippage: 0.01,
    epochInfo: await raydium.fetchEpochInfo(),
  });

  console.log("Result:", result.priceImpact.toSignificant(5));
}

console.log("Starting...");
init().catch((err) => console.error("Error:", err));
