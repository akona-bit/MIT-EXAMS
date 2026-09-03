import { useState, useEffect, useRef } from "react";
import { ForceGraph2D } from "react-force-graph-2d";
import { getKnowledgeGraph } from "../../api/knowledge";
import type { KnowledgeGraph } from "../../types";
import { Loader2, Maximize2, ZoomIn, ZoomOut, Filter } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";

export default function KnowledgeGraphPage() {
  const fgRef = useRef<any>();
  const [data, setData] = useState<KnowledgeGraph | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState<string>("Toán");
  
  const subjects = ["Toán", "Vật lí", "Hóa học", "Sinh học", "Lịch sử", "Địa lí", "Tiếng Anh"];

  useEffect(() => {
    fetchGraph();
  }, [subjectFilter]);

  const fetchGraph = async () => {
    setIsLoading(true);
    try {
      const graphData = await getKnowledgeGraph(subjectFilter);
      
      // Calculate node sizes based on question counts
      const maxCount = Math.max(...graphData.nodes.map(n => n.question_count || 0), 1);
      
      const processedData = {
        nodes: graphData.nodes.map(n => ({
          ...n,
          val: Math.max(1, ((n.question_count || 0) / maxCount) * 10),
          color: getNodeColor(n.type)
        })),
        links: graphData.edges.map(e => ({
          ...e,
          color: e.type === "hierarchical" ? "#94a3b8" : "#f43f5e",
          width: e.type === "hierarchical" ? 1 : 2,
          lineDash: e.type === "hierarchical" ? [] : [5, 5]
        }))
      };
      
      setData(processedData as any);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const getNodeColor = (type: string) => {
    switch(type?.toLowerCase()) {
      case 'topic': return '#3b82f6'; // blue-500
      case 'concept': return '#8b5cf6'; // violet-500
      case 'skill': return '#10b981'; // emerald-500
      default: return '#64748b'; // slate-500
    }
  };

  const handleZoomIn = () => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom * 1.5, 400);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom / 1.5, 400);
    }
  };

  const handleFit = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 50);
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] w-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      {/* Top Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-4 rounded-xl shadow-lg border border-slate-200 dark:border-white/10 pointer-events-auto">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Đồ thị Tri thức (Knowledge Graph)</h1>
          <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
             <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Chủ đề</div>
             <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-violet-500 inline-block"></span> Khái niệm</div>
             <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Kỹ năng</div>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-2">
            {subjects.map(s => (
              <Badge 
                key={s}
                variant={subjectFilter === s ? "primary" : "outline"}
                className="cursor-pointer"
                onClick={() => setSubjectFilter(s)}
              >
                {s}
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="flex flex-col gap-2 pointer-events-auto">
          <Button variant="secondary" size="icon" className="shadow-lg bg-white dark:bg-slate-800" onClick={handleZoomIn}>
            <ZoomIn className="w-5 h-5" />
          </Button>
          <Button variant="secondary" size="icon" className="shadow-lg bg-white dark:bg-slate-800" onClick={handleZoomOut}>
            <ZoomOut className="w-5 h-5" />
          </Button>
          <Button variant="secondary" size="icon" className="shadow-lg bg-white dark:bg-slate-800" onClick={handleFit}>
            <Maximize2 className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      {/* Graph Container */}
      <div className="flex-1 w-full h-full">
        {isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
             <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-4" />
             <p className="text-slate-500">Đang tải và xây dựng đồ thị...</p>
          </div>
        ) : data && data.nodes.length > 0 ? (
          <ForceGraph2D
            ref={fgRef}
            graphData={data}
            nodeLabel={(node: any) => `${node.label} (${node.question_count || 0} câu hỏi)`}
            nodeColor={(node: any) => node.color}
            nodeRelSize={4}
            linkColor={(link: any) => link.color}
            linkWidth={(link: any) => link.width}
            linkLineDash={(link: any) => link.lineDash}
            linkDirectionalArrowLength={(link: any) => link.type === "hierarchical" ? 3.5 : 0}
            linkDirectionalArrowRelPos={1}
            onNodeClick={(node) => {
              if (fgRef.current) {
                 fgRef.current.centerAt(node.x, node.y, 1000);
                 fgRef.current.zoom(3, 1000);
              }
            }}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
             <Filter className="w-12 h-12 text-slate-300 mb-4" />
             <p className="text-slate-500">Không có dữ liệu đồ thị cho môn {subjectFilter}</p>
          </div>
        )}
      </div>
    </div>
  );
}
