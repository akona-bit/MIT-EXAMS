# Obsidian AI Memory

## Mục tiêu

Obsidian là vault lưu tri thức và bộ nhớ làm việc cho AI/agent của dự án MIT EXAMS. Web không thay thế Obsidian; web đọc cấu trúc tri thức đã chuẩn hoá từ Obsidian, đưa vào backend, rồi frontend hiển thị lại như một cây/graph kiến thức phục vụ quản lý ngân hàng câu hỏi.

## Ranh giới dữ liệu

- Obsidian lưu: ghi chú kiến thức, frontmatter câu hỏi, liên kết giữa note, quyết định nghiệp vụ, nhật ký suy luận của AI/agent.
- Backend lưu: dữ liệu vận hành chính thức như `KnowledgeNode`, `Question`, `Answer`, `Matrix`, `Exam`, `ExamForm`, `Submission`, `ItemAnalysis`.
- Frontend hiển thị: cây vault, graph link, danh sách câu hỏi, ma trận, kỳ thi và thống kê.

## Quy ước note câu hỏi trong Obsidian

Mỗi file câu hỏi nên có YAML frontmatter:

```yaml
---
type: question
knowledge_node: "Toan_Hoc/Dai_So/Phuong_Trinh"
level: 1
question_type: SINGLE_CHOICE
---
```

Nội dung câu hỏi nằm dưới frontmatter. Đáp án dùng checklist:

```markdown
Nội dung câu hỏi ở đây.

- [ ] Đáp án A
- [x] Đáp án B
- [ ] Đáp án C
- [ ] Đáp án D
```

## Mapping Obsidian sang backend

- `knowledge_node` dạng đường dẫn `/` được import thành cây `KnowledgeNode`.
- Mỗi đoạn trong path là một node: Topic -> Concept -> Skill -> Note nếu sâu hơn.
- File có `type: question` được import thành `Question` và `Answer`.
- Câu hỏi sync từ Obsidian hiện được đánh dấu `APPROVED` để dùng được trong sinh đề.

## API liên kết frontend/backend

- `GET /api/v1/knowledge/tree`: trả cây vault cho sidebar frontend.
- `GET /api/v1/knowledge/graph`: trả node/edge cho graph view kiểu Obsidian.
- `POST /api/v1/obsidian/sync-local-api`: lấy markdown từ Obsidian Local REST API và import vào backend.

## Quy tắc cho AI/agent

- Trước khi sửa nghiệp vụ lớn, đọc `memory-bank/` và note Obsidian liên quan nếu có.
- Khi thêm module mới, cập nhật file này nếu module đó có dữ liệu hoặc convention đi qua Obsidian.
- Không dùng Obsidian làm database thay cho backend. Obsidian là nguồn tri thức và bộ nhớ; backend là nguồn dữ liệu chạy hệ thống.
- Khi đổi format frontmatter, phải cập nhật `backend/app/services/obsidian_parser.py`, frontend hiển thị liên quan và file này cùng lúc.

## Việc còn cần làm

- Lưu `source_file_path`/`obsidian_uri` cho `Question` để click ngược từ web về note Obsidian.
- Parse wikilink `[[...]]` để bổ sung edge thật giữa các note, không chỉ parent-child.
- Thêm trang quản lý Memory/Decision Log cho AI từ vault.
- Đồng bộ hai chiều có kiểm soát: web chỉ nên ghi ngược Obsidian với nhật ký/metadata, không ghi đè nội dung câu hỏi đã dùng trong đề.
