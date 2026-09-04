import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getKnowledgeTree } from '../../../api/knowledge';
import type { KnowledgeNode } from '../../../types';
import { Search } from 'lucide-react';

interface MatrixNodeSelectorProps {
  value: number | null;
  onChange: (nodeId: number | null) => void;
  subject?: string;
  error?: string;
  placeholder?: string;
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

export default function MatrixNodeSelector({ 
  value, 
  onChange, 
  subject, 
  error,
  placeholder = "-- Chọn chủ đề / kỹ năng --"
}: MatrixNodeSelectorProps) {
  const [tree, setTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allNodes = useMemo(() => flattenTree(tree), [tree]);
  
  const selectedNode = allNodes.find(n => n.id === value);
  
  const filteredNodes = useMemo(() => {
    if (!search.trim()) return allNodes.slice(0, 50); // limit initial render
    const lower = search.toLowerCase();
    return allNodes.filter(n => (n.path || '').toLowerCase().includes(lower) || n.name.toLowerCase().includes(lower)).slice(0, 50);
  }, [allNodes, search]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div 
        className={`w-full rounded-lg border flex items-center bg-white dark:bg-slate-900 px-3 py-2 cursor-pointer transition-all ${
          error ? 'border-red-500 ring-2 ring-red-500/20' : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20'
        }`}
        onClick={() => setIsOpen(true)}
      >
        <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
        {selectedNode && !isOpen ? (
          <div className="flex-1 flex flex-col justify-center min-w-0">
            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {selectedNode.name}
            </span>
            {selectedNode.path && selectedNode.path !== selectedNode.name && (
              <span className="text-[10px] text-slate-500 truncate leading-tight">
                {selectedNode.path}
              </span>
            )}
          </div>
        ) : (
          <input
            type="text"
            className="flex-1 bg-transparent border-none focus:outline-none text-sm dark:text-white h-full py-0.5"
            placeholder={placeholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            disabled={loading}
            autoFocus={isOpen}
          />
        )}
        
        {selectedNode && (
          <button 
            type="button"
            className="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
            onClick={(e) => { e.stopPropagation(); onChange(null); setSearch(''); }}
          >
            &times;
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-slate-500">Đang tải...</div>
          ) : filteredNodes.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">Không tìm thấy kết quả.</div>
          ) : (
            <ul className="py-1">
              {filteredNodes.map(node => (
                <li 
                  key={node.id} 
                  className={`px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer flex flex-col ${value === node.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                  onClick={() => {
                    onChange(node.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  <span className={`text-sm ${value === node.id ? 'font-semibold text-primary-700 dark:text-primary-400' : 'text-slate-900 dark:text-slate-200'}`}>
                    {node.name}
                  </span>
                  {node.path && node.path !== node.name && (
                    <span className="text-xs text-slate-500 truncate mt-0.5">
                      {node.path}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
