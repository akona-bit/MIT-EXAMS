"""Shared pytest configuration.

Import toàn bộ model module NGAY TỪ ĐẦU process test để mọi relationship
(ví dụ Question -> Passage) được đăng ký trước khi configure_mappers() chạy
lần đầu. App thật import tất cả qua app.main; khi chạy test riêng lẻ, nếu
thiếu import này thì configure_mappers sẽ fail và "poison" các test phía sau
(SQLAlchemy cache trạng thái configure-failed trong toàn bộ process).
"""
import app.models.passage  # noqa: F401
import app.models.omr  # noqa: F401
import app.models.obsidian  # noqa: F401
import app.models.system  # noqa: F401
import app.models.audit  # noqa: F401
import app.models.user  # noqa: F401
import app.models.question  # noqa: F401
import app.models.exam  # noqa: F401
import app.models.grading  # noqa: F401
import app.models.ai  # noqa: F401
import app.models.feedback  # noqa: F401
import app.models.otp  # noqa: F401
import app.models.notification  # noqa: F401
