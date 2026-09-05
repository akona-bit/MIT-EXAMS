# UI Component Registry

> Danh mục component đã có/cần có. Trước khi tạo component mới, kiểm tra bảng này trước để tránh trùng lặp. Agent phải tự cập nhật bảng này (đổi trạng thái, thêm dòng mới) sau khi tạo component.
>
> **Cập nhật 2026-09-05:** đồng bộ trạng thái với code thực tế sau đợt UI Redesign 5 phase. Vị trí: `components/ui/`, `components/layout/`, `components/student/`, `components/admin/`.

## Layout
| Component | Mô tả | Props chính | Trạng thái |
|---|---|---|---|
| `AdminShell` | Layout khung admin: sidebar + topbar + content | `children` | ✅ Đã tạo (`layout/AdminShell.tsx`) |
| `StudentShell` | Layout student: logo, bell, user info, logout | `children` | ✅ Đã tạo (`layout/StudentShell.tsx`) |
| `AuthShell` | Layout trang đăng nhập/đăng ký | `children` | ✅ Đã tạo (`layout/AuthShell.tsx`) |
| `StudentExamShell` | Layout fullscreen khi làm bài (kèm timer, watermark, anti-cheat) | — (page, tự fetch session) | ✅ Đã tạo (`pages/student/StudentExamShell.tsx`) |

## Data Display
| Component | Mô tả | Props chính | Trạng thái |
|---|---|---|---|
| `DataTable` | Bảng có sort/filter/phân trang/export | `columns`, `data`, `onExport` | ✅ Đã tạo (`ui/DataTable.tsx`) |
| `Badge` | Badge trạng thái (variant: default/destructive/warning/info) | `variant`, `children` | ✅ Đã tạo (`ui/Badge.tsx`) |
| `Skeleton` | Loading placeholder | `className` | ✅ Đã tạo (`ui/Skeleton.tsx`) |
| `PageSkeleton` | Skeleton nguyên trang | `variant` | ✅ Đã tạo (`ui/PageSkeleton.tsx`) |
| `EmptyState` | Trạng thái trống thống nhất | `icon`, `title`, `message`, `action` | ✅ Đã tạo (`ui/EmptyState.tsx`) |
| `ErrorState` | Trạng thái lỗi + retry | `title`, `message`, `onRetry` | ✅ Đã tạo (`ui/ErrorState.tsx`) |
| `QuestionNavGrid` | Lưới điều hướng câu hỏi 1-120 khi thi | `questions`, `savedAnswers`, `flaggedQuestions`, `currentIndex`, `onSelect` | ✅ Đã tạo (`student/QuestionNavGrid.tsx`) |
| `QuestionRenderer` | Render câu hỏi mọi định dạng (SINGLE/MULTI/TRUE_FALSE/COMPOSITE/FILL_IN_BLANK) | `question`, `answer`, `onChange` | ✅ Đã tạo (`student/QuestionRenderer.tsx`) |
| `KpiCard` | Thẻ số liệu tóm tắt (dashboard) | `label`, `value`, `trend` | Chưa tạo |
| `ScoreDistributionChart` | Biểu đồ phổ điểm theo 4 phần thi | `data` | Chưa tạo (dùng tạm inline Plotly/Recharts trong analytics pages) |
| `ItemAnalysisTable` | Bảng độ khó/phân biệt/nhiễu theo câu | `items[]` | Chưa tạo (inline trong ExamDetailPage tab IRT) |

## Form / Input
| Component | Mô tả | Props chính | Trạng thái |
|---|---|---|---|
| `Input` | Input với label, error state | `label`, `error`, ... | ✅ Đã tạo (`ui/Input.tsx`) |
| `Select` | Dropdown với label, error state | `label`, `options`, `error` | ✅ Đã tạo (`ui/Select.tsx`) |
| `Textarea` | Textarea với label, error state | `label`, `error` | ✅ Đã tạo (`ui/Textarea.tsx`) |
| `MarkdownEditor` | Editor soạn nội dung (TipTap + KaTeX + image) | `value`, `onChange` | ✅ Đã tạo (`editor/MarkdownEditor.tsx`) |
| `KnowledgeNodeSelector` | Combobox tìm kiếm node tri thức (primary + secondary) | `primaryValue`, `onPrimaryChange`, `secondaryValue`, `onSecondaryChange` | ✅ Đã tạo (`admin/question/KnowledgeNodeSelector.tsx`) |
| `MatrixNodeSelector` | Chọn node tri thức cho ma trận | `selectedIds`, `onChange` | ✅ Đã tạo (`admin/MatrixNodeSelector.tsx`) |
| `SmartMatrixWizard` | Wizard sinh ma trận tự động (scope → propose → confirm) | `isOpen`, `onClose` | ✅ Đã tạo (`admin/SmartMatrixWizard.tsx`) |
| `ResourceUploader` | Upload ngữ liệu (ảnh/PDF/link) | `onUpload` | Chưa tạo (inline trong ResourcesPage) |
| `OmrBatchUploader` | Upload hàng loạt ảnh phiếu OMR | `onUploadBatch` | Chưa tạo (inline trong OmrPage) |

## Feedback
| Component | Mô tả | Props chính | Trạng thái |
|---|---|---|---|
| `Toast` / `toast.*` | Toast notification stack (thay `alert()`) — `toast.success/error/warning/info(title, message?)` | — | ✅ Đã tạo (`ui/Toast.tsx`) |
| `ConfirmDialog` | Modal xác nhận (2 bước cho hành động phá huỷ, thay `window.confirm`) | `isOpen`, `title`, `message`, `isDestructive`, `onConfirm`, `onCancel` | ✅ Đã tạo (`ui/ConfirmDialog.tsx`) |
| `Alert` | Inline alert banner (success/error/warning/info) | `variant`, `title`, `children` | ✅ Đã tạo (`ui/Alert.tsx`) |
| `Modal` | Modal gốc dùng chung | `isOpen`, `onClose`, `title`, `maxWidth` | ✅ Đã tạo (`ui/Modal.tsx`) |
| `ErrorBoundary` | Bắt lỗi render React | `children` | ✅ Đã tạo (`ui/ErrorBoundary.tsx`) |
| `NotificationBell` + `NotificationDetailModal` | Bell + unread badge + dropdown + modal chi tiết | — | ✅ Đã tạo (`layout/NotificationBell.tsx`) |
| `TabExitWarning` | Cảnh báo khi thí sinh thoát tab lúc thi | `count` | Chưa tạo (inline banner trong StudentExamShell) |
| `ReviewFlagBadge` | Badge cảnh báo câu hỏi misfit/SE cao | `severity` | Chưa tạo (inline badge trong ExamDetailPage) |

## Exam-specific
| Component | Mô tả | Props chính | Trạng thái |
|---|---|---|---|
| `ExamCard` | Thẻ hiển thị 1 kỳ thi (danh sách) | `exam` | Chưa tạo (inline trong ExamsPage/StudentHomePage) |
| `AnswerSheetPreview` | Xem trước phiếu OMR đã quét + kết quả đọc | `imageUrl`, `detectedAnswers` | Chưa tạo (inline trong OmrPage) |
| `GenerateExamModal` | Modal sinh mã đề theo ma trận | `isOpen`, `examId`, `matrixId`, `hasExistingForms`, `onSuccess` | ✅ Đã tạo (`admin/GenerateExamModal.tsx`) |
| `StudentFeedbackModal` | Modal góp ý của thí sinh trong/khi nộp bài | `isOpen`, `examSessionId` | ✅ Đã tạo (`student/StudentFeedbackModal.tsx`) |
