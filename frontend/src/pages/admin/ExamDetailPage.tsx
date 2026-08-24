import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExam, publishExam, generateExamForms } from '../../api/exams';
import type { Exam } from '../../types';
import Button from '../../components/ui/Button';

export default function ExamDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchExam = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await getExam(parseInt(id));
      setExam(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [id]);

  const handleGenerate = async () => {
    if (!id) return;
    if (confirm('Tạo 4 mã đề cho kỳ thi này?')) {
      try {
        await generateExamForms(parseInt(id), 4);
        alert('Tạo mã đề thành công!');
        fetchExam();
      } catch (error) {
        alert('Lỗi tạo mã đề');
      }
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    if (confirm('Xuất bản kỳ thi? Học sinh sẽ có thể tham gia thi.')) {
      try {
        await publishExam(parseInt(id));
        alert('Đã xuất bản!');
        fetchExam();
      } catch (error) {
        alert('Lỗi xuất bản');
      }
    }
  };

  if (isLoading) return <div>Đang tải...</div>;
  if (!exam) return <div>Không tìm thấy kỳ thi</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">{exam.name}</h1>
        <Button variant="ghost" onClick={() => navigate('/admin/exams')}>Quay lại</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Thông tin chung</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-neutral-500">Trạng thái:</span> <span className="font-medium ml-2">{exam.status}</span></div>
              <div><span className="text-neutral-500">Thời gian:</span> <span className="font-medium ml-2">{exam.duration_minutes} phút</span></div>
              <div><span className="text-neutral-500">ID Ma trận:</span> <span className="font-medium ml-2">{exam.matrix_id}</span></div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm flex flex-col gap-3">
            <h3 className="text-lg font-semibold mb-2">Thao tác</h3>
            {exam.status === 'DRAFT' && (
              <>
                <Button variant="secondary" onClick={handleGenerate}>Sinh mã đề thi</Button>
                <Button variant="primary" onClick={handlePublish}>Xuất bản (Publish)</Button>
              </>
            )}
            {exam.status === 'PUBLISHED' && (
              <Button variant="secondary" disabled>Đang diễn ra</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
