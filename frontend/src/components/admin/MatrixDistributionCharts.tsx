import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useMemo } from 'react';
import type { MatrixRule } from '../../types';

interface DistributionChartsProps {
  rules: MatrixRule[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7'];

const LEVEL_LABELS: Record<number, string> = { 1: 'NB', 2: 'TH', 3: 'VD', 4: 'VDC' };
const PART_LABELS: Record<number, string> = { 1: 'Tiếng Việt', 2: 'Tiếng Anh', 3: 'Toán', 4: 'Khoa học' };
const TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: 'Trắc nghiệm',
  MULTIPLE_CHOICE: 'Nhiều lựa chọn',
  TRUE_FALSE: 'Đúng/Sai',
  FILL_IN_BLANK: 'Điền khuyết',
  COMPOSITE: 'Chùm câu',
};

export default function MatrixDistributionCharts({ rules }: DistributionChartsProps) {
  const distributions = useMemo(() => {
    const topicDist: Record<string, number> = {};
    const levelDist: Record<string, number> = {};
    const typeDist: Record<string, number> = {};

    rules.forEach(rule => {
      // Use knowledge_node name for topic if available, otherwise fallback to part
      let topicName = PART_LABELS[rule.part] || `Phần ${rule.part}`;
      if (rule.knowledge_node?.name) {
        topicName = rule.knowledge_node.name;
      }
      topicDist[topicName] = (topicDist[topicName] || 0) + rule.count;

      const levelName = LEVEL_LABELS[rule.level] || `M${rule.level}`;
      levelDist[levelName] = (levelDist[levelName] || 0) + rule.count;

      const typeName = TYPE_LABELS[rule.question_type] || rule.question_type || 'UNKNOWN';
      typeDist[typeName] = (typeDist[typeName] || 0) + rule.count;
    });

    return {
      topicData: Object.entries(topicDist)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      levelData: Object.entries(levelDist)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => {
          const order = ['NB', 'TH', 'VD', 'VDC'];
          return order.indexOf(a.name) - order.indexOf(b.name);
        }),
      typeData: Object.entries(typeDist)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      totalQuestions: rules.reduce((sum, r) => sum + (r.count || 0), 0),
    };
  }, [rules]);

  if (rules.length === 0) {
    return (
      <div className="text-center p-8 text-slate-500 glass-card rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
        Không có dữ liệu để hiển thị biểu đồ
      </div>
    );
  }

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Topic Distribution (Pie) */}
      <div className="glass-card p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center">
        <h4 className="text-lg font-bold mb-1 text-slate-900 dark:text-white">Phân phối theo Kiến thức</h4>
        <p className="text-xs text-slate-500 mb-4">{distributions.totalQuestions} câu hỏi</p>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distributions.topicData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={renderCustomLabel}
                labelLine={false}
              >
                {distributions.topicData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any, name: any) => [`${value} câu`, name]} />
              <Legend iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Level Distribution (Bar) */}
      <div className="glass-card p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center">
        <h4 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Phân phối theo Mức độ</h4>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distributions.levelData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value: any) => [`${value} câu`]} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {distributions.typeData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Type Distribution (Bar) */}
      <div className="glass-card p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center">
        <h4 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Phân phối theo Dạng câu</h4>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distributions.typeData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value: any) => [`${value} câu`]} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {distributions.typeData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
