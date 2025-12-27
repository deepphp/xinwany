
import React from 'react';
import { DocPlan, DocumentSection } from '../types';

interface PlanViewerProps {
  plan: DocPlan | null;
  activeSectionId: string | null;
  onSelectSection: (id: string) => void;
  onUpdateSectionContent: (id: string, newContent: string) => void;
  isGeneratingContent: boolean;
  onDownload?: () => void; // New Prop for Export
}

export const PlanViewer: React.FC<PlanViewerProps> = ({
  plan,
  activeSectionId,
  onSelectSection,
  isGeneratingContent,
  onDownload
}) => {
  if (!plan) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl border-dashed">
        <div className="text-slate-300 text-5xl mb-4"><i className="fa-regular fa-clipboard"></i></div>
        <p className="text-slate-500 font-medium">尚无文档计划</p>
        <p className="text-slate-400 text-sm mt-2 max-w-xs text-center">请先在左侧咨询窗口与AI讨论，并点击“生成文档大纲”。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 p-4 border-b border-slate-200">
             <div className="flex justify-between items-start mb-2">
                 <h2 className="text-lg font-semibold text-slate-800 line-clamp-1" title={plan.title}>
                    <i className="fa-solid fa-sitemap mr-2 text-brand-600"></i>
                    {plan.title || "未命名文档"}
                 </h2>
                 {onDownload && (
                     <button 
                        onClick={onDownload}
                        className="text-slate-400 hover:text-brand-600 transition-colors"
                        title="导出为 Markdown"
                     >
                         <i className="fa-solid fa-file-arrow-down text-lg"></i>
                     </button>
                 )}
             </div>
             <div className="flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><i className="fa-solid fa-users"></i> {plan.targetAudience}</span>
                <span className="flex items-center gap-1"><i className="fa-solid fa-palette"></i> {plan.tone}</span>
             </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {plan.sections.map((section, index) => (
                <div 
                    key={section.id}
                    onClick={() => onSelectSection(section.id)}
                    className={`group cursor-pointer border rounded-lg p-3 transition-all duration-200 relative ${
                        activeSectionId === section.id 
                        ? 'bg-brand-50 border-brand-200 shadow-sm ring-1 ring-brand-200' 
                        : 'bg-white border-slate-100 hover:border-brand-200 hover:shadow-sm'
                    }`}
                >
                    <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                             activeSectionId === section.id ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                        }`}>
                            {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className={`text-sm font-semibold mb-1 truncate ${activeSectionId === section.id ? 'text-brand-900' : 'text-slate-700'}`}>
                                {section.title}
                            </h3>
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                {section.description}
                            </p>
                        </div>
                        <div className="shrink-0 text-slate-300 group-hover:text-brand-400">
                           {activeSectionId === section.id && isGeneratingContent ? (
                               <i className="fa-solid fa-circle-notch animate-spin"></i>
                           ) : (
                               <i className="fa-solid fa-chevron-right text-xs"></i>
                           )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};
