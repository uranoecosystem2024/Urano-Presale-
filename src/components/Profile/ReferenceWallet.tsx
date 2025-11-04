"use client";

import { useMemo, useState } from "react";
import { Box, Stack, Typography, Link, useTheme } from "@mui/material";
import Image from "next/image";
import { Copy, Slash } from "iconsax-reactjs";
import arbLogo from "@/assets/images/WhiteText_horizontal_RGB.webp";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { toast } from "react-toastify";

type ReferenceWalletProps = {
  /** Optional: override the displayed address (otherwise uses the connected wallet) */
  addressOverride?: `0x${string}`;
};

export default function ReferenceWallet({ addressOverride }: ReferenceWalletProps) {
  const theme = useTheme();
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  const { disconnect } = useDisconnect()
  const [copyBusy, setCopyBusy] = useState(false);
  const [discBusy, setDiscBusy] = useState(false);

  const address = useMemo(
    () => addressOverride ?? ("0xbE0816F9379737e3b01e162C2481F62e91BdD247" as `0x${string}` | undefined),
    [addressOverride, account?.address]
  );

  const handleCopy = async () => {
    if (!address) return;
    try {
      setCopyBusy(true);
      await navigator.clipboard.writeText(address);
      toast?.success?.("Address copied to clipboard");
    } catch {
      toast?.error?.("Failed to copy address");
    } finally {
      setCopyBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!account || !wallet) return;
    try {
      setDiscBusy(true);
      disconnect(wallet);
      toast?.info?.("Wallet disconnected");
    } catch {
      toast?.error?.("Failed to disconnect");
    } finally {
      setDiscBusy(false);
    }
  };

  return (
    <Stack
      width="100%"
      sx={{
        backgroundColor: theme.palette.presaleCardBg.main,
        border: `1px solid ${theme.palette.headerBorder.main}`,
        borderRadius: 2,
        p: 3,
        gap: 2,
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent={{ xs: "space-between", lg: "flex-start" }}
        gap={2}
      >
        <Typography
          variant="h6"
          sx={{ fontSize: "1rem", fontWeight: 500, color: theme.palette.text.primary }}
        >
          Your Reference Wallet
        </Typography>

        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{
            background: theme.palette.transparentPaper.main,
            border: `1px solid ${theme.palette.headerBorder.main}`,
            borderRadius: 2,
            px: 1,
            py: 0.75,
          }}
        >
          <Image
            src={arbLogo}
            alt="arbitrum-logo"
            style={{ width: "6rem", height: "1.55rem" }}
          />
        </Stack>
      </Stack>

      {/* Address row + actions */}
      <Stack
        width="100%"
        direction={{ xs: "column", lg: "row" }}
        alignItems="center"
        justifyContent="space-between"
        gap={{ xs: 1, lg: 0 }}
      >
        {/* Address box */}
        <Stack
          width={{ xs: "100%", lg: "65%" }}
          direction="row"
          alignItems="center"
          gap={1}
          sx={{
            background: theme.palette.transparentPaper.main,
            border: `1px solid ${theme.palette.headerBorder.main}`,
            borderRadius: 2,
            px: 1.5,
            py: 1,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: "1.5rem",
              height: "1.5rem",
              background: theme.palette.uranoGradient,
              border: `1px solid ${theme.palette.headerBorder.main}`,
              borderRadius: "50%",
              p: 1.5,
            }}
          />
          <Typography
            variant="h6"
            sx={{ fontSize: "0.875rem", fontWeight: 300, color: theme.palette.text.primary }}
          >
            {address}
          </Typography>
        </Stack>

        {/* Actions */}
        <Stack
          width={{ xs: "100%", lg: "35%" }}
          direction="row"
          alignItems="center"
          justifyContent="center"
          gap={{ xs: 0.5, lg: 1 }}
        >
          {/* Copy */}
          <Link
            href="/"
            underline="none"
            sx={{ width: "50%" }}
            onClick={(e) => {
              e.preventDefault();
              if (!address) return;
              void handleCopy();
            }}
          >
            <Box
              sx={{
                width: "100%",
                background: theme.palette.secondary.main,
                border: `1px solid ${theme.palette.headerBorder.main}`,
                borderRadius: 2,
                px: { xs: 1.5, lg: 2 },
                py: { xs: 1.5, lg: 1 },
                ml: { xs: 0, lg: 1 },
                gap: { xs: 0.5, lg: 1 },
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                cursor: address ? "pointer" : "not-allowed",
                opacity: address && !copyBusy ? 1 : 0.7,
                "&:hover": address
                  ? {
                      background: theme.palette.uranoGradient,
                      "& .connectWalletLink": { color: theme.palette.info.main },
                      "& .iconButton": { filter: { xs: "none", lg: "brightness(0)" } },
                    }
                  : undefined,
              }}
            >
              <Typography
                variant="body1"
                fontWeight={400}
                className="connectWalletLink"
                sx={{ color: theme.palette.text.disabled }}
              >
                {copyBusy ? "Copying…" : "Copy"}
              </Typography>
              <Copy
                variant="Bold"
                color={theme.palette.text.disabled}
                size={18}
                className="iconButton"
              />
            </Box>
          </Link>

          {/* Disconnect */}
          <Link
            href="/"
            underline="none"
            sx={{ width: "50%" }}
            onClick={(e) => {
              e.preventDefault();
              if (!account) return;
              void handleDisconnect();
            }}
          >
            <Box
              sx={{
                width: "100%",
                background: theme.palette.secondary.main,
                border: `1px solid ${theme.palette.headerBorder.main}`,
                borderRadius: 2,
                px: { xs: 1.5, lg: 2 },
                py: { xs: 1.5, lg: 1 },
                ml: { xs: 0, lg: 1 },
                gap: { xs: 0.5, lg: 1 },
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                cursor: account ? "pointer" : "not-allowed",
                opacity: account && !discBusy ? 1 : 0.7,
                "&:hover": account
                  ? {
                      background: theme.palette.uranoGradient,
                      "& .connectWalletLink": { color: theme.palette.info.main },
                      "& .buttonIcon2": { filter: { xs: "none", lg: "brightness(0)" } },
                    }
                  : undefined,
              }}
            >
              <Typography
                variant="body1"
                fontWeight={400}
                className="connectWalletLink"
                sx={{ color: theme.palette.text.disabled }}
              >
                {discBusy ? "Disconnecting…" : "Disconnect"}
              </Typography>
              <Slash
                variant="Bold"
                color={theme.palette.text.disabled}
                size={18}
                className="buttonIcon2"
              />
            </Box>
          </Link>
        </Stack>
      </Stack>
    </Stack>
  );
}
