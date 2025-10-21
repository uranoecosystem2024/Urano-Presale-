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

const PRESALE_ADDR = process.env
  .NEXT_PUBLIC_PRESALE_SMART_CONTRACT_ADDRESS as `0x${string}`;

if (!PRESALE_ADDR) {
  throw new Error(
    "NEXT_PUBLIC_PRESALE_SMART_CONTRACT_ADDRESS is not set. Withdraw utils will fail without it."
  );
}

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
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export async function getTokenAddress(): Promise<`0x${string}`> {
  return (await readContract({ contract: presale, method: "token" })) as `0x${string}`;
}

export async function getTreasuryAddress(): Promise<`0x${string}`> {
  return (await readContract({ contract: presale, method: "treasury" })) as `0x${string}`;
}

export async function getTokenDecimals(): Promise<number> {
  try {
    const tokenAddr = await getTokenAddress();
    const erc20 = getContract({
      client,
      chain: arbitrum,
      address: tokenAddr,
      abi: ERC20_ABI,
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

export async function readContractTokenBalanceRaw(): Promise<bigint> {
  const tokenAddr = await getTokenAddress();
  const erc20 = getContract({
    client,
    chain: arbitrum,
    address: tokenAddr,
    abi: ERC20_ABI,
  });
  return (await readContract({
    contract: erc20,
    method: "balanceOf",
    params: [PRESALE_ADDR],
  }));
}

export async function readContractTokenBalanceHuman(): Promise<string> {
  const [decimals, raw] = await Promise.all([getTokenDecimals(), readContractTokenBalanceRaw()]);
  return fromUnits(raw, decimals);
}

export function toUnits(amount: string, decimals: number): bigint {
  const cleaned = (amount ?? "").trim();
  if (!cleaned) return 0n;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error("Invalid number format");
  }

  const [intPart = "0", fracRaw = ""] = cleaned.split(".");
  const frac = fracRaw.slice(0, decimals).padEnd(decimals, "0");

  const base = 10n ** BigInt(decimals);
  const intVal = BigInt(intPart || "0") * base;
  const fracVal = frac ? BigInt(frac) : 0n;

  return intVal + fracVal;
}

export function fromUnits(amount: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const intPart = amount / base;
  const frac = amount % base;
  if (frac === 0n) return intPart.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${intPart}.${fracStr}`;
}

export async function withdrawUnsoldTokensRawTx(
  account: Account,
  amountRaw: bigint
): Promise<`0x${string}`> {
  if (amountRaw <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }

  const tx = prepareContractCall({
    contract: presale,
    method: "withdrawUnsoldTokens",
    params: [amountRaw],
  });

  const sent = await sendTransaction({ account, transaction: tx });
  await waitForReceipt(sent);
  return sent.transactionHash;
}

export async function withdrawUnsoldTokensHumanTx(
  account: Account,
  amountHuman: string
): Promise<`0x${string}`> {
  const decimals = await getTokenDecimals();
  const raw = toUnits(amountHuman, decimals);
  return withdrawUnsoldTokensRawTx(account, raw);
}
