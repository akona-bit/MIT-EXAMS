import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getKnowledgeTree, getKnowledgeNodeContext } from '../../../api/knowledge';
import type { KnowledgeNode } from '../../../types';
import { ChevronRight, Info, AlertTriangle, Plus, X, Search } from 'lucide-react';
import { Badge } from '../../ui/Badge';

interface KnowledgeNodeSelectorProps {
  primaryValue: number | null;
  onPrimaryChange: (nodeId: number | null) => void;
  secondaryValues: number[];
  onSecondaryChange: (nodeIds: number[]) => void;
  subject?: string;
  error?: string;
}

// Helper to flatten the tree
function flattenTree(nodes: any[], result: any[] = []) {
  for (const node of nodes) {
    result.push({ ...node });
    if (node.children && node.children.length > 0) {
      flattenTree(node.children, result);
    }
  }
  return result;
}

export default function KnowledgeNodeSelector({ 
  primaryValue, 
  onPrimaryChange, 
  secondaryValues, 
  onSecondaryChange, 
  subject, 
  error 
}: KnowledgeNodeSelectorProps) {
  const [tree, setTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Context for the selected primary skill
  const [contextData, setContextData] = useState<any>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  // Search state for primary
  const [primarySearch, setPrimarySearch] = useState('');
  const [isPrimaryDropdownOpen, setIsPrimaryDropdownOpen] = useState(false);
  const primaryDropdownRef = useRef<HTMLDivElement>(null);

  // Search state for secondary
  const [addingSecondary, setAddingSecondary] = useState(false);
  const [secondarySearch, setSecondarySearch] = useState('');
  const secondaryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    getKnowledgeTree(subject).then(data => {
      setTree(data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [subject]);

  useEffect(() => {
    if (primaryValue) {
      setLoadingContext(true);
      getKnowledgeNodeContext(primaryValue).then(data => {
        setContextData(data);
        setLoadingContext(false);
      }).catch(() => setLoadingContext(false));
    } else {
      setContextData(null);
    }
  }, [primaryValue]);

  // Click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (primaryDropdownRef.current && !primaryDropdownRef.current.contains(event.target as Node)) {
        setIsPrimaryDropdownOpen(false);
      }
      if (secondaryDropdownRef.current && !secondaryDropdownRef.current.contains(event.target as Node)) {
        setAddingSecondary(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allNodes = useMemo(() => flattenTree(tree), [tree]);
  const leafNodes = useMemo(() => allNodes.filter(n => n.is_leaf === true), [allNodes]);
  
  const selectedPrimaryNode = allNodes.find(n => n.id === primaryValue);
  
  const filteredPrimaryNodes = useMemo(() => {
    if (!primarySearch.trim()) return allNodes.slice(0, 50); // limit initial render
    const lower = primarySearch.toLowerCase();
    return allNodes.filter(n => (n.path || '').toLowerCase().includes(lower) || n.name.toLowerCase().includes(lower)).slice(0, 50);
  }, [allNodes, primarySearch]);

  const filteredSecondaryNodes = useMemo(() => {
    const lower = secondarySearch.toLowerCase();
    // Exclude primary and already selected secondary
    const availableNodes = allNodes.filter(n => n.id !== primaryValue && !secondaryValues.includes(n.id));
    if (!secondarySearch.trim()) return availableNodes.slice(0, 50);
    return availableNodes.filter(n => (n.path || '').toLowerCase().includes(lower) || n.name.toLowerCase().includes(lower)).slice(0, 50);
  }, [allNodes, secondarySearch, primaryValue, secondaryValues]);

  return (
    <div className="space-y-4">
      {/* Primary Skill Selection */}
      <div className="relative" ref={primaryDropdownRef}>
        <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Phân loại chính <span className="text-red-500">*</span>
        </label>
        
        <div 
          className={`w-full rounded-xl border flex items-center bg-white px-3 py-2 cursor-pointer ${
            error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20'
          } dark:bg-slate-900 shadow-sm transition-all`}
          onClick={() => setIsPrimaryDropdownOpen(true)}
        >
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          {selectedPrimaryNode && !isPrimaryDropdownOpen ? (
            <div className="flex-1 flex flex-col justify-center min-w-0">
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {selectedPrimaryNode.name}
              </span>
              <span className="text-[10px] text-slate-500 truncate">
                {selectedPrimaryNode.path}
              </span>
            </div>
          ) : (
            <input
              type="text"
              className="flex-1 bg-transparent border-none focus:outline-none text-sm dark:text-white h-8"
              placeholder="-- Nhập từ khóa để tìm chủ đề / khái niệm / kỹ năng --"
              value={primarySearch}
              onChange={(e) => {
                setPrimarySearch(e.target.value);
                setIsPrimaryDropdownOpen(true);
              }}
              disabled={loading}
              autoFocus={isPrimaryDropdownOpen}
            />
          )}
          {selectedPrimaryNode && (
            <button 
              type="button"
              className="ml-2 text-slate-400 hover:text-slate-600"
              onClick={(e) => { e.stopPropagation(); onPrimaryChange(null); setPrimarySearch(''); }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        
        {/* Dropdown */}
        {isPrimaryDropdownOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-auto">
            {filteredPrimaryNodes.length === 0 ? (
              <div className="p-3 text-sm text-slate-500 text-center">Không tìm thấy phân loại phù hợp</div>
            ) : (
              <ul className="py-1">
                {filteredPrimaryNodes.map(node => {
                  const paths = (node.path || "").split("/");
                  const parents = paths.slice(0, -1).join(" > ");
                  return (
                    <li 
                      key={node.id} 
                      className="px-4 py-3 border-b last:border-b-0 border-slate-100 dark:border-slate-700/50 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPrimaryChange(node.id);
                        setPrimarySearch('');
                        setIsPrimaryDropdownOpen(false);
                      }}
                    >
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{node.name}</div>
                      {parents && <div className="text-[11px] font-medium text-slate-500 mt-0.5">{parents}</div>}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Context Panel for Primary Skill */}
      {primaryValue && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4 dark:border-primary-900/30 dark:bg-primary-900/10">
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
            </div>
          ) : (
            <div className="text-sm text-red-500">Không thể tải ngữ cảnh node</div>
          )}
        </div>
      )}

      {/* Secondary Skills */}
      <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700/50">
        <label className="block text-sm font-semibold text-slate-900 dark:text-slate-300">
          Phân loại phụ <span className="text-xs font-normal text-slate-500">(tuỳ chọn)</span>
        </label>
        
        <div className="flex flex-wrap gap-2">
          {secondaryValues.map(secId => {
            const secNode = allNodes.find(n => n.id === secId);
            return (
              <div key={secId} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-sm px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-600">
                <span className="text-slate-800 dark:text-slate-200" title={secNode?.path}>{secNode?.name || `ID: ${secId}`}</span>
                <button 
                  type="button" 
                  onClick={() => onSecondaryChange(secondaryValues.filter(id => id !== secId))}
                  className="text-slate-400 hover:text-red-500 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          
          <div className="relative" ref={secondaryDropdownRef}>
            {!addingSecondary ? (
              <button
                type="button"
                onClick={() => setAddingSecondary(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-primary-300 dark:border-primary-700 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
              >
                <Plus className="w-4 h-4" /> Thêm phân loại liên quan
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    className="w-full text-sm rounded-full border border-primary-500 bg-white dark:bg-slate-800 pl-9 pr-3 py-1.5 focus:outline-none"
                    placeholder="Tìm kỹ năng phụ..."
                    value={secondarySearch}
                    onChange={(e) => setSecondarySearch(e.target.value)}
                  />
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-auto left-0">
                    {filteredSecondaryNodes.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500 text-center">Không tìm thấy</div>
                    ) : (
                      <ul className="py-1">
                        {filteredSecondaryNodes.map(node => (
                          <li 
                            key={node.id} 
                            className="px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer"
                            onClick={() => {
                              onSecondaryChange([...secondaryValues, node.id]);
                              setSecondarySearch('');
                              setAddingSecondary(false);
                            }}
                          >
                            <div className="font-medium text-slate-900 dark:text-slate-100">{node.name}</div>
                            <div className="text-xs text-slate-500 truncate">{node.path}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => setAddingSecondary(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
