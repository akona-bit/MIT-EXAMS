# UI Component Registry

> Danh mục component đã có/cần có. Trước khi tạo component mới, kiểm tra bảng này trước để tránh trùng lặp. Agent phải tự cập nhật bảng này (đổi trạng thái, thêm dòng mới) sau khi tạo component.

## Layout
| Component | Mô tả | Props chính | Trạng thái |
|---|---|---|---|
| `AdminShell` | Layout khung admin: sidebar + topbar + content | `children` | Chưa tạo |
| `StudentExamShell` | Layout fullscreen khi làm bài | `timerSeconds`, `children` | Chưa tạo |
| `AuthShell` | Layout trang đăng nhập/đăng ký | `children` | Chưa tạo |

## Data Display
| Component | Mô tả | Props chính | Trạng thái |
|---|---|---|---|
| `DataTable` | Bảng có sort/filter/phân trang/export | `columns`, `data`, `onExport` | Chưa tạo |
| `KpiCard` | Thẻ số liệu tóm tắt (dashboard) | `label`, `value`, `trend` | Chưa tạo |
| `ScoreDistributionChart` | Biểu đồ phổ điểm theo 4 phần thi | `data` | Chưa tạo |
| `QuestionNavGrid` | Lưới điều hướng câu hỏi 1-120 khi thi | `answered[]`, `current`, `onJump` | Chưa tạo |
| `ItemAnalysisTable` | Bảng độ khó/phân biệt/nhiễu theo câu | `items[]` | Chưa tạo |

## Form / Input
| Component | Mô tả | Props chính | Trạng thái |
|---|---|---|---|
| `QuestionEditor` | Soạn thảo câu hỏi (rich text + đáp án + gắn Kiến thức) | `question`, `onSave` | Chưa tạo |
| `MatrixBuilder` | UI xây ma trận đặc tả (Topic→Concept→Skill→số lượng) | `matrix`, `onChange` | Chưa tạo |
| `ResourceUploader` | Upload ngữ liệu (ảnh/PDF/link) | `onUpload` | Chưa tạo |
| `OmrBatchUploader` | Upload hàng loạt ảnh phiếu OMR | `onUploadBatch` | Chưa tạo |

## Feedback
| Component | Mô tả | Props chính | Trạng thái |
|---|---|---|---|
| `ConfirmDialog` | Modal xác nhận 2 bước cho hành động phá huỷ | `title`, `onConfirm` | Chưa tạo |
| `TabExitWarning` | Cảnh báo khi thí sinh thoát tab lúc thi | `count` | Chưa tạo |
| `ReviewFlagBadge` | Badge cảnh báo câu hỏi misfit/SE cao | `severity` | Chưa tạo |

## Exam-specific
| Component | Mô tả | Props chính | Trạng thái |
|---|---|---|---|
| `ExamCard` | Thẻ hiển thị 1 kỳ thi (danh sách) | `exam` | Chưa tạo |
| `AnswerSheetPreview` | Xem trước phiếu OMR đã quét + kết quả đọc, dùng cho review thủ công | `imageUrl`, `detectedAnswers` | Chưa tạo |
