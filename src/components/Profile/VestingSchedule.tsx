// components/VestingSchedule.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Stack, Typography, useTheme } from "@mui/material";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "react-toastify";

import {
  readAllParticipatedMonthlyVesting,
  formatTokenAmount,
  type MonthlyVestingItem,
} from "@/utils/profile/vestingUnlocks";

type VestingScheduleProps = {
  /** Optional: override address; defaults to connected wallet */
  addressOverride?: `0x${string}`;
};

type MonthGroup = {
  key: string;           // e.g. "2026-0"
  label: string;         // e.g. "Jan 2026"
  date: Date;            // first day of month (UTC)
  items: MonthlyVestingItem[]; // unlocks in that month (not summed)
};

export default function VestingSchedule({ addressOverride }: VestingScheduleProps) {
  const theme = useTheme();
  const account = useActiveAccount();

  const address = useMemo(
    () => addressOverride ?? (account?.address as `0x${string}` | undefined),
    [addressOverride, account?.address]
  );

  const [loading, setLoading] = useState(false);
  const [decimals, setDecimals] = useState(18);
  const [items, setItems] = useState<MonthlyVestingItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      if (!address) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        const res = await readAllParticipatedMonthlyVesting(address);
        if (cancelled) return;
        setDecimals(res.tokenDecimals);
        setItems(res.items);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load vesting schedule.";
        // eslint-disable-next-line no-console
        console.error(err);
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Group items by month (UTC), earliest month first, keep all individual unlocks per month
  const groups: MonthGroup[] = useMemo(() => {
    if (!items.length) return [];

    const map = new Map<string, MonthGroup>();
    for (const it of items) {
      const y = it.firstUnlockDate.getUTCFullYear();
      const m = it.firstUnlockDate.getUTCMonth();
      const key = `${y}-${m}`;
      const monthStart = new Date(Date.UTC(y, m, 1));
      const label = monthStart.toLocaleString(undefined, { month: "short", year: "numeric" });

      const existing = map.get(key);
      if (existing) {
        existing.items.push(it);
      } else {
        map.set(key, { key, label, date: monthStart, items: [it] });
      }
    }

    // Sort months, then sort each month's items by date (and tie-break by amount)
    const arr = Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const g of arr) {
      g.items.sort((a, b) => {
        const t = a.firstUnlockDate.getTime() - b.firstUnlockDate.getTime();
        if (t !== 0) return t;
        // deterministic tie-breaker
        if (a.round !== b.round) return a.round.localeCompare(b.round);
        return a.amountRaw === b.amountRaw ? 0 : a.amountRaw < b.amountRaw ? -1 : 1;
      });
    }
    return arr;
  }, [items]);

  return (
    <Stack width="100%" alignItems="stretch" gap={2} sx={{ opacity: loading ? 0.85 : 1 }}>
      {!address ? (
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          Connect your wallet to see your vesting schedule.
        </Typography>
      ) : groups.length === 0 ? (
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          No upcoming unlocks for your participations yet.
        </Typography>
      ) : (
        groups.map((group) => (
          <Stack key={group.key} width="100%" gap={1.25}>
            {/* Month/Year heading */}
            <Typography
              variant="h6"
              sx={{ fontSize: "0.95rem", fontWeight: 600, color: theme.palette.text.primary }}
              title={group.date.toLocaleDateString(undefined, {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            >
              {group.label}
            </Typography>

            {/* Cards for each unlock in that month */}
            <Stack width="100%" gap={1}>
              {group.items.map((it) => (
                <Stack
                  key={`${it.round}-${it.firstUnlockDate.getTime()}-${it.amountRaw.toString()}`}
                  width="100%"
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                  sx={{
                    background: theme.palette.transparentPaper.main,
                    border: `1px solid ${theme.palette.headerBorder.main}`,
                    borderRadius: 2,
                    px: 1.5,
                    py: 1.25,
                    overflow: "hidden",
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontSize: "0.9rem",
                      fontWeight: 400,
                      color: theme.palette.text.secondary,
                    }}
                  >
                    {it.roundLabel}
                  </Typography>

                  <Typography
                    variant="h6"
                    sx={{ fontSize: "0.9rem", fontWeight: 600, color: theme.palette.text.primary }}
                  >
                    {`${formatTokenAmount(it.amountRaw, decimals)} $URANO`}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        ))
      )}
    </Stack>
  );
}
