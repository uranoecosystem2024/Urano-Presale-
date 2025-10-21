// utils/profile/participation.ts
"use client";

import { getContract, readContract } from "thirdweb";
import { arbitrum } from "thirdweb/chains";

import type { RoundKey } from "@/utils/profile/bought";
import { getUsdcDecimals } from "@/utils/profile/bought";
import { client } from "@/lib/thirdwebClient";
import { presaleAbi } from "@/lib/abi/presale";

/** ===== Contract setup ===== */
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

/** ===== Rounds & helpers ===== */
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

export const ROUND_LABEL: Readonly<Record<RoundKey, string>> = {
  seed: "Seed",
  private: "Private",
  institutional: "Institutional",
  strategic: "Strategic",
  community: "Community",
};

/** Shape of getUserPurchases return (uint256[] quadruple) */
type PurchasesTuple = readonly [bigint[], bigint[], bigint[], bigint[]];

/** Round info readers (to grab tokenPrice_) */
async function readRoundTokenPrice(key: RoundKey): Promise<bigint> {
  // each getter returns a tuple where the 2nd item is tokenPrice_
  // (bool isActive_, uint256 tokenPrice_, ...)
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

/** Get a user's purchases for a given round */
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

  // Defensive: ensure tuple lengths match (contract should guarantee this)
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

/** ===== Public types ===== */
export type UserRoundParticipation = {
  key: RoundKey;
  label: string;
  tokenPriceRaw: bigint; // USDC units (e.g., 6 decimals)
  purchasesCount: number;
  totalTokensBought: bigint; // sum of token amounts across purchases
  totalUsdcSpent: bigint; // sum of usdcAmounts across purchases
};

export type UserParticipationSummary = {
  usdcDecimals: number;
  rounds: UserRoundParticipation[]; // only rounds with at least one purchase
};

/** ===== Main API =====
 * For a given user, returns all rounds where the user has one or more purchases,
 * including the round token price and simple aggregates.
 */
export async function readUserParticipationRounds(
  user: `0x${string}`,
): Promise<UserParticipationSummary> {
  const usdcDecimals = await getUsdcDecimals();

  // Fetch purchases & token prices per round in parallel
  const perRound = await Promise.all(
    ROUNDS_ORDER.map(async (key) => {
      const [amounts, usdcAmounts] = await readUserPurchasesForRound(user, key);
      const purchasesCount = amounts.length;

      if (purchasesCount === 0) {
        // no purchases in this round
        return null;
      }

      // Aggregate
      const totalTokensBought = amounts.reduce<bigint>(
        (acc, v) => acc + v,
        0n,
      );
      const totalUsdcSpent = usdcAmounts.reduce<bigint>(
        (acc, v) => acc + v,
        0n,
      );

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

  const rounds = perRound.filter(
    (x): x is UserRoundParticipation => x !== null,
  );

  return { usdcDecimals, rounds };
}
