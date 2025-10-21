import { getContract, readContract } from "thirdweb";
import type { Account } from "thirdweb/wallets";
import { client } from "@/lib/thirdwebClient";
import { arbitrum } from "thirdweb/chains";
import { presaleAbi } from "@/lib/abi/presale";

const PRESALE_ADDR = process.env
  .NEXT_PUBLIC_PRESALE_SMART_CONTRACT_ADDRESS as `0x${string}`;

if (!PRESALE_ADDR) {
  throw new Error("NEXT_PUBLIC_PRESALE_SMART_CONTRACT_ADDRESS is not set");
}

const presale = getContract({
  client,
  chain: arbitrum,
  address: PRESALE_ADDR,
  abi: presaleAbi,
});

export async function getDefaultAdminRole(): Promise<`0x${string}`> {
  const role = await readContract({
    contract: presale,
    method: "DEFAULT_ADMIN_ROLE",
  });
  return role;
}

export async function isAddressAdmin(
  address: `0x${string}`
): Promise<boolean> {
  const adminRole = await getDefaultAdminRole();
  const has = await readContract({
    contract: presale,
    method: "hasRole",
    params: [adminRole, address],
  });
  return Boolean(has);
}

export async function hasAdminRole(account?: Account): Promise<boolean> {
  if (!account) return false;
  return isAddressAdmin(account.address as `0x${string}`);
}

export async function assertAdmin(account?: Account): Promise<void> {
  if (!(await hasAdminRole(account))) {
    throw new Error("Current wallet does not have admin permissions.");
  }
}
