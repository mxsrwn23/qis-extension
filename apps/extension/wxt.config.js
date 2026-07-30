import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  manifest: {
    name: "__MSG_extension_name__",
    description: "__MSG_extension_description__",
    default_locale: "de",
    permissions: ["storage"],
    host_permissions: ["*://qis.hochschule-trier.de/*"],
    icons: {
      48: "icon-48.png",
      96: "icon-96.png",
      128: "icon-128.png",
      256: "icon-256.png",
      512: "icon-512.png",
    },
  },
});
