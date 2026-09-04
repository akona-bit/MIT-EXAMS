# UI Redesign & Notification System Plan

## Tổng quan

**Mục tiêu:** Nâng cấp toàn bộ UI Admin + Student, thêm hệ thống thông báo (bell), thay thế `alert()`/`window.confirm()` bằng component chuẩn, fixing frontend-backend mismatches.

**Thời gian ước tính:** 5 giai đoạn

---

## Phase 1 — Nền tảng: UI Components + Notification Store

### 1.1 Tạo các UI component thiếu

| Component | File | Mô tả |
|-----------|------|--------|
| `Select` | `components/ui/Select.tsx` | Dropdown với label, error state, glass style |
| `Textarea` | `components/ui/Textarea.tsx` | Textarea với label, error state |
| `Tabs` | `components/ui/Tabs.tsx` | Tab group component (thay vì inline button groups) |
| `Toast` | `components/ui/Toast.tsx` | Toast notification stack (thay `alert()`) |
| `Alert` | `components/ui/Alert.tsx` | Inline alert banner (success/error/warning/info) |

### 1.2 Tạo Notification Store + Bell Component

**Notification Store** (`stores/notificationStore.tsx`):
- `Notification` type: `{ id, type, title, message, detail?, read, created_at, sender_id? }`
- State: `notifications[]`, `unreadCount`
- Actions: `addNotification()`, `markAsRead()`, `markAllRead()`, `fetchNotifications()`
- WebSocket listener cho real-time notifications từ server
- Polling fallback (mỗi 30s) nếu WebSocket disconnect

**NotificationBell** (`components/ui/NotificationBell.tsx`):
- Bell icon + unread count badge
- Click → dropdown danh sách notifications
- Mỗi notification: avatar, title, message, thời gian, unread dot
- Click notification → mở modal chi tiết
- Tab: Tất cả / Chưa đọc / Đã đọc

**NotificationDetailModal** (`components/ui/NotificationDetailModal.tsx`):
- Hiển thị chi tiết notification: title, message, detail (rich text/markdown), sender, thời gian
- Nút đánh dấu đã đọc
- Nút xóa

### 1.3 Backend: Notification Model + API

**Model** (`models/notification.py`):
```python
class Notification(Base):
    id, recipient_id, sender_id, type, title, message, detail, is_read, created_at
```

**API** (`api/v1/notifications.py`):
- `GET /notifications/` — list notifications (filter by read/unread)
- `GET /notifications/unread-count` — count unread
- `PUT /notifications/{id}/read` — mark as read
- `PUT /notifications/read-all` — mark all as read
- `DELETE /notifications/{id}` — delete
- `POST /notifications/` — admin send notification (to user/role/all)

### 1.4 Thêm Bell vào Layout

- **AdminShell**: Thêm `NotificationBell` vào header (bên trái theme toggle)
- **StudentHomePage**: Thêm `NotificationBell` vào header

---

## Phase 2 — Replace alert()/window.confirm() + Standardize Confirm

### 2.1 Thay thế 67+ `alert()` bằng Toast

Mỗi page thay `alert(message)` bằng `toast.success(message)` / `toast.error(message)`.

**Files cần sửa (có `alert()`):**
- `ExamFormPage.tsx` — alert khi tạo kỳ thi
- `GenerateExamModal.tsx` — alert khi sinh mã đề
- `ExamDetailPage.tsx` — alert publish/delete/error
- `QuestionsPage.tsx` — alert approve/error
- `QuestionFormPage.tsx` — alert create/update/error
- `MatrixPage.tsx` — window.confirm → ConfirmDialog
- `MatrixFormPage.tsx` — alert create/update
- `MatrixDetailPage.tsx` — alert feasibility/error
- `PassagesPage.tsx` — alert delete/error
- `PassageFormPage.tsx` — alert create/update
- `ResourcesPage.tsx` — alert upload/delete
- `KnowledgePage.tsx` — alert create/update/delete
- `AccessControlPage.tsx` — alert invite/update
- `OmrPage.tsx` — alert upload/error
- `SystemSettingsPage.tsx` — alert update
- `AdminFeedbacksPage.tsx` — alert status update
- `StudentHomePage.tsx` — alert start exam/error
- `StudentExamShell.tsx` — alert submit/error
- `StudentFeedbackModal.tsx` — alert submit

### 2.2 Thay thế `window.confirm()` bằng ConfirmDialog

**Files hiện dùng `window.confirm()`:**
- `MatrixPage.tsx` — confirm delete matrix
- `KnowledgePage.tsx` — confirm delete node
- `QuestionsPage.tsx` — confirm delete question
- `PassagesPage.tsx` — confirm delete passage

→ Thay bằng `<ConfirmDialog>` component có sẵn.

### 2.3 Thêm ConfirmDialog cho các action nguy hiểm

Các action cần confirm nhưng CHƯA có:
- `ExamDetailPage`: Publish exam, Delete exam, Complete exam
- `AccessControlPage`: Ban/unban student, Delete staff, Toggle is_active
- `OmrPage`: Reject sheet
- `SystemSettingsPage`: Update critical settings
- `StudentExamShell`: Submit exam (confirm trước khi nộp)

---

## Phase 3 — Fix Frontend-Backend Mismatches

### 3.1 API URL fixes

| File | Vấn đề | Fix |
|------|--------|-----|
| `api/resources.ts` | Thiếu `/api/v1/` prefix | Thêm prefix |
| `TeacherAnalyticsPage.tsx` | Hardcode `localhost:8000` | Dùng axios client |
| `AdvancedAnalyticsPage.tsx` | Hardcode `localhost:8000` | Dùng axios client |

### 3.2 Missing API client functions

| Function | Endpoint | Ghi chú |
|----------|----------|---------|
| `getNotifications()` | `GET /notifications/` | Cho notification bell |
| `getUnreadCount()` | `GET /notifications/unread-count` | Badge count |
| `markAsRead(id)` | `PUT /notifications/{id}/read` | |
| `markAllRead()` | `PUT /notifications/read-all` | |
| `deleteNotification(id)` | `DELETE /notifications/{id}` | |
| `sendNotification(data)` | `POST /notifications/` | Admin only |
| `getExamForms(examId)` | Already exists | Verify contract |
| `deleteExam(id)` | Missing | `DELETE /exams/{id}` |
| `updateExam(id, data)` | Missing | `PUT /exams/{id}` |
| `completeExam(id)` | Missing | `PUT /exams/{id}/complete` |
| `getExamParticipants(examId)` | Verify match | Check admin.ts |

### 3.3 Type definitions

- Consolidate inline types into `types/index.ts`
- Add `Notification` type
- Add missing exam-related types

---

## Phase 4 — UI Polish & Consistency

### 4.1 Student Layout Shell

Tạo `StudentShell.tsx` layout component:
- Header với logo, tên kỳ thi (contextual), NotificationBell, user menu
- Consistent background, typography
- Wrap tất cả student routes

### 4.2 Admin UI Consistency Audit

Mỗi admin page kiểm tra:
- Dùng đúng `Card`, `Button`, `Badge`, `Input`, `DataTable` thay vì custom HTML
- Dùng `ConfirmDialog` cho mọi destructive action
- Dùng `Toast` cho mọi feedback
- Loading states thống nhất (Skeleton hoặc spinner)
- Empty states thống nhất
- Error states thống nhất

### 4.3 Student UI Consistency Audit

- StudentHomePage: modern card layout, consistent spacing
- StudentExamShell: clean exam UI, accessible
- StudentExamResultPage: score cards, review list

---

## Phase 5 — Notification Features (Admin Send + Detail View)

### 5.1 Admin Send Notification UI

**Trang mới** (`/admin/notifications`):
- Gửi thông báo đến: 1 user, 1 role (STUDENT/TEACHER/ADMIN), hoặc tất cả
- Form: tiêu đề, nội dung, chi tiết (optional rich text), loại (SYSTEM/EXAM/GRADING/OTHER)
- Danh sách đã gửi với thống kê (đã đọc/chưa đọc)

**Thêm vào Sidebar Admin**: "Thông báo" trong section "Hệ thống"

### 5.2 Notification Detail View

Khi click notification trong bell dropdown:
- Mở modal hiển thị chi tiết
- Nếu là thông báo kỳ thi → link đến trang kỳ thi
- Nếu là thông báo điểm → link đến trang kết quả
- Đánh dấu đã đọc tự động

### 5.3 Real-time Integration

- WebSocket `/ws/notifications` (hoặc extend `/ws/online` hiện có)
- Khi admin gửi notification → push ngay đến recipient qua WebSocket
- Fallback: polling mỗi 30s

---

## Thứ tự thực hiện

1. **Phase 1** (nền tảng): UI components + Notification model/API/store/bell
2. **Phase 2** (clean up): Replace alert/confirm trên TOÀN BỘ pages
3. **Phase 3** (fix): API mismatches, missing endpoints, types
4. **Phase 4** (polish): Layout shell, consistency audit
5. **Phase 5** (features): Admin send notification, detail view, real-time

## Lưu ý

- Mỗi phase commit riêng, test build `npm run build` sau mỗi phase
- Giữ nguyên design system glass-morphism hiện tại
- Không thêm dependency mới (trừ那些 đã có: framer-motion, lucide-react, cmdk, etc.)
- Toast component tự cài, không dùng react-toastify/toast library
