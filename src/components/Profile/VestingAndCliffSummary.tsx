"use client";

import { useEffect, useMemo, useState } from "react";
import { Stack, Typography, useTheme } from "@mui/material";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "react-toastify";

import {
  readUserVestingSummaries,
  type PerRoundVesting,
} from "@/utils/profile/roundVesting";

export default function VestingAndCliffSummary() {
  const theme = useTheme();
  const account = useActiveAccount();

  const address = useMemo(
    () => account?.address.toString() as `0x${string}` | undefined,
    [account?.address]
  );

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PerRoundVesting[]>([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        if (!address) {
          if (!cancelled) setRows([]);
          return;
        }
        const res = await readUserVestingSummaries(address);
        if (!cancelled) setRows(res);
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error("Failed to load vesting summary.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Helpers to render the four cards’ contents
  const noData = rows.length === 0;

  const renderTge = () => {
    if (noData) return "no participations yet";
    return (
      <Stack display="grid" gridTemplateColumns="1fr 1fr" gap={0.75}>
        {rows.map((r) => (
          <Stack key={r.round} gap={0.25}>
            <Typography
              variant="body2"
              sx={{ color: theme.palette.text.secondary }}
            >
              {r.label}
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontSize: "1.25rem", fontWeight: 500, color: theme.palette.text.primary }}
            >
              {(r.tgeUnlockBps / 100).toFixed(0)}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    );
  };

  const renderDuration = () => {
    if (noData) return "no participations yet";
    return (
      <Stack display="grid" gridTemplateColumns="1fr 1fr" gap={0.75}>
        {rows.map((r) => (
          <Stack key={r.round} gap={0.25}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {r.label}
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontSize: "1.25rem", fontWeight: 500, color: theme.palette.text.primary }}
            >
              {r.durationMonths} months
            </Typography>
          </Stack>
        ))}
      </Stack>
    );
  };

  const renderCliff = () => {
    if (noData) return "no participations yet";
    return (
      <Stack display="grid" gridTemplateColumns="1fr 1fr" gap={0.75}>
        {rows.map((r) => (
          <Stack key={r.round} gap={0.25}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {r.label}
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontSize: "1.25rem", fontWeight: 500, color: theme.palette.text.primary }}
            >
              {r.cliffMonths} months
            </Typography>
          </Stack>
        ))}
      </Stack>
    );
  };

  const renderFrequency = () => {
    if (noData) return "no participations yet";
    return (
      <Stack display="grid" gridTemplateColumns="1fr 1fr" gap={0.75}>
        {rows.map((r) => (
          <Stack key={r.round} gap={0.25}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {r.label}
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontSize: "1.25rem", fontWeight: 500, color: theme.palette.text.primary }}
            >
              {r.releaseFrequency}
            </Typography>
          </Stack>
        ))}
      </Stack>
    );
  };

  const cardSx = {
    background: theme.palette.transparentPaper.main,
    border: `1px solid ${theme.palette.headerBorder.main}`,
    borderRadius: 2,
    px: 1.5,
    py: 1.5,
    width: { xs: "100%", lg: "50%" },
  } as const;

  return (
    <Stack
      width="100%"
      sx={{
        backgroundColor: theme.palette.presaleCardBg.main,
        border: `1px solid ${theme.palette.headerBorder.main}`,
        borderRadius: 2,
        p: 3,
        gap: 2,
        opacity: loading ? 0.8 : 1,
      }}
    >
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography
          variant="h6"
          sx={{ fontSize: "1rem", fontWeight: 500, color: theme.palette.text.primary }}
        >
          Vesting + Cliff Summary <span style={{ fontSize: "0.875rem", fontWeight: 400, color: theme.palette.text.secondary }}>(Only data of the rounds where you participated)</span>
        </Typography>
      </Stack>

      {/* Row 1: TGE + Duration */}
      <Stack
        width="100%"
        direction={{ xs: "column", lg: "row" }}
        alignItems="stretch"
        justifyContent="space-between"
        gap={{ xs: 1, lg: 2 }}
      >
        <Stack sx={cardSx} gap={1}>
          <Typography
            variant="h6"
            sx={{ fontSize: "0.955rem", fontWeight: 400, mb: 2 }}
          >
            TGE Release
          </Typography>
          <Typography
            component="div"
            sx={{ fontSize: "1rem", fontWeight: 400, color: theme.palette.text.primary }}
          >
            {renderTge()}
          </Typography>
        </Stack>

        <Stack sx={cardSx} gap={1}>
          <Typography
            variant="h6"
            sx={{ fontSize: "0.955rem", fontWeight: 400, mb: 2 }}
          >
            Total Duration
          </Typography>
          <Typography
            component="div"
            sx={{ fontSize: "1rem", fontWeight: 400, color: theme.palette.text.primary }}
          >
            {renderDuration()}
          </Typography>
        </Stack>
      </Stack>

      {/* Row 2: Cliff + Frequency */}
      <Stack
        width="100%"
        direction={{ xs: "column", lg: "row" }}
        alignItems="stretch"
        justifyContent="space-between"
        gap={{ xs: 1, lg: 2 }}
      >
        <Stack sx={cardSx} gap={1}>
          <Typography
            variant="h6"
            sx={{ fontSize: "0.955rem", fontWeight: 400, mb: 2 }}
          >
            Cliff Period
          </Typography>
          <Typography
            component="div"
            sx={{ fontSize: "1rem", fontWeight: 400, color: theme.palette.text.primary }}
          >
            {renderCliff()}
          </Typography>
        </Stack>

        <Stack sx={cardSx} gap={1}>
          <Typography
            variant="h6"
            sx={{ fontSize: "0.955rem", fontWeight: 400, mb: 2 }}
          >
            Release Frequency
          </Typography>
          <Typography
            component="div"
            sx={{ fontSize: "1rem", fontWeight: 400, color: theme.palette.text.primary }}
          >
            {renderFrequency()}
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
}
