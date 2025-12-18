'use client'

import { Stack, Typography, Link, Box } from "@mui/material"
import Image from "next/image"
import logo from "@/assets/images/logos/logo-turquoise-1.webp"
import { useTheme, type Theme } from '@mui/material/styles';
import { PiTelegramLogoDuotone, PiXLogo } from "react-icons/pi";
import MobileMenu from "./MobileMenu";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { client } from "@/lib/thirdwebClient";
import { FaRegUser } from "react-icons/fa";

import ReferralButton from "@/components/referral/ReferralButton";
import { isWhitelistedReferrer } from "@/utils/referral/whitelist";

const Header = () => {
    const theme = useTheme<Theme>();
    const account = useActiveAccount();

    const connectedAddress =
        account?.address && typeof account.address === "string"
            ? account.address
            : null;

    const showReferral =
        connectedAddress ? isWhitelistedReferrer(connectedAddress) : false;

    return (
        <>
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                width={{ xs: "100vw", lg: "100%" }}
                sx={{
                    backgroundColor: theme.palette.background.paper,
                    borderTop: { xs: "none", lg: `1px solid ${theme.palette.headerBorder.main}` },
                    borderBottom: `1px solid ${theme.palette.headerBorder.main}`,
                    borderLeft: { xs: "none", lg: `1px solid ${theme.palette.headerBorder.main}` },
                    borderRight: { xs: "none", lg: `1px solid ${theme.palette.headerBorder.main}` },
                    borderRadius: 2,
                    paddingX: { xs: 2, lg: 5 },
                    marginLeft: { xs: -2, lg: 0 },
                }}
            >
                <Link href="https://www.uranoecosystem.com/">
                    <Image src={logo} alt="Logo" width={120} height={70} />
                </Link>

                <Stack
                    display={{
                        xs: "none",
                        lg: "flex",
                    }}
                    direction="row"
                    justifyContent="center"
                    alignItems="center"
                    gap={2}
                >
                    <Link href="/" underline="none">
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                paddingY: 1,
                                paddingX: 2,
                                borderRadius: 2,
                                '&:hover': {
                                    backgroundColor: "#1A1A1A",
                                    "&:hover .navLink": {
                                        background: theme.palette.uranoGradient,
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    },
                                },
                            }}
                        >
                            <Typography
                                variant="body1"
                                fontWeight={400}
                                color={theme.palette.text.secondary}
                                className="navLink"
                            >
                                Homepage
                            </Typography>
                        </Box>
                    </Link>

                    <Link href="https://docs.uranoecosystem.com/" underline="none" target="_blank">
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                paddingY: 1,
                                paddingX: 2,
                                borderRadius: 2,
                                '&:hover': {
                                    backgroundColor: "#1A1A1A",
                                    "&:hover .navLink": {
                                        background: theme.palette.uranoGradient,
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    },
                                },
                            }}
                        >
                            <Typography
                                variant="body1"
                                fontWeight={400}
                                color={theme.palette.text.secondary}
                                className="navLink"
                            >
                                Docs
                            </Typography>
                        </Box>
                    </Link>

                    <Link
                        href="https://docs.uranoecosystem.com/ecosystem/interactive-blocks/tokenomics"
                        underline="none"
                        target="_blank"
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                paddingY: 1,
                                paddingX: 2,
                                borderRadius: 2,
                                '&:hover': {
                                    backgroundColor: "#1A1A1A",
                                    "&:hover .navLink": {
                                        background: theme.palette.uranoGradient,
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    },
                                },
                            }}
                        >
                            <Typography
                                variant="body1"
                                fontWeight={400}
                                color={theme.palette.text.secondary}
                                className="navLink"
                            >
                                Tokenomics
                            </Typography>
                        </Box>
                    </Link>
                </Stack>

                <Stack direction="row" justifyContent="end" alignItems="center" gap={1}>
                    {account && (
                        <Link href="/profile" underline="none">
                            <Box
                                sx={{
                                    background: { xs: theme.palette.uranoGradient, lg: theme.palette.secondary.main },
                                    border: `1px solid ${theme.palette.headerBorder.main}`,
                                    borderRadius: 2,
                                    paddingX: { xs: 1.5, lg: 2 },
                                    paddingY: { xs: 1.5, lg: 1 },
                                    marginRight: 1,
                                    gap: 1,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    "&:hover": {
                                        background: theme.palette.uranoGradient,
                                        "&:hover .connectWalletLink": {
                                            color: theme.palette.info.main,
                                        },
                                    },
                                }}
                            >
                                <FaRegUser color="#FFFFFF" size={13} />
                                <Typography
                                    variant="body1"
                                    fontWeight={400}
                                    className="connectWalletLink"
                                    sx={{
                                        color: { xs: theme.palette.background.default, lg: theme.palette.text.disabled },
                                    }}
                                >
                                    Profile
                                </Typography>
                            </Box>
                        </Link>
                    )}

                    {account && showReferral && connectedAddress ? (
                        <ReferralButton address={connectedAddress} />
                    ) : null}

                    {!account ? <></> : <ConnectButton client={client} />}

                    <Link
                        display={{
                            xs: "none",
                            lg: "flex",
                        }}
                        href="https://x.com/uranoecosystem"
                        underline="none"
                        target="_blank"
                    >
                        <Box
                            sx={{
                                backgroundColor: theme.palette.secondary.main,
                                border: `1px solid ${theme.palette.headerBorder.main}`,
                                borderRadius: 2,
                                paddingX: 1,
                                paddingY: 1,
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                "&:hover": {
                                    background: theme.palette.uranoGradient,
                                    "&:hover .navIcon": {
                                        filter: 'brightness(0)',
                                    },
                                },
                            }}
                        >
                            <PiXLogo size={24} color={theme.palette.text.disabled} className="navIcon" />
                        </Box>
                    </Link>

                    <Link
                        display={{
                            xs: "none",
                            lg: "flex",
                        }}
                        href="https://t.me/UranoEcosystem"
                        underline="none"
                        target="_blank"
                    >
                        <Box
                            sx={{
                                backgroundColor: theme.palette.secondary.main,
                                border: `1px solid ${theme.palette.headerBorder.main}`,
                                borderRadius: 2,
                                paddingX: 1,
                                paddingY: 1,
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                "&:hover": {
                                    background: theme.palette.uranoGradient,
                                    "&:hover .navIcon": {
                                        filter: 'brightness(0)',
                                    },
                                },
                            }}
                        >
                            <PiTelegramLogoDuotone size={24} color={theme.palette.text.disabled} className="navIcon" />
                        </Box>
                    </Link>

                    <MobileMenu />
                </Stack>
            </Stack>
        </>
    )
}

export default Header;
