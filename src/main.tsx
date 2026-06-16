import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TrayPopup } from "./features/tray/TrayPopup";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

type RuntimePlatform = "macos" | "windows" | "linux" | "other";

function fallbackPlatform(): RuntimePlatform {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("windows")) return "windows";
  if (userAgent.includes("macintosh") || userAgent.includes("mac os")) return "macos";
  if (userAgent.includes("linux")) return "linux";
  return "other";
}

async function applyPlatformDataset() {
  let platform: RuntimePlatform = fallbackPlatform();
  try {
    platform = await invoke<RuntimePlatform>("get_platform");
  } catch {
    // Browser-only test contexts use the user-agent fallback.
  }
  document.documentElement.dataset.platform = platform;
}

(async () => {
  await applyPlatformDataset();
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
