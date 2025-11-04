"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Link, Stack, Tooltip, Typography, useTheme, IconButton } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { IoIosCheckmarkCircle } from "react-icons/io";
import { toast } from "react-toastify";
import { useActiveAccount } from "thirdweb/react";
import { sendTransaction } from "thirdweb";

import {
  readAllClaimSummary,
  prepareClaimAllTxs,
  formatTokenAmount,
  formatTokenAmountFixed,
} from "@/utils/profile/userClaimInfo";
import { formatCompactDecimalString } from "@/utils/compactDecimal";

type UserClaimInfoProps = { addressOverride?: `0x${string}` };

export default function UserClaimInfo({ addressOverride }: UserClaimInfoProps) {
  const theme = useTheme();
  const account = useActiveAccount();
  const address = useMemo(
    () => addressOverride ?? (account?.address as `0x${string}` | undefined),
    [addressOverride, account?.address]
  );

  const [loading, setLoading] = useState(false);
  const [claimingAll, setClaimingAll] = useState(false);

  // human strings
  const [unclaimedAll, setUnclaimedAll] = useState<string>("0");
  const [claimedAll, setClaimedAll] = useState<string>("0");

  // tooltip breakdown (formatted)
  const [wlClaimableStr, setWlClaimableStr] = useState<string>("0");
  const [purchasedClaimableStr, setPurchasedClaimableStr] = useState<string>("0");

  const refresh = async () => {
    if (!address) {
      setUnclaimedAll("0");
      setClaimedAll("0");
      setWlClaimableStr("0");
      setPurchasedClaimableStr("0");
      return;
    }
    setLoading(true);
    try {
      const all = await readAllClaimSummary(address);

      // main numbers
      setUnclaimedAll(formatTokenAmount(all.unclaimedTotalRaw, all.tokenDecimals));
      setClaimedAll(formatTokenAmount(all.claimedTotalRaw, all.tokenDecimals));

      // tooltip breakdown (rounded to 3 decimals)
      setWlClaimableStr(
        formatTokenAmountFixed(all.parts.wl.claimableRaw, all.tokenDecimals, 3)
      );
      setPurchasedClaimableStr(
        formatTokenAmountFixed(all.parts.purchased.claimableRaw, all.tokenDecimals, 3)
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to load claim data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [address]);

  const onClaimAll = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (!account || !address) {
      toast.info("Connect your wallet first.");
      return;
    }
    try {
      setClaimingAll(true);
      const txs = await prepareClaimAllTxs(address);
      if (txs.length === 0) {
        toast.info("Nothing to claim right now.");
        return;
      }
      for (const [i, tx] of txs.entries()) {
        await sendTransaction({ account, transaction: tx });
        toast.success(`Claim ${i + 1}/${txs.length} confirmed.`);
      }
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Claim failed.");
    } finally {
      setClaimingAll(false);
    }
  };

  const unclaimedNum = Number(unclaimedAll.replace(/,/g, ""));
  const compactUnclaimed = useMemo(() => formatCompactDecimalString(unclaimedAll, 2), [unclaimedAll]);
  const compactClaimed   = useMemo(() => formatCompactDecimalString(claimedAll, 2), [claimedAll]);

  return (
    <Stack
      direction={{ xs: "column", lg: "row" }}
      justifyContent="space-between"
      gap={{ xs: 2, lg: 1 }}
      sx={{ opacity: loading ? 0.85 : 1 }}
    >
      {/* LEFT: Unclaimed (All) + Claim All */}
      <Stack width={{ xs: "100%", lg: "48%" }} gap={1.5}>
        <Stack
          width="100%"
          gap={{ xs: 1, lg: 2 }}
          direction={{ xs: "column-reverse", lg: "column" }}
          sx={{
            border: "1px solid transparent",
            background: `
              linear-gradient(rgba(28, 34, 33, 1), rgba(28, 34, 33, 1)) padding-box,
              linear-gradient(260.63deg, rgba(107, 226, 194, 0.82) 0%, #6BE2C2 100%) border-box,
              linear-gradient(0deg, #242424, #242424) border-box
            `,
            borderRadius: 2, px: 2, py: 2, overflow: "hidden", position: "relative",
          }}
        >
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Typography
              variant="h6"
              sx={{ fontSize: "1rem", fontWeight: 400, color: theme.palette.text.primary }}
            >
              Unclaimed (All)
            </Typography>

            {/* Info tooltip with breakdown */}
            <Tooltip
              arrow
              placement="top"
              title={
                <Box sx={{ p: 0.5 }}>
                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, mb: 0.5 }}>
                    Pre-assigned whitelist tokens
                  </Typography>
                  <Typography sx={{ fontSize: "0.85rem", mb: 1 }}>
                    {wlClaimableStr} $URANO
                  </Typography>
                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, mb: 0.5 }}>
                    Purchased tokens
                  </Typography>
                  <Typography sx={{ fontSize: "0.85rem" }}>
                    {purchasedClaimableStr} $URANO
                  </Typography>
                </Box>
              }
              slotProps={{
                tooltip: {
                  sx: {
                    bgcolor: "#2B2B2B",
                    color: "#FFFFFF",
                    border: "1px solid #3A3A3A",
                  },
                },
                arrow: {
                  sx: { color: "#2B2B2B" },
                },
              }}
            >
              <IconButton size="small" sx={{ p: 0.25 }}>
                <InfoOutlinedIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
              </IconButton>
            </Tooltip>
          </Stack>

          <Typography
            variant="h6"
            sx={{
              fontSize: "1.5rem",
              fontWeight: 500,
              background: theme.palette.uranoGradient,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {address ? `${compactUnclaimed} $URANO` : "—"}
          </Typography>
        </Stack>

        <Link
          href="/"
          underline="none"
          target="_blank"
          onClick={onClaimAll}
          sx={{ pointerEvents: claimingAll || unclaimedNum <= 0 ? "none" : "auto" }}
          aria-disabled={claimingAll || unclaimedNum <= 0}
        >
          <Box
            sx={{
              width: "100%",
              background:
                claimingAll || unclaimedNum <= 0
                  ? theme.palette.action.disabledBackground
                  : theme.palette.uranoGradient,
              border: `2px solid ${theme.palette.headerBorder.main}`,
              borderRadius: 2,
              px: { xs: 1.5, lg: 5 },
              py: { xs: 1.5, lg: 1 },
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              "&:hover": { border: `2px solid ${theme.palette.text.primary}`, filter: "brightness(1.2)" },
              transition: "filter 0.15s ease",
            }}
          >
            <Typography
              variant="body1"
              fontWeight={400}
              sx={{
                color:
                  claimingAll || unclaimedNum <= 0
                    ? theme.palette.text.disabled
                    : theme.palette.background.default,
              }}
            >
              {claimingAll
                ? "Claiming…"
                : address
                ? `Claim ${compactUnclaimed} $URANO`
                : "Connect Wallet"}
            </Typography>
          </Box>
        </Link>
      </Stack>

      {/* RIGHT: Claimed (All) */}
      <Stack width={{ xs: "100%", lg: "48%" }} gap={1}>
        <Stack
          width="100%"
          gap={{ xs: 1, lg: 2 }}
          direction={{ xs: "column-reverse", lg: "column" }}
          sx={{
            border: "1px solid #5E9BC3",
            background: "#1C2022",
            borderRadius: 2, px: 2, py: 2,
            overflow: "hidden", position: "relative",
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Typography variant="h6" sx={{ fontSize: "1rem", fontWeight: 400, color: theme.palette.text.primary }}>
              Claimed (All)
            </Typography>
            <IoIosCheckmarkCircle size={24} color={theme.palette.text.primary} />
          </Stack>

          <Typography
            variant="h6"
            sx={{
              fontSize: "1.5rem",
              fontWeight: 500,
              background: theme.palette.uranoGradient,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {address ? `${compactClaimed} $URANO` : "—"}
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
}
