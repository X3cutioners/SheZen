"use client";

import { useEffect } from "react";

/**
 * Registers the SheZen service worker for offline/PWA support.
 * Rendered in the root layout, client-side only.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Temporarily unregister ALL service workers to force a cache clear for the user
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        let unregistered = false;
        for (let registration of registrations) {
          registration.unregister();
          unregistered = true;
        }
        if (unregistered) {
          console.log("[SheZen] Service workers unregistered to clear cache.");
          // Force a hard reload from the server once
          window.location.reload();
        }
      });
    }
  }, []);

  return null;
}
