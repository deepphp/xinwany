
import React, { useRef, useEffect } from 'react';
import { Message } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  input: string;
  isLoading: boolean;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onGeneratePlan?: () => void; // Added optional prop
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  input,
  isLoading,
  onInputChange,
  onSend,
  onGeneratePlan
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-800"><i className="fa-solid fa-robot mr-2 text-brand-600"></i>AI 交易顾问</h2>
          <p className="text-xs text-slate-500">基于实时数据回答您的行情疑问</p>
        </div>
        
        {/* Generate Plan Button (Restored) */}
        {onGeneratePlan && messages.length > 0 && (
            <button 
                onClick={onGeneratePlan}
                className="bg-brand-100 hover:bg-brand-200 text-brand-700 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
                <i className="fa-solid fa-file-pen"></i> 生成文档大纲
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <i className="fa-solid fa-chart-pie text-4xl mb-4 text-slate-300"></i>
                <p>你好，我是您的专属交易顾问。</p>
                <p className="text-sm">请问关于当前的行情，您有什么想了解的？</p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-md">
                     <button onClick={() => onInputChange("目前的4H趋势如何？")} className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:border-brand-500 hover:text-brand-600 transition-colors">目前的4H趋势如何？</button>
                     <button onClick={() => onInputChange("有没有潜在的背驰信号？")} className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:border-brand-500 hover:text-brand-600 transition-colors">有没有潜在的背驰信号？</button>
                     <button onClick={() => onInputChange("解释一下当前的Hurst指数")} className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:border-brand-500 hover:text-brand-600 transition-colors">解释一下当前的Hurst指数</button>
                </div>
            </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-none'
                  : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
           <div className="flex justify-start">
             <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none border border-slate-100 shadow-sm flex items-center gap-2">
               <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
               <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
               <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的问题... (例如：现在的中枢结构是什么？)"
            className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none h-20 text-sm"
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || isLoading}
            className="absolute bottom-3 right-3 p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors"
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
};
