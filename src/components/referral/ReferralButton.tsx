"use client";

import React, { useCallback, useMemo, useState, type ReactElement } from "react";
import { Button, IconButton, Stack } from "@mui/material";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import { useTheme, type Theme } from "@mui/material/styles";

import { toast } from "react-toastify";

type ReferralButtonProps = Readonly<{
  address: string;
}>;

type GenerateResponse =
  | { ref_code: string; referral_link: string }
  | { error: string; details?: string };

async function postGenerate(address: string): Promise<GenerateResponse> {
  const res = await fetch("/api/referral/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });

  const data = (await res.json()) as GenerateResponse;
  return data;
}

async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export default function ReferralButton({
  address,
}: ReferralButtonProps): ReactElement {
  const theme = useTheme<Theme>();

  const [loading, setLoading] = useState(false);
  const [refLink, setRefLink] = useState<string>("");

  const canCopy = useMemo(() => refLink.trim().length > 0, [refLink]);

  const handleGenerate = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);

      const data = await postGenerate(address);

      if ("error" in data) {
        toast.error(data.details ? `${data.error}: ${data.details}` : data.error, {
          position: "bottom-right",
        });
        return;
      }

      setRefLink(data.referral_link);
      toast.success("Referral link generated.", {
        position: "bottom-right",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate link";
      toast.error(msg, {
        position: "bottom-right",
      });
    } finally {
      setLoading(false);
    }
  }, [address]);

  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      if (!refLink) return;
      await copyToClipboard(refLink);
      toast.success("Copied.", {
        position: "bottom-right",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Copy failed";
      toast.error(msg, {
        position: "bottom-right",
      });
    }
  }, [refLink]);

  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Button
        disabled={loading}
        onClick={handleGenerate}
        sx={{
          background: theme.palette.uranoGradient,
          border: `1px solid ${theme.palette.headerBorder.main}`,
          borderRadius: 2,
          px: 2,
          py: 1,
          textTransform: "none",
          color: theme.palette.background.default,
          "&:hover": {
            background: theme.palette.uranoGradient,
            opacity: 0.92,
          },
        }}
      >
        {loading ? "Generating..." : "Generate Ref Code"}
      </Button>

      <IconButton
        disabled={!canCopy}
        onClick={handleCopy}
        sx={{
          borderRadius: 2,
          border: `1px solid ${theme.palette.headerBorder.main}`,
          backgroundColor: theme.palette.secondary.main,
          "&:hover": {
            background: theme.palette.uranoGradient,
          },
        }}
        aria-label="Copy referral link"
      >
        <ContentCopyOutlinedIcon
          sx={{
            fontSize: 18,
            color: canCopy
              ? theme.palette.text.disabled
              : theme.palette.text.secondary,
          }}
        />
      </IconButton>
    </Stack>
  );
}
