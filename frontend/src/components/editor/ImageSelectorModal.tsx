import { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import { resourceApi, ResourceResponse } from '../../api/resources';
import { toast } from '../ui/Toast';
import { Loader2, Search, Upload, CheckCircle2, ArrowLeft, Trash2 } from 'lucide-react';
import Input from '../ui/Input';

export interface ImageConfig {
  url: string;
  alt: string;
  width?: string;
  align?: string;
  format?: 'markdown' | 'latex';
}

interface ImageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (configs: ImageConfig[], layout: 'horizontal' | 'vertical') => void;
}

export default function ImageSelectorModal({ isOpen, onClose, onSelect }: ImageSelectorModalProps) {
  const [images, setImages] = useState<ResourceResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [configs, setConfigs] = useState<Record<string, ImageConfig>>({});
  const [exportFormat, setExportFormat] = useState<'markdown' | 'latex'>('markdown');
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'vertical'>('vertical');
  
  const [step, setStep] = useState<1 | 2>(1);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadImages();
      setStep(1);
      setSelectedIds([]);
      setConfigs({});
      setSearch("");
    }
  }, [isOpen]);

  const loadImages = async () => {
    setIsLoading(true);
    try {
      const data = await resourceApi.list('IMAGE');
      setImages(data);
    } catch (error) {
      console.error(error);
      toast.error('Không thể tải danh sách hình ảnh');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFileUploadClean = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    let uploadedCount = 0;
    const newImages: ResourceResponse[] = [];

    // Notify user that upload is starting
    toast.info(`Đang tải lên ${files.length} hình ảnh...`);

    for (const file of files) {
      try {
        const uploaded = await resourceApi.upload(file, 'IMAGE');
        newImages.push(uploaded);
        uploadedCount++;
      } catch (err: any) {
        toast.error(`Upload file ${file.name} thất bại.`);
      }
    }
    
    if (uploadedCount > 0) {
      toast.success(`Đã upload thành công ${uploadedCount} hình ảnh.`);
      setImages(prev => [...newImages, ...prev]);
      
      setSelectedIds(prev => {
         const next = [...prev];
         for (const img of newImages) {
            if (!next.includes(img.id)) next.push(img.id);
         }
         return next;
      });

      setConfigs(prev => {
        const next = { ...prev };
        newImages.forEach(img => {
          next[img.id] = { url: img.content_url, alt: img.original_name, width: '100%', align: 'center' };
        });
        return next;
      });
    }
    
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleSelection = (img: ResourceResponse) => {
    setSelectedIds(prev => {
      const isSelected = prev.includes(img.id);
      if (isSelected) {
        return prev.filter(id => id !== img.id);
      } else {
        setConfigs(c => ({
          ...c,
          [img.id]: { url: img.content_url, alt: img.original_name, width: '100%', align: 'center' }
        }));
        return [...prev, img.id];
      }
    });
  };

  const updateConfig = (id: string, updates: Partial<ImageConfig>) => {
    setConfigs(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

  const handleProceed = () => {
    if (selectedIds.length === 0) {
      toast.warning("Vui lòng chọn ít nhất một hình ảnh.");
      return;
    }
    setStep(2);
  };

  const handleSubmit = () => {
    const finalConfigs = selectedIds.map(id => ({
      ...configs[id],
      format: exportFormat
    })).filter(Boolean);
    onSelect(finalConfigs as ImageConfig[], layoutMode);
    onClose();
  };

  const filteredImages = images.filter(img => 
    img.original_name.toLowerCase().includes(search.toLowerCase())
  );

  const generatePreviewCode = () => {
    let code = "";
    selectedIds.forEach(id => {
      const conf = configs[id];
      if (!conf) return;
      if (exportFormat === 'latex') {
        let widthStr = '';
        if (conf.width && conf.width !== '100%') {
           if (conf.width.endsWith('%')) {
              const wVal = parseFloat(conf.width);
              widthStr = `[width=${(wVal/100).toFixed(2)}\\linewidth]`;
           } else {
              widthStr = `[width=${conf.width}]`;
           }
        }
        code += `\\begin{figure}[H]\n\\centering\n\\includegraphics${widthStr}{${conf.url}}\n${conf.alt ? `\\caption{${conf.alt}}\n` : ''}\\end{figure}\n\n`;
      } else {
        const titleParts = [];
        if (conf.width && conf.width !== '100%') titleParts.push(`width=${conf.width}`);
        if (conf.align && conf.align !== 'center') titleParts.push(`align=${conf.align}`);
        const title = titleParts.length > 0 ? ` "${titleParts.join(' ')}"` : '';
        code += `![${conf.alt || 'image'}](${conf.url}${title})\n\n`;
      }
    });
    return code;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={step === 1 ? "Chọn hình ảnh" : "Cấu hình hình ảnh"} maxWidth={step === 1 ? "max-w-4xl" : "max-w-6xl"}>
      <div className="p-6 flex flex-col h-[70vh]">
        {step === 1 ? (
          <>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                <Input 
                  label=""
                  placeholder="Tìm kiếm hình ảnh..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUploadClean} 
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold transition-all shadow-md shadow-primary-500/20 whitespace-nowrap"
              >
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                Tải lên hàng loạt
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              {isLoading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
              ) : filteredImages.length === 0 ? (
                <div className="flex justify-center items-center h-full text-slate-500">
                  Không tìm thấy hình ảnh nào.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  {filteredImages.map((img) => {
                    const isSelected = selectedIds.includes(img.id);
                    return (
                      <div 
                        key={img.id}
                        className={`group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${isSelected ? 'border-primary-500 ring-4 ring-primary-500/20' : 'border-transparent hover:border-primary-300 dark:hover:border-primary-700'} bg-white dark:bg-slate-800`}
                        onClick={() => toggleSelection(img)}
                      >
                        <img 
                          src={img.content_url} 
                          alt={img.original_name}
                          className={`w-full h-full object-cover transition-all ${isSelected ? 'scale-110 opacity-70' : 'group-hover:scale-105'}`}
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <CheckCircle2 className="w-10 h-10 text-primary-500 fill-white drop-shadow-md" />
                          </div>
                        )}
                        <div className={`absolute inset-x-0 bottom-0 bg-black/60 p-2 transition-transform ${isSelected ? 'translate-y-0' : 'translate-y-full group-hover:translate-y-0'}`}>
                          <p className="text-xs text-white truncate" title={img.original_name}>
                            {img.original_name}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Đã chọn: <span className="text-primary-600 font-bold">{selectedIds.length}</span> hình ảnh
              </span>
              <button 
                onClick={handleProceed} 
                disabled={selectedIds.length === 0}
                className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Tiếp tục thiết lập →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 mb-4">
              <div className="w-full lg:w-2/3 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm relative">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700 w-12 text-center">STT</th>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700 w-24">Hình ảnh</th>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">Chú thích (Alt)</th>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700 w-32">Chiều rộng</th>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700 w-32">Căn chỉnh</th>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700 w-16 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedIds.map((id, index) => {
                      const conf = configs[id];
                      if (!conf) return null;
                      return (
                        <tr key={id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 text-sm font-semibold text-slate-500 text-center">{index + 1}</td>
                          <td className="p-3">
                            <img src={conf.url} className="w-16 h-16 object-cover bg-slate-100 dark:bg-slate-900 rounded-lg shadow-sm" alt="Preview" />
                          </td>
                          <td className="p-3">
                            <input 
                              type="text"
                              value={conf.alt} 
                              onChange={e => updateConfig(id, {alt: e.target.value})} 
                              placeholder="Nhập chú thích..." 
                              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                            />
                          </td>
                          <td className="p-3">
                            <input 
                              type="text"
                              value={conf.width || ''} 
                              onChange={e => updateConfig(id, {width: e.target.value})} 
                              placeholder="vd: 100%, 8cm..." 
                              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                            />
                          </td>
                          <td className="p-3">
                            <select 
                              value={conf.align || 'center'} 
                              onChange={e => updateConfig(id, {align: e.target.value})}
                              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                            >
                               <option value="left">Trái</option>
                               <option value="center">Giữa</option>
                               <option value="right">Phải</option>
                            </select>
                          </td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => {
                                 setSelectedIds(prev => prev.filter(i => i !== id));
                                 if (selectedIds.length === 1) setStep(1); // Go back if empty
                              }}
                              className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
                              title="Bỏ chọn ảnh này"
                            >
                              <Trash2 className="w-5 h-5 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="w-full lg:w-1/3 flex flex-col bg-[#1e1e1e] rounded-xl overflow-hidden shadow-inner border border-slate-700/50 min-h-[300px]">
                <div className="bg-[#2d2d2d] px-4 py-2.5 flex items-center justify-between border-b border-black/30">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                    Live Preview ({exportFormat === 'latex' ? 'LaTeX' : 'Markdown'})
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#1a1a1a]">
                  <div className={layoutMode === 'horizontal' ? "flex flex-wrap items-center justify-center gap-2" : "space-y-6"}>
                    {selectedIds.length === 0 && (
                       <div className="text-slate-500 text-sm text-center italic mt-10 w-full">
                         Chưa có ảnh nào được chọn
                       </div>
                    )}
                    {selectedIds.map((id, index) => {
                      const conf = configs[id];
                      if (!conf) return null;
                      
                      let justify = "center";
                      if (conf.align === "left") justify = "flex-start";
                      if (conf.align === "right") justify = "flex-end";
                      
                      // Subtract gap space so 50% + 50% doesn't wrap to the next line
                      let imgWidth = conf.width || "100%";
                      
                      return (
                        <div key={`preview-${id}`} className={`flex flex-col ${layoutMode === 'horizontal' ? '' : 'w-full'}`} style={layoutMode === 'horizontal' ? { width: `calc(${imgWidth} - 8px)`, flexGrow: 0, flexShrink: 0 } : { alignItems: justify }}>
                          {layoutMode === 'vertical' && (
                             <div className="w-full border-b border-slate-800/50 mb-2 pb-1 flex items-center justify-between">
                               <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Image {index + 1}</span>
                               <span className="text-[10px] text-slate-500 font-mono">{conf.width || '100%'} | {conf.align || 'center'}</span>
                             </div>
                          )}
                          <img 
                            src={conf.url} 
                            alt={conf.alt} 
                            style={layoutMode === 'vertical' ? { width: imgWidth, maxWidth: "100%" } : { width: '100%', maxWidth: "100%" }} 
                            className="rounded-md shadow-lg shadow-black/50 bg-slate-900 border border-slate-700/50 transition-all object-contain"
                          />
                          {exportFormat === 'latex' && (
                             <span className="text-[10px] text-slate-400 mt-2 italic text-center font-serif leading-tight">Hình {index + 1}: {conf.alt || "..."}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-4 gap-4">
              <button 
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors w-full sm:w-auto justify-center"
              >
                <ArrowLeft className="w-4 h-4" /> Quay lại chọn ảnh
              </button>
              
              <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 pr-4">
                  <span>Bố cục:</span>
                  <select 
                    value={layoutMode}
                    onChange={(e) => setLayoutMode(e.target.value as 'horizontal' | 'vertical')}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer"
                  >
                    <option value="vertical">Dọc (Xuống dòng)</option>
                    <option value="horizontal">Ngang (Cạnh nhau)</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <span>Mã xuất ra:</span>
                  <select 
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'markdown' | 'latex')}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-500/20 cursor-pointer"
                  >
                    <option value="markdown">Markdown (Azota)</option>
                    <option value="latex">LaTeX (Overleaf)</option>
                  </select>
                </div>
                
                <button 
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-bold shadow-md shadow-primary-500/30 transition-all whitespace-nowrap ml-auto"
                >
                  Chèn {selectedIds.length} ảnh
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
