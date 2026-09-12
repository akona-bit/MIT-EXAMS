export default function PrintStyles() {
  return (
    <style>{`
      /* ===== Print Preview Shared Styles ===== */
      .print-preview-page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 15mm;
        background: white;
        font-family: "Times New Roman", Times, serif;
        font-size: 12pt;
        line-height: 1.5;
        color: #000;
        box-sizing: border-box;
      }

      .print-preview-page h1 {
        font-size: 16pt;
        font-weight: bold;
        text-align: center;
        margin: 0 0 8pt 0;
      }

      .print-preview-page h2 {
        font-size: 14pt;
        font-weight: bold;
        margin: 0 0 6pt 0;
      }

      .print-preview-page h3 {
        font-size: 12pt;
        font-weight: bold;
        margin: 0 0 4pt 0;
      }

      /* ===== Table Styles ===== */
      .print-table {
        width: 100%;
        border-collapse: collapse;
        margin: 8pt 0;
        font-size: 10pt;
      }

      .print-table th,
      .print-table td {
        border: 1px solid #000;
        padding: 4pt 6pt;
        text-align: left;
        vertical-align: top;
      }

      .print-table th {
        background-color: #f0f0f0;
        font-weight: bold;
        text-align: center;
      }

      .print-table td.center {
        text-align: center;
      }

      .print-table tr:nth-child(even) {
        background-color: #fafafa;
      }

      /* ===== Matrix Spec Table ===== */
      .matrix-table th {
        background-color: #e8e8e8;
      }

      .matrix-table .part-header {
        background-color: #d0d0d0;
        font-weight: bold;
        text-align: center;
      }

      .matrix-table .total-row {
        background-color: #e0e0e0;
        font-weight: bold;
      }

      /* ===== Answer Sheet (OMR) ===== */
      .omr-sheet {
        font-family: Arial, sans-serif;
      }

      .omr-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        border-bottom: 2px solid #000;
        padding-bottom: 8pt;
        margin-bottom: 12pt;
      }

      .omr-header-left {
        font-size: 10pt;
      }

      .omr-header-right {
        text-align: right;
      }

      .omr-exam-code {
        border: 2px solid #000;
        padding: 4pt 12pt;
        font-weight: bold;
        font-size: 14pt;
        display: inline-block;
      }

      .omr-sbd-row {
        display: flex;
        gap: 20pt;
        margin-bottom: 12pt;
      }

      .omr-sbd-field {
        flex: 1;
      }

      .omr-sbd-field label {
        font-size: 10pt;
        font-weight: bold;
        display: block;
        margin-bottom: 4pt;
      }

      .omr-sbd-field .dotfill {
        border-bottom: 1px solid #000;
        min-height: 16pt;
      }

      .omr-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 2pt;
        margin: 8pt 0;
      }

      .omr-question {
        display: flex;
        align-items: center;
        gap: 4pt;
        font-size: 9pt;
      }

      .omr-question-num {
        width: 20pt;
        text-align: right;
        font-weight: bold;
      }

      .omr-bubble {
        width: 12pt;
        height: 12pt;
        border: 1.5px solid #000;
        border-radius: 50%;
        display: inline-block;
        text-align: center;
        line-height: 12pt;
        font-size: 7pt;
        font-weight: bold;
      }

      .omr-footer {
        margin-top: 12pt;
        font-size: 9pt;
        font-style: italic;
        text-align: center;
        border-top: 1px solid #000;
        padding-top: 6pt;
      }

      /* ===== Essay Answer Sheet ===== */
      .essay-header {
        text-align: center;
        margin-bottom: 12pt;
      }

      .essay-info-row {
        display: flex;
        gap: 16pt;
        margin-bottom: 6pt;
        font-size: 11pt;
      }

      .essay-info-row label {
        font-weight: bold;
      }

      .essay-info-row .dotfill {
        flex: 1;
        border-bottom: 1px solid #000;
      }

      .essay-answers {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 2pt 12pt;
        font-size: 10pt;
      }

      .essay-answer-item {
        display: flex;
        align-items: center;
        gap: 4pt;
      }

      .essay-answer-num {
        font-weight: bold;
        width: 24pt;
      }

      .essay-checkbox {
        width: 10pt;
        height: 10pt;
        border: 1.5px solid #000;
        display: inline-block;
      }

      /* ===== Stats Preview ===== */
      .stats-summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8pt;
        margin: 8pt 0;
      }

      .stats-card {
        border: 1px solid #ccc;
        padding: 6pt;
        text-align: center;
        border-radius: 4pt;
      }

      .stats-card .value {
        font-size: 18pt;
        font-weight: bold;
        color: #1a56db;
      }

      .stats-card .label {
        font-size: 9pt;
        color: #666;
      }

      /* ===== Passage Preview ===== */
      .passage-content {
        margin-bottom: 12pt;
        padding-bottom: 8pt;
        border-bottom: 1px solid #ccc;
      }

      .passage-content table {
        width: 100%;
        border-collapse: collapse;
        margin: 8pt 0;
      }

      .passage-content table th,
      .passage-content table td {
        border: 1px solid #000;
        padding: 4pt 6pt;
      }

      .passage-content table th {
        background-color: #f0f0f0;
        font-weight: bold;
      }

      .passage-source {
        text-align: right;
        font-size: 9pt;
        font-style: italic;
        color: #666;
        margin-top: 4pt;
      }

      .question-block {
        margin-bottom: 10pt;
      }

      .question-block .question-text {
        font-weight: bold;
        margin-bottom: 4pt;
      }

      .question-block .answers-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 2pt 16pt;
        margin-left: 16pt;
        font-size: 11pt;
      }

      .question-block .answer-item {
        display: flex;
        gap: 4pt;
      }

      .question-block .answer-letter {
        font-weight: bold;
      }

      /* ===== Print Button ===== */
      .print-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background-color: #1a56db;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .print-btn:hover {
        background-color: #1e40af;
      }

      .print-btn:disabled {
        background-color: #9ca3af;
        cursor: not-allowed;
      }

      /* ===== Modal ===== */
      .print-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .print-modal {
        background: white;
        border-radius: 8px;
        width: 95vw;
        max-width: 900px;
        max-height: 95vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }

      .print-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
      }

      .print-modal-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .print-modal-actions {
        display: flex;
        gap: 8px;
      }

      .print-modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: #e5e7eb;
      }

      .print-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 20px;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
      }

      @media print {
        body * {
          visibility: hidden;
        }

        .print-preview-page,
        .print-preview-page * {
          visibility: visible;
        }

        .print-preview-page {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          margin: 0;
          padding: 15mm;
          box-shadow: none;
          border: none;
        }

        .no-print {
          display: none !important;
        }

        @page {
          size: A4;
          margin: 0;
        }
      }
    `}</style>
  );
}
