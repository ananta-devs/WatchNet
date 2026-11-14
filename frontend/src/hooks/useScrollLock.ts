"use client";

import { useEffect } from "react";

// Maintain a global counter of active modal dialogs so multiple stacked modals
// correctly keep scroll locked until the last one unmounts/closes.
let lockCount = 0;
let previousBodyOverflow = "";
let previousHtmlOverflow = "";

export function useScrollLock(isOpen: boolean = true) {
  useEffect(() => {
    if (!isOpen) return;

    if (lockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      previousHtmlOverflow = document.documentElement.style.overflow;
    }
    lockCount++;

    // Apply scroll lock to both document.body and html
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      lockCount--;
      if (lockCount <= 0) {
        lockCount = 0;
        document.body.style.overflow = previousBodyOverflow || "";
        document.documentElement.style.overflow = previousHtmlOverflow || "";
      }
    };
  }, [isOpen]);
}
