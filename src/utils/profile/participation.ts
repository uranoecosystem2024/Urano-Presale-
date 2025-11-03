"use client";

import { getContract, readContract } from "thirdweb";
import { arbitrum } from "thirdweb/chains";

import type { RoundKey } from "@/utils/profile/bought";
import { getUsdcDecimals } from "@/utils/profile/bought";
import { client } from "@/lib/thirdwebClient";
import { presaleAbi } from "@/lib/abi/presale";

const PRESALE_ADDR = process.env
  .NEXT_PUBLIC_PRESALE_SMART_CONTRACT_ADDRESS as `0x${string}`;

if (!PRESALE_ADDR) {
  throw new Error("Missing NEXT_PUBLIC_PRESALE_SMART_CONTRACT_ADDRESS");
}

const presale = getContract({
  client,
  chain: arbitrum,
  address: PRESALE_ADDR,
  abi: presaleAbi,
});
 
export const ROUNDS_ORDER: readonly RoundKey[] = [
  "strategic",
  "seed",
  "private",
  "institutional",
  "community",
] as const;

export const ROUND_ENUM_INDEX: Readonly<Record<RoundKey, number>> = {
  strategic: 0,
  seed: 1,
  private: 2,
  institutional: 3,
  community: 4,
};

export const ENUM_TO_ROUND_KEY: Readonly<Record<number, RoundKey | undefined>> = {
  0: "strategic",
  1: "seed",
  2: "private",
  3: "institutional",
  4: "community",
};

export const ROUND_LABEL: Readonly<Record<RoundKey, string>> = {
  seed: "Seed",
  private: "Private",
  institutional: "Institutional",
  strategic: "Strategic",
  community: "Community",
};

type PurchasesTuple = readonly [bigint[], bigint[], bigint[], bigint[]];

type WhitelistTuple = readonly [boolean, bigint, bigint, number];
type WhitelistObj = {
  isWhitelisted: boolean;
  preAssignedTokens: bigint;
  claimedTokens: bigint;
  whitelistRound: number;
};

function isWhitelistTuple(x: unknown): x is WhitelistTuple {
  return (
    Array.isArray(x) &&
    x.length >= 4 &&
    typeof x[0] === "boolean" &&
    typeof x[1] === "bigint" &&
    typeof x[2] === "bigint" &&
    typeof x[3] === "number"
  );
}
function isWhitelistObj(x: unknown): x is WhitelistObj {
  if (x === null || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.isWhitelisted === "boolean" &&
    typeof r.preAssignedTokens === "bigint" &&
    typeof r.claimedTokens === "bigint" &&
    typeof r.whitelistRound === "number"
  );
}

async function readRoundTokenPrice(key: RoundKey): Promise<bigint> {
  switch (key) {
    case "strategic": {
      const [, tokenPrice] = (await readContract({
        contract: presale,
        method: "getStrategicRoundInfo",
      })) as readonly [boolean, bigint, ...unknown[]];
      return tokenPrice;
    }
    case "seed": {
      const [, tokenPrice] = (await readContract({
        contract: presale,
        method: "getSeedRoundInfo",
      })) as readonly [boolean, bigint, ...unknown[]];
      return tokenPrice;
    }
    case "private": {
      const [, tokenPrice] = (await readContract({
        contract: presale,
        method: "getPrivateRoundInfo",
      })) as readonly [boolean, bigint, ...unknown[]];
      return tokenPrice;
    }
    case "institutional": {
      const [, tokenPrice] = (await readContract({
        contract: presale,
        method: "getInstitutionalRoundInfo",
      })) as readonly [boolean, bigint, ...unknown[]];
      return tokenPrice;
    }
    case "community": {
      const [, tokenPrice] = (await readContract({
        contract: presale,
        method: "getCommunityRoundInfo",
      })) as readonly [boolean, bigint, ...unknown[]];
      return tokenPrice;
    }
  }
}

async function readUserPurchasesForRound(
  user: `0x${string}`,
  key: RoundKey,
): Promise<PurchasesTuple> {
  const roundIndex = ROUND_ENUM_INDEX[key];
  const res = (await readContract({
    contract: presale,
    method: "getUserPurchases",
    params: [user, roundIndex],
  })) as PurchasesTuple;

  const [amounts, usdcAmounts, timestamps, claimed] = res;
  const len = Math.min(
    amounts.length,
    usdcAmounts.length,
    timestamps.length,
    claimed.length,
  );
  return [
    amounts.slice(0, len),
    usdcAmounts.slice(0, len),
    timestamps.slice(0, len),
    claimed.slice(0, len),
  ] as const;
}

async function readUserWhitelistRound(
  user: `0x${string}`,
): Promise<RoundKey | null> {
  const wlUnknown: unknown = await readContract({
    contract: presale,
    method: "whitelist",
    params: [user],
  });

  let isWhitelisted = false;
  let whitelistRound = -1;

  if (isWhitelistTuple(wlUnknown)) {
    isWhitelisted = wlUnknown[0];
    whitelistRound = wlUnknown[3] ?? -1;
  } else if (isWhitelistObj(wlUnknown)) {
    isWhitelisted = wlUnknown.isWhitelisted;
    whitelistRound = wlUnknown.whitelistRound ?? -1;
  }

  if (!isWhitelisted) return null;

  const key = ENUM_TO_ROUND_KEY[whitelistRound];
  return key ?? null;
}

export type UserRoundParticipation = {
  key: RoundKey;
  label: string;
  tokenPriceRaw: bigint;
  purchasesCount: number;
  totalTokensBought: bigint;
  totalUsdcSpent: bigint;
};

export type UserParticipationSummary = {
  usdcDecimals: number;
  rounds: UserRoundParticipation[];
};

export async function readUserParticipationRounds(
  user: `0x${string}`,
): Promise<UserParticipationSummary> {
  const usdcDecimals = await getUsdcDecimals();

  const perRoundPurchases = await Promise.all(
    ROUNDS_ORDER.map(async (key) => {
      const [amounts, usdcAmounts] = await readUserPurchasesForRound(user, key);
      const purchasesCount = amounts.length;
      if (purchasesCount === 0) return null;

      const totalTokensBought = amounts.reduce<bigint>((acc, v) => acc + v, 0n);
      const totalUsdcSpent = usdcAmounts.reduce<bigint>((acc, v) => acc + v, 0n);
      const tokenPriceRaw = await readRoundTokenPrice(key);

      const participation: UserRoundParticipation = {
        key,
        label: ROUND_LABEL[key],
        tokenPriceRaw,
        purchasesCount,
        totalTokensBought,
        totalUsdcSpent,
      };
      return participation;
    }),
  );

  const purchaseRounds = perRoundPurchases.filter(
    (x): x is UserRoundParticipation => x !== null,
  );

  const wlKey = await readUserWhitelistRound(user);

  const presentKeys = new Set<RoundKey>(purchaseRounds.map((r) => r.key));

  const rounds: UserRoundParticipation[] = [...purchaseRounds];

  if (wlKey && !presentKeys.has(wlKey)) {
    const tokenPriceRaw = await readRoundTokenPrice(wlKey);
    rounds.push({
      key: wlKey,
      label: ROUND_LABEL[wlKey],
      tokenPriceRaw,
      purchasesCount: 0,
      totalTokensBought: 0n,
      totalUsdcSpent: 0n,
    });
  }

  rounds.sort(
    (a, b) =>
      ROUNDS_ORDER.indexOf(a.key) - ROUNDS_ORDER.indexOf(b.key),
  );

  return { usdcDecimals, rounds };
}
