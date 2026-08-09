# UI Design Tokens

> Nguồn chân lý duy nhất cho màu sắc, typography, spacing. Không định nghĩa giá trị mới ngoài file này khi build UI — nếu thiếu, bổ sung vào đây trước, rồi mới dùng trong code.

## Màu sắc

### Primary (thương hiệu — điều chỉnh nếu có brand guide riêng)
- `primary-50`  #EEF4FF
- `primary-100` #D9E6FF
- `primary-300` #7FA8FF
- `primary-500` #2D6CFF  ← màu chính (nút, link, active state)
- `primary-700` #1B45B3
- `primary-900` #0F2966

### Neutral (nền, chữ, viền)
- `neutral-0`   #FFFFFF
- `neutral-50`  #F7F8FA
- `neutral-100` #EEF0F3
- `neutral-300` #C7CCD4
- `neutral-500` #8A93A3
- `neutral-700` #4A5261
- `neutral-900` #1A1F29

### Semantic (BẮT BUỘC dùng đúng ngữ nghĩa, không đảo màu)
- `success-500` #1BA672 — câu đúng, thao tác thành công, trạng thái "Đã duyệt"
- `danger-500`  #E5484D — câu sai, lỗi, trạng thái "Từ chối"
- `warning-500` #F5A623 — cảnh báo, trạng thái "Chờ duyệt", câu bỏ trống
- `info-500`    #2D9BFF — thông báo trung tính

### Biểu đồ/thống kê (dùng cho 4 phần thi — nhất quán trên toàn hệ thống)
- Tiếng Việt: `#2D6CFF` (xanh dương)
- Tiếng Anh: `#E5484D` (đỏ)
- Toán học: `#F5A623` (cam)
- Tư duy khoa học: `#1BA672` (xanh lá)

## Typography

- Font chữ: `Inter` (UI chung); `Times New Roman`/`Noto Serif` cho nội dung đề thi khi xuất PDF/in ấn (giữ đúng chuẩn trình bày đề thi truyền thống mà thí sinh quen thuộc).
- Scale: `text-xs` 12px · `text-sm` 14px · `text-base` 16px · `text-lg` 18px · `text-xl` 20px · `text-2xl` 24px · `text-3xl` 30px.
- Line-height: 1.5 cho nội dung dài (câu hỏi, đoạn văn), 1.2 cho heading.

## Spacing scale (đơn vị 4px, theo Tailwind mặc định)
`1` 4px · `2` 8px · `3` 12px · `4` 16px · `6` 24px · `8` 32px · `12` 48px · `16` 64px

## Border radius
- `radius-sm` 4px (input, badge)
- `radius-md` 8px (card, button)
- `radius-lg` 16px (modal, panel lớn)

## Shadow
- `shadow-sm` — card thường
- `shadow-md` — dropdown, popover
- `shadow-lg` — modal

## Breakpoints (mobile-first)
- `sm` 640px · `md` 768px · `lg` 1024px · `xl` 1280px

> Lưu ý riêng cho **trang thi (exam-taking)**: ưu tiên layout ≥ `md` (làm bài trên máy tính/tablet là chính); vẫn phải responsive nhưng không cần tối ưu sâu cho màn hình < 375px.
