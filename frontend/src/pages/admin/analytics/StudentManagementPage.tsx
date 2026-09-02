import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  BarChart3,
  Database,
  Search,
  ChevronRight,
  X,
  BarChart2,
} from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Skeleton";
import DataTable from "../../../components/ui/DataTable";
import { Button } from "../../../components/ui/Button";

export default function StudentManagementPage() {
  const navigate = useNavigate();
  const [classSummary, setClassSummary] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resSummary, resStudents] = await Promise.all([
        fetch("http://localhost:8000/api/v1/analytics/class-summary"),
        fetch("http://localhost:8000/api/v1/analytics/students"),
      ]);
      const summary = await resSummary.json();
      const stData = await resStudents.json();
      setClassSummary(summary);
      setStudents(stData.items || []);
      setFilteredStudents(stData.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query) {
      setFilteredStudents(students);
    } else {
      const lowerQuery = query.toLowerCase();
      const filtered = students.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(lowerQuery)) ||
          (s.email && s.email.toLowerCase().includes(lowerQuery)),
      );
      setFilteredStudents(filtered);
    }
  };

  const handleSelectStudent = (student: any) => {
    setSelectedStudents((prev) => {
      const exists = prev.find((s) => s.name === student.name);
      if (exists) {
        return prev.filter((s) => s.name !== student.name);
      } else {
        if (prev.length >= 4) {
          alert("Chỉ được chọn tối đa 4 thí sinh để so sánh");
          return prev;
        }
        return [...prev, student];
      }
    });
  };

  const columns = useMemo(
    () => [
      {
        header: "",
        key: "select",
        width: "40px",
        render: (row: any) => {
          const isSelected = selectedStudents.some((s) => s.name === row.name);
          return (
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
              checked={isSelected}
              onChange={() => handleSelectStudent(row)}
            />
          );
        },
      },
      {
        header: "STT",
        key: "stt",
        width: "60px",
        render: (row: any) => (
          <span className="font-medium text-slate-500">{row.stt}</span>
        ),
      },
      {
        header: "Họ và tên",
        key: "name",
        render: (row: any) => (
          <span className="font-bold text-slate-900 dark:text-white">
            {row.name}
          </span>
        ),
      },
      {
        header: "Toán (IRT)",
        key: "irt_toan",
        render: (row: any) => (
          <Badge variant={row.irt_toan ? "default" : "secondary"}>
            {row.irt_toan ? row.irt_toan.toFixed(1) : "N/A"}
          </Badge>
        ),
      },
      {
        header: "TDKH (IRT)",
        key: "irt_tdkh",
        render: (row: any) => (
          <Badge variant={row.irt_tdkh ? "success" : "secondary"}>
            {row.irt_tdkh ? row.irt_tdkh.toFixed(1) : "N/A"}
          </Badge>
        ),
      },
      {
        header: "Tổng điểm",
        key: "total",
        render: (row: any) => {
          const total = (row.irt_toan || 0) + (row.irt_tdkh || 0);
          return (
            <span className="font-bold text-primary-600 dark:text-primary-400">
              {total > 0 ? total.toFixed(1) : "N/A"}
            </span>
          );
        },
      },
      {
        header: "Thao tác",
        key: "actions",
        width: "120px",
        render: (row: any) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate(`/admin/students/${encodeURIComponent(row.name)}`)
            }
            className="hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/20"
          >
            Chi tiết <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ),
      },
    ],
    [navigate, selectedStudents],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const handleCompare = () => {
    if (selectedStudents.length < 2) return;
    const names = selectedStudents
      .map((s) => encodeURIComponent(s.name))
      .join(",");
    navigate(`/admin/students/compare?names=${names}`);
  };

  return (
    <div className="space-y-6 relative pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">
            Quản lý Thí sinh
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Tổng quan điểm số lớp học và danh sách kết quả thí sinh
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-6 flex items-center gap-4 border-l-4 border-l-indigo-500 glass-card shadow-lg">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
            <Users className="h-7 w-7 text-indigo-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">
              Tổng số thí sinh
            </p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {classSummary?.total_students || 0}
            </p>
          </div>
        </Card>

        <Card className="p-6 flex items-center gap-4 border-l-4 border-l-primary-500 glass-card shadow-lg">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-500/10">
            <BarChart3 className="h-7 w-7 text-primary-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">
              Trung bình Toán (IRT)
            </p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {classSummary?.avg_toan || 0}
            </p>
          </div>
        </Card>

        <Card className="p-6 flex items-center gap-4 border-l-4 border-l-success-500 glass-card shadow-lg">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-success-50 dark:bg-success-500/10">
            <Database className="h-7 w-7 text-success-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">
              Trung bình TDKH (IRT)
            </p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {classSummary?.avg_tdkh || 0}
            </p>
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-2xl">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Danh sách Thí sinh
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Chọn tối đa 4 thí sinh để so sánh
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Tìm kiếm theo Tên..."
              className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>
        <div className="p-6">
          <DataTable
            data={filteredStudents}
            columns={columns}
            keyExtractor={(item: any) => item.name}
            isLoading={isLoading}
            emptyMessage="Không tìm thấy thí sinh nào."
          />
        </div>
      </Card>

      {/* Floating Compare Button */}
      {selectedStudents.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="glass-card shadow-2xl rounded-full border border-primary-500/30 p-2 flex items-center gap-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
            <div className="flex -space-x-2 pl-2">
              {selectedStudents.map((s, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-400"
                  title={s.name}
                >
                  {s.name.charAt(0)}
                </div>
              ))}
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Đã chọn {selectedStudents.length} / 4
            </p>
            <div className="flex gap-2">
              <Button
                variant="default"
                className="rounded-full px-6 shadow-lg shadow-primary-500/30"
                onClick={handleCompare}
                disabled={selectedStudents.length < 2}
              >
                <BarChart2 className="w-4 h-4 mr-2" /> So sánh
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-slate-500"
                onClick={() => setSelectedStudents([])}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
