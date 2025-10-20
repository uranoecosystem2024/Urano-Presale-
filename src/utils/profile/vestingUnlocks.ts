// utils/profile/vestingUnlocks.ts
import { getContract, readContract } from "thirdweb";
import { client } from "@/lib/thirdwebClient";
import { sepolia } from "thirdweb/chains";
import { presaleAbi } from "@/lib/abi/presale";

/* ----------------------------- Types & Mappings ----------------------------- */

export type RoundKey = "strategic" | "seed" | "private" | "institutional" | "community";
export const ROUND_ENUM_INDEX: Record<RoundKey, number> = {
  strategic: 0,
  seed: 1,
  private: 2,
  institutional: 3,
  community: 4,
};

const ROUND_LABEL: Record<RoundKey, string> = {
  strategic: "Strategic Round",
  seed: "Seed Round",
  private: "Private Round",
  institutional: "Institutional Round",
  community: "Community Round",
};

const ROUND_INDEX_TO_KEY = ["strategic", "seed", "private", "institutional", "community"] as const;

/** Safe mapper for uint8 round index → RoundKey (returns null if out of range). */
function roundIndexToKey(idx: number): RoundKey | null {
  return Number.isInteger(idx) && idx >= 0 && idx < ROUND_INDEX_TO_KEY.length
    ? (ROUND_INDEX_TO_KEY[idx]! as RoundKey)
    : null;
}

const PRESALE_ADDR = process.env.NEXT_PUBLIC_PRESALE_SMART_CONTRACT_ADDRESS as `0x${string}`;

/* --------------------------------- Contracts -------------------------------- */

const presale = getContract({
  client,
  chain: sepolia,
  address: PRESALE_ADDR,
  abi: presaleAbi,
});

const ERC20_DECIMALS_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/* --------------------------------- ABI Shapes -------------------------------- */

type RoundInfoTuple = readonly [
  boolean, // isActive
  bigint, // tokenPrice
  bigint, // minPurchase
  bigint, // totalRaised
  bigint, // startTime
  bigint, // endTime
  bigint, // totalTokensSold
  bigint, // maxTokensToSell
  boolean, // isPublic
  bigint, // vestingEndTime
  bigint, // cliffPeriodMonths
  bigint, // vestingDurationMonths
  bigint // tgeUnlockPercentage (bps)
];

type GetUserPurchasesTuple = readonly [bigint[], bigint[], bigint[], bigint[]];

type WhitelistTuple = readonly [
  boolean, // isWhitelisted
  bigint, // preAssignedTokens
  bigint, // claimedTokens
  number // whitelistRound (uint8)
];

/* --------------------------------- Utilities -------------------------------- */

export async function getTokenDecimals(): Promise<number> {
  try {
    const tokenAddr = (await readContract({
      contract: presale,
      method: "token",
    })) as `0x${string}`;

    const erc20 = getContract({
      client,
      chain: sepolia,
      address: tokenAddr,
      abi: ERC20_DECIMALS_ABI,
    });

    const dec = (await readContract({
      contract: erc20,
      method: "decimals",
    })) as number | bigint;

    return typeof dec === "bigint" ? Number(dec) : dec;
  } catch {
    return 18;
  }
}

async function getTgeTime(): Promise<bigint> {
  try {
    const t = (await readContract({
      contract: presale,
      method: "tgeTime",
    }));
    return t;
  } catch {
    return 0n;
  }
}

async function readRoundInfoByKey(key: RoundKey): Promise<RoundInfoTuple> {
  switch (key) {
    case "strategic":
      return (await readContract({ contract: presale, method: "getStrategicRoundInfo" })) as RoundInfoTuple;
    case "seed":
      return (await readContract({ contract: presale, method: "getSeedRoundInfo" })) as RoundInfoTuple;
    case "private":
      return (await readContract({ contract: presale, method: "getPrivateRoundInfo" })) as RoundInfoTuple;
    case "institutional":
      return (await readContract({ contract: presale, method: "getInstitutionalRoundInfo" })) as RoundInfoTuple;
    case "community":
      return (await readContract({ contract: presale, method: "getCommunityRoundInfo" })) as RoundInfoTuple;
  }
}

/** Add months in UTC preserving "day of month" semantics. */
function addMonthsUTC(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const result = new Date(Date.UTC(y, m + months, 1));
  // Set to desired day or last day of that month if day overflows
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(d, lastDay));
  return result;
}

/** Month label like "Nov 2025" in the user's locale. */
function monthLabel(date: Date): string {
  return date.toLocaleString(undefined, { month: "short", year: "numeric" });
}

/** Convert UNIX seconds bigint → Date (UTC). */
function unixToDateUTC(sec: bigint): Date {
  return new Date(Number(sec) * 1000);
}

/** Format token for UI (max 3 decimals, localized) from bigint raw value. */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  if (raw === 0n) return "0";
  const base = 10n ** BigInt(decimals);
  const integer = raw / base;
  const fraction = raw % base;

  if (fraction === 0n) return integer.toLocaleString();

  // Convert to JS number for rounding to 3 decimals (safe for UI, not for precise math)
  const asNumber = Number(integer) + Number(fraction) / Number(base);
  const rounded = Math.round(asNumber * 1000) / 1000;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

/** Split a bigint total into `months` nearly-equal bigint chunks; remainder to the last. */
function splitIntoMonths(total: bigint, months: number): bigint[] {
  if (months <= 0) return [];
  const m = BigInt(months);
  const q = total / m;
  const r = total % m;
  const arr: bigint[] = new Array(months).fill(q) as bigint[];
  if (r > 0n) {
    const lastIndex = months - 1;
    const lastMonth = arr[lastIndex]!;
    arr[lastIndex] = lastMonth + r; // put remainder in the final month
  }
  return arr;
}

/* -------------------------- Participation discovery -------------------------- */

async function getUserPurchasesSumByRound(user: `0x${string}`, rk: RoundKey): Promise<bigint> {
  const res = (await readContract({
    contract: presale,
    method: "getUserPurchases",
    params: [user, ROUND_ENUM_INDEX[rk]],
  })) as GetUserPurchasesTuple;

  const [amounts] = res;
  let sum = 0n;
  for (const a of amounts) sum += a;
  return sum;
}

async function getWhitelistInfo(user: `0x${string}`): Promise<WhitelistTuple> {
  const w = (await readContract({
    contract: presale,
    method: "whitelist",
    params: [user],
  })) as WhitelistTuple;
  return w;
}

/** Returns the set of rounds the user participated in (purchases or whitelist>0). */
async function getUserParticipatedRounds(user: `0x${string}`): Promise<RoundKey[]> {
  const keys: RoundKey[] = ["strategic", "seed", "private", "institutional", "community"];
  const set = new Set<RoundKey>();

  // Purchases
  const sums = await Promise.all(keys.map((rk) => getUserPurchasesSumByRound(user, rk)));
  sums.forEach((sum, i) => {
    if (sum > 0n) set.add(keys[i]!);
  });

  // Whitelist
  const [isWhitelisted, preAssigned, _claimed, wlRound] = await getWhitelistInfo(user);
  if (isWhitelisted && preAssigned > 0n) {
    const mapped = roundIndexToKey(wlRound);
    if (mapped) set.add(mapped);
  }

  return Array.from(set.values());
}

/* ------------------------------ Public interface ------------------------------ */

export type MonthlyVestingItem = {
  /** e.g., "Nov 2025" */
  label: string;
  /** Total tokens unlocking at that date (raw BigInt) */
  amountRaw: bigint;
  /** UTC date of the unlock */
  firstUnlockDate: Date;
  /** Which round this item belongs to */
  round: RoundKey;
  roundLabel: string;
};

/**
 * Build "upcoming unlocks" for rounds the user actually participated in,
 * based solely on vesting params + TGE time (not the active round).
 */
export async function readAllParticipatedMonthlyVesting(user: `0x${string}`): Promise<{
  tokenDecimals: number;
  items: MonthlyVestingItem[];
}> {
  const [tokenDecimals, tgeTimeRaw] = await Promise.all([getTokenDecimals(), getTgeTime()]);
  const tgeDate = tgeTimeRaw > 0n ? unixToDateUTC(tgeTimeRaw) : new Date(0);
  const now = new Date();

  const rounds = await getUserParticipatedRounds(user);
  if (rounds.length === 0) {
    return { tokenDecimals, items: [] };
  }

  const items: MonthlyVestingItem[] = [];

  const wl = await getWhitelistInfo(user);
  const [isWl, preAssigned, _claimedWl, wlRound] = wl;
  const wlMapped = roundIndexToKey(wlRound);

  for (const rk of rounds) {
    const roundInfo = await readRoundInfoByKey(rk);
    const cliffMonths = Number(roundInfo[10]);
    const vestMonths = Number(roundInfo[11]);
    const tgeBps = Number(roundInfo[12]); // basis points

    // Base tokens for this round
    const purchasedSum = await getUserPurchasesSumByRound(user, rk);
    const whitelistAdd = isWl && preAssigned > 0n && wlMapped === rk ? preAssigned : 0n;

    const totalBase = purchasedSum + whitelistAdd;
    if (totalBase === 0n) continue;

    // TGE portion
    const tgePortion = tgeBps > 0 ? (totalBase * BigInt(tgeBps)) / 10000n : 0n;
    const afterTge = totalBase - tgePortion;

    // If TGE is in the future and has non-zero amount, add it as an upcoming item
    if (tgePortion > 0n && tgeDate.getTime() > now.getTime()) {
      items.push({
        label: monthLabel(tgeDate),
        amountRaw: tgePortion,
        firstUnlockDate: tgeDate,
        round: rk,
        roundLabel: ROUND_LABEL[rk],
      });
    }

    // Monthly linear schedule post-cliff
    if (vestMonths > 0 && afterTge > 0n && tgeTimeRaw > 0n) {
      const firstMonthDate = addMonthsUTC(tgeDate, cliffMonths);
      const monthlyParts = splitIntoMonths(afterTge, vestMonths);

      for (let i = 0; i < monthlyParts.length; i++) {
        const unlockDate = addMonthsUTC(firstMonthDate, i);
        if (unlockDate.getTime() <= now.getTime()) continue; // upcoming only
        const amt = monthlyParts[i] ?? 0n;
        if (amt === 0n) continue;

        items.push({
          label: monthLabel(unlockDate),
          amountRaw: amt,
          firstUnlockDate: unlockDate,
          round: rk,
          roundLabel: ROUND_LABEL[rk],
        });
      }
    }
  }

  // Sort chronologically
  items.sort((a, b) => a.firstUnlockDate.getTime() - b.firstUnlockDate.getTime());

  return { tokenDecimals, items };
}
