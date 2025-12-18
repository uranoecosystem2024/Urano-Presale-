// src/utils/referral/logConversion.ts

export type LogConversionInput = Readonly<{
    buyerAddress: string;
    txHash: string;
    chainId: number;
    amount?: string | null; // pass as string to avoid bigint serialization issues
  }>;
  
  export async function logReferralConversion(input: LogConversionInput): Promise<void> {
    const res = await fetch("/api/referral/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyer_address: input.buyerAddress,
        tx_hash: input.txHash,
        chain_id: input.chainId,
        amount: input.amount ?? null,
      }),
    });
  
    // Do not throw if referral attribution is missing; purchase should never fail because of analytics.
    if (!res.ok) return;
  
    // Optionally read response; currently not needed.
    // const data = (await res.json()) as unknown;
  }
  