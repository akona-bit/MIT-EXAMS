import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { resourceApi, ResourceResponse } from '../../api/resources';
import { toast } from '../ui/Toast';
import { Loader2, Search } from 'lucide-react';
import Input from '../ui/Input';

interface ImageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export default function ImageSelectorModal({ isOpen, onClose, onSelect }: ImageSelectorModalProps) {
  const [images, setImages] = useState<ResourceResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadImages();
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

  const filteredImages = images.filter(img => 
    img.original_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chọn hình ảnh từ Kho dữ liệu" maxWidth="max-w-4xl">
      <div className="p-6 flex flex-col h-[60vh]">
        <div className="mb-4 relative">
          <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
          <Input 
            label=""
            placeholder="Tìm kiếm hình ảnh..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex-1 overflow-y-auto min-h-0">
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
              {filteredImages.map((img) => (
                <div 
                  key={img.id}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all bg-slate-100 dark:bg-slate-800"
                  onClick={() => {
                    onSelect(img.content_url);
                    onClose();
                  }}
                >
                  <img 
                    src={img.content_url} 
                    alt={img.original_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                    <p className="text-xs text-white truncate" title={img.original_name}>
                      {img.original_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
