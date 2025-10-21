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
import { parseUnits, zeroAddress } from "viem";
import { presaleAbi } from "@/lib/abi/presale";
import { mockUSDC as mockUsdcAbi } from "@/lib/abi/mockUSDC";

const PRESALE_ADDR = process.env
  .NEXT_PUBLIC_PRESALE_SMART_CONTRACT_ADDRESS as `0x${string}`;
const MOCK_USDC_ADDR = process.env
  .NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA as `0x${string}`;

const presale = getContract({
  client,
  chain: arbitrum,
  address: PRESALE_ADDR,
  abi: presaleAbi,
});

const mockUsdc = getContract({
  client,
  chain: arbitrum,
  address: MOCK_USDC_ADDR,
  abi: mockUsdcAbi,
});

export const RoundType = {
  STRATEGIC: 0,
  SEED: 1,
  PRIVATE: 2,
  INSTITUTIONAL: 3,
  COMMUNITY: 4,
} as const;

export type RoundName = keyof typeof RoundType;
export type RoundLike = number | RoundName;

function resolveRound(round: RoundLike): number {
  if (typeof round === "number") return round;
  return RoundType[round];
}

export type RoundInfo = {
  isActive_: boolean;
  tokenPrice_: bigint;
  minPurchase_: bigint;
  totalRaised_: bigint;
  startTime_: bigint;
  endTime_: bigint;
  totalTokensSold_: bigint;
  maxTokensToSell_: bigint;
  isPublic_: boolean;
  vestingEndTime_: bigint;
  cliffPeriodMonths_: bigint;
  vestingDurationMonths_: bigint;
  tgeUnlockPercentage_: bigint;
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

type RoundInfoLite = Pick<
  RoundInfo,
  "isActive_" | "startTime_" | "endTime_" | "totalTokensSold_" | "maxTokensToSell_"
>;

function mapRoundTuple(t: RoundInfoTuple): RoundInfo {
  return {
    isActive_: t[0],
    tokenPrice_: t[1],
    minPurchase_: t[2],
    totalRaised_: t[3],
    startTime_: t[4],
    endTime_: t[5],
    totalTokensSold_: t[6],
    maxTokensToSell_: t[7],
    isPublic_: t[8],
    vestingEndTime_: t[9],
    cliffPeriodMonths_: t[10],
    vestingDurationMonths_: t[11],
    tgeUnlockPercentage_: t[12],
  };
}

export async function getRoundInfo(round: RoundLike): Promise<RoundInfo> {
  const idx = resolveRound(round);

  if (idx === RoundType.STRATEGIC) {
    const res = (await readContract({
      contract: presale,
      method: "getStrategicRoundInfo",
    })) as RoundInfoTuple;
    return mapRoundTuple(res);
  }
  if (idx === RoundType.SEED) {
    const res = (await readContract({
      contract: presale,
      method: "getSeedRoundInfo",
    })) as RoundInfoTuple;
    return mapRoundTuple(res);
  }
  if (idx === RoundType.PRIVATE) {
    const res = (await readContract({
      contract: presale,
      method: "getPrivateRoundInfo",
    })) as RoundInfoTuple;
    return mapRoundTuple(res);
  }
  if (idx === RoundType.INSTITUTIONAL) {
    const res = (await readContract({
      contract: presale,
      method: "getInstitutionalRoundInfo",
    })) as RoundInfoTuple;
    return mapRoundTuple(res);
  }
  if (idx === RoundType.COMMUNITY) {
    const res = (await readContract({
      contract: presale,
      method: "getCommunityRoundInfo",
    })) as RoundInfoTuple;
    return mapRoundTuple(res);
  }

  throw new Error(`Unknown round index: ${idx}`);
}

async function readRoundLite(index: number): Promise<RoundInfoLite> {
  const info = await getRoundInfo(index);
  return {
    isActive_: info.isActive_,
    startTime_: info.startTime_,
    endTime_: info.endTime_,
    totalTokensSold_: info.totalTokensSold_,
    maxTokensToSell_: info.maxTokensToSell_,
  };
}

export async function getActiveRoundIndex(): Promise<number | null> {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const order = [
    RoundType.STRATEGIC,
    RoundType.SEED,
    RoundType.PRIVATE,
    RoundType.INSTITUTIONAL,
    RoundType.COMMUNITY,
  ];

  for (const idx of order) {
    const r = await readRoundLite(idx);
    const withinTime = now >= r.startTime_ && now <= r.endTime_;
    const hasCapacity = r.totalTokensSold_ < r.maxTokensToSell_;
    if (r.isActive_ && withinTime && hasCapacity) {
      return idx;
    }
  }
  return null;
}

export async function getActiveRoundIndexStrict(): Promise<number> {
  const idx = await getActiveRoundIndex();
  if (idx === null) {
    throw new Error("No active presale round is currently open.");
  }
  return idx;
}

const gen6 = () =>
  String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");

let cachedUsdcDecimals: number | null = null;
async function getUsdcDecimals(): Promise<number> {
  if (cachedUsdcDecimals !== null) return cachedUsdcDecimals;

  const raw = (await readContract({
    contract: mockUsdc,
    method: "decimals",
  })) as number | bigint;

  const n = typeof raw === "bigint" ? Number(raw) : raw;
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Invalid USDC decimals read from contract");
  }

  cachedUsdcDecimals = n;
  return n;
}

export async function getOrCreateInviteCode(
  account: Account
): Promise<{ code: string; created: boolean; txHash?: `0x${string}` }> {
  if (!account) throw new Error("No connected account");
  if (!PRESALE_ADDR) throw new Error("PRESALE address is missing");
  if (!MOCK_USDC_ADDR) throw new Error("USDC address is missing");

  const userAddr = account.address as `0x${string}`;

  const existing = (await readContract({
    contract: presale,
    method: "getUserInviteCode",
    params: [userAddr],
  }));

  if (existing && existing.length > 0) {
    return { code: existing, created: false };
  }

  for (let i = 0; i < 10; i++) {
    const code = gen6();

    if (!/^\d{6}$/.test(code)) continue;

    const owner = (await readContract({
      contract: presale,
      method: "getInviteCodeOwner",
      params: [code],
    })) as `0x${string}`;

    if (owner === zeroAddress) {
      const tx = prepareContractCall({
        contract: presale,
        method: "registerInviteCode",
        params: [code],
      });

      const sent = await sendTransaction({ account, transaction: tx });
      await waitForReceipt(sent);

      return { code, created: true, txHash: sent.transactionHash };
    }
  }

  throw new Error(
    "Could not find a free 6-digit code after several attempts. Try again."
  );
}

export async function approveUsdcSpending(
  account: Account,
  humanAmountUsdc: number
): Promise<{ approvedAmount: bigint; txHash: `0x${string}` }> {
  if (!account) throw new Error("No connected account");
  if (!PRESALE_ADDR) throw new Error("PRESALE address is missing");
  if (!MOCK_USDC_ADDR) throw new Error("USDC address is missing");
  if (!(humanAmountUsdc > 0))
    throw new Error("Amount must be greater than 0");

  const decimals = await getUsdcDecimals();
  const amountBaseUnits = parseUnits(humanAmountUsdc.toString(), decimals);

  const tx = prepareContractCall({
    contract: mockUsdc,
    method: "approve",
    params: [PRESALE_ADDR, amountBaseUnits],
  });

  const sent = await sendTransaction({ account, transaction: tx });
  await waitForReceipt(sent);

  return { approvedAmount: amountBaseUnits, txHash: sent.transactionHash };
}

export async function buyPresaleTokens(
  account: Account,
  round: RoundLike,
  humanUsdcAmount: number,
  inviteCode: string
): Promise<{ txHash: `0x${string}` }> {
  if (!account) throw new Error("No connected account");
  if (!PRESALE_ADDR) throw new Error("PRESALE address is missing");
  if (!MOCK_USDC_ADDR) throw new Error("USDC address is missing");
  if (!(humanUsdcAmount > 0))
    throw new Error("USDC amount must be greater than 0");
  if (!inviteCode || inviteCode.trim().length === 0)
    throw new Error("Invite code is required");

  const decimals = await getUsdcDecimals();
  const usdcAmount = parseUnits(humanUsdcAmount.toString(), decimals);

  const owner = account.address as `0x${string}`;
  const currentAllowance = (await readContract({
    contract: mockUsdc,
    method: "allowance",
    params: [owner, PRESALE_ADDR],
  }));

  if (currentAllowance < usdcAmount) {
    throw new Error("Insufficient USDC allowance for presale contract.");
  }

  const roundIndex = resolveRound(round);

  const tx = prepareContractCall({
    contract: presale,
    method: "buyTokens",
    params: [roundIndex, usdcAmount, inviteCode],
  });

  const sent = await sendTransaction({ account, transaction: tx });
  await waitForReceipt(sent);

  return { txHash: sent.transactionHash };
}
