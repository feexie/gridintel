"use client";

import { useEffect } from "react";

/* Presentation mode: while it is on the page, the navigation around the screen is hidden
   (globals.css, html[data-present]) so a recording shows the finding and its figures only. */
export function PresentMode() {
  useEffect(() => {
    document.documentElement.dataset.present = "1";
    return () => {
      delete document.documentElement.dataset.present;
    };
  }, []);
  return null;
}
