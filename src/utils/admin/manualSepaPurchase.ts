"use client";

import {
  getContract,
  prepareContractCall,
  readContract,
  sendTransaction,
  waitForReceipt,
} from "thirdweb";
import type { PreparedTransaction } from "thirdweb";
import type { Account } from "thirdweb/wallets";
import { arbitrum } from "thirdweb/chains";

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

const ERC20_DECIMALS_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export type RoundKey =
  | "strategic"
  | "seed"
  | "private"
  | "institutional"
  | "community";

export const ROUND_ENUM_INDEX: Record<RoundKey, number> = {
  strategic: 0,
  seed: 1,
  private: 2,
  institutional: 3,
  community: 4,
};

export function toRoundIndex(round: RoundKey | number): number {
  if (typeof round === "number") {
    if (round < 0 || round > 255) throw new Error("round must be a uint8 (0..255).");
    return round;
  }
  const idx = ROUND_ENUM_INDEX[round];
  if (idx === undefined) throw new Error(`Unknown round key: ${round}`);
  return idx;
}

export type RoundOption = { id: string; label: string };
export function getRoundOptions(): RoundOption[] {
  return [
    { id: "strategic",      label: "Strategic" },
    { id: "seed",           label: "Seed" },
    { id: "private",        label: "Private" },
    { id: "institutional",  label: "Institutional" },
    { id: "community",      label: "Community" },
  ];
}

export function coerceRoundId(roundId: string): RoundKey | number {
  if (/^\d+$/.test(roundId)) return Number(roundId);
  const lower = (roundId || "").toLowerCase();
  const keys: RoundKey[] = ["strategic", "seed", "private", "institutional", "community"];
  if (keys.includes(lower as RoundKey)) return lower as RoundKey;
  throw new Error(`Unknown round id "${roundId}" — use 0..255 or one of ${keys.join(", ")}`);
}

export function isAddressLike(a: string): a is `0x${string}` {
  return typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a);
}

export function toUnits(amount: string, decimals: number): bigint {
  const cleaned = (amount ?? "").trim();
  if (!cleaned) throw new Error("Amount is required");

  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Invalid number format: "${amount}"`);
  }

  const [intPart = "0", fracRaw = ""] = cleaned.split(".");
  const frac = fracRaw.slice(0, decimals).padEnd(decimals, "0");

  const base = 10n ** BigInt(decimals);
  const intVal = BigInt(intPart || "0") * base;
  const fracVal = frac ? BigInt(frac) : 0n;

  return intVal + fracVal;
}

async function getUsdcDecimals(): Promise<number> {
  try {
    const usdcAddr = (await readContract({
      contract: presale,
      method: "usdc",
    })) as `0x${string}`;

    const usdc = getContract({
      client,
      chain: arbitrum,
      address: usdcAddr,
      abi: ERC20_DECIMALS_ABI,
    });

    const dec = (await readContract({
      contract: usdc,
      method: "decimals",
    })) as number | bigint;

    return typeof dec === "bigint" ? Number(dec) : dec;
  } catch {
    // Most USDCs are 6 decimals; safe fallback.
    return 6;
  }
}

export function prepareAddPurchaseTx(
  user: `0x${string}`,
  roundId: number,
  usdcAmount: bigint
): PreparedTransaction<typeof presaleAbi> {
  return prepareContractCall({
    contract: presale,
    method: "addPurchase",
    params: [user, roundId, usdcAmount],
  });
}

export type SepaRow = {
  address: string;
  amountUsdcHuman: string;
  reference?: string;
};

type AddOptions = {
  dedupe?: boolean;
};

export async function addManualPurchasesSameRoundTx(
  account: Account,
  round: RoundKey | number,
  rows: SepaRow[],
  opts?: AddOptions
): Promise<`0x${string}`[]> {
  if (!rows.length) return [];

  const dedupe = opts?.dedupe ?? true;

  const cleaned: { addr: `0x${string}`; amount: string }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const addrStr = (r.address ?? "").trim();
    const amtStr = (r.amountUsdcHuman ?? "").trim();
    if (!addrStr || !amtStr) continue;
    if (!isAddressLike(addrStr)) throw new Error(`Invalid address: ${addrStr}`);
    if (!/^\d+(\.\d+)?$/.test(amtStr)) throw new Error(`Invalid USDC amount for ${addrStr}: "${amtStr}"`);

    const key = addrStr.toLowerCase();
    if (dedupe) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    cleaned.push({ addr: addrStr, amount: amtStr });
  }

  if (!cleaned.length) throw new Error("No valid rows to add.");

  const usdcDecimals = await getUsdcDecimals();
  const roundId = toRoundIndex(round);

  const hashes: `0x${string}`[] = [];
  for (const { addr, amount } of cleaned) {
    const usdcUnits = toUnits(amount, usdcDecimals);
    if (usdcUnits <= 0n) throw new Error(`USDC amount must be > 0 for ${addr}`);

    const tx = prepareAddPurchaseTx(addr, roundId, usdcUnits);
    const sent = await sendTransaction({ account, transaction: tx });
    await waitForReceipt(sent);
    hashes.push(sent.transactionHash);
  }

  return hashes;
}
