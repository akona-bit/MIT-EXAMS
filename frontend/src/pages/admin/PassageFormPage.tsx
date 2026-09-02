import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, FileText } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { passageApi } from '../../api/passages';
import MDEditor from '@uiw/react-md-editor';

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
      alert('Không thể tải dữ liệu ngữ liệu.');
      navigate('/admin/passages');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.content.trim()) {
      alert('Vui lòng nhập nội dung ngữ liệu.');
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
      navigate('/admin/passages');
    } catch (error) {
      console.error('Failed to save passage', error);
      alert('Lưu ngữ liệu thất bại.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/passages')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary-600" />
            {isEdit ? 'Chỉnh sửa Ngữ Liệu' : 'Thêm Ngữ Liệu Mới'}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving} className="min-w-[100px]">
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Lưu
            </>
          )}
        </Button>
      </div>

      <Card className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">Nguồn / Tiêu đề (tùy chọn)</label>
            <Input
              value={formData.source_title}
              onChange={(e) => setFormData(prev => ({ ...prev, source_title: e.target.value }))}
              placeholder="VD: Trích đoạn báo Tuổi Trẻ..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">Tác giả (tùy chọn)</label>
            <Input
              value={formData.source_author}
              onChange={(e) => setFormData(prev => ({ ...prev, source_author: e.target.value }))}
              placeholder="VD: Nguyễn Văn A"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700">
            Nội dung bài đọc <span className="text-red-500">*</span>
          </label>
          <div data-color-mode="light">
            <MDEditor
              value={formData.content}
              onChange={(val: string | undefined) => setFormData(prev => ({ ...prev, content: val || '' }))}
              height={400}
              preview="edit"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
