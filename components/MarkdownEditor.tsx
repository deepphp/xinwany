import React from 'react';
import { DocumentSection } from '../types';

interface MarkdownEditorProps {
  section: DocumentSection | undefined;
  onContentChange: (content: string) => void;
  onAutoWrite: () => void;
  isWriting: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  section,
  onContentChange,
  onAutoWrite,
  isWriting
}) => {
  if (!section) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl border-dashed text-slate-400">
        <p>请选择一个章节以开始编辑</p>
      </div>
    );
  }

  // A very simple markdown formatter for display purposes (avoiding complex libs to keep it single-file-ish friendly)
  // In a real app, use react-markdown
  const renderMarkdown = (text: string) => {
    if (!text) return <p className="text-slate-400 italic">内容为空...</p>;
    
    // Basic replacements for preview
    const lines = text.split('\n').map((line, i) => {
      if (line.startsWith('# ')) return <h1 key={i}>{line.replace('# ', '')}</h1>;
      if (line.startsWith('## ')) return <h2 key={i}>{line.replace('## ', '')}</h2>;
      if (line.startsWith('### ')) return <h3 key={i}>{line.replace('### ', '')}</h3>;
      if (line.startsWith('> ')) return <blockquote key={i}>{line.replace('> ', '')}</blockquote>;
      if (line.startsWith('- ')) return <ul key={i}><li>{line.replace('- ', '')}</li></ul>;
      if (line.startsWith('1. ')) return <ol key={i}><li>{line.replace(/^\d+\.\s/, '')}</li></ol>;
      if (line.startsWith('```')) return <pre key={i}><code>{line.replace(/```.*/, 'Code Block')}</code></pre>;
      if (line.trim() === '') return <br key={i} />;
      return <p key={i}>{line}</p>;
    });
    return lines;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
         <div className="flex items-center gap-2 overflow-hidden">
             <span className="bg-brand-100 text-brand-700 text-xs px-2 py-0.5 rounded font-bold">SECTION</span>
             <h2 className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">{section.title}</h2>
         </div>
         <button
            onClick={onAutoWrite}
            disabled={isWriting}
            className="text-xs flex items-center gap-1.5 text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2 py-1 rounded transition-colors"
         >
            {isWriting ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-pen-nib"></i>}
            AI 自动撰写
         </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-h-[50%] md:min-h-0 bg-white">
            <div className="px-3 py-1 bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider">Markdown Source</div>
            <textarea
                value={section.content}
                onChange={(e) => onContentChange(e.target.value)}
                className="flex-1 w-full p-4 resize-none focus:outline-none focus:ring-inset focus:ring-2 focus:ring-brand-500/10 font-mono text-sm leading-relaxed text-slate-700"
                placeholder="在此处输入Markdown内容..."
            />
        </div>

        {/* Preview Area */}
        <div className="flex-1 flex flex-col min-h-[50%] md:min-h-0 bg-slate-50/30">
             <div className="px-3 py-1 bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider">Live Preview</div>
             <div className="flex-1 p-8 overflow-y-auto markdown-preview">
                {renderMarkdown(section.content)}
             </div>
        </div>
      </div>
    </div>
  );
};
