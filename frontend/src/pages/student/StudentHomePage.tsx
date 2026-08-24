import { useEffect, useState } from "react";
import { useAuth } from "../../stores/authStore";
import { getExams } from "../../api/exams";
import client from "../../api/client";
import type { Exam } from "../../types";

function formatExamWindow(startTime: string | null, endTime: string | null) {
  if (!startTime && !endTime) return "Thời gian linh hoạt";

  const formatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (startTime && endTime) {
    return `${formatter.format(new Date(startTime))} - ${formatter.format(new Date(endTime))}`;
  }

  return formatter.format(new Date(startTime || endTime || ""));
}

export default function StudentHomePage() {
  const { user, logout } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingExamId, setStartingExamId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const loadExams = async () => {
      try {
        const data = await getExams(0, 50, "PUBLISHED");
        setExams(data.items);
      } catch {
        setError("Không tải được danh sách kỳ thi. Vui lòng thử lại.");
      } finally {
        setIsLoading(false);
      }
    };

    loadExams();
  }, [retryKey]);

  const handleStart = async (exam: Exam) => {
    setStartingExamId(exam.id);
    setNotice("");
    try {
      const response = await client.post<{ form_code: string }>(
        `/api/v1/exams/${exam.id}/start`,
      );
      setNotice(
        `Đã nhận mã đề ${response.data.form_code}. Phòng thi đang được chuẩn bị.`,
      );
    } catch (requestError: unknown) {
      const detail =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError
          ? (requestError as { response?: { data?: { detail?: string } } })
              .response?.data?.detail
          : undefined;
      setNotice(detail || "Bạn chưa được đăng ký trong kỳ thi này.");
    } finally {
      setStartingExamId(null);
    }
  };

  return (
    <div className="student-shell min-h-screen text-neutral-900">
      <header className="border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-lg font-bold text-white shadow-lg shadow-primary-500/25">
              M
            </div>
            <div>
              <p className="font-bold tracking-tight">MIT EXAMS</p>
              <p className="text-xs text-neutral-500">Khu vực thí sinh</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-neutral-600 sm:block">
              {user?.username || user?.email}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8 lg:py-10">
        <section className="relative overflow-hidden rounded-2xl bg-neutral-900 px-6 py-8 text-white shadow-lg sm:px-10">
          <div className="relative z-10 max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary-300">
              Bảng điều khiển thí sinh
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Chào {user?.username || "bạn"}.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-300 sm:text-base">
              Các kỳ thi được mở cho bạn sẽ xuất hiện tại đây. Hãy kiểm tra thời
              lượng và thời gian trước khi bắt đầu.
            </p>
          </div>
          <div className="absolute inset-y-0 right-0 w-1/3 bg-primary-500/10 [clip-path:polygon(40%_0,100%_0,100%_100%,0_100%)]" />
        </section>

        {notice && (
          <div
            className="rounded-xl border border-info-500/20 bg-info-500/10 px-4 py-3 text-sm text-info-500"
            role="status"
          >
            {notice}
          </div>
        )}

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-primary-500">
                Kỳ thi của bạn
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                Sẵn sàng chinh phục
              </h2>
            </div>
            {!isLoading && (
              <span className="text-sm text-neutral-500">
                {exams.length} kỳ thi đang mở
              </span>
            )}
          </div>

          {isLoading && (
            <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
              Đang tải kỳ thi...
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-danger-500/20 bg-danger-500/10 p-8 text-center">
              <p className="text-sm text-danger-500">{error}</p>
              <button
                type="button"
                onClick={() => setRetryKey((key) => key + 1)}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-danger-500 shadow-sm transition hover:bg-danger-500 hover:text-white"
              >
                Thử lại
              </button>
            </div>
          )}
          {!isLoading && !error && exams.length === 0 && (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
              <p className="font-semibold text-neutral-900">
                Chưa có kỳ thi đang mở
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Kỳ thi được phân công sẽ hiển thị ở đây.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {exams.map((exam) => (
              <article
                key={exam.id}
                className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-semibold text-success-500">
                      Đang mở
                    </span>
                    <h3 className="mt-4 text-lg font-bold text-neutral-900">
                      {exam.name}
                    </h3>
                  </div>
                  <span className="text-2xl font-bold text-primary-500">
                    {exam.duration_minutes}
                    <span className="ml-1 text-xs font-medium text-neutral-500">
                      phút
                    </span>
                  </span>
                </div>
                <p className="mt-3 min-h-12 text-sm leading-6 text-neutral-600">
                  {exam.description || "Bài thi trắc nghiệm MIT EXAMS."}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
                  <svg
                    className="h-4 w-4 text-primary-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {formatExamWindow(exam.start_time, exam.end_time)}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4">
                  <span className="text-xs text-neutral-500">
                    Mã kỳ thi #{exam.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStart(exam)}
                    disabled={startingExamId === exam.id}
                    className="rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    {startingExamId === exam.id ? "Đang vào..." : "Bắt đầu thi"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
