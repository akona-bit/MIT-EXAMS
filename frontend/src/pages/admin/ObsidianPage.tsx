import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createKnowledgeNode,
  getKnowledgeGraph,
  getKnowledgeTree,
} from "../../api/knowledge";
import { syncObsidianLocalApi, type SyncRequest } from "../../api/obsidian";
import type { KnowledgeGraphNode, KnowledgeNode } from "../../types";

const levelLabels: Record<string, string> = {
  TOPIC: "Chủ đề",
  CONCEPT: "Khái niệm",
  SKILL: "Kỹ năng",
  NOTE: "Ghi chú",
};

function flattenTree(nodes: KnowledgeNode[]): KnowledgeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children ?? [])]);
}

function levelClass(level?: string) {
  if (level === "TOPIC")
    return "bg-primary-500/10 text-primary-700 border-primary-300";
  if (level === "CONCEPT")
    return "bg-info-500/10 text-info-500 border-info-500/30";
  if (level === "SKILL")
    return "bg-success-500/10 text-success-500 border-success-500/30";
  return "bg-neutral-100 text-neutral-700 border-neutral-300";
}

function TreeNode({
  node,
  selectedId,
  onSelect,
  depth = 0,
}: {
  node: KnowledgeNode;
  selectedId: number | null;
  onSelect: (node: KnowledgeNode) => void;
  depth?: number;
}) {
  const isSelected = node.id === selectedId;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
          isSelected
            ? "bg-primary-500 text-white"
            : "text-neutral-700 hover:bg-neutral-100"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-neutral-300"}`}
        />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {typeof node.question_count === "number" && node.question_count > 0 && (
          <span
            className={`text-xs ${isSelected ? "text-white/80" : "text-neutral-500"}`}
          >
            {node.question_count}
          </span>
        )}
      </button>
      {(node.children ?? []).map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          selectedId={selectedId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function GraphNodeCard({ node }: { node: KnowledgeGraphNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary-500" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
          {node.label}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`rounded border px-2 py-0.5 text-xs ${levelClass(node.type)}`}
        >
          {levelLabels[node.type] ?? node.type}
        </span>
        <span className="text-xs text-neutral-500">
          {node.question_count} câu
        </span>
      </div>
    </div>
  );
}

export default function ObsidianPage() {
  const [apiUrl, setApiUrl] = useState("https://127.0.0.1:27124");
  const [apiKey, setApiKey] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [nodeName, setNodeName] = useState("");
  const [nodeDescription, setNodeDescription] = useState("");
  const [nodeParentId, setNodeParentId] = useState<number | undefined>();
  const [nodeError, setNodeError] = useState("");
  const queryClient = useQueryClient();

  const treeQuery = useQuery({
    queryKey: ["knowledgeTree"],
    queryFn: getKnowledgeTree,
  });

  const graphQuery = useQuery({
    queryKey: ["knowledgeGraph"],
    queryFn: getKnowledgeGraph,
  });

  const flatNodes = useMemo(
    () => flattenTree(treeQuery.data ?? []),
    [treeQuery.data],
  );
  const selectedNode =
    flatNodes.find((node) => node.id === selectedId) ?? flatNodes[0] ?? null;

  const mutation = useMutation({
    mutationFn: (data: SyncRequest) => syncObsidianLocalApi(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      queryClient.invalidateQueries({ queryKey: ["knowledgeTree"] });
      queryClient.invalidateQueries({ queryKey: ["knowledgeGraph"] });
    },
  });

  const handleSync = () => {
    if (!apiUrl || !apiKey) {
      alert("Vui lòng nhập đầy đủ API URL và API Key");
      return;
    }
    mutation.mutate({ api_url: apiUrl, api_key: apiKey });
  };

  const createNodeMutation = useMutation({
    mutationFn: createKnowledgeNode,
    onSuccess: (node) => {
      setNodeName("");
      setNodeDescription("");
      setNodeParentId(undefined);
      setSelectedId(node.id);
      setNodeError("");
      queryClient.invalidateQueries({ queryKey: ["knowledgeTree"] });
      queryClient.invalidateQueries({ queryKey: ["knowledgeGraph"] });
    },
    onError: (requestError: unknown) => {
      setNodeError(
        requestError instanceof Error
          ? requestError.message
          : "Không tạo được node.",
      );
    },
  });

  const handleCreateNode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nodeName.trim()) return;
    createNodeMutation.mutate({
      name: nodeName.trim(),
      description: nodeDescription.trim() || undefined,
      parent_id: nodeParentId,
    });
  };

  const graphNodes = graphQuery.data?.nodes ?? [];
  const graphEdges = graphQuery.data?.edges ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Knowledge Vault
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Cây kiến thức đồng bộ từ Obsidian, liên kết với câu hỏi và graph
            nghiệp vụ của MIT EXAMS.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>{flatNodes.length} node</span>
          <span className="h-1 w-1 rounded-full bg-neutral-300" />
          <span>{graphEdges.length} liên kết</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">Vault Tree</p>
          </div>
          <div className="max-h-[620px] overflow-y-auto p-2">
            {treeQuery.isLoading && (
              <p className="px-2 py-3 text-sm text-neutral-500">
                Đang tải cây kiến thức...
              </p>
            )}
            {!treeQuery.isLoading && flatNodes.length === 0 && (
              <p className="px-2 py-3 text-sm text-neutral-500">
                Chưa có node kiến thức.
              </p>
            )}
            {(treeQuery.data ?? []).map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                selectedId={selectedNode?.id ?? null}
                onSelect={(nextNode) => setSelectedId(nextNode.id)}
              />
            ))}
          </div>
        </aside>

        <main className="space-y-4">
          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            {selectedNode ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-neutral-500">
                      {selectedNode.path}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-neutral-900">
                      {selectedNode.name}
                    </h2>
                  </div>
                  <span
                    className={`w-fit rounded border px-2.5 py-1 text-xs font-medium ${levelClass(selectedNode.level)}`}
                  >
                    {levelLabels[selectedNode.level ?? "NOTE"] ??
                      selectedNode.level}
                  </span>
                </div>

                {selectedNode.description && (
                  <p className="text-sm leading-6 text-neutral-700">
                    {selectedNode.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-lg bg-neutral-50 p-3">
                    <p className="text-xs text-neutral-500">Câu hỏi</p>
                    <p className="mt-1 text-lg font-semibold text-neutral-900">
                      {selectedNode.question_count ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-neutral-50 p-3">
                    <p className="text-xs text-neutral-500">Node con</p>
                    <p className="mt-1 text-lg font-semibold text-neutral-900">
                      {selectedNode.children?.length ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-neutral-50 p-3">
                    <p className="text-xs text-neutral-500">Parent ID</p>
                    <p className="mt-1 text-lg font-semibold text-neutral-900">
                      {selectedNode.parent_id ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-neutral-50 p-3">
                    <p className="text-xs text-neutral-500">Node ID</p>
                    <p className="mt-1 text-lg font-semibold text-neutral-900">
                      {selectedNode.id}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                Chọn một node để xem chi tiết.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-5 border-b border-neutral-100 pb-5">
              <p className="text-sm font-semibold text-neutral-900">
                Tạo node thủ công
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Không cần cài Obsidian. Dùng cách này để tạo cây kiến thức trực
                tiếp.
              </p>
              <form
                onSubmit={handleCreateNode}
                className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_180px_auto] md:items-end"
              >
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-700">
                    Tên node
                  </span>
                  <input
                    value={nodeName}
                    onChange={(event) => setNodeName(event.target.value)}
                    required
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="Ví dụ: Đại số"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-700">
                    Mô tả
                  </span>
                  <input
                    value={nodeDescription}
                    onChange={(event) => setNodeDescription(event.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="Tùy chọn"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-700">
                    Node cha
                  </span>
                  <select
                    value={nodeParentId ?? ""}
                    onChange={(event) =>
                      setNodeParentId(
                        event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      )
                    }
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">Node gốc</option>
                    {flatNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.path || node.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={createNodeMutation.isPending}
                  className="rounded-lg bg-success-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-success-500/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createNodeMutation.isPending ? "Đang tạo..." : "Thêm node"}
                </button>
              </form>
              {nodeError && (
                <p className="mt-2 text-xs text-danger-500">{nodeError}</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px]">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-neutral-900">
                  Đồng bộ Obsidian Local REST API{" "}
                  <span className="font-normal text-neutral-500">
                    (tùy chọn)
                  </span>
                </p>
                <p className="mb-3 text-xs text-neutral-500">
                  Chỉ dùng phần này nếu bạn có Obsidian và plugin Local REST
                  API. Nếu không, hãy tạo node thủ công ở trên.
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-neutral-700">
                      Obsidian API URL
                    </span>
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(event) => setApiUrl(event.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-neutral-700">
                      API Key
                    </span>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                  </label>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSync}
                disabled={!apiUrl || !apiKey || mutation.isPending}
                className="self-end rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mutation.isPending ? "Đang đồng bộ..." : "Đồng bộ ngay"}
              </button>
            </div>

            {mutation.isError && (
              <div className="mt-4 rounded-lg border border-danger-500/20 bg-danger-500/10 p-3 text-sm text-danger-500">
                Lỗi kết nối: {(mutation.error as Error).message}
              </div>
            )}

            {mutation.isSuccess && mutation.data && (
              <div className="mt-5 max-h-72 overflow-y-auto rounded-lg border border-neutral-200">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className="sticky top-0 bg-neutral-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-neutral-500">
                        File
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-500">
                        Trạng thái
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-500">
                        Chi tiết
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {mutation.data.details.map((detail, index) => (
                      <tr key={`${detail.file}-${index}`}>
                        <td className="px-4 py-3 text-neutral-900">
                          {detail.file}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {detail.status}
                        </td>
                        <td className="px-4 py-3 text-neutral-500">
                          {detail.reason || `ID: ${detail.question_id}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>

        <aside className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">
              Graph Links
            </p>
          </div>
          <div className="max-h-[620px] space-y-4 overflow-y-auto p-4">
            {graphQuery.isLoading && (
              <p className="text-sm text-neutral-500">Đang tải graph...</p>
            )}
            {!graphQuery.isLoading && graphNodes.length === 0 && (
              <p className="text-sm text-neutral-500">Chưa có graph node.</p>
            )}
            <div className="grid grid-cols-1 gap-3">
              {graphNodes.slice(0, 12).map((node) => (
                <GraphNodeCard key={node.id} node={node} />
              ))}
            </div>
            {graphNodes.length > 12 && (
              <p className="text-xs text-neutral-500">
                +{graphNodes.length - 12} node khác trong vault
              </p>
            )}
            <div className="rounded-lg bg-neutral-50 p-3">
              <p className="text-xs font-medium text-neutral-500">
                Loại liên kết
              </p>
              <div className="mt-2 space-y-1 text-sm text-neutral-700">
                <p>
                  PARENT_OF:{" "}
                  {
                    graphEdges.filter((edge) => edge.type === "PARENT_OF")
                      .length
                  }
                </p>
                <p>
                  NEXT_SIBLING:{" "}
                  {
                    graphEdges.filter((edge) => edge.type === "NEXT_SIBLING")
                      .length
                  }
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
