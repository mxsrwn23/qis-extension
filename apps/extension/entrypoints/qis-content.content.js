import "./qis-content.css";

export default defineContentScript({
  matches: ["*://qis.hochschule-trier.de/*"],
  runAt: "document_idle",
  main() {
    // TODO: migrate content_script.js + settings.js
  },
});
