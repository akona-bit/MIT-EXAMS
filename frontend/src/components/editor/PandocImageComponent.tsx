import { NodeViewWrapper } from '@tiptap/react';
import React, { useState } from 'react';

export default function PandocImageComponent(props: any) {
  const { node, updateAttributes, selected } = props;
  const { src, alt, width, align } = node.attrs;

  const [showToolbar, setShowToolbar] = useState(false);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateAttributes({ width: e.target.value + '%' });
  };

  const handleAlign = (newAlign: string) => {
    updateAttributes({ align: newAlign });
  };

  return (
    <NodeViewWrapper 
      className={`relative inline-block ${align === 'center' ? 'block mx-auto' : ''}`}
      style={{ 
        width: width || 'auto',
        float: align === 'center' ? 'none' : (align || 'none'),
        margin: align === 'center' ? '1rem auto' : '1rem',
      }}
      onMouseEnter={() => setShowToolbar(true)}
      onMouseLeave={() => setShowToolbar(false)}
    >
      <img 
        src={src} 
        alt={alt} 
        className={`max-w-full rounded-md ${selected ? 'ring-2 ring-primary-500' : ''}`}
        style={{ width: '100%' }}
      />

      {showToolbar && (
        <div 
          className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-lg p-2 flex items-center gap-2 z-50"
          contentEditable={false}
        >
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded p-1">
            <button type="button" onClick={() => handleAlign('left')} className={`px-2 py-1 text-xs rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${align === 'left' ? 'bg-white dark:bg-slate-600 shadow-sm' : ''}`}>Trái</button>
            <button type="button" onClick={() => handleAlign('center')} className={`px-2 py-1 text-xs rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${align === 'center' ? 'bg-white dark:bg-slate-600 shadow-sm' : ''}`}>Giữa</button>
            <button type="button" onClick={() => handleAlign('right')} className={`px-2 py-1 text-xs rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${align === 'right' ? 'bg-white dark:bg-slate-600 shadow-sm' : ''}`}>Phải</button>
          </div>
          <div className="w-px h-4 bg-slate-300 dark:bg-slate-600"></div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">Size:</span>
            <input 
              type="range" 
              min="10" max="100" step="5" 
              value={parseInt(width || '100')} 
              onChange={handleWidthChange}
              className="w-20"
            />
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
}
