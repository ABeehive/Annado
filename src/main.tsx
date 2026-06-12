import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TrayPopup } from "./features/tray/TrayPopup";
import { getCurrentWindow } from "@tauri-apps/api/window";

(async () => {
  const label = (await getCurrentWindow()).label;
  const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
  if (label === "tray-popup") {
    root.render(<TrayPopup />);
  } else {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
})();
