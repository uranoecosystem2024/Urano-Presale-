"use client";

import { useEffect, useMemo, useState } from "react";
import { Stack, IconButton } from "@mui/material";
import TokenSelectionTextField from "@/components/MainSection/TokenSelectionTextField";
import usdc from "@/assets/images/usdc1.webp";
import urano from "@/assets/images/urano1.webp";
import { AiOutlineSwap } from "react-icons/ai";
import { useTheme } from "@mui/material/styles";

import { useActiveAccount, useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import { getBalance } from "thirdweb/extensions/erc20";
import { arbitrum } from "thirdweb/chains";
import { client } from "@/lib/thirdwebClient";
import { parseUnits } from "viem";
import { usePresaleCardData } from "@/hooks/usePresaleCard";

const MIN_USDC = 100;
const AMOUNT_STORAGE_KEY = "urano:purchaseAmount:v1";
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA as
  | `0x${string}`
  | undefined;
const ZERO: `0x${string}` = "0x0000000000000000000000000000000000000000";

function roundTo(n: number, dp: number) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

const TokensSelection = () => {
  const theme = useTheme();

  const { loading, rawTokenPrice, usdcDecimals } = usePresaleCardData({
    priceFractionDigits: 5,
  });
  const dec = usdcDecimals ?? 6;
  const price = rawTokenPrice ? Number(rawTokenPrice) : 0;

  const account = useActiveAccount();
  const address = account?.address as `0x${string}` | undefined;

  const usdcContract = useMemo(() => {
    if (!USDC_ADDRESS) return undefined;
    return getContract({ client, address: USDC_ADDRESS, chain: arbitrum });
  }, []);

  const fallbackContract = useMemo(
    () => getContract({ client, address: ZERO, chain: arbitrum }),
    []
  );

  const readEnabled = Boolean(address && usdcContract);
  const { data: usdcBal } = useReadContract(getBalance, {
    contract: readEnabled ? usdcContract! : fallbackContract,
    address: readEnabled ? address! : ZERO,
    queryOptions: {
      enabled: readEnabled,
      refetchInterval: 15_000,
      retry: 3,
    },
  });

  const [usdcValue, setUsdcValue] = useState<number>(0);
  const [uranoValue, setUranoValue] = useState<number>(0);
  const [lastEdited, setLastEdited] = useState<"usdc" | "urano" | null>("usdc");

  const usdcToUrano = (u: number) => {
    if (!price || loading) return 0;
    const tokens = (u * Math.pow(10, dec)) / price;
    return roundTo(tokens, 2);
  };
  const uranoToUsdc = (t: number) => {
    if (!price || loading) return 0;
    const u = (t * price) / Math.pow(10, dec);
    return roundTo(u, 2);
  };

  const handleUsdcChange = (v: number) => {
    const safe = Number.isFinite(v) && v >= 0 ? v : 0;
    setUsdcValue(safe);
    setUranoValue(usdcToUrano(safe));
    setLastEdited("usdc");
  };

  const handleUranoChange = (v: number) => {
    const safe = Number.isFinite(v) && v >= 0 ? v : 0;
    setUranoValue(safe);
    setUsdcValue(uranoToUsdc(safe));
    setLastEdited("urano");
  };

  useEffect(() => {
    if (!price || loading) {
      setUranoValue(0);
      return;
    }
    if (lastEdited === "usdc") {
      setUranoValue(usdcToUrano(usdcValue));
    } else if (lastEdited === "urano") {
      setUsdcValue(uranoToUsdc(uranoValue));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price, dec, loading]);

  useEffect(() => {
    try {
      localStorage.setItem(AMOUNT_STORAGE_KEY, String(usdcValue || 0));
      window.dispatchEvent(new Event("urano:amount"));
    } catch {
      /* noop */
    }
  }, [usdcValue]);

  const insufficient = useMemo(() => {
    if (!usdcBal || !Number.isFinite(usdcValue)) return false;
    const d = usdcBal.decimals ?? 6;
    try {
      const want = parseUnits((usdcValue || 0).toString(), d);
      return want > usdcBal.value;
    } catch {
      return true;
    }
  }, [usdcValue, usdcBal]);

  const belowMin = useMemo(() => usdcValue > 0 && usdcValue < MIN_USDC, [usdcValue]);

  const usdcHelper: string = useMemo(() => {
    if (insufficient) return "Insufficient balance";
    if (belowMin) return `Min amount is ${MIN_USDC} USDC`;

    const sym = usdcBal?.symbol ?? "USDC";
    if (!usdcBal) return `Balance: -- ${sym}`;
    const amount = Number(usdcBal.displayValue);
    const balStr = Number.isFinite(amount)
      ? `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${sym}`
      : `-- ${sym}`;
    return `Balance: ${balStr}`;
  }, [usdcBal, insufficient, belowMin]);

  return (
    <Stack
      width={"100%"}
      direction={{ xs: "column", lg: "row" }}
      justifyContent={"space-between"}
      alignItems={"center"}
      gap={{ xs: 2, lg: 1 }}
    >
      <Stack width={{ xs: "100%", lg: "45%" }}>
        <TokenSelectionTextField
          value={usdcValue}
          label="Pay with stablecoin"
          tokenIconSrc={usdc.src}
          tokenSymbol="USDC"
          onChange={handleUsdcChange}
          error={insufficient || belowMin}
          helperText={usdcHelper}
        />
      </Stack>

      <IconButton
        sx={{
          backgroundColor: theme.palette.background.default,
          border: `1px solid ${theme.palette.headerBorder.main}`,
          borderRadius: "50%",
          padding: "0.6rem",
          marginTop: "-1rem",
          backdropFilter: "blur(8.2px)",
          transform: { xs: "rotate(90deg)", lg: "rotate(0deg)" },
          "&:hover": { border: `1px solid ${theme.palette.text.secondary}` },
        }}
        onClick={() => {
          if (!price || loading) return;
          if (lastEdited === "usdc") {
            setLastEdited("urano");
            setUsdcValue(uranoToUsdc(uranoValue));
          } else {
            setLastEdited("usdc");
            setUranoValue(usdcToUrano(usdcValue));
          }
        }}
      >
        <AiOutlineSwap size={20} color="#14EFC0" />
      </IconButton>

      <Stack width={{ xs: "100%", lg: "45%" }}>
        <TokenSelectionTextField
          value={uranoValue}
          label="Receive URANO"
          tokenIconSrc={urano.src}
          tokenSymbol="URANO"
          helperText={"Balance: -- URANO"}
          onChange={handleUranoChange}
        />
      </Stack>
    </Stack>
  );
};

export default TokensSelection;
