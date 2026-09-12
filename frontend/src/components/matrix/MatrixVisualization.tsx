import React, { useState, useMemo } from 'react';
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
  Cell,
  Treemap,
} from 'recharts';
import { LayoutDashboard, Network, Target, BarChart2, Layers } from 'lucide-react';

type ChartType = 'overview' | 'concept' | 'skill' | 'level' | 'groups';

interface VisualizationProps {
  data: any[]; // The raw matrix rules
  groups?: any[]; // The matrix rule groups
}

// Thêm các custom palettes với Rich Aesthetics
const COLORS_TOPIC = ['#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#eab308', '#14b8a6', '#0ea5e9'];
const COLORS_LEVEL = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
const COLORS_TYPE = ['#8b5cf6', '#ec4899', '#f43f5e', '#6366f1'];

export default function MatrixVisualization({ data, groups = [] }: VisualizationProps) {
  const [chartType, setChartType] = useState<ChartType>('overview');

  // Data Mappers
  const topicData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => {
      const topicName = item.knowledge_node?.parent?.parent?.name || item.topic || 'Chủ đề khác';
      const count = item.count || 0;
      map.set(topicName, (map.get(topicName) || 0) + count);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data]);

  const conceptData = useMemo(() => {
    const topicsMap = new Map<string, any>();
    data.forEach((item) => {
      const topicName = item.knowledge_node?.parent?.parent?.name || item.topic || 'Chủ đề khác';
      const conceptName = item.knowledge_node?.parent?.name || item.concept || 'Khái niệm khác';
      const count = item.count || 0;
      
      if (!topicsMap.has(topicName)) {
        topicsMap.set(topicName, { name: topicName, children: new Map() });
      }
      const t = topicsMap.get(topicName);
      if (!t.children.has(conceptName)) {
        t.children.set(conceptName, { name: conceptName, size: 0 });
      }
      t.children.get(conceptName).size += count;
    });

    return Array.from(topicsMap.values()).map(t => ({
      name: t.name,
      children: Array.from(t.children.values()).filter(c => c.size > 0)
    })).filter(t => t.children.length > 0);
  }, [data]);

  const skillData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => {
      const skillName = item.knowledge_node?.name || item.skill || 'Kỹ năng khác';
      const count = item.count || 0;
      if (count > 0) {
        map.set(skillName, (map.get(skillName) || 0) + count);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.count - b.count);
  }, [data]);

  const levelData = useMemo(() => {
    const levels = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const levelNames = { 1: "Nhận biết", 2: "Thông hiểu", 3: "Vận dụng", 4: "Vận dụng cao" };
    data.forEach((item) => {
      const lv = item.level || 1;
      levels[lv as keyof typeof levels] += (item.count || 0);
    });
    return Object.entries(levels)
      .filter(([, count]) => count > 0)
      .map(([lv, count]) => ({ name: levelNames[Number(lv) as keyof typeof levelNames], value: count }));
  }, [data]);

  const typeData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(item => {
      const type = item.question_type === 'SINGLE_CHOICE' ? 'Trắc nghiệm' 
                 : item.question_type === 'MULTIPLE_CHOICE' ? 'Nhiều lựa chọn'
                 : item.question_type === 'TRUE_FALSE' ? 'Đúng/Sai'
                 : item.question_type === 'FILL_IN_BLANK' ? 'Điền khuyết'
                 : 'Khác';
      const count = item.count || 0;
      if (count > 0) map.set(type, (map.get(type) || 0) + count);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data]);

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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 p-4 rounded-2xl shadow-xl shadow-slate-900/10">
          <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">{payload[0].name || label}</p>
          <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full" style={{ backgroundColor: payload[0].payload.fill || payload[0].color || COLORS_TOPIC[0] }} />
             <p className="font-medium text-slate-600 dark:text-slate-300">
               <span className="text-xl font-black text-slate-900 dark:text-white mr-1">{payload[0].value}</span> 
               câu hỏi
             </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const COLORS_TREEMAP = ['#8889DD', '#9597E4', '#8DC77B', '#A5D297', '#E2CF45', '#F8C12D'];
  const CustomTreemapContent = (props: any) => {
    const { root, depth, x, y, width, height, index, name, value } = props;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: depth < 2 ? COLORS_TREEMAP[Math.floor((index / root.children.length) * 6)] : '#ffffff00',
            stroke: '#fff',
            strokeWidth: 2 / (depth + 1e-10),
            strokeOpacity: 1 / (depth + 1e-10),
          }}
        />
        {depth === 1 && width > 50 && height > 30 ? (
          <text x={x + 8} y={y + 18} fill="#fff" fontSize={14} fontWeight="bold">
            {name}
          </text>
        ) : null}
        {depth === 2 && width > 40 && height > 20 ? (
          <text x={x + width / 2} y={y + height / 2} textAnchor="middle" fill="#fff" fontSize={12} opacity={0.9}>
            {name} ({value})
          </text>
        ) : null}
      </g>
    );
  };

  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'concept', label: 'Khái niệm', icon: Network },
    { id: 'skill', label: 'Kỹ năng', icon: Target },
    { id: 'level', label: 'Mức độ', icon: BarChart2 },
    { id: 'groups', label: 'Nhóm Ngữ liệu', icon: Layers }
  ] as const;

  return (
    <div className="w-full bg-slate-50/50 dark:bg-[#0b1120]/50 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-lg overflow-hidden">
      
      {/* Header & Tabs */}
      <div className="px-6 py-5 border-b border-slate-200/50 dark:border-slate-800/50 flex flex-col lg:flex-row items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
        <div>
           <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-emerald-500 bg-clip-text text-transparent">
             Phân tích Cấu trúc Ma trận
           </h3>
           <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Đánh giá độ phủ kiến thức & định dạng câu hỏi</p>
        </div>

        <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = chartType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChartType(tab.id)}
                className={`relative px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all duration-300 ease-out
                  ${isActive 
                    ? 'text-indigo-600 dark:text-indigo-300 shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/20'
                  }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-white dark:bg-slate-950 rounded-lg shadow-sm border border-slate-200/50 dark:border-slate-700/50" style={{ zIndex: 0 }} />
                )}
                <Icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Chart Area */}
      <div className="p-6 h-[450px]">
        
        {chartType === 'overview' && (
           <div className="flex w-full h-full gap-6">
             <div className="w-1/2 flex flex-col">
                <h4 className="text-sm font-bold text-slate-500 text-center uppercase tracking-wider mb-2">Tỷ trọng Chủ đề</h4>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={topicData} 
                        cx="50%" cy="50%" 
                        innerRadius={80} outerRadius={120} 
                        paddingAngle={4} 
                        dataKey="value" 
                        cornerRadius={6}
                      >
                        {topicData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS_TOPIC[index % COLORS_TOPIC.length]} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
             </div>
             
             <div className="w-1/2 flex flex-col border-l border-slate-200 dark:border-slate-800 pl-6">
                <h4 className="text-sm font-bold text-slate-500 text-center uppercase tracking-wider mb-2">Dạng câu hỏi</h4>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typeData} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 600, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#94a3b8' }} />
                      <RechartsTooltip cursor={{ fill: '#f8fafc', opacity: 0.5 }} content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={48}>
                         {typeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_TYPE[index % COLORS_TYPE.length]} />
                         ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             </div>
           </div>
        )}
        
        {chartType === 'concept' && (
          <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-inner">
             {conceptData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <Treemap
                   data={conceptData}
                   dataKey="size"
                   stroke="#fff"
                   fill="#8884d8"
                   content={<CustomTreemapContent />}
                   animationDuration={800}
                 >
                   <RechartsTooltip content={<CustomTooltip />} />
                 </Treemap>
               </ResponsiveContainer>
             ) : (
               <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">Không có dữ liệu khái niệm</div>
             )}
          </div>
        )}
        
        {chartType === 'skill' && (
          <div className="w-full h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-inner">
            {skillData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skillData} layout="vertical" margin={{ top: 10, right: 30, left: 140, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" strokeOpacity={0.4} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={130} tick={{ fontSize: 12, fontWeight: 500, fill: '#475569' }} />
                  <RechartsTooltip cursor={{ fill: '#f1f5f9', opacity: 0.6 }} content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} barSize={20} animationDuration={1000} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">Không có dữ liệu kỹ năng</div>
            )}
          </div>
        )}

        {chartType === 'level' && (
          <div className="flex w-full h-full gap-6 items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-inner">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie 
                  data={levelData} 
                  cx="50%" cy="50%" 
                  innerRadius={70} outerRadius={130} 
                  paddingAngle={5} 
                  dataKey="value"
                  cornerRadius={8}
                >
                  {levelData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_LEVEL[index % COLORS_LEVEL.length]} stroke="rgba(255,255,255,0.7)" strokeWidth={3} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontWeight: 600, fontSize: 14 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartType === 'groups' && (
          <div className="w-full h-full overflow-y-auto pr-2 custom-scrollbar">
             <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                  <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                     <Layers className="w-32 h-32" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1 relative z-10">Câu hỏi Đơn lẻ</h4>
                  <p className="text-5xl font-black text-slate-800 dark:text-slate-100 relative z-10">{groupTableData.standaloneCount}</p>
                </div>
                
                <div className="bg-gradient-to-br from-indigo-50 to-emerald-50 dark:from-indigo-950/40 dark:to-emerald-950/40 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm relative overflow-hidden group">
                  <div className="absolute -right-4 -bottom-4 opacity-10 text-indigo-500 group-hover:scale-110 transition-transform">
                     <Network className="w-32 h-32" />
                  </div>
                  <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1 relative z-10">Thuộc Nhóm Ngữ liệu</h4>
                  <p className="text-5xl font-black text-indigo-900 dark:text-indigo-100 relative z-10">{groupTableData.groupedCount}</p>
                </div>
             </div>
             
             <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
               {groupTableData.groups.length > 0 ? (
                 <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                     <tr>
                       <th className="px-6 py-4">Tên Nhóm Ngữ liệu / Tên Bài đọc</th>
                       <th className="px-6 py-4 text-right">Số lượng câu</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                     {groupTableData.groups.map((g, i) => (
                       <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                         <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                               G{i+1}
                            </span>
                            {g.label}
                         </td>
                         <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium text-right text-lg">{g.count}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               ) : (
                 <div className="text-center py-16 text-slate-400 font-medium">
                   <Layers className="w-12 h-12 mx-auto mb-4 opacity-20" />
                   Không có nhóm ngữ liệu nào trong ma trận này.
                 </div>
               )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
