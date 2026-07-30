import "./style.css";

export default defineContentScript({
  matches: ["*://qis.hochschule-trier.de/*"],
  runAt: "document_end",
  main() {
    // TODO: migrate layout_script.js
  },
});
