import { getContract, readContract } from "thirdweb";
import { client } from "@/lib/thirdwebClient";
import { arbitrum } from "thirdweb/chains";
import { presaleAbi } from "@/lib/abi/presale";

export type RoundKey = "strategic" | "seed" | "private" | "institutional" | "community";

export const ROUND_ENUM_INDEX: Record<RoundKey, number> = {
  strategic: 0,
  seed: 1,
  private: 2,
  institutional: 3,
  community: 4,
};

const ENUM_TO_ROUND_KEY: Record<number, RoundKey | undefined> = {
  0: "strategic",
  1: "seed",
  2: "private",
  3: "institutional",
  4: "community",
};

const PRESALE_ADDR = process.env
  .NEXT_PUBLIC_PRESALE_SMART_CONTRACT_ADDRESS as `0x${string}`;

const presale = getContract({
  client,
  chain: arbitrum,
  address: PRESALE_ADDR,
  abi: presaleAbi,
});

const ROUND_LABEL: Record<RoundKey, string> = {
  seed: "Seed Round",
  private: "Private Round",
  institutional: "Institutional Round",
  strategic: "Strategic Round",
  community: "Community Round",
};

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
  }
}

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

async function readUserWhitelistRound(user: `0x${string}`): Promise<RoundKey | null> {
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

export type PerRoundVesting = {
  round: RoundKey;
  label: string;
  tgeUnlockBps: number;
  cliffMonths: number;
  durationMonths: number;
  releaseFrequency: "Monthly" | "Unknown";
};

export async function readUserVestingSummaries(user: `0x${string}`): Promise<PerRoundVesting[]> {
  const all: RoundKey[] = ["strategic", "seed", "private", "institutional", "community"];

  const viaPurchases = new Set<RoundKey>();
  for (const rk of all) {
    const [amounts] = (await readContract({
      contract: presale,
      method: "getUserPurchases",
      params: [user, ROUND_ENUM_INDEX[rk]],
    })) as readonly [bigint[], bigint[], bigint[], bigint[]];

    const sum = amounts.reduce((acc, v) => acc + v, 0n);
    if (sum > 0n) viaPurchases.add(rk);
  }

  const wlKey = await readUserWhitelistRound(user);
  if (wlKey) viaPurchases.add(wlKey);

  const participated = all.filter((rk) => viaPurchases.has(rk));
  if (participated.length === 0) return [];

  const infos = await Promise.all(participated.map((rk) => readRoundInfoByKey(rk)));

  return participated.map((rk, i) => {
    const info = infos[i]!;
    const cliffMonths = Number(info[10]);
    const durationMonths = Number(info[11]);
    const tgeUnlockBps = Number(info[12]);

    return {
      round: rk,
      label: ROUND_LABEL[rk],
      tgeUnlockBps,
      cliffMonths,
      durationMonths,
      releaseFrequency: durationMonths > 0 ? "Monthly" : "Unknown",
    };
  });
}
