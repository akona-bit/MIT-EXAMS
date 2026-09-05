import React, { useState } from "react";
import { usePassageGroupDraft } from "../../../hooks/usePassageGroupDraft";
import PassageSelectStep from "./PassageSelectStep";
import PassageEditStep from "./PassageEditStep";
import QuestionListStep from "./QuestionListStep";
import PassageGroupPreview from "./PassageGroupPreview";
import { passageApi } from "../../../api/passages";
import { useNavigate } from "react-router-dom";
import { toast } from "../../ui/Toast";
import ConfirmDialog from "../../ui/ConfirmDialog";

export default function PassageGroupWizard() {
  const navigate = useNavigate();
  // Using a single draft ID per session. If editing, we might pass id in URL,
  // but for creating new, 'new' is fine.
  const draftId = "new";
  const { draft, updateDraft, clearDraft } = usePassageGroupDraft(draftId);

  const [submitting, setSubmitting] = useState(false);
  const [confirmNoQuestions, setConfirmNoQuestions] = useState(false);

  // Navigation between steps
  const nextStep = () => updateDraft({ currentStep: draft.currentStep + 1 });
  const prevStep = () => updateDraft({ currentStep: draft.currentStep - 1 });

  const handleSave = async () => {
    if (!draft.passageContent.trim()) {
      toast.warning("Vui lòng nhập nội dung ngữ liệu!");
      return;
    }

    // Check questions — dùng ConfirmDialog thay window.confirm
    if (draft.questions.length === 0) {
      setConfirmNoQuestions(true);
      return;
    }

    await doSave();
  };

  const doSave = async () => {
    setConfirmNoQuestions(false);
    setSubmitting(true);
    try {
      let code = draft.public_code;
      // 1. Save passage
      if (!code) {
        const res = await passageApi.create({
          content: draft.passageContent,
          source_author: draft.sourceAuthor,
          source_title: draft.sourceTitle,
        });
        code = res.public_code;
      } else {
        await passageApi.update(code, {
          content: draft.passageContent,
          source_author: draft.sourceAuthor,
          source_title: draft.sourceTitle,
        });
      }

      // 2. Save questions if there are any
      if (code && draft.questions.length > 0) {
        await passageApi.bulkUpdateQuestions(code, draft.questions);
      } else if (code) {
        // Just clear old questions if any
        await passageApi.bulkUpdateQuestions(code, []);
      }

      clearDraft();
      toast.success("Lưu thành công!");
      navigate("/admin/questions");
    } catch (e: any) {
      console.error(e);
      toast.error("Lỗi khi lưu dữ liệu", e.response?.data?.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (draft.currentStep) {
      case 0:
        return (
          <PassageSelectStep
            draft={draft}
            updateDraft={updateDraft}
            onNext={nextStep}
          />
        );
      case 1:
        return <PassageEditStep draft={draft} updateDraft={updateDraft} />;
      case 2:
        return <QuestionListStep draft={draft} updateDraft={updateDraft} />;
      default:
        return <div>Invalid Step</div>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">
          Tạo Nhóm Câu Hỏi (Ngữ liệu chung)
        </h1>
        {draft.lastSavedAt && (
          <span className="text-sm text-slate-500 italic">
            Đã lưu nháp lúc {new Date(draft.lastSavedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Stepper Header */}
      <div className="flex items-center mb-8">
        {[
          { id: 0, label: "Chọn nguồn" },
          { id: 1, label: "Nội dung chung" },
          { id: 2, label: "Câu hỏi con" },
        ].map((step, idx) => (
          <React.Fragment key={step.id}>
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${draft.currentStep >= step.id ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}
            >
              {step.id + 1}
            </div>
            <span
              className={`ml-3 font-medium ${draft.currentStep >= step.id ? "text-slate-800" : "text-slate-400"}`}
            >
              {step.label}
            </span>
            {idx < 2 && (
              <div
                className={`flex-1 h-1 mx-4 ${draft.currentStep > step.id ? "bg-blue-600" : "bg-slate-200"}`}
              ></div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex gap-8">
        {/* Left Column: Editor/Steps */}
        <div className="w-2/3">
          {renderStep()}

          {/* Navigation Controls */}
          <div className="mt-8 flex justify-between border-t border-slate-200 pt-6">
            <button
              onClick={prevStep}
              disabled={draft.currentStep === 0 || submitting}
              className="px-6 py-2 border border-slate-300 rounded text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Quay lại
            </button>

            {draft.currentStep < 2 && draft.currentStep > 0 && (
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
              >
                Tiếp tục
              </button>
            )}

            {draft.currentStep === 2 && (
              <button
                onClick={handleSave}
                disabled={submitting}
                className="px-6 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                {submitting ? "Đang lưu..." : "Lưu tất cả"}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="w-1/3">
          <h3 className="font-medium text-slate-700 mb-4">
            Xem trước (Preview)
          </h3>
          <PassageGroupPreview
            passageContent={draft.passageContent}
            sourceAuthor={draft.sourceAuthor}
            sourceTitle={draft.sourceTitle}
            questions={draft.questions.map((q) => ({
              content: q.content,
              answers: q.answers,
            }))}
          />
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmNoQuestions}
        title="Nhóm chưa có câu hỏi nào"
        message="Bạn có chắc muốn lưu chỉ mỗi ngữ liệu, không kèm câu hỏi con không?"
        confirmText="Vẫn lưu"
        onConfirm={doSave}
        onCancel={() => setConfirmNoQuestions(false)}
      />
    </div>
  );
}
