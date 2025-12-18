"use client";

import { Typography, Stack, Link as MuiLink, Box, Link } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Registration from "./Registration";
import PresaleCard from "./PresaleCard";
import TokensSelection from "./TokensSelection";
import mobileCoin1 from "@/assets/images/mobileCoin1.webp";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { useActiveAccount, useReadContract } from "thirdweb/react";
import { getContract } from "thirdweb";
import { getBalance } from "thirdweb/extensions/erc20";
import { arbitrum } from "thirdweb/chains";
import { client } from "@/lib/thirdwebClient";
import { parseUnits } from "viem";
import {
  getOrCreateInviteCode,
  getActiveRoundIndexStrict,
  approveUsdcSpending,
  buyPresaleTokens,
} from "@/utils/presaleActions";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import PurchaseSuccessModal from "../PurchaseSuccessModal";

type Progress = { step1: boolean; step2: boolean; step3: boolean };

type ReferralPayload = {
  ref_code?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

const STORAGE_KEY = "registrationProgress:v1";
const AMOUNT_STORAGE_KEY = "urano:purchaseAmount:v1";
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA as `0x${string}` | undefined;
const MIN_USDC = 100;
const ZERO: `0x${string}` = "0x0000000000000000000000000000000000000000";
const txUrl = (hash?: string) => (hash ? `https://arbiscan.io/tx/${hash}` : undefined);
const AnimatedDots = () => (
  <span
    style={{
      display: "inline-block",
      width: 20,
      textAlign: "left",
      fontWeight: 600,
      letterSpacing: 1,
      marginLeft: 6,
    }}
    className="animated-dots"
  >
    …
    <style jsx>{`
      .animated-dots {
        animation: dots 1s steps(3, end) infinite;
      }
      @keyframes dots {
        0% {
          clip-path: inset(0 0 0 0);
        }
        33% {
          clip-path: inset(0 66% 0 0);
        }
        66% {
          clip-path: inset(0 33% 0 0);
        }
        100% {
          clip-path: inset(0 0 0 0);
        }
      }
    `}</style>
  </span>
);

const MainSection = () => {
  const theme = useTheme();
  const [purchaseSuccessModalOpen, setPurchaseSuccessModalOpen] = useState<boolean>(false)
  const [progress, setProgress] = useState<Progress>({ step1: false, step2: false, step3: false });
  const [amount, setAmount] = useState<number>(0);
  const [loadingPhase, setLoadingPhase] = useState<"idle" | "approve" | "buy">("idle");

  const [approvedThisSession, setApprovedThisSession] = useState(false);

  function readReferralPayload(): ReferralPayload {
    try {
      // Use whatever key you chose when persisting from landing page
      const raw = localStorage.getItem("urano:referral:v1");
      if (!raw) return {};
      const parsed = JSON.parse(raw) as ReferralPayload;
      return parsed ?? {};
    } catch {
      return {};
    }
  }
  
  async function trackConversion(input: {
    buyerAddress: `0x${string}`;
    txHash: `0x${string}`;
    chainId: number;
    amount: number; // USDC human
  }): Promise<void> {
    const res = await fetch("/api/referral/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyer_address: input.buyerAddress,
        tx_hash: input.txHash,
        chain_id: input.chainId,
        amount: String(input.amount),
      }),
    });
  
    // do not block UX if it fails, but do detect errors
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Failed to convert referral");
    }
  }
  

  const toastBase = useMemo(
    () => ({
      style: {
        background: theme.palette.background.default,
        color: theme.palette.text.primary,
        border: `1px solid ${theme.palette.headerBorder?.main ?? "transparent"}`,
      },
      icon: (
        <Box component="span" sx={{ color: theme.palette.uranoGreen1.main, fontWeight: 700 }}>
          ●
        </Box>
      ),
      progressStyle: { background: theme.palette.uranoGreen1.main },
    }),
    [theme]
  );

  const account = useActiveAccount();
  const address = account?.address as `0x${string}` | undefined;

  const usdcContract = useMemo(() => {
    if (!USDC_ADDRESS) return undefined;
    return getContract({ client, address: USDC_ADDRESS, chain: arbitrum });
  }, []);

  const fallbackContract = useMemo(
    () => getContract({ client, address: ZERO, chain: arbitrum }),
    []
  );

  const readEnabled = Boolean(address && usdcContract);

  const { data: usdcBal } = useReadContract(getBalance, {
    contract: readEnabled ? usdcContract! : fallbackContract,
    address: readEnabled ? (address as string) : ZERO,
    queryOptions: {
      enabled: readEnabled,
      refetchInterval: 15_000,
      retry: 3,
    },
  });

  const insufficient = useMemo(() => {
    if (!usdcBal || !Number.isFinite(amount)) return false;
    const dec = usdcBal.decimals ?? 6;
    try {
      const want = parseUnits((amount || 0).toString(), dec);
      return want > usdcBal.value;
    } catch {
      return true;
    }
  }, [amount, usdcBal]);

  const belowMin = useMemo(() => amount > 0 && amount < MIN_USDC, [amount]);

  const readProgress = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<Progress>;
      setProgress({
        step1: Boolean(parsed.step1),
        step2: Boolean(parsed.step2),
        step3: Boolean(parsed.step3),
      });
    } catch {
      /* noop */
    }
  };

  const readAmount = () => {
    try {
      const raw = localStorage.getItem(AMOUNT_STORAGE_KEY);
      const v = raw ? Number(raw) : 0;
      setAmount(Number.isFinite(v) ? v : 0);
    } catch {
      setAmount(0);
    }
  };

  useEffect(() => {
    readProgress();
    readAmount();

    const onFocus = () => {
      readProgress();
      readAmount();
    };
    window.addEventListener("focus", onFocus);

    const onProgressEvent = () => readProgress();
    const onAmountEvent = () => readAmount();
    window.addEventListener("urano:progress", onProgressEvent as EventListener);
    window.addEventListener("urano:amount", onAmountEvent as EventListener);

    const id = window.setInterval(() => {
      readProgress();
      readAmount();
    }, 500);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) readProgress();
      if (e.key === AMOUNT_STORAGE_KEY) readAmount();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("urano:progress", onProgressEvent as EventListener);
      window.removeEventListener("urano:amount", onAmountEvent as EventListener);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(id);
    };
  }, []);

  const allStepsDone = progress.step1 && progress.step3 && progress.step2;

  const baseChecksPass = useMemo(() => {
    if (!allStepsDone) return false;
    if (amount <= 0) return false;
    if (belowMin) return false;
    if (insufficient) return false;
    return true;
  }, [allStepsDone, amount, belowMin, insufficient]);

  useEffect(() => {
    setApprovedThisSession(false);
  }, [amount, address]);

  const canClick = baseChecksPass && loadingPhase === "idle";
  const ctaText = useMemo(() => {
    if (!progress.step1) return "Register with Email";
    if (!progress.step3) return "Connect Wallet";
    if (!progress.step2) return "Verify Identity";
    if (amount <= 0) return "Insert amount to pay";
    if (belowMin) return `Min amount is ${MIN_USDC} USDC`;
    if (insufficient) return "Insufficient balance";
    if (loadingPhase === "approve") return <>Approving<AnimatedDots /></>;
    if (loadingPhase === "buy") return <>Buying<AnimatedDots /></>;
    return approvedThisSession ? "Buy" : "Approve";
  }, [progress, amount, belowMin, insufficient, loadingPhase, approvedThisSession]);

  const onClickCta = async () => {
    try {
      if (!canClick) return;
      if (!account) throw new Error("No connected account");

      if (!approvedThisSession) {
        setLoadingPhase("approve");
        const { txHash: approveTx } = await approveUsdcSpending(account, amount);

        toast.success(
          <div>
            <div><b>Approval submitted</b></div>
            {approveTx && (
              <a
                href={txUrl(approveTx)}
                target="_blank"
                rel="noreferrer"
                style={{ color: theme.palette.uranoGreen1.main }}
              >
                View on Etherscan
              </a>
            )}
            <div>Once confirmed, you can click <b>Buy</b>.</div>
          </div>,
          { ...toastBase, autoClose: 6000, position: "bottom-right" }
        );
        setApprovedThisSession(true);
        setLoadingPhase("idle");
        return;
      }

      setLoadingPhase("buy");
      const { code } = await getOrCreateInviteCode(account);
      const idx = await getActiveRoundIndexStrict()
      const { txHash: buyTx } = await buyPresaleTokens(account, idx, amount, code);

      try {
        if (address) {
          await trackConversion({
            buyerAddress: address,
            txHash: buyTx,
            chainId: arbitrum.id,
            amount,
          });
        }
      } catch (e) {
        // don’t fail the purchase UX if tracking fails
        console.error("Conversion tracking failed:", e);
      }

      toast.success(
        <div>
          <div><b>Transaction sent</b></div>
          {buyTx && (
            <a
              href={txUrl(buyTx)}
              target="_blank"
              rel="noreferrer"
              style={{ color: theme.palette.uranoGreen1.main }}
            >
              View on Etherscan
            </a>
          )}
        </div>,
        { ...toastBase, autoClose: 6000, position: "bottom-right" }
      );
      setPurchaseSuccessModalOpen(true);

      setApprovedThisSession(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err, null, 2);

      toast.error(
        <div>
          <div><b>Transaction failed</b></div>
          <div style={{ wordBreak: "break-word" }}>{message}</div>
        </div>,
        { ...toastBase, autoClose: 6000, position: "bottom-right" }
      );
      console.error(err);
    } finally {
      setLoadingPhase("idle");
    }
  };

  return (
    <>
      <Stack
        width={"100%"}
        flex={1}
        direction={{ xs: "column", lg: "row" }}
        justifyContent={"space-between"}
        alignItems={"stretch"}
        paddingTop={2}
        paddingBottom={4}
      >
        <ToastContainer position="top-right" autoClose={6000} newestOnTop closeOnClick />

        <Stack width={{ xs: "100%", lg: "60%" }} flexGrow={1} gap={4}>
          <Typography
            className="conthrax"
            variant="h3"
            sx={{
              fontSize: { xs: "1.4rem", lg: "2.5rem" },
              fontWeight: 700,
              background: theme.palette.uranoGradient,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Unlocking the power
            <br /> of on-chain tokenization
          </Typography>

          <Stack>
            <Typography
              className="conthrax"
              variant="h6"
              sx={{
                fontSize: { xs: "1rem", lg: "1.5rem" },
                fontWeight: 600,
                color: theme.palette.text.primary,
              }}
            >
              Welcome to Urano Ecosystem
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontSize: { xs: "1rem", lg: "0.95rem" },
                fontWeight: { xs: 400, lg: 300 },
                color: theme.palette.text.primary,
              }}
            >
              The gateway to tokenized Real World Assets, powered by{" "}
              <span style={{ fontWeight: 600, color: theme.palette.uranoGreen1.main }}>$URANO</span>
            </Typography>
          </Stack>
          <Stack gap={1.5} display={{ xs: "none", lg: "flex" }}>
            <Stack direction={"row"} gap={1} alignItems={"center"}>
              <Typography variant="h6" sx={{
                fontSize: "1rem",
                fontWeight: 500,
                color: theme.palette.text.primary,
              }}>
                Shape The Future – <span style={{ fontWeight: 300, color: theme.palette.darkerText.main }}>Gain governance rights to influence Urano’s direction</span>
              </Typography>
            </Stack>
            <Stack direction={"row"} gap={1} alignItems={"center"}>
              <Typography variant="h6" sx={{
                fontSize: "1rem",
                fontWeight: 500,
                color: theme.palette.text.primary,
              }}>
                Early Access – <span style={{ fontWeight: 300, color: theme.palette.darkerText.main }}>Get priority entry to exclusive RWA offerings</span>
              </Typography>
            </Stack>
            <Stack direction={"row"} gap={1} alignItems={"center"}>
              <Typography variant="h6" sx={{
                fontSize: "1rem",
                fontWeight: 500,
                color: theme.palette.text.primary,
              }}>
                Staking Rewards – <span style={{ fontWeight: 300, color: theme.palette.darkerText.main }}>Unlock dynamic incentives through staking <span style={{ fontWeight: 600, color: theme.palette.uranoGreen1.main }}>$URANO</span></span>
              </Typography>
            </Stack>
            <Stack direction={"row"} gap={1} alignItems={"center"}>
              <Typography variant="h6" sx={{
                fontSize: "1rem",
                fontWeight: 500,
                color: theme.palette.text.primary,
              }}>
                Revenue-sharing Pool – <span style={{ fontWeight: 300, color: theme.palette.darkerText.main }}>Access protocol fees distributed to key contributors</span>
              </Typography>
            </Stack>
            <Link href="https://www.uranoecosystem.com/token" underline="none" target="_blank" sx={{
              display: { xs: "none", lg: "flex" },
              width: "fit-content",
            }}>
              <Box sx={{
                width: "fit-content",
                background: theme.palette.uranoGradient,
                border: `2px solid ${theme.palette.headerBorder.main}`,
                borderRadius: 2,
                paddingX: { xs: 1.5, lg: 5 },
                paddingY: { xs: 1.5, lg: 1 },
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                "&:hover": {
                  border: `2px solid ${theme.palette.text.primary}`,
                  filter: "brightness(1.2)",
                },
              }}>
                <Typography variant="body1" fontWeight={400} sx={{
                  color: theme.palette.background.default
                }}>Learn More</Typography>
              </Box>
            </Link>
          </Stack>

          <Stack gap={1.5} display={{ xs: "flex", lg: "none" }}>
            <Stack gap={1} sx={{
              background: "rgba(21, 21, 21, 0.7)",
              border: `1px solid ${theme.palette.headerBorder.main}`,
              borderRadius: 2,
              padding: 2,
            }}>
              <Stack direction={"row"} justifyContent={"start"} alignItems={"center"} gap={1}>
                <Typography variant="h6" sx={{
                  fontSize: "1.15rem",
                  fontWeight: 500,
                  color: theme.palette.text.primary,
                }}>
                  Shape The Future
                </Typography>
              </Stack>
              <Typography variant="h6" sx={{
                fontSize: "1rem",
                fontWeight: 300,
                color: theme.palette.text.primary,
              }}>
                Gain governance rights to influence Urano’s direction
              </Typography>
            </Stack>
            <Stack gap={1} sx={{
              background: "rgba(21, 21, 21, 0.7)",
              border: `1px solid ${theme.palette.headerBorder.main}`,
              borderRadius: 2,
              padding: 2,
            }}>
              <Stack direction={"row"} justifyContent={"start"} alignItems={"center"} gap={1}>
                <Typography variant="h6" sx={{
                  fontSize: "1.15rem",
                  fontWeight: 500,
                  color: theme.palette.text.primary,
                }}>
                  Early Access
                </Typography>
              </Stack>
              <Typography variant="h6" sx={{
                fontSize: "1rem",
                fontWeight: 300,
                color: theme.palette.text.primary,
              }}>
                Get priority entry to exclusive RWA offerings
              </Typography>
            </Stack>
            <Stack gap={1} sx={{
              background: "rgba(21, 21, 21, 0.7)",
              border: `1px solid ${theme.palette.headerBorder.main}`,
              borderRadius: 2,
              padding: 2,
            }}>
              <Stack direction={"row"} justifyContent={"start"} alignItems={"center"} gap={1}>
                <Typography variant="h6" sx={{
                  fontSize: "1.15rem",
                  fontWeight: 500,
                  color: theme.palette.text.primary,
                }}>
                  Staking Rewards
                </Typography>
              </Stack>
              <Typography variant="h6" sx={{
                fontSize: "1rem",
                fontWeight: 300,
                color: theme.palette.text.primary,
              }}>
                Unlock dynamic incentives through staking <span style={{ fontWeight: 600, color: theme.palette.uranoGreen1.main }}>$URANO</span>
              </Typography>
            </Stack>
            <Stack gap={1} sx={{
              background: "rgba(21, 21, 21, 0.7)",
              border: `1px solid ${theme.palette.headerBorder.main}`,
              borderRadius: 2,
              padding: 2,
            }}>
              <Stack direction={"row"} justifyContent={"start"} alignItems={"center"} gap={1}>
                <Typography variant="h6" sx={{
                  fontSize: "1.15rem",
                  fontWeight: 500,
                  color: theme.palette.text.primary,
                }}>
                  Revenue-sharing Pool
                </Typography>
              </Stack>
              <Typography variant="h6" sx={{
                fontSize: "1rem",
                fontWeight: 300,
                color: theme.palette.text.primary,
              }}>
                Access protocol fees distributed to key contributors
              </Typography>
            </Stack>

            <Link href="https://www.uranoecosystem.com/token" underline="none" target="_blank" sx={{
              display: { xs: "none", lg: "flex" },
              width: "fit-content",
            }}>
              <Box sx={{
                width: "fit-content",
                background: theme.palette.uranoGradient,
                border: `2px solid ${theme.palette.headerBorder.main}`,
                borderRadius: 2,
                paddingX: { xs: 1.5, lg: 5 },
                paddingY: { xs: 1.5, lg: 1 },
                marginLeft: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                "&:hover": {
                  border: `2px solid ${theme.palette.text.primary}`,
                  filter: "brightness(1.2)",
                },
              }}>
                <Typography variant="body1" fontWeight={400} sx={{
                  color: theme.palette.background.default
                }}>Learn More</Typography>
              </Box>
            </Link>
          </Stack>

          <Stack
            display={{ xs: "flex", lg: "none" }}
            width={"100%"}
            justifyContent={"center"}
            alignItems={"center"}
            sx={{ marginY: -6 }}
          >
            <Image
              src={mobileCoin1}
              className="mobileCoin1"
              alt="coins urano"
              style={{ width: "100%", height: "auto", scale: 1.2 }}
              priority
            />
          </Stack>
        </Stack>

        <Stack
          width={{ xs: "100%", lg: "40%" }}
          flexGrow={1}
          gap={{ xs: 3, lg: 3 }}
          marginTop={{ xs: 4, lg: 0 }}
          sx={{
            backgroundColor: { xs: "transparent", lg: theme.palette.transparentPaper.main },
            border: { xs: "none", lg: "1px solid transparent" },
            background: {
              xs: "transparent",
              lg: `
                transparent
            `,
            },
            borderRadius: { xs: 0, lg: "0.75rem" },
            padding: { xs: 0, lg: "0.6rem" },
            backdropFilter: { xs: "none", lg: "blur(8.2px)" },
          }}
        >
          <Registration />
          <PresaleCard />
          <TokensSelection />

          <MuiLink
            href="/"
            underline="none"
            target="_blank"
            onClick={async (e) => {
              e.preventDefault();
              await onClickCta();
            }}
          >
            <Box
              sx={{
                width: "100%",
                background: theme.palette.uranoGradient,
                border: `2px solid ${theme.palette.headerBorder.main}`,
                borderRadius: 2,
                paddingX: { xs: 1.5, lg: 5 },
                paddingY: { xs: 1.5, lg: 1 },
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                opacity: canClick ? 1 : 0.7,
                pointerEvents: canClick ? "auto" : "none",
                cursor: canClick ? "pointer" : "not-allowed",
                "&:hover": {
                  border: `2px solid ${theme.palette.text.primary}`,
                  filter: "brightness(1.1)",
                },
                transition: "filter .15s ease, border-color .15s ease, opacity .15s ease",
              }}
            >
              <Typography variant="body1" fontWeight={600} sx={{ color: theme.palette.background.default }}>
                {ctaText}
              </Typography>
            </Box>
          </MuiLink>
        </Stack>
      </Stack >
      <PurchaseSuccessModal
        open={purchaseSuccessModalOpen}
        onClose={() => setPurchaseSuccessModalOpen(false)}
        purchaseUSDvalue={amount}
      />
    </>
  );
};

export default MainSection;
