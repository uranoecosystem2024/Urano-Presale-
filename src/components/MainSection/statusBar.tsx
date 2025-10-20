"use client";

import { Stack, Typography, Box } from "@mui/material";
import { useMemo } from "react";
import { usePresaleProgress } from "@/hooks/usePresaleProgress";
import { useTheme } from "@mui/material/styles";

const CELL_W = 20;
const CELL_H = 18;
const CELL_GAP_X = 4;

function buildTileDataUrl({
  fill = "transparent",
  fillOpacity = "0",
  stroke = "white",
  strokeOpacity = "0.31",
}: {
  fill?: string;
  fillOpacity?: string;
  stroke?: string;
  strokeOpacity?: string;
}) {
  const svg = `
<svg width="${CELL_W}" height="${CELL_H}" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M1.35596 1.83391C1.44235 0.797326 2.30888 0 3.34905 0H17.7743C18.9663 0 19.8937 1.03613 19.762 2.22086L18.2065 16.2209C18.0939 17.2337 17.2378 18 16.2187 18H2.18239C1.01231 18 0.0921267 16.9999 0.189297 15.8339L1.35596 1.83391Z"
        fill="${fill}" fill-opacity="${fillOpacity}"/>
  <path d="M3.34863 0.5H17.7744C18.6684 0.50009 19.3634 1.27752 19.2646 2.16602L17.71 16.166C17.6254 16.9255 16.9829 17.5 16.2188 17.5H2.18262C1.30506 17.5 0.614623 16.7495 0.6875 15.875L1.85449 1.875C1.91948 1.09792 2.56884 0.500216 3.34863 0.5Z"
        stroke="${stroke}" stroke-opacity="${strokeOpacity}"/>
</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/** Format a raw token amount (bigint) with given decimals into a string with
 * thousands separators and exactly 2 decimal digits, rounded half up. */
function formatTokenAmount2dp(amountRaw: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);      // e.g., 1e18
  // Scale to 2 decimals and round half up: (raw * 100 + base/2) / base
  const scaled = (amountRaw * 100n + base / 2n) / base; // integer "cents"
  const intPart = scaled / 100n;
  const fracTwo = scaled % 100n;

  const intStr = intPart.toLocaleString();                // BigInt has toLocaleString
  const fracStr = fracTwo.toString().padStart(2, "0");    // always 2 digits
  return `${intStr}.${fracStr}`;
}

export default function StatusBar() {
  const { loading, error, data } = usePresaleProgress();
  const theme = useTheme();

  const TOKEN_DECIMALS = 18;

  const pct: number = useMemo(() => {
    const raw = !loading && data ? Number(data.purchasedPercent) : 0;
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(100, raw));
  }, [loading, data]);

  const fmtPct = useMemo(() => `${pct.toFixed(2)}%`, [pct]);

  const fmtSold = useMemo(() => {
    if (!data) return "—";
    return formatTokenAmount2dp(data.totalTokensSold, TOKEN_DECIMALS);
  }, [data]);

  const fmtMax = useMemo(() => {
    if (!data) return "—";
    return formatTokenAmount2dp(data.maxTokensToSell, TOKEN_DECIMALS);
  }, [data]);

  const UNSOLD_TILE_BG = useMemo(
    () =>
      buildTileDataUrl({
        fill: "#171717",
        fillOpacity: "0.48",
        stroke: "white",
        strokeOpacity: "0.31",
      }),
    []
  );

  const SOLD_TILE_BG = useMemo(
    () =>
      buildTileDataUrl({
        fill: "#5EBBC3",
        fillOpacity: "1",
        stroke: "white",
        strokeOpacity: "0.31",
      }),
    []
  );

  return (
    <Stack width="100%" gap={1}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" sx={{ fontStyle: "italic" }}>
          Status
        </Typography>
        <Typography variant="subtitle2" color="text.secondary">
          {loading ? "Loading…" : fmtPct}
        </Typography>
      </Stack>

      <Box
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        sx={{
          position: "relative",
          width: "100%",
          height: CELL_H,
          borderRadius: "3px",
          overflow: "hidden",
          backgroundColor: "transparent",
          boxSizing: "border-box",
          borderRight: "solid 1px rgba(255, 255, 255, 0.31)",
          borderTopRightRadius: "3px",
          borderBottomRightRadius: "3px"
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundOrigin: "content-box",
            backgroundImage: UNSOLD_TILE_BG,
            backgroundRepeat: "repeat-x",
            backgroundPosition: "left center",
            backgroundSize: `${CELL_W + CELL_GAP_X}px ${CELL_H}px`,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: pct === 0 ? 0 : `${pct}%`,
            backgroundOrigin: "content-box",
            backgroundImage: SOLD_TILE_BG,
            backgroundRepeat: "repeat-x",
            backgroundPosition: "left center",
            backgroundSize: `${CELL_W + CELL_GAP_X}px ${CELL_H}px`,
            pointerEvents: "none",
            zIndex: 1,
            transition: "width 400ms ease",
          }}
        />
      </Box>

      {!loading && !error && data ? (
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">
            Sold: {fmtSold}{" "}
            <span
              style={{
                fontWeight: 600,
                background: theme.palette.uranoGradient,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginBottom: 2,
              }}
            >
              $URANO
            </span>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Max: {fmtMax}{" "}
            <span
              style={{
                fontWeight: 600,
                background: theme.palette.uranoGradient,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginBottom: 2,
              }}
            >
              $URANO
            </span>
          </Typography>
        </Stack>
      ) : error ? (
        <Typography variant="caption" color="error.main">
          {error}
        </Typography>
      ) : null}
    </Stack>
  );
}
