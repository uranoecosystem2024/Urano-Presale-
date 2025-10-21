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
  boolean,  // isActive
  bigint,   // tokenPrice
  bigint,   // minPurchase
  bigint,   // totalRaised
  bigint,   // startTime
  bigint,   // endTime
  bigint,   // totalTokensSold
  bigint,   // maxTokensToSell
  boolean,  // isPublic
  bigint,   // vestingEndTime
  bigint,   // cliffPeriodMonths
  bigint,   // vestingDurationMonths
  bigint    // tgeUnlockPercentage (bps)
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

export type PerRoundVesting = {
  round: RoundKey;
  label: string;
  tgeUnlockBps: number;     // e.g. 1200 = 12%
  cliffMonths: number;      // months
  durationMonths: number;   // months
  releaseFrequency: "Monthly" | "Unknown";
};

/**
 * Returns vesting info **only for rounds the user actually purchased in**.
 * A round is considered participated if getUserPurchases(user, round) contains any non-zero amount.
 */
export async function readUserVestingSummaries(user: `0x${string}`): Promise<PerRoundVesting[]> {
  const all: RoundKey[] = ["strategic", "seed", "private", "institutional", "community"];

  // 1) Detect participation via purchases
  const participated: RoundKey[] = [];
  for (const rk of all) {
    const [amounts] = (await readContract({
      contract: presale,
      method: "getUserPurchases",
      params: [user, ROUND_ENUM_INDEX[rk]],
    })) as readonly [bigint[], bigint[], bigint[], bigint[]];

    const sum = amounts.reduce((acc, v) => acc + v, 0n);
    if (sum > 0n) participated.push(rk);
  }

  if (participated.length === 0) return [];

  // 2) Load vesting params for each participated round
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
