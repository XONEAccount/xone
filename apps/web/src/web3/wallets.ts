import { lightTheme } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { APP_NAME } from "@wallet/config";

/**
 * Supported login / wallet options for Connect UI.
 * In-app: email, GitHub, Google, Apple, Discord, phone, passkey, guest…
 * External: MetaMask, Coinbase, Rainbow, WalletConnect, Rabby, Trust.
 */
/**
 * Social OAuth uses redirect (not popup) to avoid COOP / window.closed
 * "Invalid event data" failures in Chrome with Google/GitHub login.
 */
export const appWallets = [
  inAppWallet({
    auth: {
      mode: "redirect",
      redirectUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      options: [
        "email",
        "phone",
        "passkey",
        "github",
        "google",
        "apple",
        "discord",
        "facebook",
        "x",
        "telegram",
        "farcaster",
        "guest",
      ],
    },
    metadata: {
      name: APP_NAME,
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("walletConnect"),
  createWallet("io.rabby"),
  createWallet("com.trustwallet.app"),
];

/**
 * Monochrome Connect UI theme aligned with the product visual language.
 */
export const connectTheme = lightTheme({
  colors: {
    modalBg: "#ffffff",
    borderColor: "#e5e5e5",
    accentText: "#0a0a0a",
    primaryText: "#0a0a0a",
    secondaryText: "#737373",
    secondaryButtonBg: "#f5f5f5",
    secondaryButtonHoverBg: "#ebebeb",
    secondaryButtonText: "#0a0a0a",
    primaryButtonBg: "#0a0a0a",
    primaryButtonText: "#fafafa",
    connectedButtonBg: "#ffffff",
    connectedButtonBgHover: "#f5f5f5",
    selectedTextBg: "#0a0a0a",
    selectedTextColor: "#ffffff",
    skeletonBg: "#f5f5f5",
    separatorLine: "#e5e5e5",
    tertiaryBg: "#fafafa",
    danger: "#dc2626",
    success: "#171717",
    tooltipBg: "#0a0a0a",
    tooltipText: "#fafafa",
    inputAutofillBg: "#ffffff",
    scrollbarBg: "#e5e5e5",
  },
});
