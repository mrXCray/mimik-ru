import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// Mimik RU Extra, distributed by AFI Distribution.
const PUBLISHER = "AFI Distribution";
const CONTACT_EMAIL = "dm@afi-d.ru";
const HOMEPAGE_URL = "https://github.com/mrXCray/mimik-ru";
// Public half of the signing key: pins the Chrome/Brave extension ID to
// iifnohaefakanhlkanmfmkdankejanek wherever the unpacked folder lives, so
// saved guides survive moving or re-extracting it.
const CHROME_PUBLIC_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt+9ilpXTmbhbIwJNvqpdJgSvsb6kx7eqGQqjAtdqIm237DCJrlSLwNMjQ3mUI8+bjO/RcdFr1KMHO8ruDHZcyiBASbQPatTT0gJuPz1/wz8P6d2gQBW5bXCmb7XjmUV0rgHA7Acs1XU4k0ldj7BfJ2sOQr6VvVwBJdsSNYvarfWPWZNQ4lFS90pZeW6Fr4jvtl8DC/n+RrQU/mLOQ6LmxK3KwG66sPgo5ENAYiip8JkuAlp1L6KvL6/jw4VhyEyJMxlcKJR1JgGjErUrkuBkLUmgMvMRsP1ttjTwkmsnDXrPnQ/lQGm4TUD8U4IjQUl3r8X0n4uNUigGHR7VoYdYwQIDAQAB";

export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/i18n/module"],
  srcDir: "src",
  imports: false,
  webExt: {
    chromiumArgs: ['--user-data-dir=/tmp/mimik-dev-profile', '--window-size=1280,800', '--window-position=0,0', '--force-device-scale-factor=1.25'],
  },
  zip: {
    excludeSources: [
      "mockups/**",
      "docs/**",
      ".claude/**",
      ".planning/**",
      ".worktrees/**",
      "CLAUDE.md",
      "AGENTS.md",
      "CONTRIBUTING.md",
    ],
  },
  alias: {
    '@': 'src',
    canvg: 'src/core/export/empty.ts',
    html2canvas: 'src/core/export/empty.ts',
    dompurify: 'src/core/export/empty.ts',
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      if (wxt.config.browser === 'firefox' && manifest.sidebar_action) {
        (manifest.sidebar_action as Record<string, unknown>).open_at_install = false;
        (manifest.sidebar_action as Record<string, unknown>).default_icon = 'icon32.png';
      }
    },
  },
  manifest: ({ browser }) => {
    const isFirefox = browser === 'firefox';
    return {
      name: "__MSG_app_store_title__",
      description: "__MSG_app_description__",
      default_locale: "en",
      homepage_url: HOMEPAGE_URL,
      ...(isFirefox
        ? { author: PUBLISHER, developer: { name: PUBLISHER, url: HOMEPAGE_URL } }
        : { author: { email: CONTACT_EMAIL }, key: CHROME_PUBLIC_KEY }),
      permissions: [
        "storage",
        "activeTab",
        "tabs",
        "scripting",
        "unlimitedStorage",
        "webNavigation",
        ...(isFirefox ? [] : ["sidePanel", "offscreen"]),
      ],
      ...(isFirefox
        ? { optional_host_permissions: ["<all_urls>"] }
        : { host_permissions: ["<all_urls>"], minimum_chrome_version: "118" }),
      icons: {
        16: 'icon16.png',
        32: 'icon32.png',
        48: 'icon48.png',
        128: 'icon128.png',
      },
      action: {},
      ...(isFirefox
        ? {
            sidebar_action: {
              default_panel: "sidepanel.html",
              default_icon: "icon32.png",
              default_title: "Mimik",
              open_at_install: false,
            },
            browser_specific_settings: {
              gecko: {
                // Own ID so this build can be signed on AMO and sits beside the upstream add-on.
                id: process.env.MIMIK_GECKO_ID || "mimik-ru@afi-d.ru",
                strict_min_version: "128.0",
                data_collection_permissions: {
                  required: ["websiteActivity"],
                  optional: [
                    "websiteContent",
                    "personallyIdentifyingInfo",
                  ],
                },
              },
            },
          }
        : {
            side_panel: {
              default_path: "sidepanel/index.html",
            },
          }),
    };
  },
});
