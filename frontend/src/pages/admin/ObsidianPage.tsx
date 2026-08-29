import { useMemo, useState, type FormEvent, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { createKnowledgeNode, getKnowledgeGraph } from "../../api/knowledge";
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from "../../types";
import { useTheme } from "../../stores/themeStore";

const levelLabels: Record<string, string> = {
  TOPIC: "Chủ đề",
  CONCEPT: "Khái niệm",
  SKILL: "Kỹ năng",
  NOTE: "Ghi chú",
};

const levelColors: Record<string, string> = {
  TOPIC: "#2D6CFF",
  CONCEPT: "#2D9BFF",
  SKILL: "#1BA672",
  NOTE: "#8A93A3",
};

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
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-primary-50 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:ring-primary-500/50" : "hover:bg-neutral-50 dark:hover:bg-slate-800/50"}`}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: levelColors[node.type] ?? levelColors.NOTE }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {node.label}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-neutral-500 dark:text-neutral-400">
          {node.path}
        </span>
      </span>
      {node.question_count > 0 && (
        <span className="rounded-full bg-neutral-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300">
          {node.question_count}
        </span>
      )}
    </button>
  );
}

function GraphCanvas({
  nodes,
  edges,
  selectedId,
  onSelect,
  isDarkMode
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

  useEffect(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    setDimensions({ width: clientWidth, height: clientHeight });
    
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const graphData = useMemo(() => {
    return {
      nodes: nodes.map(n => ({ ...n, id: n.id, name: n.label, val: (n.question_count || 1) * 1.5 })),
      links: edges.map(e => ({ source: e.source, target: e.target }))
    };
  }, [nodes, edges]);

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected = node.id === selectedId;
    const label = node.name;
    const fontSize = 14 / globalScale;
    ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 1.2);

    ctx.fillStyle = isDarkMode ? (isSelected ? 'rgba(45, 108, 255, 0.2)' : 'rgba(15, 23, 42, 0.8)') : (isSelected ? 'rgba(45, 108, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)');
    if (isSelected) {
      ctx.strokeStyle = '#2D6CFF';
      ctx.lineWidth = 1.5 / globalScale;
    } else {
      ctx.strokeStyle = isDarkMode ? '#334155' : '#e2e8f0';
      ctx.lineWidth = 1 / globalScale;
    }
    
    // Draw background
    ctx.beginPath();
    ctx.roundRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1], 4 / globalScale);
    ctx.fill();
    ctx.stroke();

    // Draw dot
    ctx.fillStyle = levelColors[node.type] ?? levelColors.NOTE;
    ctx.beginPath();
    ctx.arc(node.x - bckgDimensions[0] / 2 + fontSize, node.y, 3 / globalScale, 0, 2 * Math.PI);
    ctx.fill();

    // Draw text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDarkMode ? '#f8fafc' : '#0f172a';
    ctx.fillText(label, node.x - bckgDimensions[0] / 2 + fontSize * 2, node.y);
  }, [selectedId, isDarkMode]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-[600px] items-center justify-center rounded-2xl border border-dashed border-neutral-300 dark:border-slate-700 bg-neutral-50 dark:bg-slate-900 text-sm text-neutral-500">
        Không có note phù hợp với bộ lọc.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-[600px] overflow-hidden rounded-2xl border border-neutral-200 dark:border-slate-800 bg-[#fbfcff] dark:bg-[#0b1120] shadow-inner transition-colors duration-300">
      <div className="absolute inset-0 z-0 opacity-[0.4] dark:opacity-[0.1]" style={{
        backgroundImage: `radial-gradient(${isDarkMode ? '#334155' : '#cbd5e1'} 1px, transparent 1px)`,
        backgroundSize: '24px 24px'
      }} />
      <div className="absolute inset-0 z-10">
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={(node: any, color, ctx) => {
            const bckgDimensions = [50, 15]; // rough estimate
            ctx.fillStyle = color;
            ctx.fillRect(node.x - bckgDimensions[0]/2, node.y - bckgDimensions[1]/2, bckgDimensions[0], bckgDimensions[1]);
          }}
          linkColor={() => isDarkMode ? 'rgba(71, 85, 105, 0.4)' : 'rgba(203, 213, 225, 0.6)'}
          linkWidth={selectedId ? (link: any) => (link.source.id === selectedId || link.target.id === selectedId) ? 2 : 1 : 1}
          onNodeClick={(node) => onSelect(node.id)}
          d3VelocityDecay={0.3}
          cooldownTicks={100}
        />
      </div>
      <div className="absolute left-4 top-4 z-20 rounded-lg border border-white/80 dark:border-slate-700 bg-white/85 dark:bg-slate-800/80 px-3 py-2 text-[11px] text-neutral-500 dark:text-neutral-400 shadow-sm backdrop-blur">
        Graph view · {nodes.length} notes · {edges.length} links
      </div>
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3 rounded-lg border border-white/80 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 px-3 py-2 text-[10px] text-neutral-500 dark:text-neutral-400 shadow-sm backdrop-blur">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: levelColors.TOPIC }}/> Topic</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: levelColors.CONCEPT }}/> Concept</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: levelColors.SKILL }}/> Skill</span>
      </div>
    </div>
  );
}

export default function ObsidianPage() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewNote, setShowNewNote] = useState(false);
  const [noteName, setNoteName] = useState("");
  const [noteDescription, setNoteDescription] = useState("");
  const [noteError, setNoteError] = useState("");
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

  const handleCreateNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!noteName.trim()) return;
    const selectedEntityId = selectedNode ? selectedNode.entity_id : undefined;
    createNoteMutation.mutate({
      name: noteName.trim(),
      description: noteDescription.trim() || undefined,
      parent_id: selectedEntityId,
    });
  };

  return (
    <div className={`space-y-5 transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-600 dark:text-primary-400">
            Local knowledge space
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Obsidian Graph
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
            Không gian trực quan để khám phá các note, liên kết và ngữ cảnh tri thức trong vault.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewNote((value) => !value)}
          className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-600 dark:hover:bg-primary-400"
        >
          {showNewNote ? "Đóng note mới" : "+ Note mới"}
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Notes", value: allNodes.length },
          { label: "Links", value: allEdges.length },
          {
            label: "Có câu hỏi",
            value: allNodes.filter((node) => node.question_count > 0).length,
          },
          {
            label: "Đang chọn",
            value: selectedNode ? selectedNode.label : "-",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-neutral-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm transition-colors"
          >
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{stat.label}</p>
            <p className="mt-1 truncate text-lg font-bold text-neutral-900 dark:text-white">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {showNewNote && (
        <form
          onSubmit={handleCreateNote}
          className="rounded-2xl border border-primary-100 dark:border-primary-900/50 bg-primary-50/60 dark:bg-primary-900/20 p-5 shadow-sm transition-colors"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <label className="flex-1">
              <span className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Tên note
              </span>
              <input
                value={noteName}
                onChange={(event) => setNoteName(event.target.value)}
                required
                placeholder="Ví dụ: Phương trình bậc hai"
                className="w-full rounded-lg border border-neutral-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-neutral-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </label>
            <label className="flex-[1.5]">
              <span className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Mô tả ngắn
              </span>
              <input
                value={noteDescription}
                onChange={(event) => setNoteDescription(event.target.value)}
                placeholder="Ghi chú cho note"
                className="w-full rounded-lg border border-neutral-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-neutral-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </label>
            <button
              type="submit"
              disabled={createNoteMutation.isPending}
              className="rounded-lg bg-success-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-success-600 transition"
            >
              {createNoteMutation.isPending ? "Đang tạo..." : "Tạo note"}
            </button>
          </div>
          {selectedNode && (
            <p className="mt-3 text-xs text-primary-700 dark:text-primary-400">
              Note mới sẽ được liên kết với{" "}
              <strong>{selectedNode.label}</strong>.
            </p>
          )}
          {noteError && (
            <p className="mt-3 text-xs text-danger-500 dark:text-danger-400">{noteError}</p>
          )}
        </form>
      )}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="rounded-2xl border border-neutral-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm transition-colors">
          <div className="px-2 pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">All notes</h2>
              <span className="text-xs text-neutral-400">
                {visibleNodes.length}/{allNodes.length}
              </span>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes..."
              aria-label="Tìm note"
              className="mt-3 w-full rounded-lg border border-neutral-200 dark:border-slate-700 bg-neutral-50 dark:bg-slate-800 px-3 py-2 text-xs text-neutral-900 dark:text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Lọc loại note"
              className="mt-2 w-full rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-neutral-700 dark:text-neutral-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="ALL">Tất cả loại note</option>
              <option value="TOPIC">Chủ đề</option>
              <option value="CONCEPT">Khái niệm</option>
              <option value="SKILL">Kỹ năng</option>
              <option value="NOTE">Ghi chú</option>
            </select>
          </div>
          <div className="max-h-[520px] space-y-1 overflow-y-auto custom-scrollbar">
            {graphQuery.isLoading && (
              <p className="px-2 py-5 text-sm text-neutral-500 dark:text-neutral-400">
                Đang tải notes...
              </p>
            )}
            {graphQuery.isError && (
              <p className="px-2 py-5 text-sm text-danger-500 dark:text-danger-400">
                Không tải được graph.
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
              <p className="px-2 py-5 text-sm text-neutral-500 dark:text-neutral-400">
                Chưa có note phù hợp.
              </p>
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

        <aside className="rounded-2xl border border-neutral-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-400">
            Note context
          </p>
          {selectedNode ? (
            <>
              <div className="mt-3 flex items-start gap-3">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      levelColors[selectedNode.type] ?? levelColors.NOTE,
                  }}
                />
                <div className="min-w-0">
                  <h2 className="break-words text-xl font-bold text-neutral-900 dark:text-white">
                    {selectedNode.label}
                  </h2>
                  <p className="mt-1 break-words text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    {selectedNode.path}
                  </p>
                </div>
              </div>
              <span
                className="mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  color: levelColors[selectedNode.type] ?? levelColors.NOTE,
                  backgroundColor: `${levelColors[selectedNode.type] ?? levelColors.NOTE}18`,
                }}
              >
                {levelLabels[selectedNode.type] ?? selectedNode.type}
              </span>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-neutral-50 dark:bg-slate-800/50 p-3">
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Questions</p>
                  <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-white">
                    {selectedNode.question_count}
                  </p>
                </div>
                <div className="rounded-lg bg-neutral-50 dark:bg-slate-800/50 p-3">
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Links</p>
                  <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-white">
                    {connectedNodes.length}
                  </p>
                </div>
              </div>
              <div className="mt-5 border-t border-neutral-100 dark:border-slate-800 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
                  Backlinks & connections
                </p>
                <div className="mt-3 space-y-1">
                  {connectedNodes.length === 0 && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Note chưa có liên kết.
                    </p>
                  )}
                  {connectedNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedId(node.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            levelColors[node.type] ?? levelColors.NOTE,
                        }}
                      />{" "}
                      <span className="truncate">{node.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
              Chọn một note trên graph để xem context.
            </p>
          )}
        </aside>
      </section>
    </div>
  );
}
