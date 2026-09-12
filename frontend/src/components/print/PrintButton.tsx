import React, { useState } from "react";
import PrintPreviewModal from "./PrintPreviewModal";

interface PrintButtonProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export default function PrintButton({
  title,
  children,
  className,
  disabled,
}: PrintButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={className || "print-btn"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Xem trước khi in
      </button>

      <PrintPreviewModal open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </PrintPreviewModal>
    </>
  );
}
