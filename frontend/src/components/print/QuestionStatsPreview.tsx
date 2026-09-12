import type { MatrixRule, MatrixRuleGroup } from "../../types";

interface QuestionStatsPreviewProps {
  rules: MatrixRule[];
  groups?: MatrixRuleGroup[];
  matrixName?: string;
  matrixDescription?: string;
}

const LEVEL_MAP: Record<number, string> = {
  1: "Nhận biết",
  2: "Thông hiểu",
  3: "Vận dụng",
  4: "Vận dụng cao",
};

const TYPE_MAP: Record<string, string> = {
  SINGLE_CHOICE: "Trắc nghiệm",
  TRUE_FALSE: "Đúng/Sai",
  FILL_IN_BLANK: "Điền khuyết",
  MULTIPLE_CHOICE: "Nhiều lựa chọn",
};

const PART_NAMES: Record<number, string> = {
  1: "Phần 1: Sử dụng ngôn ngữ",
  2: "Phần 2: Toán học",
  3: "Phần 3: Tư duy khoa học",
  4: "Phần 4: Tư duy tổng hợp",
};

export default function QuestionStatsPreview({
  rules,
  groups,
  matrixName,
  matrixDescription,
}: QuestionStatsPreviewProps) {
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

  const levelDist = rules.reduce(
    (acc, r) => {
      const level = r.level || 0;
      acc[level] = (acc[level] || 0) + r.count;
      return acc;
    },
    {} as Record<number, number>,
  );

  const typeDist = rules.reduce(
    (acc, r) => {
      const type = r.question_type || "SINGLE_CHOICE";
      acc[type] = (acc[type] || 0) + r.count;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div>
      <h1 style={{ textAlign: "center", marginBottom: 4 }}>
        {matrixName || "Ma trận đặc tả"}
      </h1>
      {matrixDescription && (
        <p style={{ textAlign: "center", fontSize: 11, color: "#666", marginBottom: 12 }}>
          {matrixDescription}
        </p>
      )}

      <div className="stats-summary">
        <div className="stats-card">
          <div className="value">{totalQuestions}</div>
          <div className="label">Tổng câu hỏi</div>
        </div>
        <div className="stats-card">
          <div className="value">{Object.keys(rulesByPart).length}</div>
          <div className="label">Phần thi</div>
        </div>
        <div className="stats-card">
          <div className="value">{rules.length}</div>
          <div className="label">Quy tắc</div>
        </div>
        <div className="stats-card">
          <div className="value">{groups?.length || 0}</div>
          <div className="label">Nhóm câu hỏi</div>
        </div>
      </div>

      <h2 style={{ marginTop: 16, marginBottom: 6 }}>Chi tiết theo Phần</h2>
      {Object.entries(rulesByPart)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([part, partRules]) => {
          const partTotal = partRules.reduce((s, r) => s + r.count, 0);
          return (
            <div key={part} style={{ marginBottom: 12 }}>
              <h3>{PART_NAMES[Number(part)] || `Phần ${part}`}</h3>
              <table className="print-table matrix-table">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>STT</th>
                    <th>Chủ đề kiến thức</th>
                    <th style={{ width: 80 }}>Dạng câu</th>
                    <th style={{ width: 80 }}>Mức độ</th>
                    <th style={{ width: 50 }}>SL</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {partRules.map((rule, idx) => (
                    <tr key={rule.id || idx}>
                      <td className="center">{idx + 1}</td>
                      <td>{rule.knowledge_node?.name || `Node #${rule.knowledge_node_id}`}</td>
                      <td className="center">
                        {TYPE_MAP[rule.question_type || "SINGLE_CHOICE"] || "Tự động"}
                      </td>
                      <td className="center">
                        {rule.level ? LEVEL_MAP[rule.level] : "Tự động"}
                      </td>
                      <td className="center">{rule.count}</td>
                      <td>{rule.note || ""}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan={4} style={{ textAlign: "right" }}>
                      Tổng phần {part}:
                    </td>
                    <td className="center">{partTotal}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

      <h2 style={{ marginTop: 16, marginBottom: 6 }}>Phân bố Mức độ</h2>
      <table className="print-table">
        <thead>
          <tr>
            {Object.entries(levelDist)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([level]) => (
                <th key={level}>{LEVEL_MAP[Number(level)] || `Level ${level}`}</th>
              ))}
            <th>Tổng</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {Object.entries(levelDist)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([level, count]) => (
                <td key={level} className="center">
                  {count} ({Math.round((count / totalQuestions) * 100)}%)
                </td>
              ))}
            <td className="center" style={{ fontWeight: "bold" }}>
              {totalQuestions}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ marginTop: 16, marginBottom: 6 }}>Phân bố Dạng câu</h2>
      <table className="print-table">
        <thead>
          <tr>
            {Object.keys(typeDist).map((type) => (
              <th key={type}>{TYPE_MAP[type] || type}</th>
            ))}
            <th>Tổng</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {Object.entries(typeDist).map(([type, count]) => (
              <td key={type} className="center">
                {count} ({Math.round((count / totalQuestions) * 100)}%)
              </td>
            ))}
            <td className="center" style={{ fontWeight: "bold" }}>
              {totalQuestions}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
