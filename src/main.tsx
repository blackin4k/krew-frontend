import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { appStateManager } from "./lib/appState";
import { Capacitor } from "@capacitor/core";

// Initialize app state persistence
if (Capacitor.isNativePlatform()) {
  appStateManager.init();
}

createRoot(document.getElementById("root")!).render(<App />);
