import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        // Precache the app shell plus every fingering diagram so the core
        // convert flow works fully offline after the first load.
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
      },
      manifest: {
        name: "Ocarina Tab Converter",
        short_name: "Ocarina Tabs",
        description: "Convert a note sequence into an ocarina fingering tab.",
        start_url: "/",
        display: "standalone",
        background_color: "#f5efe0",
        theme_color: "#f5efe0",
        icons: [
          { src: "tabs/12hole_C5.png", sizes: "192x192", type: "image/png" },
          { src: "tabs/12hole_C5.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});
