import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import Plot from 'react-plotly.js';

type ChartType = 'topic' | 'concept' | 'skill' | 'level' | 'groups';

interface VisualizationProps {
  data: any[]; // The raw matrix rules
  groups?: any[]; // The matrix rule groups
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function MatrixVisualization({ data, groups = [] }: VisualizationProps) {
  const [chartType, setChartType] = useState<ChartType>('topic');

  // Topic (Donut) Data
  const topicData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => {
      const topicName = item.knowledge_node?.parent?.parent?.name || item.topic || 'Topic';
      const count = item.count || 0;
      map.set(topicName, (map.get(topicName) || 0) + count);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data]);

  // Concept (Treemap) Data via Plotly
  const conceptTreemapData = useMemo(() => {
    const ids: string[] = ['Root'];
    const labels: string[] = ['Ma trận'];
    const parents: string[] = [''];
    const values: number[] = [0];
    
    let rootSum = 0;
    const topicsMap = new Map<string, any>();
    
    data.forEach((item) => {
      const topicName = item.knowledge_node?.parent?.parent?.name || item.topic || 'Topic';
      const conceptName = item.knowledge_node?.parent?.name || item.concept || 'Concept';
      const count = item.count || 0;
      
      if (!topicsMap.has(topicName)) topicsMap.set(topicName, { name: topicName, value: 0, concepts: new Map() });
      const t = topicsMap.get(topicName);
      t.value += count;
      
      if (!t.concepts.has(conceptName)) t.concepts.set(conceptName, { name: conceptName, value: 0 });
      t.concepts.get(conceptName).value += count;
    });

    for (const t of topicsMap.values()) {
      const tId = `T-${t.name}`;
      ids.push(tId);
      labels.push(t.name);
      parents.push('Root');
      values.push(t.value);
      rootSum += t.value;
      
      for (const c of t.concepts.values()) {
        ids.push(`C-${t.name}-${c.name}`);
        labels.push(c.name);
        parents.push(tId);
        values.push(c.value);
      }
    }
    
    values[0] = rootSum;
    return { ids, labels, parents, values };
  }, [data]);

  // Skill (Horizontal Bar List) Data
  const skillData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => {
      const skillName = item.knowledge_node?.name || item.skill || 'Skill';
      const count = item.count || 0;
      map.set(skillName, (map.get(skillName) || 0) + count);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.count - b.count); // Sort ascending for horizontal bar (largest at top)
  }, [data]);

  // Mức độ & Dạng câu (Pie / Bar)
  const levelData = useMemo(() => {
    const levels = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const levelNames = { 1: "Nhận biết", 2: "Thông hiểu", 3: "Vận dụng", 4: "Vận dụng cao" };
    data.forEach((item) => {
      const lv = item.level || 1;
      levels[lv as keyof typeof levels] += (item.count || 0);
    });
    return Object.entries(levels)
      .filter(([_, count]) => count > 0)
      .map(([lv, count]) => ({ name: levelNames[Number(lv) as keyof typeof levelNames], value: count }));
  }, [data]);

  const typeData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(item => {
      const type = item.question_type === 'SINGLE_CHOICE' ? 'Trắc nghiệm' 
                 : item.question_type === 'MULTIPLE_CHOICE' ? 'Nhiều lựa chọn'
                 : item.question_type === 'TRUE_FALSE' ? 'Đúng/Sai'
                 : item.question_type === 'FILL_IN_BLANK' ? 'Điền khuyết'
                 : 'Câu hỏi chùm';
      map.set(type, (map.get(type) || 0) + (item.count || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data]);

  // Table Data for Groups
  const groupTableData = useMemo(() => {
    let groupedCount = 0;
    let standaloneCount = 0;
    
    const groupStats = new Map<number, { label: string, count: number }>();
    
    data.forEach(item => {
      if (item.group_local_id) {
        groupedCount += (item.count || 0);
        if (!groupStats.has(item.group_local_id)) {
          const g = groups.find(x => x.local_id === item.group_local_id);
          groupStats.set(item.group_local_id, { label: g?.label || `Nhóm ${item.group_local_id}`, count: 0 });
        }
        groupStats.get(item.group_local_id)!.count += (item.count || 0);
      } else {
        standaloneCount += (item.count || 0);
      }
    });
    
    return { 
      groupedCount, 
      standaloneCount, 
      total: groupedCount + standaloneCount,
      groups: Array.from(groupStats.values())
    };
  }, [data, groups]);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
        <h3 className="text-sm font-semibold text-slate-800">Biểu đồ Phân tích Ma trận</h3>
        <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg">
          {(['topic', 'concept', 'skill', 'level', 'groups'] as const).map((type) => {
            const labels = { topic: 'Topic (Donut)', concept: 'Concept (Treemap)', skill: 'Skill (Bar)', level: 'Mức độ & Dạng câu', groups: 'Nhóm câu hỏi' };
            return (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  chartType === type 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {labels[type]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="h-[400px] w-full flex items-center justify-center relative">
        {chartType === 'topic' && (
           <ResponsiveContainer width="100%" height="100%">
             <PieChart>
               <Pie data={topicData} cx="50%" cy="50%" innerRadius={80} outerRadius={140} paddingAngle={2} dataKey="value" label={({name, percent}) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                 {topicData.map((_entry, index) => (
                   <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                 ))}
               </Pie>
               <RechartsTooltip />
             </PieChart>
           </ResponsiveContainer>
        )}
        
        {chartType === 'concept' && (
          <Plot
            data={[{
              type: 'treemap',
              ids: conceptTreemapData.ids,
              labels: conceptTreemapData.labels,
              parents: conceptTreemapData.parents,
              values: conceptTreemapData.values,
              branchvalues: 'total',
              textinfo: 'label+value+percent parent',
            }]}
            layout={{ margin: { l: 0, r: 0, b: 0, t: 0 }, paper_bgcolor: 'transparent' }}
            useResizeHandler
            className="w-full h-full"
          />
        )}
        
        {chartType === 'skill' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={skillData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={150} tick={{ fontSize: 11, fill: '#64748B' }} />
              <RechartsTooltip cursor={{ fill: '#F1F5F9' }} />
              <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {chartType === 'level' && (
          <div className="flex w-full h-full gap-4">
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie data={levelData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({name, percent}) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {levelData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#60A5FA', '#34D399', '#FBBF24', '#F87171'][index % 4]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="50%" height="100%">
              <BarChart data={typeData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{ fill: '#F1F5F9' }} />
                <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartType === 'groups' && (
          <div className="w-full h-full overflow-auto p-2">
             <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-sm font-medium text-slate-500">Câu hỏi Đơn lẻ (Standalone)</h4>
                  <p className="text-2xl font-bold text-slate-800">{groupTableData.standaloneCount} câu</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                  <h4 className="text-sm font-medium text-amber-600">Thuộc Nhóm Ngữ liệu</h4>
                  <p className="text-2xl font-bold text-amber-800">{groupTableData.groupedCount} câu</p>
                </div>
             </div>
             
             {groupTableData.groups.length > 0 ? (
               <table className="w-full text-sm text-left">
                 <thead className="bg-slate-50 text-slate-600 font-medium">
                   <tr>
                     <th className="px-4 py-3 rounded-tl-lg rounded-bl-lg">Tên Nhóm</th>
                     <th className="px-4 py-3 rounded-tr-lg rounded-br-lg text-right">Số lượng câu</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {groupTableData.groups.map((g, i) => (
                     <tr key={i}>
                       <td className="px-4 py-3 text-slate-800 font-medium">{g.label}</td>
                       <td className="px-4 py-3 text-slate-600 text-right">{g.count}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             ) : (
               <div className="text-center py-12 text-slate-400">
                 Không có nhóm ngữ liệu nào trong ma trận này.
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
