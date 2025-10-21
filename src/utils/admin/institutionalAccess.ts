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

const presale = getContract({
  client,
  chain: arbitrum,
  address: PRESALE_ADDR,
  abi: presaleAbi,
});

type InstitutionalInfoTuple = readonly [
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

export async function readInstitutionalPublic(): Promise<boolean> {
  const info = (await readContract({
    contract: presale,
    method: "getInstitutionalRoundInfo",
  })) as InstitutionalInfoTuple;

  return info[8];
}

let cachedDefaultAdminRole: `0x${string}` | null = null;
let cachedInstitutionalManagerRole: `0x${string}` | null = null;

async function getDefaultAdminRole(): Promise<`0x${string}`> {
  if (cachedDefaultAdminRole) return cachedDefaultAdminRole;
  const role = (await readContract({
    contract: presale,
    method: "DEFAULT_ADMIN_ROLE",
  }));
  cachedDefaultAdminRole = role;
  return role;
}

async function getInstitutionalManagerRole(): Promise<`0x${string}`> {
  if (cachedInstitutionalManagerRole) return cachedInstitutionalManagerRole;
  const role = (await readContract({
    contract: presale,
    method: "INSTITUTIONAL_MANAGER_ROLE",
  }));
  cachedInstitutionalManagerRole = role;
  return role;
}

export async function canEditInstitutionalPublic(
  account?: Account
): Promise<boolean> {
  if (!account) return false;

  const addr = account.address as `0x${string}`;
  const [adminRole, instRole] = await Promise.all([
    getDefaultAdminRole(),
    getInstitutionalManagerRole(),
  ]);

  const [isAdmin, isManager] = await Promise.all([
    readContract({
      contract: presale,
      method: "hasRole",
      params: [adminRole, addr],
    }),
    readContract({
      contract: presale,
      method: "hasRole",
      params: [instRole, addr],
    }),
  ]);

  return isAdmin || isManager;
}

export async function setInstitutionalPublic(
  account: Account,
  next: boolean
): Promise<{ txHash: `0x${string}` }> {
  const tx = prepareContractCall({
    contract: presale,
    method: "setInstitutionalRoundPublic",
    params: [next],
  });

  const sent = await sendTransaction({ account, transaction: tx });
  await waitForReceipt(sent);

  return { txHash: sent.transactionHash };
}
