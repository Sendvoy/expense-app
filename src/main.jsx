import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../ynab-clone.jsx";

// localStorage polyfill for window.storage
// The app uses window.storage.get/set — this bridges it to localStorage
if (!window.storage) {
  window.storage = {
    get: async (key) => {
      try {
        const value = localStorage.getItem(key);
        return value !== null ? { value } : null;
      } catch {
        return null;
      }
    },
    set: async (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // ignore quota errors
      }
    },
  };
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
