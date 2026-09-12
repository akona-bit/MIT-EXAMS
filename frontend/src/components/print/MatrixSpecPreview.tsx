import type { MatrixRule, MatrixRuleGroup } from "../../types";

interface MatrixSpecPreviewProps {
  name: string;
  description?: string;
  rules: MatrixRule[];
  groups?: MatrixRuleGroup[];
}

const LEVEL_MAP: Record<number, string> = {
  1: "NB",
  2: "TH",
  3: "VD",
  4: "VDC",
};

const TYPE_MAP: Record<string, string> = {
  SINGLE_CHOICE: "TN",
  TRUE_FALSE: "T/S",
  FILL_IN_BLANK: "DK",
  MULTIPLE_CHOICE: "NC",
};

const PART_LABELS: Record<number, string> = {
  1: "PHẦN 1: SỬ DỤNG NGÔN NGỮ",
  2: "PHẦN 2: TOÁN HỌC",
  3: "PHẦN 3: TƯ DUY KHOA HỌC",
  4: "PHẦN 4: TƯ DUY TỔNG HỢP",
};

export default function MatrixSpecPreview({
  name,
  description,
  rules,
  groups,
}: MatrixSpecPreviewProps) {
  const totalQuestions = rules.reduce((sum, r) => sum + r.count, 0);

  const rulesByPart = rules.reduce(
    (acc, rule) => {
      const part = rule.part || 1;
      if (!acc[part]) acc[part] = [];
      acc[part].push(rule);
      return acc;
    },
    {} as Record<number, MatrixRule[]>,
  );

  const sortedParts = Object.keys(rulesByPart)
    .map(Number)
    .sort((a, b) => a - b);

  const getGroupLabel = (rule: MatrixRule): string => {
    if (!rule.group_local_id || !groups) return "";
    const group = groups.find((g) => g.local_id === rule.group_local_id);
    return group?.label || rule.group_local_id;
  };

  return (
    <div>
      <h1 style={{ textAlign: "center", marginBottom: 2, fontSize: 16 }}>
        MA TRẬN ĐẶC TẢ
      </h1>
      <h2 style={{ textAlign: "center", marginBottom: 4, fontSize: 14, fontWeight: "normal" }}>
        {name}
      </h2>
      {description && (
        <p style={{ textAlign: "center", fontSize: 10, color: "#666", marginBottom: 10 }}>
          {description}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 10 }}>
        <span><strong>Tổng số câu:</strong> {totalQuestions}</span>
        <span><strong>Số phần:</strong> {sortedParts.length}</span>
        <span><strong>Số quy tắc:</strong> {rules.length}</span>
      </div>

      {sortedParts.map((part) => {
        const partRules = rulesByPart[part];
        const partTotal = partRules.reduce((s, r) => s + r.count, 0);

        const rulesByGroup = partRules.reduce(
          (acc, rule) => {
            const gid = rule.group_local_id || "__ungrouped__";
            if (!acc[gid]) acc[gid] = [];
            acc[gid].push(rule);
            return acc;
          },
          {} as Record<string, MatrixRule[]>,
        );

        return (
          <div key={part} style={{ marginBottom: 14, pageBreakInside: "avoid" }}>
            <div
              style={{
                background: "#e8e8e8",
                padding: "4pt 8pt",
                fontWeight: "bold",
                fontSize: 11,
                border: "1px solid #999",
              }}
            >
              {PART_LABELS[part] || `PHẦN ${part}`} — {partTotal} câu
            </div>

            <table className="print-table matrix-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 24 }}>STT</th>
                  <th>Chủ đề kiến thức</th>
                  <th style={{ width: 40 }}>Mã</th>
                  <th style={{ width: 36 }}>Loại</th>
                  <th style={{ width: 36 }}>Mức</th>
                  <th style={{ width: 30 }}>SL</th>
                  <th>Nhóm</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(rulesByGroup).map(([gid, groupRules]) =>
                  groupRules.map((rule, idx) => (
                    <tr key={rule.id || `${gid}-${idx}`}>
                      <td className="center">{rule.position || idx + 1}</td>
                      <td style={{ fontSize: 9 }}>
                        {rule.knowledge_node?.name || `Node #${rule.knowledge_node_id}`}
                        {rule.knowledge_node?.short_code && (
                          <span style={{ color: "#888", marginLeft: 4 }}>
                            [{rule.knowledge_node.short_code}]
                          </span>
                        )}
                      </td>
                      <td className="center" style={{ fontSize: 9 }}>
                        {rule.knowledge_node?.short_code || "-"}
                      </td>
                      <td className="center" style={{ fontSize: 9 }}>
                        {rule.question_type
                          ? TYPE_MAP[rule.question_type] || "?"
                          : "TD"}
                      </td>
                      <td className="center" style={{ fontSize: 9 }}>
                        {rule.level ? LEVEL_MAP[rule.level] : "TD"}
                      </td>
                      <td className="center" style={{ fontWeight: "bold" }}>
                        {rule.count}
                      </td>
                      <td style={{ fontSize: 9 }}>{getGroupLabel(rule)}</td>
                      <td style={{ fontSize: 9 }}>{rule.note || ""}</td>
                    </tr>
                  )),
                )}
                <tr className="total-row">
                  <td colSpan={5} style={{ textAlign: "right", fontSize: 10 }}>
                    Tổng cộng phần {part}:
                  </td>
                  <td className="center" style={{ fontSize: 11 }}>
                    {partTotal}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      <div
        style={{
          marginTop: 12,
          padding: "6pt 8pt",
          border: "2px solid #000",
          textAlign: "center",
          fontWeight: "bold",
          fontSize: 12,
        }}
      >
        TỔNG SỐ CÂU HOÀN CHỈNH: {totalQuestions} câu
      </div>

      {groups && groups.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 9, color: "#666" }}>
          <strong>Ghi chú nhóm:</strong>{" "}
          {groups
            .map((g) => `${g.label || g.local_id}`)
            .join(" | ")}
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 9, color: "#888", borderTop: "1px solid #ccc", paddingTop: 6 }}>
        <strong>Chú thích:</strong> TD = Tự động, TN = Trắc nghiệm, T/S = Đúng/Sai,
        DK = Điền khuyết, NC = Nhiều lựa chọn, NB = Nhận biết, TH = Thông hiểu,
        VD = Vận dụng, VDC = Vận dụng cao
      </div>
    </div>
  );
}
