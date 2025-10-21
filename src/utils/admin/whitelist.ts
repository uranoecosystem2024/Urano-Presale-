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

const ERC20_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

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

export function toUnixSecondsBigint(
  input: Date | number | string | { valueOf: () => number }
): bigint {
  const ms = typeof input === "object" ? input.valueOf() : Number(input);
  if (!Number.isFinite(ms)) throw new Error("Invalid date/time value");
  const seconds = ms < 1e12 ? ms : Math.floor(ms / 1000);
  return BigInt(seconds);
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

    const dec = (await readContract({ contract: erc20, method: "decimals" })) as number | bigint;
    return typeof dec === "bigint" ? Number(dec) : dec;
  } catch {
    return 18;
  }
}

type WhitelistTuple = readonly [boolean, bigint, bigint, number | bigint];

export type WhitelistEntry = {
  isWhitelisted: boolean;
  preAssignedTokensRaw: bigint;
  preAssignedTokensHuman: string;
  claimedTokensRaw: bigint;
  whitelistRound: number;
};

export async function readWhitelist(user: `0x${string}`): Promise<WhitelistEntry> {
  const decimals = await getTokenDecimals();

  const res = (await readContract({
    contract: presale,
    method: "whitelist",
    params: [user],
  })) as WhitelistTuple;

  const isWhitelisted = Boolean(res[0]);
  const preAssignedRaw = res[1];
  const claimedRaw = res[2];
  const whitelistRound = Number(res[3]);

  return {
    isWhitelisted,
    preAssignedTokensRaw: preAssignedRaw,
    preAssignedTokensHuman: fromUnits(preAssignedRaw, decimals),
    claimedTokensRaw: claimedRaw,
    whitelistRound,
  };
}

export async function readWhitelistMany(
  users: `0x${string}`[]
): Promise<Record<string, WhitelistEntry>> {
  const out: Record<string, WhitelistEntry> = {};
  for (const u of users) {
    out[u] = await readWhitelist(u);
  }
  return out;
}

export async function getWhitelistClaimable(user: `0x${string}`): Promise<bigint> {
  const amount = await readContract({
    contract: presale,
    method: "getWhitelistClaimable",
    params: [user],
  });
  return amount;
}

export function isAddressLike(a: string): a is `0x${string}` {
  return typeof a === "string" && a.startsWith("0x") && a.length === 42;
}

function toRoundIndex(round: RoundKey | number): number {
  if (typeof round === "number") {
    if (round < 0 || round > 255) throw new Error("whitelistRound must be a uint8 (0..255).");
    return round;
  }
  const idx = ROUND_ENUM_INDEX[round];
  if (idx === undefined) throw new Error(`Unknown round key: ${round}`);
  return idx;
}

export type AddWhitelistEntryHuman = {
  address: `0x${string}`;
  preAssignedTokens: string;
  whitelistRound: RoundKey | number;
};

export async function addToWhitelistRawTx(
  account: Account,
  users: `0x${string}`[],
  preAssignedTokensRaw: bigint[],
  whitelistRounds: number[]
): Promise<`0x${string}`> {
  if (
    !users.length ||
    users.length !== preAssignedTokensRaw.length ||
    users.length !== whitelistRounds.length
  ) {
    throw new Error("Input arrays must be non-empty and of equal length.");
  }

  for (const r of whitelistRounds) {
    if (r < 0 || r > 255) throw new Error("whitelistRound must be in uint8 range (0..255).");
  }

  const tx = prepareContractCall({
    contract: presale,
    method: "addToWhitelist",
    params: [users, preAssignedTokensRaw, whitelistRounds],
  });

  const sent = await sendTransaction({ account, transaction: tx });
  await waitForReceipt(sent);
  return sent.transactionHash;
}

export async function addToWhitelistHumanTx(
  account: Account,
  entries: AddWhitelistEntryHuman[]
): Promise<`0x${string}`> {
  if (!entries.length) throw new Error("No entries to add.");

  const decimals = await getTokenDecimals();

  const users: `0x${string}`[] = [];
  const amounts: bigint[] = [];
  const rounds: number[] = [];

  for (const e of entries) {
    const addr = e.address;
    if (!isAddressLike(addr)) {
      throw new Error(`Invalid address`);
    }

    const amtRaw = toUnits((e.preAssignedTokens ?? "").trim(), decimals);
    if (amtRaw < 0n) throw new Error(`Negative amount for ${addr}`);

    const roundIdx = toRoundIndex(e.whitelistRound);

    users.push(addr);
    amounts.push(amtRaw);
    rounds.push(roundIdx);
  }

  return addToWhitelistRawTx(account, users, amounts, rounds);
}

export async function removeFromWhitelistTx(
  account: Account,
  users: `0x${string}`[]
): Promise<`0x${string}`> {
  if (!users.length) throw new Error("Provide at least one address.");
  const tx = prepareContractCall({
    contract: presale,
    method: "removeFromWhitelist",
    params: [users],
  });
  const sent = await sendTransaction({ account, transaction: tx });
  await waitForReceipt(sent);
  return sent.transactionHash;
}

export type WhitelistRowInput = {
  address: string;
  amountHuman: string;
};

export async function addWhitelistRowsSameRoundTx(
  account: Account,
  round: RoundKey | number,
  rows: WhitelistRowInput[],
  opts?: { chunkSize?: number; dedupe?: boolean }
): Promise<`0x${string}`[]> {
  const chunkSize = opts?.chunkSize && opts.chunkSize > 0 ? Math.floor(opts.chunkSize) : Infinity;
  const dedupe = opts?.dedupe ?? true;

  const cleaned: { address: `0x${string}`; preAssignedTokens: string; whitelistRound: RoundKey | number }[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const addr = (r.address ?? "").trim();
    const amt = (r.amountHuman ?? "").trim();

    if (!addr || !amt) continue;
    if (!isAddressLike(addr)) throw new Error(`Invalid address: ${addr}`);
    if (!/^\d+(\.\d+)?$/.test(amt)) throw new Error(`Invalid amount for ${addr}: "${amt}"`);

    if (dedupe) {
      const key = `${addr.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }

    cleaned.push({ address: addr, preAssignedTokens: amt, whitelistRound: round });
  }

  if (!cleaned.length) throw new Error("No valid rows to add.");

  if (cleaned.length <= chunkSize) {
    const tx = await addToWhitelistHumanTx(account, cleaned);
    return [tx];
  }

  const hashes: `0x${string}`[] = [];
  for (let i = 0; i < cleaned.length; i += chunkSize) {
    const slice = cleaned.slice(i, i + chunkSize);
    const tx = await addToWhitelistHumanTx(account, slice);
    hashes.push(tx);
  }
  return hashes;
}
