import {
  getContract,
  readContract,
  prepareContractCall,
  sendTransaction,
  waitForReceipt,
} from "thirdweb";
import type { Account } from "thirdweb/wallets";
import { client } from "@/lib/thirdwebClient";
import { arbitrum } from "thirdweb/chains";
import { presaleAbi } from "@/lib/abi/presale";

type RoundCoreTuple = readonly [
  isActive: boolean,
  tokenPrice: bigint,
  minPurchase: bigint,
  totalRaised: bigint,
  startTime: bigint,
  endTime: bigint,
  totalTokensSold: bigint,
  maxTokensToSell: bigint,
  isPublic: boolean,
  vestingEndTime: bigint,
  cliffPeriodMonths: bigint,
  vestingDurationMonths: bigint,
  tgeUnlockPercentage: bigint
];

export async function readEarliestAllowedTgeSec(): Promise<bigint> {
  const infos = await Promise.all([
    readRoundInfoByKey("seed"),
    readRoundInfoByKey("private"),
    readRoundInfoByKey("institutional"),
    readRoundInfoByKey("strategic"),
    readRoundInfoByKey("community"),
  ]) as RoundCoreTuple[];

  let maxEnd = 0n;
  for (const info of infos) {
    const end = info[5] ?? 0n;
    if (end > maxEnd) maxEnd = end;
  }
  return maxEnd;
}

export type RoundKey = "strategic" | "seed" | "private" | "institutional" | "community";

export const ROUND_ENUM_INDEX: Record<RoundKey, number> = {
  strategic: 0,
  seed: 1,
  private: 2,
  institutional: 3,
  community: 4,
};

const ALL_ROUND_KEYS: RoundKey[] = ["strategic", "seed", "private", "institutional", "community"];

const PRESALE_ADDR = process.env
  .NEXT_PUBLIC_PRESALE_SMART_CONTRACT_ADDRESS as `0x${string}`;

export const DEFAULT_LEEWAY_SEC = 120n;

const presale = getContract({
  client,
  chain: arbitrum,
  address: PRESALE_ADDR,
  abi: presaleAbi,
});

type RoundInfoTuple = readonly [
  boolean,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
  bigint,
  bigint,
  bigint,
  bigint
];

export async function readVestingStarted(): Promise<boolean> {
  const started = await readContract({ contract: presale, method: "vestingStarted" });
  return Boolean(started);
}

export async function readTgeTime(): Promise<bigint> {
  const tge = await readContract({ contract: presale, method: "tgeTime" });
  return BigInt(tge);
}

async function readRoundInfoByKey(key: RoundKey): Promise<RoundInfoTuple> {
  switch (key) {
    case "seed":
      return (await readContract({ contract: presale, method: "getSeedRoundInfo" })) as RoundInfoTuple;
    case "private":
      return (await readContract({ contract: presale, method: "getPrivateRoundInfo" })) as RoundInfoTuple;
    case "institutional":
      return (await readContract({ contract: presale, method: "getInstitutionalRoundInfo" })) as RoundInfoTuple;
    case "strategic":
      return (await readContract({ contract: presale, method: "getStrategicRoundInfo" })) as RoundInfoTuple;
    case "community":
      return (await readContract({ contract: presale, method: "getCommunityRoundInfo" })) as RoundInfoTuple;
    default: {
      const neverKey: never = key;
      throw new Error(`Unsupported round key: ${String(neverKey)}`);
    }
  }
}

export async function readVestingEndTimes(
  keys: RoundKey[] = ALL_ROUND_KEYS
): Promise<Record<RoundKey, bigint>> {
  const infos = await Promise.all(keys.map((k) => readRoundInfoByKey(k)));

  const result = {} as Record<RoundKey, bigint>;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const info = infos[i];

    if (key === undefined) {
      throw new Error(`Missing round key at index ${i}`);
    }
    if (!info) {
      throw new Error(`Failed to load round info for key "${key}"`);
    }

    result[key] = info[9];
  }

  return result;
}

export async function readVestingStatus(): Promise<{
  started: boolean;
  tgeTime: bigint;
  ends: Record<RoundKey, bigint>;
}> {
  const [started, tgeTime, ends] = await Promise.all([
    readVestingStarted(),
    readTgeTime(),
    readVestingEndTimes(),
  ]);
  return { started, tgeTime, ends };
}

export function toUnixSecondsBigint(
  input: Date | number | string | { valueOf: () => number }
): bigint {
  const ms = typeof input === "object" ? input.valueOf() : Number(input);
  if (!Number.isFinite(ms)) throw new Error("Invalid date/time value");
  const seconds = ms < 1e12 ? ms : Math.floor(ms / 1000);
  return BigInt(seconds);
}

export function ensureFutureTime(
  tsSec: bigint,
  opts?: { LEEWAY_SEC?: bigint }
): bigint {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const LEEWAY = opts?.LEEWAY_SEC ?? DEFAULT_LEEWAY_SEC;
  return tsSec <= now + LEEWAY ? now + LEEWAY : tsSec;
}

export async function startVestingTx(
  account: Account,
  tgeTimeSec: bigint,
  opts?: { enforceAfterSaleEnds?: boolean }   // <- add a flag
): Promise<`0x${string}`> {
  const enforce = opts?.enforceAfterSaleEnds ?? true;

  let base = tgeTimeSec;
  if (enforce) {
    const minAllowed = await readEarliestAllowedTgeSec();
    base = tgeTimeSec <= minAllowed ? (minAllowed + 1n) : tgeTimeSec;
  }

  const safeTge = ensureFutureTime(base);
  const tx = prepareContractCall({ contract: presale, method: "startVesting", params: [safeTge] });
  const sent = await sendTransaction({ account, transaction: tx });
  await waitForReceipt(sent);
  return sent.transactionHash;
}


export async function startVestingFromDateTx(
  account: Account,
  tge: Date | { valueOf: () => number },
  opts?: { LEEWAY_SEC?: bigint }
): Promise<`0x${string}`> {
  const tgeSec = ensureFutureTime(toUnixSecondsBigint(tge), opts);
  return startVestingTx(account, tgeSec);
}

export async function updateRoundVestingParametersTx(
  account: Account,
  key: RoundKey,
  params: {
    cliffPeriodMonths: bigint;
    vestingDurationMonths: bigint;
    tgeUnlockPercentage: bigint;
  }
): Promise<`0x${string}`> {
  const idx = ROUND_ENUM_INDEX[key];
  if (idx === undefined) throw new Error(`Unknown round key: ${key}`);

  const tx = prepareContractCall({
    contract: presale,
    method: "updateRoundVestingParameters",
    params: [
      idx,
      params.cliffPeriodMonths,
      params.vestingDurationMonths,
      params.tgeUnlockPercentage,
    ],
  });

  const sent = await sendTransaction({ account, transaction: tx });
  await waitForReceipt(sent);
  return sent.transactionHash;
}
