import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import Modal from "../ui/Modal";
import { Button } from "../ui/Button";
import { toast } from "../ui/Toast";
import { getStudents, type StudentItem } from "../../api/admin";
import { assignParticipants } from "../../api/exams";

interface AssignStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: number;
  onSuccess: () => void;
}

export default function AssignStudentsModal({
  isOpen,
  onClose,
  examId,
  onSuccess,
}: AssignStudentsModalProps) {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Pagination states if needed, but for simplicity let's load up to 100 students at a time
  useEffect(() => {
    if (isOpen) {
      loadStudents();
      setSelectedIds(new Set());
      setSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      loadStudents();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      // Limit to 100 to show in the list, can be expanded if needed
      const res = await getStudents({ skip: 0, limit: 100, search });
      setStudents(res.items);
    } catch (error) {
      toast.error("Không thể tải danh sách học sinh");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === students.length && students.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  };

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    try {
      await assignParticipants(examId, Array.from(selectedIds));
      toast.success(`Đã giao đề cho ${selectedIds.size} học sinh thành công!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Giao đề thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Giao đề cho học sinh" maxWidth="max-w-3xl">
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên, SBD, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Student List */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden flex flex-col h-[400px]">
          <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-4">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              checked={selectedIds.size === students.length && students.length > 0}
              onChange={selectAll}
            />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Chọn tất cả ({selectedIds.size}/{students.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary-500" />
                <p>Đang tải danh sách...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <p>Không tìm thấy học sinh nào</p>
              </div>
            ) : (
              students.map((student) => (
                <label
                  key={student.id}
                  className="flex items-center gap-4 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={selectedIds.has(student.id)}
                    onChange={() => toggleSelect(student.id)}
                  />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {student.full_name || student.username}
                      {student.sbd && <span className="ml-2 text-xs font-mono text-slate-500">({student.sbd})</span>}
                    </p>
                    <p className="text-sm text-slate-500">{student.email}</p>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={handleAssign}
            disabled={selectedIds.size === 0 || submitting}
            isLoading={submitting}
          >
            Giao đề ({selectedIds.size})
          </Button>
        </div>
      </div>
    </Modal>
  );
}
