import React, { useEffect } from "react";
import PrintStyles from "./PrintStyles";

interface PrintPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function PrintPreviewModal({
  open,
  onClose,
  title,
  children,
}: PrintPreviewModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <PrintStyles />
      <div className="print-modal-overlay no-print" onClick={onClose}>
        <div className="print-modal" onClick={(e) => e.stopPropagation()}>
          <div className="print-modal-header">
            <h3>{title}</h3>
            <div className="print-modal-actions">
              <button
                onClick={handlePrint}
                className="print-btn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                In
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
          <div className="print-modal-body">
            <div className="print-preview-page">
              {children}
            </div>
          </div>
          <div className="print-modal-footer no-print">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Đóng
            </button>
            <button
              onClick={handlePrint}
              className="print-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              In
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
