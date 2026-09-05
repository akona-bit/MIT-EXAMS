import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, FileText } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { toast } from '../../components/ui/Toast';
import { passageApi } from '../../api/passages';
import MarkdownEditor from '../../components/editor/MarkdownEditor';

export default function PassageFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    source_title: '',
    source_author: '',
    content: ''
  });

  useEffect(() => {
    if (isEdit && id) {
      loadPassage(id);
    }
  }, [id, isEdit]);

  const loadPassage = async (code: string) => {
    try {
      setLoading(true);
      const data = await passageApi.getByCode(code);
      setFormData({
        source_title: data.source_title || '',
        source_author: data.source_author || '',
        content: data.content || ''
      });
    } catch (error) {
      console.error('Failed to load passage', error);
      toast.error('Không thể tải dữ liệu ngữ liệu.');
      navigate('/admin/resources');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.content.trim()) {
      toast.warning('Vui lòng nhập nội dung ngữ liệu.');
      return;
    }

    try {
      setSaving(true);
      if (isEdit && id) {
        await passageApi.update(id, {
          content: formData.content,
          source_title: formData.source_title,
          source_author: formData.source_author,
        });
      } else {
        await passageApi.create({
          content: formData.content,
          source_title: formData.source_title,
          source_author: formData.source_author,
        });
      }
      navigate('/admin/resources');
    } catch (error) {
      console.error('Failed to save passage', error);
      toast.error('Lưu ngữ liệu thất bại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-gradient flex items-center gap-3 pb-1">
          <FileText className="w-8 h-8 text-primary-500" />
          {isEdit ? 'Chỉnh sửa Ngữ Liệu' : 'Thêm Ngữ Liệu Mới'}
        </h1>
        <Button variant="ghost" onClick={() => navigate('/admin/passages')}>
          Quay lại
        </Button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-8 text-center text-sm text-slate-500 backdrop-blur-xl">
          Đang tải dữ liệu ngữ liệu...
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="glass-card space-y-6 border-t-4 border-t-primary-500 p-6">
            <h2 className="text-lg font-bold border-b border-slate-200 dark:border-slate-700 pb-2">1. Thông tin chung</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Nguồn / Tiêu đề (tùy chọn)</label>
                <Input
                  label=""
                  value={formData.source_title}
                  onChange={(e) => setFormData(prev => ({ ...prev, source_title: e.target.value }))}
                  placeholder="VD: Trích đoạn báo Tuổi Trẻ..."
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Tác giả (tùy chọn)</label>
                <Input
                  label=""
                  value={formData.source_author}
                  onChange={(e) => setFormData(prev => ({ ...prev, source_author: e.target.value }))}
                  placeholder="VD: Nguyễn Văn A"
                />
              </div>
            </div>
          </div>

          <div className="glass-card space-y-6 p-6">
            <h2 className="text-lg font-bold border-b border-slate-200 dark:border-slate-700 pb-2">
              2. Nội dung bài đọc <span className="text-red-500">*</span>
            </h2>
            <div className="space-y-4">
              <MarkdownEditor
                value={formData.content}
                onChange={(val: string) => setFormData(prev => ({ ...prev, content: val }))}
                placeholder="Nhập nội dung bài đọc tại đây..."
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 pb-12 sticky bottom-0 z-20">
            <Button type="submit" isLoading={saving} size="lg" className="shadow-lg shadow-primary-500/20 px-12 py-6 text-lg">
              {isEdit ? "Lưu thay đổi" : "Hoàn tất tạo ngữ liệu"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
