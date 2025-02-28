import { NATIVE_MINT } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { Raydium } from "../src/index";
import { PoolUtils, TickArray, TickArrayLayout } from "../src/raydium/clmm";
import { getPdaExBitmapAccount, getPdaTickArrayAddress } from "../src/raydium/clmm/utils/pda";
import { getPdaObservationId } from "../src/raydium/cpmm";

// Cache per dati persistenti tra le chiamate con tipi TypeScript appropriati
interface CachedData {
  tickCurrent: number | null;
  tickArrayIds: string[];
  poolInfo: any | null;
}

let cachedData: CachedData = {
  tickCurrent: null,
  tickArrayIds: [],
  poolInfo: null,
};

async function init(useCache = false) {
  const raydium = await Raydium.load({});
  const inputAmount = new BN(100000000000);
  const inputMint = NATIVE_MINT.toBase58();

  // Informazioni costanti della pool
  const poolId = "3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv";
  const vaultAId = "4ct7br2vTPzfdmY3S5HLtTxcGSBfn6pnw98hsS6v359A";
  const vaultBId = "5it83u57VRrVgc51oNV19TTmAJuffPx5GtGwQr7gQNUo";
  const configId = "3h2e43PunVA5K34vwKCLHWhZF4aZpyaC9RmxvshGAQpL";
  const mintAId = NATIVE_MINT.toBase58();
  const mintBId = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const programId = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
  const observationId = getPdaObservationId(new PublicKey(programId), new PublicKey(poolId)).publicKey.toBase58();
  const exBitmapAccountId = getPdaExBitmapAccount(new PublicKey(programId), new PublicKey(poolId)).publicKey.toBase58();

  const connection = new Connection("https://solana-mainnet.g.alchemy.com/v2/hYsxCHoEKYPm95tvntuud52cESGjJOj9");

  // Set di account ID da richiedere
  const accountIdsToFetch = new Set([
    poolId,
    vaultAId,
    vaultBId,
    configId,
    mintAId,
    mintBId,
    observationId,
    exBitmapAccountId,
  ]);

  // Aggiungi gli ID dei tick array dalla cache se disponibili
  if (useCache && cachedData.tickArrayIds.length > 0) {
    console.log(`Aggiungendo ${cachedData.tickArrayIds.length} tick array ID dalla cache`);
    cachedData.tickArrayIds.forEach((id) => accountIdsToFetch.add(id));
  }

  // Converti gli ID in oggetti PublicKey
  const accountsToFetch = Array.from(accountIdsToFetch).map((id) => new PublicKey(id));

  console.log(`Fetching ${accountsToFetch.length} account unici...`);
  const accountInfos = await connection.getMultipleAccountsInfo(accountsToFetch);

  // Mappa gli account ID alle loro info
  const accountInfoMap = {};
  accountsToFetch.forEach((pubkey, index) => {
    accountInfoMap[pubkey.toBase58()] = accountInfos[index];
  });

  // Verifica se tutti gli account sono stati trovati
  const missingAccounts = accountsToFetch.filter((pubkey, index) => !accountInfos[index]);
  if (missingAccounts.length > 0) {
    console.error(
      "Account mancanti:",
      missingAccounts.map((pk) => pk.toBase58()),
    );
    throw new Error("Alcuni account richiesti non sono stati trovati");
  }

  console.log("Tutti gli account recuperati con successo, costruendo le pool info...");

  // Costruisci le info della pool dai dati degli account
  const { poolInfo, poolKeys, computePoolInfo } = await raydium.clmm.buildPoolInfoFromAccountsData({
    programId,
    poolId,
    poolAccountData: accountInfoMap[poolId],
    vaultAId,
    vaultAAccountData: accountInfoMap[vaultAId],
    vaultBId,
    vaultBAccountData: accountInfoMap[vaultBId],
    observationId,
    mintAId,
    mintAAccountData: accountInfoMap[mintAId],
    mintBId,
    mintBAccountData: accountInfoMap[mintBId],
    configId,
    configAccountData: accountInfoMap[configId],
    exBitmapAccountId,
    exBitmapAccountData: accountInfoMap[exBitmapAccountId],
  });

  // Verifica se possiamo usare i tick array dalla cache o dobbiamo farne il fetch
  let tickArrays: { [key: string]: TickArray } = {};
  const newTickCurrent = computePoolInfo.tickCurrent;

  if (useCache && cachedData.tickCurrent !== null && cachedData.tickCurrent === newTickCurrent) {
    console.log("Il tick corrente non è cambiato, utilizzo i tick array dalla cache");

    // Processa i dati dei tick array dal accountInfoMap
    for (const tickArrayId of cachedData.tickArrayIds) {
      if (accountInfoMap[tickArrayId]) {
        try {
          const tickArrayLayout = TickArrayLayout.decode(accountInfoMap[tickArrayId].data);
          tickArrays[tickArrayLayout.startTickIndex] = {
            ...tickArrayLayout,
            address: new PublicKey(tickArrayId),
          };
        } catch (e) {
          console.warn(`Impossibile decodificare i dati del tick array per ${tickArrayId}:`, e);
        }
      }
    }

    console.log(`Processati ${Object.keys(tickArrays).length} tick array dalla cache`);
  } else {
    console.log("Il tick corrente è cambiato o la cache non è disponibile, recuperando i tick array");

    // Fetch dei tick array con una chiamata RPC separata
    const fetchedTickData = await PoolUtils.fetchMultiplePoolTickArrays({
      connection: connection,
      poolKeys: [computePoolInfo],
    });

    // Ottieni i tick array per questa pool specifica
    tickArrays = fetchedTickData[poolId] || {};

    // Memorizza in cache i dati dei tick per la prossima volta
    cachedData.tickArrayIds = Object.values(tickArrays).map((tickArray: TickArray) => tickArray.address.toBase58());
    cachedData.tickCurrent = newTickCurrent;
    console.log(`Memorizzati in cache ${cachedData.tickArrayIds.length} tick array ID per uso futuro`);
  }

  console.log("Pool info costruite con successo!");

  // Mostra alcune informazioni dai dati recuperati
  if (Object.keys(tickArrays).length > 0) {
    console.log(`Tick array disponibili: ${Object.keys(tickArrays).length}`);
    for (const startIndex of Object.keys(tickArrays).slice(0, 3)) {
      console.log(`Tick array ${startIndex}: ${tickArrays[startIndex].initializedTickCount} tick inizializzati`);
    }
  }

  // Qui sotto aggiungeresti il codice per il calcolo dello swap

  return { poolInfo, computePoolInfo, tickArrays };
}

// Funzione main per dimostrare il comportamento della cache
async function main() {
  console.log("Prima esecuzione: Nessuna cache disponibile");
  const startTime1 = performance.now();
  const firstRun = await init(false);
  const endTime1 = performance.now();
  console.log(`Tempo di esecuzione: ${(endTime1 - startTime1).toFixed(2)} ms`);

  console.log("\n-------------------------------------------\n");

  console.log("Seconda esecuzione: Utilizzo degli ID dei tick array dalla cache");
  const startTime2 = performance.now();
  const secondRun = await init(true);
  const endTime2 = performance.now();
  console.log(`Tempo di esecuzione: ${(endTime2 - startTime2).toFixed(2)} ms`);

  console.log("\n-------------------------------------------\n");

  // Forza un nuovo fetch simulando un cambio di tick
  cachedData.tickCurrent = null;
  console.log("Terza esecuzione: Cache invalidata (simulando un cambio di tick)");
  const startTime3 = performance.now();
  const thirdRun = await init(true);
  const endTime3 = performance.now();
  console.log(`Tempo di esecuzione: ${(endTime3 - startTime3).toFixed(2)} ms`);

  console.log("\n-------------------------------------------\n");
  console.log("Riepilogo dei tempi di esecuzione:");
  console.log(`Test 1 (senza cache): ${(endTime1 - startTime1).toFixed(2)} ms`);
  console.log(`Test 2 (con cache): ${(endTime2 - startTime2).toFixed(2)} ms`);
  console.log(`Test 3 (cache invalidata): ${(endTime3 - startTime3).toFixed(2)} ms`);
  console.log(
    `Miglioramento con cache: ${((1 - (endTime2 - startTime2) / (endTime1 - startTime1)) * 100).toFixed(2)}%`,
  );
}

console.log("Avvio dimostrazione di fetch ottimizzato...");
main().catch((err) => console.error("Errore:", err));
