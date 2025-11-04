"use client";

import { useEffect, useMemo, useState } from "react";
import { Stack, Typography, useTheme } from "@mui/material";
import { useActiveAccount } from "thirdweb/react";

import {
  readUserParticipationRounds,
  ROUND_LABEL,
  type UserRoundParticipation,
  type UserParticipationSummary,
} from "@/utils/profile/participation";
import { fromUnits } from "@/utils/profile/bought";

type ParticipationRoundProps = {
  title?: string;
};

export default function ParticipationRound({
  title = "Participation Rounds",
}: ParticipationRoundProps) {
  const theme = useTheme();
  const account = useActiveAccount();

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<UserParticipationSummary | null>(null);

  const address = "0xbE0816F9379737e3b01e162C2481F62e91BdD247" as `0x${string}` | undefined;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!address) {
        setSummary(null);
        return;
      }
      setLoading(true);
      try {
        const data = await readUserParticipationRounds(address);
        if (!cancelled) setSummary(data);
      } catch (e) {
        console.error("Failed to read user participation rounds:", e);
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const rows = useMemo(
    () =>
      summary
        ? summary.rounds.map((r: UserRoundParticipation) => ({
            key: r.key,
            label: ROUND_LABEL[r.key],
            priceHuman: fromUnits(r.tokenPriceRaw, summary.usdcDecimals),
          }))
        : [],
    [summary]
  );

  const hasData = rows.length > 0;

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
          sx={{
            fontSize: "1rem",
            fontWeight: 500,
            color: theme.palette.text.primary,
          }}
        >
          {title}
        </Typography>
      </Stack>

      {!address ? (
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          Connect a wallet to see your participation rounds.
        </Typography>
      ) : !hasData && !loading ? (
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          No purchases found yet.
        </Typography>
      ) : (
        <Stack gap={1.25}>
          {rows.map((row) => (
            <Stack
              key={row.key}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                background: theme.palette.transparentPaper.main,
                border: `1px solid ${theme.palette.headerBorder.main}`,
                borderRadius: 2,
                px: 1.5,
                py: 1,
                overflow: "hidden",
              }}
            >
              <Typography
                variant="body1"
                sx={{ color: theme.palette.text.primary, fontWeight: 400 }}
              >
                {row.label} round
              </Typography>

              <Typography
                variant="body1"
                sx={{ color: theme.palette.uranoGreen1.main, fontWeight: 400 }}
              >
                $
                {Number(row.priceHuman).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}{" "}
                per token
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
