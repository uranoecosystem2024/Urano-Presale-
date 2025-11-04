"use client";

import { useEffect, useMemo, useState } from "react";
import { Stack, Typography, useTheme } from "@mui/material";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "react-toastify";

import {
  readUserBoughtSummary,
  readActiveRoundPrice,
  fromUnits,
} from "@/utils/profile/bought";

import { formatCompactDecimalString } from "@/utils/compactDecimal";

type BoughtUranoProps = {
  /** Optional: override address; defaults to connected wallet */
  addressOverride?: `0x${string}`;
  /** Optional: title */
  title?: string;
};

export default function BoughtUrano({
  addressOverride,
  title = "Total $URANO Bought",
}: BoughtUranoProps) {
  const theme = useTheme();
  const account = useActiveAccount();

  const address = useMemo(
    () => addressOverride ?? (account?.address as `0x${string}` | undefined),
    [addressOverride, account?.address]
  );

  const [loading, setLoading] = useState(false);
  const [totalTokens, setTotalTokens] = useState<string>("");
  const [totalUsd, setTotalUsd] = useState<string>("");
  const [roundPriceText, setRoundPriceText] = useState<string>("Round price: —");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        // 1) Fetch user totals (includes whitelist USD and a user-avg price)
        let totalTokensHuman = "";
        let totalUsdHuman = "";
        let userPriceHuman: string | null = null;
        let participationCount = 0;

        if (address) {
          const userTotals = await readUserBoughtSummary(address);
          totalTokensHuman = fromUnits(userTotals.totalTokensRaw, userTotals.tokenDecimals);
          totalUsdHuman = fromUnits(userTotals.totalUsdRaw, userTotals.usdcDecimals);
          participationCount = userTotals.participationCount;

          if (userTotals.priceRawForUser !== null) {
            userPriceHuman = fromUnits(userTotals.priceRawForUser, userTotals.usdcDecimals);
          }
        } else {
          totalTokensHuman = "";
          totalUsdHuman = "";
        }

        if (!cancelled) {
          setTotalTokens(totalTokensHuman);
          setTotalUsd(totalUsdHuman);
        }

        // 2) Decide what to show for "Round price"
        //    - If user has NO participations → "no participations yet"
        //    - Else show user's weighted average price
        //    - (We no longer fall back to active round price here, per your request)
        if (!cancelled) {
          if (participationCount === 0) {
            setRoundPriceText("Round price: no participations yet");
          } else if (userPriceHuman) {
            const pretty = Number(userPriceHuman).toLocaleString(undefined, {
              maximumFractionDigits: 6,
            });
            setRoundPriceText(`Round price: $${pretty}`);
          } else {
            // Safety fallback if we somehow have participationCount>0 but no price:
            // show active round price if available, otherwise keep "—"
            const { priceRaw, usdcDecimals } = await readActiveRoundPrice();
            if (priceRaw) {
              const activePriceHuman = fromUnits(priceRaw, usdcDecimals);
              const pretty = Number(activePriceHuman).toLocaleString(undefined, {
                maximumFractionDigits: 6,
              });
              setRoundPriceText(`Round price: $${pretty}`);
            } else {
              setRoundPriceText("Round price: —");
            }
          }
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          toast.error("Failed to load data from the contract.");
          setRoundPriceText("Round price: —");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const compactTokens = useMemo(
    () => formatCompactDecimalString(totalTokens, 2),
    [totalTokens]
  );

  const compactTotalUSD = useMemo(
    () => formatCompactDecimalString(totalUsd, 2),
    [totalUsd]
  );

  return (
    <Stack
      width={{ xs: "100%", lg: "50%" }}
      flexGrow={1}
      sx={{
        backgroundColor: theme.palette.presaleCardBg.main,
        border: `1px solid ${theme.palette.headerBorder.main}`,
        borderRadius: 2,
        p: 3,
        gap: 2,
        opacity: loading ? 0.8 : 1,
      }}
    >
      <Stack direction="row" gap={2}>
        <Typography
          variant="h6"
          sx={{ fontSize: "1rem", fontWeight: 500, color: theme.palette.text.primary }}
        >
          {title}
        </Typography>
      </Stack>

      <Stack width="100%" gap={0}>
        <Typography
          variant="h6"
          sx={{
            fontSize: "1.75rem",
            fontWeight: 500,
            background: theme.palette.uranoGradient,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {address ? `${compactTokens || "0"} $URANO` : "—"}
        </Typography>

        <Stack direction="row" alignItems="center" gap={1.5}>
          <Typography
            variant="h6"
            sx={{ fontSize: "0.875rem", fontWeight: 400, color: theme.palette.text.secondary }}
          >
            {address ? <>≈ {compactTotalUSD} USD</> : "—"}
          </Typography>

          <Typography
            variant="h6"
            sx={{ fontSize: "0.875rem", fontWeight: 400, color: theme.palette.text.secondary }}
          >
            |
          </Typography>

          <Typography
            variant="h6"
            sx={{ fontSize: "0.875rem", fontWeight: 400, color: theme.palette.text.secondary }}
          >
            {roundPriceText}
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
}
