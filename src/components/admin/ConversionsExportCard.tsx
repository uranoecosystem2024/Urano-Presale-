"use client";

import React, { useMemo, useState, type ReactElement } from "react";
import { Button, Stack, Typography, useTheme } from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import { toast } from "react-toastify";

type ConversionsExportCardProps = Readonly<{
  title?: string;
  subtitle?: string;
  disabled?: boolean;
  defaultLimit?: number; // optional, passed to API
}>;

function buildUrl(format: "csv" | "xlsx", limit?: number): string {
  const url = new URL("/api/conversions/export", window.location.origin);
  url.searchParams.set("format", format);
  if (typeof limit === "number" && Number.isFinite(limit)) {
    url.searchParams.set("limit", String(limit));
  }
  return url.toString();
}

export default function ConversionsExportCard({
  title = "Export Conversions",
  subtitle = "Download referral conversions as CSV or XLSX.",
  disabled = false,
  defaultLimit = 20000,
}: ConversionsExportCardProps): ReactElement {
  const theme = useTheme();

  const [busy, setBusy] = useState<null | "csv" | "xlsx">(null);

  const actionBtnSx = useMemo(
    () =>
      ({
        textTransform: "none",
        borderRadius: 2,
        px: 3,
        py: 1.75,
        backgroundColor: theme.palette.secondary.main,
        border: `1px solid ${theme.palette.headerBorder.main}`,
        color: theme.palette.text.primary,
        "&:hover": {
          borderColor: theme.palette.text.primary,
          background: theme.palette.transparentPaper.main,
        },
      }) as const,
    [theme]
  );

  const handleDownload = async (format: "csv" | "xlsx"): Promise<void> => {
    if (disabled || busy) return;

    try {
      setBusy(format);

      const url = buildUrl(format, defaultLimit);

      // This triggers a normal browser file download with the server’s Content-Disposition filename.
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      a.download = ""; // let server set filename
      document.body.appendChild(a);
      a.click();
      a.remove();

      toast.success(`Export started (${format.toUpperCase()}).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Export failed";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Stack gap={2} width="100%">
      <Stack direction="row" alignItems="start" justifyContent="space-between" gap={2}>
        <Stack gap={0.5}>
          <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            {subtitle}
          </Typography>
        </Stack>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} gap={2}>
        <Button
          fullWidth
          disabled={disabled || busy !== null}
          startIcon={<DownloadRoundedIcon />}
          sx={{
            ...actionBtnSx,
            "&:hover": { background: theme.palette.uranoGreen1.main },
          }}
          onClick={() => void handleDownload("csv")}
        >
          {busy === "csv" ? "Preparing CSV..." : "Export CSV"}
        </Button>

        <Button
          fullWidth
          disabled={disabled || busy !== null}
          startIcon={<DownloadRoundedIcon />}
          sx={{
            ...actionBtnSx,
            "&:hover": { background: theme.palette.uranoGradient, color: theme.palette.info.main },
          }}
          onClick={() => void handleDownload("xlsx")}
        >
          {busy === "xlsx" ? "Preparing XLSX..." : "Export XLSX"}
        </Button>
      </Stack>

      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
        Tip: CSV opens in Excel/Sheets. XLSX preserves columns and types better.
      </Typography>
    </Stack>
  );
}
