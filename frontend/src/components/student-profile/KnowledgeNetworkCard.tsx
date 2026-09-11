import { useState, useEffect } from "react";
import { getKnowledgeNetwork, type KnowledgeNetworkResponse, type KnowledgeMasteryItem } from "../../api/studentProfile";
import { Loader2, BookOpen, AlertTriangle, Clock, CheckCircle2, ChevronDown, ExternalLink } from "lucide-react";
import { AnswerDetailDrawer } from "../../features/student-profile/components/AnswerDetailDrawer";

const STATUS_CONFIG = {
  overdue_review: {
    label: "Ôn trước",
    icon: AlertTriangle,
    color: "text-rose-500",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
  },
  upcoming_review: {
    label: "Ôn tiếp theo",
    icon: Clock,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
  },
  on_track: {
    label: "Ngang mặt bằng",
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
  },
};

function TopicMasteryRow({ item, onClick }: { item: KnowledgeMasteryItem, onClick: (item: KnowledgeMasteryItem) => void }) {
  const total = item.correct_count + item.wrong_count + item.blank_count;
  const correctPct = total > 0 ? (item.correct_count / total) * 100 : 0;
  const wrongPct = total > 0 ? (item.wrong_count / total) * 100 : 0;
  const blankPct = total > 0 ? (item.blank_count / total) * 100 : 0;

  const config = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.on_track;

  return (
    <div 
      className="py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 -mx-2 rounded-lg transition-colors"
      onClick={() => onClick(item)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <config.icon className={`w-4 h-4 ${config.color}`} />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {item.topic_name}
          </span>
          {item.topic_subject && (
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {item.topic_subject}
            </span>
          )}
        </div>
        <span className="text-xs font-bold text-slate-500">
          sai {item.wrong_count} · trống {item.blank_count} / {item.total_attempts} lượt
        </span>
      </div>

      {/* 3-color progress bar */}
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
        {correctPct > 0 && (
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${correctPct}%` }}
          />
        )}
        {wrongPct > 0 && (
          <div
            className="h-full bg-rose-400 transition-all duration-300"
            style={{ width: `${wrongPct}%` }}
          />
        )}
        {blankPct > 0 && (
          <div
            className="h-full bg-slate-300 dark:bg-slate-600 transition-all duration-300"
            style={{ width: `${blankPct}%` }}
          />
        )}
      </div>

      {/* Last wrong info */}
      {item.last_wrong && (
        <div className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />
          Sai câu {item.last_wrong.question_number}, {item.last_wrong.exam_label}
        </div>
      )}
    </div>
  );
}

export default function KnowledgeNetworkCard({ studentId }: { studentId: number }) {
  const [data, setData] = useState<KnowledgeNetworkResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [selectedNode, setSelectedNode] = useState<KnowledgeMasteryItem | null>(null);

  const loadData = (status?: string | null, limit = 6) => {
    setIsLoading(true);
    getKnowledgeNetwork(studentId)
      .then((res) => {
        // filter data on frontend if needed, backend returns all
        let filteredItems = res.items || [];
        if (status) {
          filteredItems = filteredItems.filter((i: KnowledgeMasteryItem) => i.status === status);
        }
        if (!showAll) {
          filteredItems = filteredItems.slice(0, limit);
        }
        setData({ ...res, items: filteredItems });
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData(activeStatus);
  }, [studentId, activeStatus, showAll]);

  if (isLoading && !data) {
    return (
      <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-[#faf9fd] dark:bg-slate-900/80 p-6 flex items-center justify-center min-h-[200px] shadow-sm">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-[#faf9fd] dark:bg-slate-900/80 p-6 flex flex-col items-center justify-center min-h-[200px] text-center shadow-sm hover:shadow-md transition-shadow">
        <div className="relative mb-5 flex items-center justify-center">
          <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-900/30 blur-xl rounded-full scale-150"></div>
          <BookOpen className="w-12 h-12 text-indigo-400 dark:text-indigo-500 relative z-10" strokeWidth={1.5} />
        </div>
        <p className="text-slate-500 text-sm">Chưa có dữ liệu mạng lưới kiến thức</p>
      </div>
    );
  }

  const tabs = [
    { key: null, label: "Tất cả", count: data.summary.total },
    { key: "overdue_review", label: "Ôn trước", count: data.summary.overdue_review, color: "text-rose-500" },
    { key: "upcoming_review", label: "Ôn tiếp theo", count: data.summary.upcoming_review, color: "text-amber-500" },
    { key: "on_track", label: "Ngang mặt bằng", count: data.summary.on_track, color: "text-emerald-500" },
  ];

  return (
    <div className="rounded-3xl border border-slate-200/60 dark:border-slate-800 bg-[#faf9fd] dark:bg-slate-900/80 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Mạng lưới kiến thức của học sinh
          </h3>
          <p className="text-xs text-slate-500">
            Đang theo dõi <span className="font-bold text-slate-900 dark:text-white">{data.summary.total}</span> phần
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {tabs.slice(1).map((tab) => {
          const config = STATUS_CONFIG[tab.key as keyof typeof STATUS_CONFIG];
          return (
            <div
              key={tab.key}
              className={`p-3 rounded-xl border ${config.border} ${config.bg} cursor-pointer transition-all hover:shadow-md ${activeStatus === tab.key ? "ring-2 ring-primary-500 shadow-md" : ""}`}
              onClick={() => setActiveStatus(activeStatus === tab.key ? null : tab.key)}
            >
              <div className={`text-2xl font-black ${config.color}`}>{tab.count}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{tab.label}</div>
            </div>
          );
        })}
      </div>

      {/* Tab filter bar */}
      <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key || "all"}
            onClick={() => setActiveStatus(tab.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeStatus === tab.key
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-3 text-[10px] font-semibold text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded-full bg-emerald-500" />
          Đúng
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded-full bg-rose-400" />
          Sai
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded-full bg-slate-300" />
          Trống
        </span>
      </div>

      {/* Items list */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center z-10 rounded-xl">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        )}
        {data.items.length === 0 ? (
          <div className="py-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            Học sinh chưa có kết quả bài thi nào để phân tích.
          </div>
        ) : (
          <>
            {data.items.map((item) => (
              <TopicMasteryRow key={item.id} item={item} onClick={setSelectedNode} />
            ))}
          </>
        )}
      </div>

      {/* Show all toggle */}
      {data.has_more && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <ChevronDown className="w-4 h-4" />
          Xem tất cả {data.summary.total} phần
        </button>
      )}

      {/* Detail Drawer */}
      <AnswerDetailDrawer
        studentId={studentId}
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
