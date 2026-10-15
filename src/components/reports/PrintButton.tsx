"use client";

/* The browser's own print dialog: "Save as PDF" there gives the report as a PDF, on a desktop and
   on a phone. Nothing is sent anywhere. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="gr-button" data-print-report>
      Print or save as PDF
    </button>
  );
}
