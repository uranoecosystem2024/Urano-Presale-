'use client'

import { Stack, Typography, Link, Box } from "@mui/material"
import Image from "next/image"
import logo from "@/assets/images/logos/logo-turquoise-1.webp"
import { useTheme, type Theme } from '@mui/material/styles';
import arb from "@/assets/images/arbdao.webp"
import MobileMenu from "@/components/MobileMenu";
import { ConnectButton, useActiveAccount, useConnectModal } from "thirdweb/react";
import { client } from "@/lib/thirdwebClient";
import { arbitrum } from "thirdweb/chains";

const AdminHeader = () => {
  const theme = useTheme<Theme>();
  const account = useActiveAccount();
  const { connect } = useConnectModal();

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" width={{ xs: "100vw", lg: "100%" }} sx={{
        backgroundColor: theme.palette.background.paper,
        borderTop: { xs: "none", lg: `1px solid ${theme.palette.headerBorder.main}` },
        borderBottom: `1px solid ${theme.palette.headerBorder.main}`,
        borderLeft: { xs: "none", lg: `1px solid ${theme.palette.headerBorder.main}` },
        borderRight: { xs: "none", lg: `1px solid ${theme.palette.headerBorder.main}` },
        borderRadius: 2,
        paddingX: { xs: 2, lg: 5 },
        marginLeft: { xs: -2, lg: 0 },
      }}>
        <Link href="https://www.uranoecosystem.com/">
          <Image src={logo} alt="Logo" width={120} height={70} />
        </Link>

        <Stack direction="row" justifyContent="end" alignItems="center" gap={1}>
          <Link display={{ xs: "none", lg: "flex" }} href="https://www.arbitrumhub.io/" underline="none" target="_blank">
            <Box sx={{
              backgroundColor: theme.palette.background.default,
              border: `1px solid ${theme.palette.headerBorder.main}`,
              borderRadius: 2,
              paddingX: 1,
              paddingY: 0.2,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Image src={arb} alt="Arb" width={120} height={40} />
            </Box>
          </Link>

          {!account ? (
            <Link
              href="/"
              underline="none"
              onClick={async (e) => {
                e.preventDefault();
                await connect({ client, chain: arbitrum });
              }}
            >
              <Box sx={{
                background: { xs: theme.palette.uranoGradient, lg: theme.palette.secondary.main },
                border: `1px solid ${theme.palette.headerBorder.main}`,
                borderRadius: 2,
                paddingX: { xs: 1.5, lg: 2 },
                paddingY: { xs: 1.5, lg: 1 },
                marginLeft: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                "&:hover": {
                  background: theme.palette.uranoGradient,
                  "&:hover .connectWalletLink": { color: theme.palette.info.main },
                },
              }}>
                <Typography
                  variant="body1"
                  fontWeight={400}
                  className="connectWalletLink"
                  sx={{ color: { xs: theme.palette.background.default, lg: theme.palette.text.disabled } }}
                >
                  Connect Wallet
                </Typography>
              </Box>
            </Link>
          ) : (
            <ConnectButton client={client} chain={arbitrum} />
          )}

          <MobileMenu />
        </Stack>
      </Stack>
    </>
  )
}

export default AdminHeader;
