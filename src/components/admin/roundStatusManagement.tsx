"use client";

import { memo, useEffect, useMemo, useState, Fragment } from "react";
import {
  Stack,
  Typography,
  Switch,
  Button,
  Divider,
  Chip,
  useTheme,
  Collapse,
  TextField,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

import { fetchRoundItems } from "@/utils/admin/rounds";
import {
  toggleRoundActive,
  toggleRoundActiveExclusive,
  readRoundInfoByKey,
  updateRoundWindowFromDateTx,
  type RoundKey as RoundsWriteRoundKey,
} from "@/utils/admin/roundsWrite";

import {
  readRoundMaxTokensHuman,
  setRoundMaxTokensHumanTx,
  readRoundSoldAndRemainingHuman,
} from "@/utils/admin/roundMaxTokens";

import { updateRoundVestingParametersTx } from "@/utils/admin/vesting";

import { useActiveAccount } from "thirdweb/react";
import { toast } from "react-toastify";

type UiRoundKey = "seed" | "private" | "institutional" | "strategic" | "community";

import type { RoundKey as RoundKeyMax } from "@/utils/admin/roundMaxTokens";
import type { RoundKey as RoundKeyVesting } from "@/utils/admin/vesting";

export type RoundStatusItem = {
  id: UiRoundKey;
  title: string;
  active: boolean;
};

export type RoundStatusManagementProps = {
  rounds?: RoundStatusItem[];
  singleActive?: boolean;
  disabled?: boolean;
  onChange?: (next: RoundStatusItem[], changedId: string) => void;
  onShowMore?: (id: string) => void;
  title?: string;
  subtitle?: string;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

const isUiRoundKey = (v: unknown): v is UiRoundKey =>
  typeof v === "string" &&
  (["seed", "private", "institutional", "strategic", "community"] as const).includes(
    v as UiRoundKey
  );

type DeactivatedEntry = { round: UiRoundKey };
function parseDeactivated(input: unknown): DeactivatedEntry[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((x): DeactivatedEntry | null => {
      if (typeof x !== "object" || x === null) return null;
      if (!("round" in x)) return null;
      const round = (x as Record<string, unknown>).round;
      return isUiRoundKey(round) ? { round } : null;
    })
    .filter((x): x is DeactivatedEntry => x !== null);
}

type ActivatedInfo = { startTimeUsed?: number | bigint; endTimeUsed?: number | bigint };
function parseActivated(input: unknown): ActivatedInfo | null {
  if (typeof input !== "object" || input === null) return null;
  const obj = input as Record<string, unknown>;
  const isNumLike = (v: unknown): v is number | bigint =>
    typeof v === "number" || typeof v === "bigint";
  const startTimeUsed = obj.startTimeUsed;
  const endTimeUsed = obj.endTimeUsed;
  if (isNumLike(startTimeUsed) || isNumLike(endTimeUsed)) {
    return {
      startTimeUsed: isNumLike(startTimeUsed) ? startTimeUsed : undefined,
      endTimeUsed: isNumLike(endTimeUsed) ? endTimeUsed : undefined,
    };
  }
  return null;
}

const UI_KEYS: readonly UiRoundKey[] = [
  "seed",
  "private",
  "institutional",
  "strategic",
  "community",
] as const;

const RoundStatusManagement = memo(function RoundStatusManagement({
  rounds,
  singleActive = true,
  disabled = false,
  onChange,
  onShowMore,
  title = "Round Status Management",
  subtitle = "Activate or deactivate presale rounds",
}: RoundStatusManagementProps) {
  const theme = useTheme();
  const account = useActiveAccount();

  const [items, setItems] = useState<RoundStatusItem[]>(rounds ?? []);
  const [loading, setLoading] = useState<boolean>(!rounds);
  const [txLoadingById, setTxLoadingById] = useState<Record<string, boolean>>({});

  const [tgePct, setTgePct] = useState("");
  const [cliffMonths, setCliffMonths] = useState("");
  const [durationMonths, setDurationMonths] = useState("");

  const [maxTokensHuman, setMaxTokensHuman] = useState("");
  const [maxTokensLoading, setMaxTokensLoading] = useState(false);

  const [soldHuman, setSoldHuman] = useState("");
  const [remainingHuman, setRemainingHuman] = useState("");
  const [salesLoading, setSalesLoading] = useState(false);

  const [expandedId, setExpandedId] = useState<UiRoundKey | null>(null);

  const [updateParamsLoading, setUpdateParamsLoading] = useState<Record<UiRoundKey, boolean>>(
    () =>
      Object.fromEntries(UI_KEYS.map((k) => [k, false])) as Record<UiRoundKey, boolean>
  );

  const [roundDatesLoading, setRoundDatesLoading] = useState(false);
  const [startISO, setStartISO] = useState("");
  const [endISO, setEndISO] = useState("");

  useEffect(() => {
    if (rounds) {
      setItems(rounds);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const onchain = await fetchRoundItems();
        if (!cancelled) setItems(onchain);
      } catch (e: unknown) {
        console.error("Failed to load rounds from chain:", e);
        toast.error("Failed to load rounds from chain");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [rounds]);

  const firstActive = useMemo(() => {
    const idx = items.findIndex((r) => r.active);
    return idx >= 0 ? { id: items[idx]?.id ?? null, index: idx } : null;
  }, [items]);

  useEffect(() => {
    if (!firstActive?.id || expandedId !== firstActive.id) setExpandedId(null);
  }, [firstActive, expandedId]);

  const setRowTxLoading = (id: string, val: boolean) =>
    setTxLoadingById((prev) => ({ ...prev, [id]: val }));

  const anyRowBusy = useMemo(
    () => Object.values(txLoadingById).some(Boolean),
    [txLoadingById]
  );

  const handleToggle = async (id: UiRoundKey, nextVal: boolean) => {
    if (disabled) return;
    if (!account) {
      toast.error("No wallet connected. Please connect an authorized wallet.");
      return;
    }
    if (txLoadingById[id] || anyRowBusy) return;

    try {
      setRowTxLoading(id, true);

      if (singleActive && nextVal) {
        const res = await toggleRoundActiveExclusive(
          account,
          id as RoundsWriteRoundKey,
          true
        );

        try {
          const latest = await fetchRoundItems();
          setItems(latest);
          onChange?.(latest, id);
        } catch {
          setItems((prev) =>
            prev.map((r) =>
              r.id === id ? { ...r, active: true } : { ...r, active: false }
            )
          );
          onChange?.(
            items.map((r) =>
              r.id === id ? { ...r, active: true } : { ...r, active: false }
            ),
            id
          );
        }

        const act = parseActivated((res as { activated?: unknown }).activated);
        const start = act?.startTimeUsed;
        const end = act?.endTimeUsed;
        toast.success(
          `Activated ${id} round${
            start != null && end != null ? ` (${Number(start)} → ${Number(end)})` : ""
          }`
        );

        const deactivated = parseDeactivated((res as { deactivated?: unknown }).deactivated);
        if (deactivated.length > 0) {
          toast.info(`Deactivated ${deactivated.map((d) => d.round).join(", ")}.`);
        }
        return;
      }

      const result = await toggleRoundActive(account, id as RoundsWriteRoundKey, nextVal);

      try {
        const latest = await fetchRoundItems();
        setItems(latest);
        onChange?.(latest, id);
      } catch {
        setItems((prev) => {
          let next = prev.map((r) => (r.id === id ? { ...r, active: nextVal } : r));
          if (singleActive && nextVal) {
            next = next.map((r) => (r.id !== id ? { ...r, active: false } : r));
          }
          onChange?.(next, id);
          return next;
        });
      }

      const act2 = parseActivated(result as unknown);
      const start2 = act2?.startTimeUsed;
      const end2 = act2?.endTimeUsed;
      toast.success(
        nextVal
          ? `Activated ${id} round${
              start2 != null && end2 != null ? ` (${Number(start2)} → ${Number(end2)})` : ""
            }`
          : `${id} round deactivated.`
      );
    } catch (e: unknown) {
      console.error(e);
      toast.error(getErrorMessage(e));
    } finally {
      setRowTxLoading(id, false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!expandedId) return;
      try {
        setMaxTokensLoading(true);
        setSalesLoading(true);
        setRoundDatesLoading(true);

        const [humanMax, sales, info] = await Promise.all([
          readRoundMaxTokensHuman(expandedId as RoundKeyMax),
          readRoundSoldAndRemainingHuman(expandedId as RoundKeyMax),
          readRoundInfoByKey(expandedId as RoundsWriteRoundKey),
        ]);

        if (!cancelled) {
          setMaxTokensHuman(humanMax);
          setSoldHuman(sales.sold);
          setRemainingHuman(sales.remaining);

          const startSec = Number(info[4] ?? 0n);
          const endSec = Number(info[5] ?? 0n);
          const toISO = (sec: number) =>
            sec > 0
              ? dayjs(sec * 1000)
                  .second(0)
                  .millisecond(0)
                  .format("YYYY-MM-DDTHH:mm")
              : "";
          setStartISO(toISO(startSec));
          setEndISO(toISO(endSec));

          const cliff = Number(info[10] ?? 0n);
          const duration = Number(info[11] ?? 0n);
          const tgeBps = Number(info[12] ?? 0n);
          const tgePercent = Math.round(tgeBps / 100);
          setCliffMonths(String(cliff));
          setDurationMonths(String(duration));
          setTgePct(String(tgePercent));
        }
      } catch (e) {
        console.error("Failed to read round details:", e);
      } finally {
        if (!cancelled) {
          setMaxTokensLoading(false);
          setSalesLoading(false);
          setRoundDatesLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [expandedId]);

  const handleSaveMaxTokens = async () => {
    if (!expandedId) return;
    if (disabled) return;

    if (!account) {
      toast.error("No wallet connected. Please connect an authorized wallet.");
      return;
    }

    const rowId = expandedId as string;
    if (txLoadingById[rowId] || anyRowBusy) return;

    try {
      setRowTxLoading(rowId, true);
      await setRoundMaxTokensHumanTx(account, expandedId as RoundKeyMax, maxTokensHuman.trim());
      toast.success(`Max tokens updated for ${expandedId} round.`);

      try {
        const human = await readRoundMaxTokensHuman(expandedId as RoundKeyMax);
        setMaxTokensHuman(human);
      } catch {
        // ignore
      }
    } catch (e) {
      console.error(e);
      toast.error(getErrorMessage(e));
    } finally {
      setRowTxLoading(rowId, false);
    }
  };

  const handleSaveVestingParams = async () => {
    if (!expandedId) return;
    if (disabled) return;
    if (!account) {
      toast.error("No wallet connected. Please connect an authorized wallet.");
      return;
    }

    const key = expandedId;
    if (txLoadingById[key] || anyRowBusy) return;

    const tgeNum = Number(tgePct);
    const cliffNum = Number(cliffMonths);
    const durationNum = Number(durationMonths);

    if (!Number.isFinite(tgeNum) || tgeNum < 0 || tgeNum > 100) {
      toast.error("TGE % must be an integer between 0 and 100.");
      return;
    }
    if (!Number.isFinite(cliffNum) || cliffNum < 0) {
      toast.error("Cliff months must be a non-negative integer.");
      return;
    }
    if (!Number.isFinite(durationNum) || durationNum <= 0) {
      toast.error("Duration months must be a positive integer.");
      return;
    }

    try {
      setUpdateParamsLoading((prev) => ({ ...prev, [key]: true }));

      const tgeBps = BigInt(Math.round(tgeNum * 100));

      await updateRoundVestingParametersTx(account, key as RoundKeyVesting, {
        cliffPeriodMonths: BigInt(Math.round(cliffNum)),
        vestingDurationMonths: BigInt(Math.round(durationNum)),
        tgeUnlockPercentage: tgeBps,
      });

      toast.success(`Updated vesting parameters for ${key} round.`);
    } catch (e) {
      console.error(e);
      toast.error(getErrorMessage(e));
    } finally {
      setUpdateParamsLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSaveRoundDates = async () => {
    if (!expandedId) return;
    if (disabled) return;
    if (!account) {
      toast.error("No wallet connected. Please connect an authorized wallet.");
      return;
    }
    const id = expandedId;
    if (txLoadingById[id] || anyRowBusy) return;

    if (!startISO || !endISO) {
      toast.error("Please set both Start and End date/time.");
      return;
    }
    const startMs = dayjs(startISO).valueOf();
    const endMs = dayjs(endISO).valueOf();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      toast.error("Invalid date/time values.");
      return;
    }
    if (endMs <= startMs) {
      toast.error("End time must be after Start time.");
      return;
    }

    try {
      setRowTxLoading(id, true);

      await updateRoundWindowFromDateTx(account, expandedId as RoundsWriteRoundKey, {
        start: new Date(startMs),
        end: new Date(endMs),
      });

      const info = await readRoundInfoByKey(id as RoundsWriteRoundKey);
      const toISO = (sec: bigint) =>
        sec > 0n
          ? dayjs(Number(sec) * 1000)
              .second(0)
              .millisecond(0)
              .format("YYYY-MM-DDTHH:mm")
          : "";
      setStartISO(toISO(info[4]));
      setEndISO(toISO(info[5]));

      toast.success(`Dates updated for ${id} round.`);
    } catch (e) {
      console.error(e);
      toast.error(getErrorMessage(e));
    } finally {
      setRowTxLoading(id, false);
    }
  };

  const handleShowMore = (id: UiRoundKey) => {
    if (disabled) return;
    if (firstActive?.id !== id) return;
    setExpandedId((prev) => (prev === id ? null : id));
    onShowMore?.(id);
  };

  const switchSx = {
    "& .MuiSwitch-track": { backgroundColor: theme.palette.grey[700], opacity: 1 },
    "& .MuiSwitch-switchBase.Mui-checked": {
      color: "rgba(42, 112, 100, 1)",
      "& + .MuiSwitch-track": { backgroundColor: "rgba(42, 112, 100, 1)", opacity: 1 },
      "& .MuiSwitch-thumb": {
        backgroundColor: "rgba(102, 212, 194, 1)",
        filter:
          "drop-shadow(0 2px 1px rgba(0, 0, 0, 0.20)) drop-shadow(0 1px 1px rgba(0, 0, 0, 0.14)) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.12))",
        boxShadow: "0 0px 0.5px 8px rgba(102, 212, 194, 0.1)",
      },
    },
  } as const;

  const cardBaseSx = {
    backgroundColor: theme.palette.presaleCardBg.main,
    border: `1px solid ${theme.palette.headerBorder.main}`,
    borderRadius: 2,
    px: { xs: 2, md: 3 },
    py: { xs: 2, md: 3 },
    transition: "border-color .15s ease, box-shadow .15s ease, background .15s ease",
  } as const;

  const inputSx = {
    "& .MuiOutlinedInput-root": {
      background: theme.palette.background.paper,
      borderRadius: 2,
      "& fieldset": { borderColor: theme.palette.headerBorder.main },
      "&:hover fieldset": { borderColor: theme.palette.text.primary },
      "&.Mui-focused fieldset": { borderColor: theme.palette.uranoGreen1.main },
    },

    "& .MuiInputBase-input::placeholder": { opacity: 0.7 },

    "& .MuiInputLabel-root": {
      color: theme.palette.common.white,
      "&.Mui-focused": { color: theme.palette.common.white },
      "&.MuiInputLabel-shrink": {
        color: theme.palette.common.white,
        px: 0.75,
        borderRadius: 0.5,
        backgroundColor: theme.palette.background.paper,
        lineHeight: 1.2,
      },
      "&.Mui-disabled": { color: theme.palette.text.disabled },
    },

    "& .MuiOutlinedInput-notchedOutline legend": {
      maxWidth: "60px",
    },

    "& .MuiOutlinedInput-notchedOutline legend > span": {
      paddingLeft: 6,
      paddingRight: 6,
    },
  } as const;

  const actionBtnSx = {
    textTransform: "none",
    borderRadius: 2,
    px: 3,
    py: 1.7,
    backgroundColor: theme.palette.secondary.main,
    border: `1px solid ${theme.palette.headerBorder.main}`,
    color: theme.palette.text.primary,
    "&:hover": {
      borderColor: theme.palette.text.primary,
      background: theme.palette.transparentPaper.main,
    },
  } as const;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Stack gap={2} width="100%">
        <Stack gap={0.5}>
          <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            {subtitle}
          </Typography>
        </Stack>

        {loading ? (
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            Loading rounds from chain…
          </Typography>
        ) : (
          <Stack gap={2} sx={{ opacity: anyRowBusy ? 0.85 : 1 }}>
            {items.map((r, idx) => {
              const isActive = r.active;
              const isFirstActive = firstActive?.id === r.id;
              const isExpanded = expandedId === r.id;
              const rowBusy = !!txLoadingById[r.id];

              return (
                <Fragment key={r.id}>
                  <Stack
                    sx={{
                      ...cardBaseSx,
                      border: isActive
                        ? `1px solid ${theme.palette.uranoGreen1.main}`
                        : cardBaseSx.border,
                      boxShadow: isActive ? `0 0 0 1px rgba(107, 226, 194, .25)` : "none",
                      opacity: rowBusy ? 0.6 : 1,
                      pointerEvents: rowBusy || anyRowBusy ? "none" : "auto",
                    }}
                    gap={2}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      flexWrap={{ xs: "wrap", md: "nowrap" }}
                    >
                      <Stack
                        gap={1}
                        direction={{ xs: "row", md: "column" }}
                        alignItems="center"
                        justifyContent={{ xs: "space-between", lg: "flex-start" }}
                        flexWrap={{ xs: "wrap", md: "nowrap" }}
                        width={{ xs: "100%", md: "auto" }}
                      >
                        <Typography
                          variant="h6"
                          sx={{
                            fontSize: "1.05rem",
                            fontWeight: 500,
                            color: theme.palette.text.primary,
                          }}
                        >
                          {r.title}
                        </Typography>

                        {isActive ? (
                          <Chip
                            size="small"
                            label="Active"
                            variant="outlined"
                            sx={{
                              height: 28,
                              width: "100%",
                              borderColor: theme.palette.uranoGreen1.main,
                              color: theme.palette.uranoGreen1.main,
                              fontWeight: 500,
                              borderRadius: 999,
                            }}
                          />
                        ) : (
                          <Typography
                            variant="body2"
                            sx={{ color: theme.palette.text.secondary, width: "100%", textAlign: "left" }}
                          >
                            Inactive
                          </Typography>
                        )}
                      </Stack>

                      <Stack
                        direction={{ xs: "row-reverse", lg: "row" }}
                        alignItems="center"
                        justifyContent={{ xs: "space-between", md: "flex-end" }}
                        gap={1.5}
                        width={{ xs: "100%", lg: "auto" }}
                        marginTop={{ xs: 2, md: 0 }}
                      >
                        <Switch
                          checked={isActive}
                          onChange={(e) => void handleToggle(r.id, e.target.checked)}
                          inputProps={{ "aria-label": `Toggle ${r.title}` }}
                          disabled={disabled || rowBusy || anyRowBusy}
                          sx={switchSx}
                        />

                        <Button
                          onClick={() => handleShowMore(r.id)}
                          disabled={disabled || !isFirstActive || rowBusy || anyRowBusy}
                          sx={{
                            ...actionBtnSx,
                            py: 1.25,
                            color: isExpanded ? theme.palette.text.disabled : theme.palette.text.primary,
                          }}
                        >
                          {isExpanded ? "Hide" : "Show more"}
                        </Button>
                      </Stack>
                    </Stack>

                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Stack gap={0.5} mb={4}>
                        <Typography variant="subtitle1">Round Vesting Parameters</Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                          Configure vesting terms for this round
                        </Typography>
                      </Stack>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 12, md: 3.5 }}>
                          <TextField
                            fullWidth
                            label="TGE %"
                            placeholder="0"
                            value={tgePct}
                            onChange={(e) => setTgePct(e.target.value)}
                            disabled={disabled || updateParamsLoading[r.id]}
                            InputLabelProps={{ shrink: true }}
                            sx={inputSx}
                            type="number"
                            inputProps={{ step: 1, min: 0, max: 100 }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 3.5 }}>
                          <TextField
                            fullWidth
                            label="Cliff (months)"
                            placeholder="0"
                            value={cliffMonths}
                            onChange={(e) => setCliffMonths(e.target.value)}
                            disabled={disabled || updateParamsLoading[r.id]}
                            InputLabelProps={{ shrink: true }}
                            sx={inputSx}
                            type="number"
                            inputProps={{ step: 1, min: 0, max: 120 }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 3.5 }}>
                          <TextField
                            fullWidth
                            label="Vesting (months)"
                            placeholder="0"
                            value={durationMonths}
                            onChange={(e) => setDurationMonths(e.target.value)}
                            disabled={disabled || updateParamsLoading[r.id]}
                            InputLabelProps={{ shrink: true }}
                            sx={inputSx}
                            type="number"
                            inputProps={{ step: 1, min: 1, max: 120 }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 1.5 }}>
                          <Button
                            onClick={handleSaveVestingParams}
                            disabled={disabled || updateParamsLoading[r.id]}
                            sx={{ ...actionBtnSx, width: { xs: "100%", md: "auto" } }}
                          >
                            {updateParamsLoading[r.id] ? "Saving…" : "Save"}
                          </Button>
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 3, borderBottom: `1px solid ${theme.palette.secondary.main}` }} />

                      <Stack gap={0.5} mb={4}>
                        <Typography variant="subtitle1">Round Start & End</Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                          Update sale window for this round
                        </Typography>
                      </Stack>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 12, md: 5.25 }}>
                          <TextField
                            fullWidth
                            label="Start Date & Time"
                            type="datetime-local"
                            value={startISO}
                            onChange={(e) => setStartISO(e.target.value)}
                            disabled={disabled || roundDatesLoading}
                            InputLabelProps={{ shrink: true }}
                            sx={{
                              ...inputSx,
                              '& input[type="datetime-local"]::-webkit-calendar-picker-indicator': {
                                filter: "invert(1) brightness(2)",
                                opacity: 1,
                              },
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 5.25 }}>
                          <TextField
                            fullWidth
                            label="End Date & Time"
                            type="datetime-local"
                            value={endISO}
                            onChange={(e) => setEndISO(e.target.value)}
                            disabled={disabled || roundDatesLoading}
                            InputLabelProps={{ shrink: true }}
                            sx={{
                              ...inputSx,
                              '& input[type="datetime-local"]::-webkit-calendar-picker-indicator': {
                                filter: "invert(1) brightness(2)",
                                opacity: 1,
                              },
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 1.5 }}>
                          <Button
                            onClick={handleSaveRoundDates}
                            disabled={
                              disabled ||
                              roundDatesLoading ||
                              anyRowBusy ||
                              (expandedId ? !!txLoadingById[expandedId] : false) ||
                              !startISO ||
                              !endISO
                            }
                            sx={{ ...actionBtnSx, width: { xs: "100%", md: "auto" } }}
                          >
                            Save
                          </Button>
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 3, borderBottom: `1px solid ${theme.palette.secondary.main}` }} />

                      <Stack gap={0.5} mb={4}>
                        <Typography variant="subtitle1">Round Max Tokens</Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                          Set the maximum tokens amount for this round
                        </Typography>
                      </Stack>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 12, md: 10.5 }}>
                          <TextField
                            fullWidth
                            label="Round Max Tokens (URANO)"
                            placeholder="0"
                            value={maxTokensHuman}
                            onChange={(e) => setMaxTokensHuman(e.target.value)}
                            disabled={
                              disabled ||
                              maxTokensLoading ||
                              anyRowBusy ||
                              (expandedId ? !!txLoadingById[expandedId] : false)
                            }
                            InputLabelProps={{ shrink: true }}
                            sx={inputSx}
                            type="number"
                            inputProps={{ step: 1, min: 0 }}
                            helperText={maxTokensLoading ? "Loading current value…" : undefined}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 1.5 }}>
                          <Button
                            onClick={handleSaveMaxTokens}
                            disabled={
                              disabled ||
                              maxTokensLoading ||
                              anyRowBusy ||
                              (expandedId ? !!txLoadingById[expandedId] : false) ||
                              !maxTokensHuman.trim()
                            }
                            sx={{ ...actionBtnSx, width: { xs: "100%", md: "auto" } }}
                          >
                            Save
                          </Button>
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 3, borderBottom: `1px solid ${theme.palette.secondary.main}` }} />

                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Typography variant="subtitle1">Sold Tokens</Typography>
                          <Typography variant="body1" color={theme.palette.text.secondary}>
                            {salesLoading ? "Loading…" : soldHuman + " $URANO" || "—"}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Typography variant="subtitle1">Remaining Tokens For Sale</Typography>
                          <Typography variant="body1" color={theme.palette.text.secondary}>
                            {salesLoading ? "Loading…" : remainingHuman + " $URANO" || "—"}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Collapse>
                  </Stack>

                  {idx < items.length - 1 && (
                    <Divider sx={{ borderColor: "transparent", my: -0.5 }} />
                  )}
                </Fragment>
              );
            })}
          </Stack>
        )}
      </Stack>
    </LocalizationProvider>
  );
});

export default RoundStatusManagement;
