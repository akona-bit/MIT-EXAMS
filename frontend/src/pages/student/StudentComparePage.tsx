import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { ArrowLeft, LineChart as LineChartIcon, Activity } from "lucide-react";
import Button from "../../components/ui/Button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface CompareItem {
  name: string;
  score: number | null;
  max_score: number;
}

export default function StudentComparePage() {
  const navigate = useNavigate();
  const [compareData, setCompareData] = useState<{ name: string; score: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get("/api/v1/exams/my-history")
      .then((res) => {
        const items: CompareItem[] = res.data.items || [];
        const scored = items
          .filter(h => h.score !== null)
          .map(h => ({
            name: h.name.length > 15 ? h.name.slice(0, 15) + "..." : h.name,
            score: h.score || 0,
          }));
        setCompareData(scored);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="pb-20">
      {/* Hero Header */}
      <div className="bg-indigo-600 pt-8 pb-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" className="text-white hover:bg-white/20 hover:text-white mb-6 -ml-2 font-bold" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5 mr-2" /> Quay lại Hồ sơ
          </Button>
          <div className="text-white flex items-center gap-4">
             <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
               <LineChartIcon className="w-10 h-10" />
             </div>
             <div>
                <h1 className="text-3xl font-black tracking-tight">So sánh Năng lực</h1>
                <p className="text-indigo-100 mt-1 font-medium">Theo dõi tiến độ học tập qua các kỳ thi</p>
             </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden">
           <div className="px-8 py-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                 <Activity className="w-5 h-5 text-indigo-500" /> Biểu đồ Điểm số
              </h2>
           </div>
           
           <div className="p-8 h-[500px]">
              {isLoading ? (
                 <div className="h-full flex items-center justify-center">
                   <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-primary-600"></div>
                 </div>
              ) : compareData.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full mb-6">
                       <LineChartIcon className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Chưa có dữ liệu so sánh</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">Hãy hoàn thành ít nhất 1 kỳ thi để xem biểu đồ so sánh</p>
                 </div>
              ) : (
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={compareData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                       <XAxis 
                          dataKey="name" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                          dy={10}
                       />
                       <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                       />
                       <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', padding: '16px' }}
                          labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}
                       />
                       <Legend wrapperStyle={{ paddingTop: '20px' }} />
                       <Line 
                          type="monotone" 
                          dataKey="score" 
                          name="Điểm số" 
                          stroke="#6366f1" 
                          strokeWidth={4}
                          dot={{ r: 6, strokeWidth: 3, fill: '#fff' }}
                          activeDot={{ r: 8, fill: '#6366f1' }}
                       />
                    </LineChart>
                 </ResponsiveContainer>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
