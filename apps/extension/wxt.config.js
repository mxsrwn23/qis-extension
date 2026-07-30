import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  manifest: {
    default_locale: "de",
    permissions: ["storage"],
    host_permissions: ["*://qis.hochschule-trier.de/*"],
    icons: {
      48: "icon-48.png",
      96: "icon-96.png",
      128: "icon-128.png",
    },
  },
});
