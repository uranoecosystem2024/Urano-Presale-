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

const ERC20_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

function ensureEnumMapping(key: RoundKey): number {
  const idx = ROUND_ENUM_INDEX[key];
  if (idx === undefined) {
    throw new Error(`Missing enum index for round "${key}" in ROUND_ENUM_INDEX.`);
  }
  return idx;
}

export function toUnits(amount: string, decimals: number): bigint {
  const cleaned = (amount ?? "").trim();
  if (!cleaned) return 0n;

  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error("Invalid number format");
  }

  const [intPart = "0", fracPartRaw = ""] = cleaned.split(".");
  const fracPart = fracPartRaw.slice(0, decimals).padEnd(decimals, "0");

  const base = 10n ** BigInt(decimals);
  const intVal = BigInt(intPart || "0") * base;
  const fracVal = fracPart ? BigInt(fracPart) : 0n;

  return intVal + fracVal;
}

export function fromUnits(amount: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const intPart = amount / base;
  const frac = amount % base;

  if (frac === 0n) return intPart.toString();

  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${intPart.toString()}.${fracStr}`;
}

export async function getTokenDecimals(): Promise<number> {
  try {
    const tokenAddr = (await readContract({
      contract: presale,
      method: "token",
    })) as `0x${string}`;

    const erc20 = getContract({
      client,
      chain: arbitrum,
      address: tokenAddr,
      abi: ERC20_ABI,
    });

    const dec = await readContract({
      contract: erc20,
      method: "decimals",
    });

    return Number(dec);
  } catch {
    return 18;
  }
}

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
      return (await readContract({
        contract: presale,
        method: "getSeedRoundInfo",
      })) as RoundInfoTuple;
    case "private":
      return (await readContract({
        contract: presale,
        method: "getPrivateRoundInfo",
      })) as RoundInfoTuple;
    case "institutional":
      return (await readContract({
        contract: presale,
        method: "getInstitutionalRoundInfo",
      })) as RoundInfoTuple;
    case "strategic":
      return (await readContract({
        contract: presale,
        method: "getStrategicRoundInfo",
      })) as RoundInfoTuple;
    case "community":
      return (await readContract({
        contract: presale,
        method: "getCommunityRoundInfo",
      })) as RoundInfoTuple;
  }
}

export async function readRoundMaxTokensRaw(key: RoundKey): Promise<bigint> {
  const info = await readRoundInfoByKey(key);
  return info[7];
}

export async function readRoundMaxTokensHuman(key: RoundKey): Promise<string> {
  const [decimals, raw] = await Promise.all([
    getTokenDecimals(),
    readRoundMaxTokensRaw(key),
  ]);
  return fromUnits(raw, decimals);
}

export async function setRoundMaxTokensRawTx(
  account: Account,
  key: RoundKey,
  maxTokensRaw: bigint
): Promise<`0x${string}`> {
  const idx = ensureEnumMapping(key);
  const tx = prepareContractCall({
    contract: presale,
    method: "setRoundMaxTokens",
    params: [idx, maxTokensRaw],
  });
  const sent = await sendTransaction({ account, transaction: tx });
  await waitForReceipt(sent);
  return sent.transactionHash;
}

export async function setRoundMaxTokensHumanTx(
  account: Account,
  key: RoundKey,
  maxTokensHuman: string
): Promise<`0x${string}`> {
  if (!maxTokensHuman || Number(maxTokensHuman) < 0) {
    throw new Error("Enter a valid max tokens amount.");
  }
  const decimals = await getTokenDecimals();
  const raw = toUnits(maxTokensHuman, decimals);
  return setRoundMaxTokensRawTx(account, key, raw);
}

export async function readRoundSoldAndRemainingRaw(key: RoundKey): Promise<{
  soldRaw: bigint;
  maxRaw: bigint;
  remainingRaw: bigint;
}> {
  const info = await readRoundInfoByKey(key);
  const soldRaw = info[6];
  const maxRaw = info[7];
  const rem = maxRaw - soldRaw;
  const remainingRaw = rem > 0n ? rem : 0n;
  return { soldRaw, maxRaw, remainingRaw };
}

export async function readRoundSoldAndRemainingHuman(key: RoundKey): Promise<{
  sold: string;
  max: string;
  remaining: string;
}> {
  const decimals = await getTokenDecimals();
  const { soldRaw, maxRaw, remainingRaw } = await readRoundSoldAndRemainingRaw(key);
  return {
    sold: fromUnits(soldRaw, decimals),
    max: fromUnits(maxRaw, decimals),
    remaining: fromUnits(remainingRaw, decimals),
  };
}
