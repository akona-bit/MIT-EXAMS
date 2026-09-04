Created At: 2026-09-04T06:44:19+07:00
Completed At: 2026-09-04T06:44:19+07:00
File Path: `file:///d:/MIT/frontend/src/pages/admin/KnowledgePage.tsx`
Total Lines: 1466
Total Bytes: 66779
Showing lines 800 to 830
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
800:     onSuccess: () => {
801:       queryClient.invalidateQueries({ queryKey: ["knowledgeGraph"] });
802:     },
803:   });
804: 
805:   const handleCreateNote = (event: FormEvent<HTMLFormElement>) => {
806:     event.preventDefault();
807:     if (!noteName.trim()) return;
808:     const parent_id =
809:       noteParentId === "none" ? undefined : parseInt(noteParentId, 10);
810:     createNoteMutation.mutate({
811:       name: noteName.trim(),
812:       description: noteDescription.trim() || undefined,
813:       parent_id: parent_id,
814:       node_type: noteType,
815:       subject: noteSubject || undefined,
816:     });
817:   };
818: 
819:   return (
820:     <div
821:       className={`space-y-6 transition-colors duration-300 ${isDarkMode ? "dark" : ""}`}
822:     >
823:       <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
824:         <div>
825:           <h1 className="text-3xl font-extrabold text-gradient pb-1">
826:             Cấu trúc Kiến thức
827:           </h1>
828:           <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
829:             Không gian trực quan để khám phá các chủ đề, liên kết và ngữ cảnh
830:             tri thức trong hệ thống.
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.

} from "lucide-react";

import {
  useMemo,
  useState,
  type FormEvent,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import {
  createKnowledgeNode,
  getKnowledgeGraph,
  deleteKnowledgeNode,
  updateKnowledgeNode,
  deleteManualLink,
} from "../../api/knowledge";
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "../../types";
import { useTheme } from "../../stores/themeStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Share2,
  FileText,
  Link as LinkIcon,
  Database,
  CheckCircle2,
  ChevronRight,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Play,
  Pause,
  Target,
  X,
  Trash2,
  GitBranch,
  Timer,
  Network,
} from "lucide-react";

const levelLabels: Record<string, string> = {
  TOPIC: "Chủ đề",
  CONCEPT: "Khái niệm",
  SKILL: "Kỹ năng",
};

const levelColors: Record<string, string> = {
  TOPIC: "#f97316", // Orange-500 — nổi bật, ấm
  CONCEPT: "#8b5cf6", // Violet-500 — tím mát
  SKILL: "#10b981", // Emerald-500 — xanh lá tươi
  SUB_SKILL: "#06b6d4", // Cyan-500 — xanh cyan
};

const DEFAULT_NODE_COLOR = "#64748b"; // Slate-500 fallback

        <span className="mt-0.5 block truncate text-[10px] text-slate-500 dark:text-slate-400">
          {node.path}
        </span>
        {node.description && (
          <span className="mt-1 block text-[10px] text-slate-400 dark:text-slate-500 truncate italic">
            {node.description}
          </span>
        )}
      </span>
      {node.question_count > 0 && (
        <span
          className={`flex h-5 items-center justify-center rounded-full px-2 text-[10px] font-bold transition-colors ${active ? "bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:text-slate-700"}`}
        >
          {node.question_count}
        </span>
      )}
    </motion.button>
  );
}

function GraphCanvas({
  isDarkMode,
}: {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isDarkMode: boolean;
}) {
  const fgRef = useRef<ForceGraphMethods>();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [isPhysicsActive, setIsPhysicsActive] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [replayProgress, setReplayProgress] = useState(-1);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    setDimensions({ width: clientWidth, height: clientHeight });

    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update physics configuration when graph ref mounts
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force("charge")?.strength(-800);
      fgRef.current.d3Force("link")?.distance(100);
    }
  }, [fgRef.current]);

  useEffect(() => {
    if (replayProgress >= 0 && replayProgress < nodes.length) {
      const timer = setTimeout(
        () => {
          setReplayProgress((p) => p + 1);
        },
        Math.max(80, 4000 / nodes.length),
      ); // scale speed, ~4 seconds total max
      return () => clearTimeout(timer);
    } else if (replayProgress === nodes.length) {
      const timer = setTimeout(() => {
        setReplayProgress(-1);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [replayProgress, nodes.length]);

  const chronologicalNodes = useMemo(() => {
    return [...nodes].sort((a, b) => a.entity_id - b.entity_id);
  }, [nodes]);

  const graphData = useMemo(() => {
    let currentNodes = nodes;
    if (replayProgress !== -1) {
      currentNodes = chronologicalNodes.slice(0, replayProgress);
    }

    const nodeIds = new Set(currentNodes.map((n) => n.id));
    const currentEdges = edges.filter((e: any) => {
      const sourceId =
        typeof e.source === "object" ? e.source.id : e.source;
      const targetId =
        typeof e.target === "object" ? e.target.id : e.target;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    return {
      nodes: currentNodes.map((n) => ({
        ...n,
        id: n.id,
        name: n.label,
        val: (n.question_count || 1) * 1.5,
      })),
      links: currentEdges.map((e: any) => ({ source: e.source, target: e.target })),
    };
  }, [nodes, edges, replayProgress, chronologicalNodes]);

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isSelected = node.id === selectedId;
      const isHovered = node.id === hoverNode;
      const label = node.name;
      const hasNote = !!node.description;
      const fontSize = 12 / globalScale;
      const nodeColor = levelColors[node.type] ?? DEFAULT_NODE_COLOR;

      // --- Measure main label ---
      ctx.font = `${isSelected || isHovered ? "600 " : "500 "}${fontSize}px Inter, system-ui, sans-serif`;
      const textWidth = ctx.measureText(label).width;

      // --- Measure description (truncated) ---
      const descFontSize = fontSize * 0.78;
      let descText = "";
      let descWidth = 0;
      if (hasNote) {
        const raw =
          node.description.length > 40
            ? node.description.slice(0, 38) + "…"
            : node.description;
        descText = raw;
        ctx.font = `400 ${descFontSize}px Inter, system-ui, sans-serif`;
        descWidth = ctx.measureText(descText).width;
      }

      // --- Node pill dimensions ---
      const paddingX = fontSize * 1.6;
      const paddingY = fontSize * 0.8;
      const accentWidth = 4 / globalScale;
      const contentWidth = Math.max(textWidth, descWidth);
      const badgeSpace = node.question_count > 0 ? fontSize * 2.5 : 0;
      const totalWidth = contentWidth + paddingX * 2 + accentWidth + badgeSpace;
      const lineSpacing = hasNote ? descFontSize * 1.4 : 0;
      const totalHeight = fontSize + paddingY * 2 + lineSpacing;
      const radius = 8 / globalScale;
      const x = node.x - totalWidth / 2;
      const y = node.y - totalHeight / 2;

      // Save dimensions for pointer hit area
      node.__bckgDimensions = [totalWidth, totalHeight];

      // --- Shadow / Glow ---
      if (isSelected) {
        ctx.shadowColor = nodeColor;
        ctx.shadowBlur = 24 / globalScale;
      } else if (isHovered) {
        ctx.shadowColor = isDarkMode
          ? "rgba(255,255,255,0.12)"
          : "rgba(0,0,0,0.1)";
        ctx.shadowBlur = 14 / globalScale;
      } else {
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
      }

      // --- Background pill ---
      ctx.beginPath();
      ctx.roundRect(x, y, totalWidth, totalHeight, radius);
      if (isSelected) {
        ctx.fillStyle = isDarkMode
          ? "rgba(15, 23, 42, 0.96)"
          : "rgba(255, 255, 255, 0.99)";
      } else if (isHovered) {
        ctx.fillStyle = isDarkMode
          ? "rgba(30, 41, 59, 0.95)"
          : "rgba(248, 250, 252, 0.98)";
      } else {
        ctx.fillStyle = isDarkMode
          ? "rgba(15, 23, 42, 0.88)"
          : "rgba(255, 255, 255, 0.94)";
      }
      ctx.fill();

      // Border — use nodeColor tint when selected
      ctx.strokeStyle = isSelected
        ? nodeColor
        : isDarkMode
          ? "rgba(51,65,85,0.5)"
          : "rgba(226,232,240,0.7)";
      ctx.lineWidth = (isSelected ? 2 : 1) / globalScale;
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      // --- Colored accent bar (left edge) ---
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, accentWidth + radius, totalHeight, [
        radius,
        0,
        0,
        radius,
      ]);
      ctx.clip();
      ctx.fillStyle = nodeColor;
      ctx.fillRect(x, y, accentWidth, totalHeight);
      ctx.restore();

      // --- Label text ---
      const labelY = hasNote ? node.y - lineSpacing / 2 : node.y;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isDarkMode ? "#f1f5f9" : "#1e293b";
      ctx.font = `${isSelected || isHovered ? "600 " : "500 "}${fontSize}px Inter, system-ui, sans-serif`;
      ctx.fillText(label, x + accentWidth + paddingX * 0.6, labelY);

      // --- Description text (second line, dimmer) ---
      if (hasNote && descText) {
        ctx.font = `400 italic ${descFontSize}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = isDarkMode ? "#94a3b8" : "#64748b";
        ctx.fillText(
          descText,
          x + accentWidth + paddingX * 0.6,
          labelY + fontSize * 1.3,
        );
      }

      // --- Question count badge (right side) ---
      if (node.question_count > 0) {
        const badgeText = String(node.question_count);
        const badgeFontSize = fontSize * 0.75;
        ctx.font = `700 ${badgeFontSize}px Inter, system-ui, sans-serif`;
        const badgeTextWidth = ctx.measureText(badgeText).width;
        const badgePad = badgeFontSize * 0.6;
        const badgeW = badgeTextWidth + badgePad * 2;
        const badgeH = badgeFontSize + badgePad;
        const badgeX = x + totalWidth - badgeW - paddingX * 0.35;
        const badgeY = labelY - badgeH / 2;

        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeH / 2);
        ctx.fillStyle = nodeColor + "20";
        ctx.fill();

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = nodeColor;
        ctx.fillText(badgeText, badgeX + badgeW / 2, labelY);
      }

      // --- Red dot ABOVE the node (top center) for nodes with notes ---
      if (hasNote) {
        const dotR = 4.5 / globalScale;
        const dotX = node.x;
        const dotY = y - dotR - 2 / globalScale;
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = isDarkMode ? "#0f172a" : "#ffffff";
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }
    },
    [selectedId, hoverNode, isDarkMode],
  );

  if (nodes.length === 0) {
              const isActive =
                (selectedId &&
                  (link.source.id === selectedId ||
                    link.target.id === selectedId)) ||
                (hoverNode &&
                  (link.source.id === hoverNode ||
                    link.target.id === hoverNode));
              return isActive ? 3 : 0;
            }}
            linkDirectionalParticleWidth={2.5}
            linkDirectionalParticleSpeed={0.004}
            linkDirectionalParticleColor={(link: any) => {
              return (
                levelColors[link.target?.type] ??
                (isDarkMode ? "#94a3b8" : "#64748b")
              );
            }}
            linkDirectionalArrowLength={(link: any) => {
              const isActive =
                (selectedId &&
                  (link.source.id === selectedId ||
                    link.target.id === selectedId)) ||
                (hoverNode &&
                  (link.source.id === hoverNode ||
                    link.target.id === hoverNode));
              return isActive ? 5 : 3;
            }}
            linkDirectionalArrowRelPos={1}
            onNodeClick={(node) => {
              onSelect(node.id);
              fgRef.current?.centerAt(node.x, node.y, 800);
              fgRef.current?.zoom(3.5, 800);
            }}
            enableNodeDrag={true}
            onNodeDrag={() => {
              if (!isPhysicsActive && fgRef.current) {
                fgRef.current.d3ReheatSimulation();
              }
            }}
            onNodeDragEnd={(node) => {
              node.fx = node.x;
              node.fy = node.y;
            }}
            onNodeHover={(node) => {
              if (containerRef.current)
                containerRef.current.style.cursor = node
                  ? "pointer"
                  : "default";
              setHoverNode(node ? (node.id as string) : null);
            }}
            onEngineStop={() => {
              if (isPhysicsActive && !selectedId) {
                fgRef.current?.zoomToFit(600, 60);
              }
            }}
            d3VelocityDecay={isPhysicsActive ? 0.3 : 1}
            cooldownTicks={isPhysicsActive ? undefined : 0}
          />
        </div>

        {/* Toolbar Overlay */}
        <div className="absolute right-4 top-4 z-20 flex flex-col gap-2">
          <div className="flex flex-col rounded-lg border border-white/60 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 shadow-sm backdrop-blur p-1">
            <button
              type="button"
              title="Tái hiện lịch sử hình thành (Timelapse)"
              className={`p-1.5 rounded transition-colors ${replayProgress !== -1 ? "text-primary-500 bg-primary-50 dark:bg-primary-900/30" : "text-slate-500 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
              onClick={() => {
                if (replayProgress === -1) {
                  setReplayProgress(1);
                  fgRef.current?.zoom(1.5, 1000);
          </span>
        </div>
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  const { isDarkMode } = useTheme();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewNote, setShowNewNote] = useState(false);
  const [noteName, setNoteName] = useState("");
  const [noteDescription, setNoteDescription] = useState("");
  const [noteType, setNoteType] = useState("TOPIC");
  const [noteError, setNoteError] = useState("");
  const [noteParentId, setNoteParentId] = useState<string>("none");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingParent, setIsEditingParent] = useState(false);
  const [newParentId, setNewParentId] = useState<string>("none");
  const [isLinking, setIsLinking] = useState(false); // linking mode
  const [editingNote, setEditingNote] = useState<string | null>(null); // note text being edited
  const [isEditingNote, setIsEditingNote] = useState(false);
  const queryClient = useQueryClient();
  const graphQuery = useQuery({
    queryKey: ["knowledgeGraph"],
    queryFn: getKnowledgeGraph,
  });
  const allNodes = graphQuery.data?.nodes ?? [];
  const allEdges = graphQuery.data?.edges ?? [];

  const visibleNodes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return allNodes.filter((node) => {
      const matchesSearch =
        !normalizedSearch ||
        node.label.toLowerCase().includes(normalizedSearch) ||
        node.path.toLowerCase().includes(normalizedSearch);
      return (
      setIsEditingNote(false);
      setEditingNote(null);
      queryClient.invalidateQueries({ queryKey: ["knowledgeGraph"] });
    },
    onError: (error: unknown) => {
      alert(error instanceof Error ? error.message : "Không lưu được ghi chú.");
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: deleteManualLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeGraph"] });
    },
  });

  const handleCreateNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!noteName.trim()) return;
    const parent_id =
      noteParentId === "none" ? undefined : parseInt(noteParentId, 10);
    createNoteMutation.mutate({
      name: noteName.trim(),
      description: noteDescription.trim() || undefined,
      parent_id: parent_id,
      node_type: noteType,
      subject: noteSubject || undefined,
    });
  };
  return (
    <div
      className={`space-y-6 transition-colors duration-300 ${isDarkMode ? "dark" : ""}`}
    >
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient flex items-center gap-3 pb-1">
            <Network className="w-8 h-8 text-primary-500" />
            Cấu trúc Kiến thức
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Không gian trực quan để khám phá các chủ đề, liên kết và ngữ cảnh
            tri thức trong hệ thống.
          </p>
        </div>
              </span>
            )}
          </div>

          {selectedNode ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
                    {selectedNode.label}
                  </h2>
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 rounded-lg p-2 border border-slate-200/50 dark:border-slate-700/50">
                    <Database className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="break-all">{selectedNode.path}</span>
                  </p>
                  {selectedNode.description && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic">
                      {selectedNode.description}
                    </p>
                  )}
                </div>

                {/* --- Ghi chú (Note) section --- */}
                <div className="rounded-xl border border-amber-200/50 dark:border-amber-700/30 bg-amber-50/50 dark:bg-amber-900/10 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Ghi chú
                    </span>
                    {!isEditingNote && (
                      <button
                        onClick={() => {
                          setIsEditingNote(true);
                          setEditingNote(selectedNode.note || "");
                        }}
                        className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                      >
                        {selectedNode.note ? "Sửa" : "+ Thêm ghi chú"}
                      </button>
                    )}
                  </div>
                    <option value="Lịch sử">Lịch sử</option>
                    <option value="Địa lý">Địa lý</option>
                    <option value="Giáo dục công dân">Giáo dục công dân</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Liên kết tới Node cha
                  </label>
                  <select
                    value={noteParentId}
                    onChange={(e) => setNoteParentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all cursor-pointer"
                  >
                    <option value="none">-- Không liên kết (Root) --</option>
                    {allNodes.map((node) => (
                      <option key={node.id} value={node.entity_id}>
                        {node.path || node.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Mô tả (tuỳ chọn)
                  </label>
                  <textarea
                    value={noteDescription}
                    onChange={(event) => setNoteDescription(event.target.value)}
                    rows={3}
                    placeholder="Nhập ghi chú cho node này..."
                    className="w-full resize-none rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
                  />
                </div>
                {noteError && (
                  <p className="text-sm font-medium text-red-500">
                    {noteError}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowNewNote(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={createNoteMutation.isPending}
                  className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50 transition-colors shadow-lg shadow-primary-500/30"
                >
                  {createNoteMutation.isPending ? "Đang xử lý..." : "Tạo mới"}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px] mt-6">
        <aside className="flex flex-col overflow-hidden h-[600px] glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-2xl">
          <div className="p-4 border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Danh sách Node
              </h2>
              <span className="inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {visibleNodes.length}/{allNodes.length}
              </span>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm kiếm theo tên, đường dẫn..."
              aria-label="Tìm note"
              className="w-full rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20 transition-all"
            />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Lọc loại note"
              className="mt-2.5 w-full rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20 transition-all cursor-pointer"
            >
              <option value="ALL">Tất cả loại node</option>
              <option value="TOPIC">Chủ đề (Topic)</option>
              <option value="CONCEPT">Khái niệm (Concept)</option>
              <option value="SKILL">Kỹ năng (Skill)</option>
              <option value="SUB_SKILL">Kỹ năng con (Sub-skill)</option>
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {graphQuery.isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent"></div>
                <p className="text-xs font-medium">Đang tải dữ liệu...</p>
              </div>
            )}
            {graphQuery.isError && (
              <p className="p-4 text-center text-sm font-medium text-danger-500">
                Không tải được dữ liệu graph.
              </p>
            )}
            {visibleNodes.map((node) => (
              <NodePill
                key={node.id}
                node={node}
                active={node.id === selectedNode?.id}
                onClick={() => setSelectedId(node.id)}
              />
            ))}
            {!graphQuery.isLoading && visibleNodes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 opacity-60">
                <FileText className="h-8 w-8" />
                <p className="text-xs font-medium">Không có note phù hợp</p>
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0">
          <GraphCanvas
            nodes={visibleNodes}
            edges={allEdges}
            selectedId={selectedNode?.id ?? null}
            onSelect={setSelectedId}
            isDarkMode={isDarkMode}
          />
        </main>

        <aside className="flex flex-col h-[600px] overflow-y-auto custom-scrollbar p-5 glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-2xl">
          <div className="flex items-center justify-between mb-5 shrink-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
              Chi tiết Node
            </p>
            {selectedNode && (
              <span
                className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm"
                style={{
                  color: levelColors[selectedNode.type] ?? levelColors.NOTE,
                  backgroundColor: `${levelColors[selectedNode.type] ?? levelColors.NOTE}20`,
                  border: `1px solid ${levelColors[selectedNode.type] ?? levelColors.NOTE}40`,
                }}
              >
                {levelLabels[selectedNode.type] ?? selectedNode.type}
              </span>
            )}
          </div>

          {selectedNode ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
                    {selectedNode.label}
                  </h2>
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 rounded-lg p-2 border border-slate-200/50 dark:border-slate-700/50">
                    <Database className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="break-all">{selectedNode.path}</span>
                  </p>
                  {selectedNode.description && (
                      <Trash2 className="h-4 w-4" />
                      {isDeleting ? "Đang xóa..." : "Xóa Node này"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
              <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Share2 className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Chọn một node trên graph
                <br />
                để xem chi tiết và liên kết
              </p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

                    <div className="space-y-2">
                      <textarea
                        value={editingNote || ""}
                        onChange={(e) => setEditingNote(e.target.value)}
                        rows={3}
                        placeholder="Nhập ghi chú cho node này..."
                        className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setIsEditingNote(false);
                            setEditingNote(null);
                          }}
                          className="flex-1 rounded-lg bg-slate-200 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={() =>
                            updateNoteMutation.mutate({
                              id: selectedNode.entity_id,
                              note: editingNote?.trim() || null,
                            })
                          }
                          disabled={updateNoteMutation.isPending}
                          className="flex-1 rounded-lg bg-amber-500 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-600 transition-colors"
                        >
                          {updateNoteMutation.isPending
                            ? "Lưu..."
                            : "Lưu ghi chú"}
                        </button>
                      </div>
                    </div>
                  ) : selectedNode.note ? (
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {selectedNode.note}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Chưa có ghi chú
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-gradient-to-b from-white/80 to-white/40 dark:from-slate-800/80 dark:to-slate-800/40 p-4 border border-white/60 dark:border-slate-700/50 shadow-sm transition-all hover:shadow-md">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      <FileText className="h-3.5 w-3.5 text-primary-500" />
                      Questions
                    </p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">
                      {selectedNode.question_count}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-b from-white/80 to-white/40 dark:from-slate-800/80 dark:to-slate-800/40 p-4 border border-white/60 dark:border-slate-700/50 shadow-sm transition-all hover:shadow-md">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      <Share2 className="h-3.5 w-3.5" />
                      Connections
                    </p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">
                      {connectedNodes.length}
                    </p>
                  </div>
                </div>

                {/* --- Manual Link section --- */}
                <div className="pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <LinkIcon className="h-3.5 w-3.5" /> Liên kết thủ công
                    </p>
                    <button
                      onClick={() => setIsLinking(!isLinking)}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${isLinking ? "bg-primary-500 text-white" : "text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"}`}
                        >
                          Hủy
                        </button>
                        <button
                          onClick={() =>
                            updateParentMutation.mutate({
                              id: selectedNode.entity_id,
                              parent_id:
                                newParentId === "none"
                                  ? null
                                  : parseInt(newParentId),
                            })
                          }
                          className="flex-1 rounded-lg bg-primary-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-primary-500 transition-colors"
                        >
                          {updateParentMutation.isPending ? "Lưu..." : "Lưu"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditingParent(true)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      Chuyển liên kết (Đổi node cha)
                    </button>
                  )}

                  <div className="pt-2 border-t border-red-200/30 dark:border-red-900/30 mt-2">
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Bạn có chắc chắn muốn xóa node "${selectedNode.label}" không? Tất cả liên kết với node con sẽ bị ngắt.`,
                          )
                        ) {
                          setIsDeleting(true);
                          deleteNoteMutation.mutate(selectedNode.entity_id);
                        }
                      }}
                      disabled={isDeleting}
                      className="w-full flex justify-center items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      {isDeleting ? "Đang xóa..." : "Xóa Node này"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
              <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Share2 className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Chọn một node trên graph
                <br />
                để xem chi tiết và liên kết
              </p>
            </div>
