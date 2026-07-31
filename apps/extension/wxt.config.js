import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  manifest: ({ browser }) => ({
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
    ...(browser === "firefox" && {
      version: "1.0.1",
      browser_specific_settings: {
        gecko: {
          id: "qis-extension@mxsrwn23.github.io",
          data_collection_permissions: {
            required: ["none"],
          },
        },
      },
    }),
  }),
});
