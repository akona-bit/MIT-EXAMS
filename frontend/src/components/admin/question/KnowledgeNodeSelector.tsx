import React, { useState, useEffect } from 'react';
import { getKnowledgeTree, getKnowledgeNodeContext } from '../../../api/knowledge';
import type { KnowledgeNode } from '../../../types';
import { ChevronRight, Info, AlertTriangle } from 'lucide-react';
import { Badge } from '../../ui/Badge';

interface KnowledgeNodeSelectorProps {
  value: string;
  onChange: (nodeId: string) => void;
  subject?: string;
  error?: string;
}

export default function KnowledgeNodeSelector({ value, onChange, subject, error }: KnowledgeNodeSelectorProps) {
  const [tree, setTree] = useState<KnowledgeNode[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selections at each level
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<number | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<number | null>(null);
  
  // Context for the selected skill
  const [contextData, setContextData] = useState<any>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  useEffect(() => {
    getKnowledgeTree(subject).then(data => {
      setTree(data);
      setLoading(false);
      
      // Auto-restore selections if value is present
      if (value) {
        const valId = parseInt(value, 10);
        setSelectedSkill(valId);
        
        // Find path
        for (const topic of data) {
          if (topic.children) {
            for (const concept of topic.children) {
              if (concept.children) {
                for (const skill of concept.children) {
                  if (skill.id === valId) {
                    setSelectedTopic(topic.id);
                    setSelectedConcept(concept.id);
                    break;
                  }
                }
              }
            }
          }
        }
      }
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [subject, value]);

  useEffect(() => {
    if (selectedSkill) {
      setLoadingContext(true);
      getKnowledgeNodeContext(selectedSkill).then(data => {
        setContextData(data);
        setLoadingContext(false);
      }).catch(() => setLoadingContext(false));
      onChange(selectedSkill.toString());
    } else {
      setContextData(null);
    }
  }, [selectedSkill]);

  const topics = tree;
  const concepts = topics.find(t => t.id === selectedTopic)?.children || [];
  const skills = concepts.find(c => c.id === selectedConcept)?.children || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Level 1: Topic */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Chủ đề (Topic)
          </label>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            value={selectedTopic || ""}
            onChange={(e) => {
              const id = e.target.value ? parseInt(e.target.value, 10) : null;
              setSelectedTopic(id);
              setSelectedConcept(null);
              setSelectedSkill(null);
              onChange("");
            }}
            disabled={loading}
          >
            <option value="">-- Chọn Chủ đề --</option>
            {topics.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Level 2: Concept */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Khái niệm (Concept)
          </label>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white disabled:opacity-50"
            value={selectedConcept || ""}
            onChange={(e) => {
              const id = e.target.value ? parseInt(e.target.value, 10) : null;
              setSelectedConcept(id);
              setSelectedSkill(null);
              onChange("");
            }}
            disabled={!selectedTopic || concepts.length === 0}
          >
            <option value="">-- Chọn Khái niệm --</option>
            {concepts.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Level 3: Skill */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Kỹ năng (Skill) <span className="text-red-500">*</span>
          </label>
          <select
            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white dark:bg-slate-800 dark:text-white disabled:opacity-50 ${
              error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600 focus:border-primary-500'
            }`}
            value={selectedSkill || ""}
            onChange={(e) => {
              const id = e.target.value ? parseInt(e.target.value, 10) : null;
              setSelectedSkill(id);
            }}
            disabled={!selectedConcept || skills.length === 0}
          >
            <option value="">-- Chọn Kỹ năng --</option>
            {skills.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
      </div>

      {/* Context Panel */}
      {selectedSkill && (
        <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4 dark:border-primary-900/30 dark:bg-primary-900/10">
          {loadingContext ? (
            <div className="text-sm text-slate-500">Đang tải ngữ cảnh...</div>
          ) : contextData ? (
            <div className="space-y-3">
              {/* Breadcrumb */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {contextData.breadcrumb.map((b: any, idx: number) => (
                  <React.Fragment key={b.id}>
                    {idx > 0 && <ChevronRight className="h-4 w-4 text-slate-400" />}
                    <span className={idx === contextData.breadcrumb.length - 1 ? "font-semibold text-primary-700 dark:text-primary-400" : "text-slate-600 dark:text-slate-400"}>
                      {b.name}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              {/* Description */}
              {contextData.description && (
                <div className="flex gap-2 items-start text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                  <Info className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                  <p>{contextData.description}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Số câu hỏi hiện có:</span>
                  <Badge variant={contextData.question_count < 5 ? "warning" : "success"}>
                    {contextData.question_count}
                  </Badge>
                  {contextData.question_count < 5 && (
                    <div className="flex items-center text-xs text-amber-600 dark:text-amber-500">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Cần bổ sung thêm
                    </div>
                  )}
                </div>
              </div>

              {/* Siblings */}
              {contextData.siblings && contextData.siblings.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-medium text-slate-500 mb-2 uppercase">Các kỹ năng cùng nhóm:</p>
                  <div className="flex flex-wrap gap-2">
                    {contextData.siblings.map((sib: any) => (
                      <div key={sib.id} className="text-xs px-2 py-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                        <span className="truncate max-w-[150px]" title={sib.name}>{sib.name}</span>
                        <span className="text-slate-400">({sib.question_count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-red-500">Không thể tải ngữ cảnh node</div>
          )}
        </div>
      )}
    </div>
  );
}
