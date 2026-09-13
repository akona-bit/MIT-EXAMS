import { useState, useCallback, useRef, useEffect } from "react";
import { searchApi, type SearchResult, type StudentSearchResult, type ExamSearchResult } from "../../api/search";
import StudentDetailModal from "./StudentDetailModal";

interface SearchBarProps {
  onSelectResult?: (result: ExamSearchResult) => void;
}

export default function SearchBar({ onSelectResult }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"exams" | "students">("exams");
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    try {
      const data = await searchApi.search(searchQuery.trim());
      setResults(data);
      setIsOpen(true);
      if (data.exams.length > 0) setActiveTab("exams");
      else if (data.students.length > 0) setActiveTab("students");
    } catch (error) {
      console.error("Search error:", error);
      setResults(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      PUBLISHED: { label: "Dang mo", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
      COMPLETED: { label: "Da ket thuc", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
      SUBMITTED: { label: "Da nop", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
      IN_PROGRESS: { label: "Dang thi", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    };
    const info = statusMap[status] || { label: status, color: "bg-slate-100 text-slate-600" };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
        {info.label}
      </span>
    );
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const totalResults = results
    ? results.exams.length + results.students.length
    : 0;

  return (
    <>
      <div ref={searchRef} className="relative w-full max-w-md">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => results && setIsOpen(true)}
            placeholder="Tim kiem ky thi, hoc sinh..."
            className="block w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <svg className="animate-spin h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}
          {query && !isSearching && (
            <button
              onClick={() => {
                setQuery("");
                setResults(null);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {isOpen && results && totalResults > 0 && (
          <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden animate-in slide-in-from-top-2 duration-200">
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setActiveTab("exams")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "exams"
                    ? "text-primary-600 border-b-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Ky thi ({results.exams.length})
              </button>
              <button
                onClick={() => setActiveTab("students")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "students"
                    ? "text-primary-600 border-b-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Hoc sinh ({results.students.length})
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {activeTab === "exams" && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {results.exams.map((exam) => (
                    <button
                      key={exam.id}
                      onClick={() => onSelectResult?.(exam)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {exam.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(exam.status)}
                            {exam.form_codes.length > 0 && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {exam.form_codes.length} ma de
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {exam.submission_count} bai thi
                          </p>
                          {exam.start_time && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              {formatDate(exam.start_time)}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === "students" && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {results.students.map((student) => (
                    <button
                      key={student.user_id}
                      onClick={() => setSelectedStudent(student)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-white">
                            {getInitials(student.full_name)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {student.full_name || "Chua cap nhat"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {student.exams.length} ky thi da tham gia
                          </p>
                        </div>
                        {student.exams.length > 0 && student.exams[0].score !== null && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                              {student.exams[0].score.toFixed(0)}
                            </p>
                            <p className="text-xs text-slate-400">diem</p>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {totalResults === 0 && (
              <div className="px-4 py-8 text-center">
                <svg className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Khong tim thay ket qua cho "{results.query}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </>
  );
}
