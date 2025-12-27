
import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../services/ai';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  currentSettings: AppSettings;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentSettings }) => {
  const [formData, setFormData] = useState<AppSettings>(currentSettings);
  const [activeTab, setActiveTab] = useState<'general' | 'chanlun'>('chanlun');

  useEffect(() => {
    setFormData({
        ...DEFAULT_SETTINGS,
        ...currentSettings
    });
  }, [currentSettings, isOpen]);

  const handleKlineLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = parseInt(e.target.value);
      if (isNaN(val)) val = 100;
      setFormData({...formData, klineLimit: val});
  };

  const handleSave = () => {
      let limit = formData.klineLimit;
      if (limit < 5) limit = 5;
      if (limit > 500) limit = 500;
      onSave({...formData, klineLimit: limit});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-dark-800 border border-dark-600 rounded-xl w-full max-w-lg p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white"><i className="fa-solid fa-gear mr-2 text-brand-500"></i>系统设置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-700 mb-4">
            <button onClick={() => setActiveTab('chanlun')} className={`px-4 py-2 text-sm font-bold ${activeTab === 'chanlun' ? 'text-brand-500 border-b-2 border-brand-500' : 'text-gray-500 hover:text-white'}`}>
                缠论参数
            </button>
            <button onClick={() => setActiveTab('general')} className={`px-4 py-2 text-sm font-bold ${activeTab === 'general' ? 'text-brand-500 border-b-2 border-brand-500' : 'text-gray-500 hover:text-white'}`}>
                通用 & API
            </button>
        </div>

        <div className="space-y-4">
          
          {/* CHANLUN TAB */}
          {activeTab === 'chanlun' && (
              <>
                <div className="bg-dark-900/50 p-4 rounded-lg border border-dark-700">
                    <label className="block text-xs font-bold text-brand-500 mb-2 uppercase">笔生成策略 (Bi Generation)</label>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                         <div onClick={() => setFormData({...formData, biType: 'old'})} className={`cursor-pointer border rounded px-3 py-2 text-xs ${formData.biType === 'old' ? 'border-brand-500 bg-brand-500/10 text-white' : 'border-dark-600 text-gray-500'}`}>
                            <div className="font-bold">传统旧笔</div>
                            <div className="text-[10px] opacity-70">严格顶底分型, K>=5</div>
                         </div>
                         <div onClick={() => setFormData({...formData, biType: 'new'})} className={`cursor-pointer border rounded px-3 py-2 text-xs ${formData.biType === 'new' ? 'border-brand-500 bg-brand-500/10 text-white' : 'border-dark-600 text-gray-500'}`}>
                            <div className="font-bold">新笔 (宽松)</div>
                            <div className="text-[10px] opacity-70">允许次高低点, K>=4</div>
                         </div>
                         <div onClick={() => setFormData({...formData, biType: 'fractal'})} className={`cursor-pointer border rounded px-3 py-2 text-xs ${formData.biType === 'fractal' ? 'border-brand-500 bg-brand-500/10 text-white' : 'border-dark-600 text-gray-500'}`}>
                            <div className="font-bold">分型笔 (敏锐)</div>
                            <div className="text-[10px] opacity-70">顶底分型直接连线</div>
                         </div>
                         <div onClick={() => setFormData({...formData, biType: 'custom'})} className={`cursor-pointer border rounded px-3 py-2 text-xs ${formData.biType === 'custom' ? 'border-brand-500 bg-brand-500/10 text-white' : 'border-dark-600 text-gray-500'}`}>
                            <div className="font-bold">任意笔 (自定义)</div>
                            <div className="text-[10px] opacity-70">自定义K线数量</div>
                         </div>
                    </div>
                    {formData.biType === 'custom' && (
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400">最小K线数:</span>
                            <input type="number" value={formData.biKCount} onChange={e => setFormData({...formData, biKCount: parseInt(e.target.value) || 5})} className="w-16 bg-dark-800 border border-dark-600 rounded px-2 py-1" />
                        </div>
                    )}
                </div>

                <div className="bg-dark-900/50 p-4 rounded-lg border border-dark-700">
                    <label className="block text-xs font-bold text-brand-500 mb-2 uppercase">显示设置 (Display)</label>
                    <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={formData.showBi} onChange={e => setFormData({...formData, showBi: e.target.checked})} className="accent-brand-500" />
                            <span className="text-xs text-gray-300">显示笔 (Bi)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={formData.showSeg} onChange={e => setFormData({...formData, showSeg: e.target.checked})} className="accent-brand-500" />
                            <span className="text-xs text-gray-300">显示线段 (Segment)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={formData.showPivot} onChange={e => setFormData({...formData, showPivot: e.target.checked})} className="accent-brand-500" />
                            <span className="text-xs text-gray-300">显示中枢 (Pivot)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={formData.showSignals} onChange={e => setFormData({...formData, showSignals: e.target.checked})} className="accent-brand-500" />
                            <span className="text-xs text-gray-300">显示买卖点/背离</span>
                        </label>
                    </div>
                </div>

                <div className="bg-dark-900/50 p-4 rounded-lg border border-dark-700">
                    <label className="block text-xs font-bold text-brand-500 mb-2 uppercase">动力学参数 (MACD)</label>
                    <div className="flex gap-2">
                         <div className="flex-1">
                             <span className="text-[10px] text-gray-500 block">Fast</span>
                             <input type="number" value={formData.macdFast} onChange={e => setFormData({...formData, macdFast: parseInt(e.target.value)})} className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1 text-xs" />
                         </div>
                         <div className="flex-1">
                             <span className="text-[10px] text-gray-500 block">Slow</span>
                             <input type="number" value={formData.macdSlow} onChange={e => setFormData({...formData, macdSlow: parseInt(e.target.value)})} className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1 text-xs" />
                         </div>
                         <div className="flex-1">
                             <span className="text-[10px] text-gray-500 block">Signal</span>
                             <input type="number" value={formData.macdSignal} onChange={e => setFormData({...formData, macdSignal: parseInt(e.target.value)})} className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1 text-xs" />
                         </div>
                    </div>
                </div>
              </>
          )}

          {/* GENERAL TAB */}
          {activeTab === 'general' && (
              <>
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                    K线计算数量 (Kline Limit)
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                        type="range"
                        min="50"
                        max="500"
                        value={formData.klineLimit}
                        onChange={handleKlineLimitChange}
                        className="flex-1 accent-brand-500 h-1 bg-dark-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <input
                        type="number"
                        min="50"
                        max="500"
                        value={formData.klineLimit}
                        onChange={handleKlineLimitChange}
                        className="w-20 bg-dark-900 border border-dark-700 text-white px-2 py-1 rounded text-center focus:border-brand-500 focus:outline-none text-sm"
                        />
                    </div>
                </div>

                <div className="border-t border-dark-700 pt-4">
                    <label className="block text-xs font-medium text-gray-400 mb-1">OpenAI API URL</label>
                    <input type="text" value={formData.apiUrl} onChange={e => setFormData({...formData, apiUrl: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded focus:border-brand-500 text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
                    <input type="password" value={formData.apiKey} onChange={e => setFormData({...formData, apiKey: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded focus:border-brand-500 text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Model ID</label>
                    <input type="text" value={formData.modelId} onChange={e => setFormData({...formData, modelId: e.target.value})} className="w-full bg-dark-900 border border-dark-700 text-white px-3 py-2 rounded focus:border-brand-500 text-sm" />
                </div>
              </>
          )}

        </div>

        <div className="mt-8 flex gap-3">
          <button 
            onClick={() => setFormData(DEFAULT_SETTINGS)}
            className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded text-sm transition-colors"
          >
            恢复默认
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-black font-bold rounded text-sm transition-colors"
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
};
