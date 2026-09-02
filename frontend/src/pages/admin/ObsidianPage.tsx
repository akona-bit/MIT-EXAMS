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
  createManualLink,
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
};

const DEFAULT_NODE_COLOR = "#64748b"; // Slate-500 fallback

function NodePill({
  node,
  active,
  onClick,
}: {
  node: KnowledgeGraphNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-300 ${active ? "bg-gradient-to-r from-primary-500/10 to-transparent ring-1 ring-primary-500/30 dark:from-primary-900/30" : "hover:bg-slate-100/50 dark:hover:bg-slate-800/50"}`}
    >
      <div
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm transition-all duration-300 ${active ? "scale-110 shadow-md" : "group-hover:scale-105"}`}
        style={{
          backgroundColor: `${levelColors[node.type] ?? levelColors.NOTE}15`,
          color: levelColors[node.type] ?? levelColors.NOTE,
        }}
      >
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: levelColors[node.type] ?? levelColors.NOTE,
            boxShadow: active ? `0 0 10px ${levelColors[node.type]}` : "none",
          }}
        />
      </div>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-semibold transition-colors ${active ? "text-primary-700 dark:text-primary-300" : "text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white"}`}
        >
          {node.label}
        </span>
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
  nodes,
  edges,
  selectedId,
  onSelect,
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
    const currentEdges = edges.filter((e) => {
      const sourceId =
        typeof e.source === "object" ? (e.source as any).id : e.source;
      const targetId =
        typeof e.target === "object" ? (e.target as any).id : e.target;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    return {
      nodes: currentNodes.map((n) => ({
        ...n,
        id: n.id,
        name: n.label,
        val: (n.question_count || 1) * 1.5,
      })),
      links: currentEdges.map((e) => ({ source: e.source, target: e.target })),
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
    return (
      <div className="flex h-[600px] items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-900/40 text-sm text-slate-500">
        Không có note phù hợp với bộ lọc.
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] group">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 rounded-2xl pointer-events-none" />

      <div
        ref={containerRef}
        className="relative z-10 h-full w-full overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-[#fafbfd] dark:bg-[#080c14] shadow-inner transition-colors duration-300"
      >
        {/* Dot grid background */}
        <div
          className="absolute inset-0 z-0 opacity-[0.35] dark:opacity-[0.12] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, ${isDarkMode ? "#64748b" : "#94a3b8"} 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />
        {/* Vignette overlay for depth */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background: isDarkMode
              ? "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)"
              : "radial-gradient(ellipse at center, transparent 40%, rgba(241,245,249,0.8) 100%)",
          }}
        />

        {replayProgress !== -1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 shadow-2xl flex items-center gap-4">
            <span className="text-white text-xs font-bold tracking-wider uppercase flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary-400" />
              Timelapse
            </span>
            <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 transition-all duration-75"
                style={{ width: `${(replayProgress / nodes.length) * 100}%` }}
              />
            </div>
            <span className="text-primary-400 text-xs font-mono font-bold w-12 text-right">
              {replayProgress}/{nodes.length}
            </span>
            <button
              onClick={() => setReplayProgress(-1)}
              className="ml-2 p-1.5 rounded-full hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
              title="Dừng Tái hiện"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="absolute inset-0 z-10">
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              ctx.fillStyle = color;
              const b = node.__bckgDimensions || [40, 20];
              ctx.fillRect(node.x - b[0] / 2, node.y - b[1] / 2, b[0], b[1]);
            }}
            linkColor={(link: any) => {
              const isActive =
                (selectedId &&
                  (link.source.id === selectedId ||
                    link.target.id === selectedId)) ||
                (hoverNode &&
                  (link.source.id === hoverNode ||
                    link.target.id === hoverNode));
              const hasFocus = selectedId || hoverNode;

              const targetColor =
                levelColors[link.target?.type] ??
                (isDarkMode ? "#94a3b8" : "#64748b");

              if (isActive) {
                return targetColor;
              }
              if (hasFocus) {
                return isDarkMode
                  ? "rgba(71, 85, 105, 0.08)"
                  : "rgba(203, 213, 225, 0.15)";
              }
              return targetColor + "40";
            }}
            linkWidth={(link: any) => {
              const isActive =
                (selectedId &&
                  (link.source.id === selectedId ||
                    link.target.id === selectedId)) ||
                (hoverNode &&
                  (link.source.id === hoverNode ||
                    link.target.id === hoverNode));
              const hasFocus = selectedId || hoverNode;
              if (isActive) return 2.5;
              if (hasFocus) return 0.3;
              return 1;
            }}
            linkCurvature={0.15}
            linkDirectionalParticles={(link: any) => {
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
                } else {
                  setReplayProgress(-1);
                }
              }}
            >
              <Timer
                className={`h-4 w-4 ${replayProgress !== -1 ? "animate-spin-slow" : ""}`}
              />
            </button>
          </div>

          <div className="flex flex-col rounded-lg border border-white/60 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 shadow-sm backdrop-blur p-1">
            <button
              type="button"
              title="Phóng to"
              className="p-1.5 text-slate-500 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              onClick={() => {
                const currentZoom = fgRef.current?.zoom() || 1;
                fgRef.current?.zoom(currentZoom * 1.5, 400);
              }}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Thu nhỏ"
              className="p-1.5 text-slate-500 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              onClick={() => {
                const currentZoom = fgRef.current?.zoom() || 1;
                fgRef.current?.zoom(currentZoom / 1.5, 400);
              }}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Vừa vặn màn hình"
              className="p-1.5 text-slate-500 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              onClick={() => fgRef.current?.zoomToFit(400, 50)}
            >
              <Target className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col rounded-lg border border-white/60 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 shadow-sm backdrop-blur p-1">
            <button
              type="button"
              title={isPhysicsActive ? "Dừng mô phỏng" : "Tiếp tục mô phỏng"}
              className={`p-1.5 rounded transition-colors ${!isPhysicsActive ? "text-primary-500 bg-primary-50 dark:bg-primary-900/30" : "text-slate-500 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
              onClick={() => {
                setIsPhysicsActive(!isPhysicsActive);
                if (!isPhysicsActive) {
                  fgRef.current?.d3ReheatSimulation();
                }
              }}
            >
              {isPhysicsActive ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              title="Toàn màn hình"
              className="p-1.5 text-slate-500 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="absolute left-4 top-4 z-20 rounded-lg border border-white/60 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 px-3 py-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-sm backdrop-blur">
          Graph view · {nodes.length} nodes · {edges.length} links
        </div>
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3 rounded-lg border border-white/60 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 px-3 py-2 text-[10px] font-medium text-slate-600 dark:text-slate-300 shadow-sm backdrop-blur">
          <span className="flex items-center gap-1.5">
            <i
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: levelColors.TOPIC }}
            />{" "}
            Topic
          </span>
          <span className="flex items-center gap-1.5">
            <i
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: levelColors.CONCEPT }}
            />{" "}
            Concept
          </span>
          <span className="flex items-center gap-1.5">
            <i
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: levelColors.SKILL }}
            />{" "}
            Skill
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ObsidianPage() {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
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
        matchesSearch && (typeFilter === "ALL" || node.type === typeFilter)
      );
    });
  }, [allNodes, search, typeFilter]);

  const selectedNode =
    allNodes.find((node) => node.id === selectedId) ?? visibleNodes[0] ?? null;
  const connectedNodes = selectedNode
    ? allEdges
        .flatMap((edge) => {
          if (edge.source === selectedNode.id)
            return [allNodes.find((node) => node.id === edge.target)];
          if (edge.target === selectedNode.id)
            return [allNodes.find((node) => node.id === edge.source)];
          return [];
        })
        .filter((node): node is KnowledgeGraphNode => Boolean(node))
    : [];

  const createNoteMutation = useMutation({
    mutationFn: createKnowledgeNode,
    onSuccess: () => {
      setNoteName("");
      setNoteDescription("");
      setNoteError("");
      setShowNewNote(false);
      queryClient.invalidateQueries({ queryKey: ["knowledgeGraph"] });
    },
    onError: (error: unknown) =>
      setNoteError(
        error instanceof Error ? error.message : "Không tạo được note.",
      ),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: deleteKnowledgeNode,
    onSuccess: () => {
      setSelectedId(null);
      setIsDeleting(false);
      queryClient.invalidateQueries({ queryKey: ["knowledgeGraph"] });
    },
    onError: (error: unknown) => {
      setIsDeleting(false);
      alert(error instanceof Error ? error.message : "Không xóa được note.");
    },
  });

  const updateParentMutation = useMutation({
    mutationFn: (data: { id: number; parent_id: number | null }) =>
      updateKnowledgeNode(data.id, { parent_id: data.parent_id }),
    onSuccess: () => {
      setIsEditingParent(false);
      queryClient.invalidateQueries({ queryKey: ["knowledgeGraph"] });
    },
    onError: (error: unknown) => {
      alert(
        error instanceof Error
          ? error.message
          : "Không cập nhật được liên kết.",
      );
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: (data: { id: number; note: string | null }) =>
      updateKnowledgeNode(data.id, { note: data.note }),
    onSuccess: () => {
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
    });
  };

  return (
    <div
      className={`space-y-6 transition-colors duration-300 ${isDarkMode ? "dark" : ""}`}
    >
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient pb-1">
            Cấu trúc Kiến thức
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Không gian trực quan để khám phá các chủ đề, liên kết và ngữ cảnh
            tri thức trong hệ thống.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => {
            if (!showNewNote) {
              setNoteParentId(
                selectedNode ? String(selectedNode.entity_id) : "none",
              );
            }
            setShowNewNote((value) => !value);
          }}
          className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 hover:bg-primary-500 transition-all duration-200"
        >
          <Plus
            className={`h-4 w-4 mr-2 transition-transform duration-300 ${showNewNote ? "rotate-45" : ""}`}
          />
          {showNewNote ? "Đóng form" : "Note mới"}
        </motion.button>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Tổng số Node",
            value: allNodes.length,
            icon: FileText,
            color: "text-blue-500 dark:text-blue-400",
            bg: "bg-blue-500/10 dark:bg-blue-400/10",
          },
          {
            label: "Tổng liên kết",
            value: allEdges.length,
            icon: LinkIcon,
            color: "text-purple-500 dark:text-purple-400",
            bg: "bg-purple-500/10 dark:bg-purple-400/10",
          },
          {
            label: "Node có câu hỏi",
            value: allNodes.filter((node) => node.question_count > 0).length,
            icon: CheckCircle2,
            color: "text-emerald-500 dark:text-emerald-400",
            bg: "bg-emerald-500/10 dark:bg-emerald-400/10",
          },
          {
            label: "Đang chọn",
            value: selectedNode ? selectedNode.label : "-",
            icon: Share2,
            color: "text-amber-500 dark:text-amber-400",
            bg: "bg-amber-500/10 dark:bg-amber-400/10",
          },
        ].map((stat, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            key={stat.label}
            className="relative overflow-hidden p-5 transition-all hover:-translate-y-1 group glass-card shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-2xl"
          >
            <div className="absolute -right-4 -top-4 opacity-[0.03] dark:opacity-10 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-[0.06] dark:group-hover:opacity-20">
              <stat.icon className="h-24 w-24" />
            </div>
            <div className="relative z-10 flex items-center gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.bg} ${stat.color} shadow-sm`}
              >
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-0.5 truncate text-xl font-black text-slate-900 dark:text-white">
                  {stat.value}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showNewNote && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.form
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleCreateNote}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Tạo Node Mới
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewNote(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Tên Node <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={noteName}
                    onChange={(event) => setNoteName(event.target.value)}
                    required
                    placeholder="Ví dụ: Phương trình bậc hai"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Loại Node
                  </label>
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all cursor-pointer"
                  >
                    <option value="TOPIC">Chủ đề (Topic)</option>
                    <option value="CONCEPT">Khái niệm (Concept)</option>
                    <option value="SKILL">Kỹ năng (Skill)</option>
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
                  {isEditingNote ? (
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
                      {isLinking
                        ? "Đang chọn... (Bấm node khác)"
                        : "+ Tạo link"}
                    </button>
                  </div>
                  {isLinking && (
                    <div className="mb-3 p-2.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-xs text-primary-700 dark:text-primary-300 font-medium">
                      👆 Bấm vào một node KHÁC trên đồ thị hoặc chọn từ danh
                      sách bên trái để tạo link thủ công với "
                      {selectedNode.label}".
                      <button
                        onClick={() => setIsLinking(false)}
                        className="ml-2 underline hover:no-underline"
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                  {/* Show manual links */}
                  {allEdges
                    .filter(
                      (e) =>
                        e.type === "MANUAL" &&
                        ((typeof e.source === "object"
                          ? (e.source as any).id
                          : e.source) === selectedNode.id ||
                          (typeof e.target === "object"
                            ? (e.target as any).id
                            : e.target) === selectedNode.id),
                    )
                    .map((edge) => {
                      const otherId =
                        (typeof edge.source === "object"
                          ? (edge.source as any).id
                          : edge.source) === selectedNode.id
                          ? typeof edge.target === "object"
                            ? (edge.target as any).id
                            : edge.target
                          : typeof edge.source === "object"
                            ? (edge.source as any).id
                            : edge.source;
                      const otherNode = allNodes.find((n) => n.id === otherId);
                      return otherNode ? (
                        <div
                          key={edge.id}
                          className="flex items-center justify-between rounded-lg bg-white/50 dark:bg-slate-800/50 px-3 py-2 mb-1.5 border border-slate-200/50 dark:border-slate-700/50"
                        >
                          <button
                            onClick={() => setSelectedId(otherNode.id)}
                            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                          >
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor:
                                  levelColors[otherNode.type] ??
                                  DEFAULT_NODE_COLOR,
                              }}
                            />
                            {otherNode.label}
                          </button>
                          <button
                            onClick={() =>
                              edge.link_id &&
                              deleteLinkMutation.mutate(edge.link_id)
                            }
                            className="text-red-400 hover:text-red-600 transition-colors p-1"
                            title="Xóa link này"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null;
                    })}
                </div>

                <div className="pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                    <Share2 className="h-3.5 w-3.5" /> Backlinks & Connections
                  </p>
                  <div className="space-y-2">
                    {connectedNodes.length === 0 && (
                      <div className="flex flex-col items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                        <Share2 className="h-6 w-6 text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                          Không có liên kết nào
                        </p>
                      </div>
                    )}
                    {connectedNodes.map((node) => (
                      <button
                        key={node.id}
                        onClick={() => setSelectedId(node.id)}
                        className="group flex w-full items-center gap-3 rounded-xl border border-transparent bg-white/50 dark:bg-slate-800/50 px-3.5 py-2.5 text-left transition-all duration-300 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm hover:-translate-y-0.5"
                      >
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm transition-transform group-hover:scale-110"
                          style={{
                            backgroundColor: `${levelColors[node.type] ?? DEFAULT_NODE_COLOR}15`,
                            color: levelColors[node.type] ?? DEFAULT_NODE_COLOR,
                          }}
                        >
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                levelColors[node.type] ?? DEFAULT_NODE_COLOR,
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                            {node.label}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50 flex flex-col gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" /> Chỉnh sửa liên kết cha
                  </p>

                  {isEditingParent ? (
                    <div className="flex flex-col gap-2">
                      <select
                        value={newParentId}
                        onChange={(e) => setNewParentId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                      >
                        <option value="none">
                          -- Không có node cha (Gốc) --
                        </option>
                        {allNodes
                          .filter((n) => n.id !== selectedNode.id)
                          .map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.label}
                            </option>
                          ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsEditingParent(false)}
                          className="flex-1 rounded-lg bg-slate-200 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
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
          )}
        </aside>
      </section>
    </div>
  );
}
