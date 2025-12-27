
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, Kline, ChanLunFeatures, MarketContext, HarmonicPattern, Message, DocPlan, DocumentSection, PredictionModel, MonteCarloResult, ChartSignal } from './types';
import { CryptoChart, CryptoChartHandle } from './components/CryptoChart';
import { SettingsModal } from './components/SettingsModal';
import { ChatInterface } from './components/ChatInterface';
import { PlanViewer } from './components/PlanViewer';
import { MarkdownEditor } from './components/MarkdownEditor';
import { DeepQuantLab } from './components/DeepQuantLab'; 
import { DraggableEye } from './components/DraggableEye'; // New Import
import { DEFAULT_SETTINGS, fetchComparativeAnalysis, chatWithTrader, generateDocumentPlan, generateSectionContent } from './services/ai';
import { fetchKlines, fetchFullMarketContext } from './services/crypto';
import { calculateChanLun } from './services/chanlun';
import { calculateHarmonics } from './services/harmonics';
import { calculateKalmanFilter, calculateLorentzianPrediction, calculateHurstExponent, calculateFDI, calculateEntropy, calculateGARCH, calculateDWT, calculateESN, calculateMonteCarlo, calculateHMMState, generateEnsembleMarkers } from './services/indicators';
import { learner } from './services/math_engine'; 
import { v4 as uuidv4 } from 'uuid';

const MarkdownDisplay = ({ content }: { content: string }) => {
    const renderContent = (text: string) => {
        if (!text) return null;
        return text.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-brand-500 mt-2 mb-1">{line.replace('# ', '')}</h1>
            if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-white mt-3 mb-1 border-b border-gray-700 pb-1">{line.replace('## ', '')}</h2>
            if (line.startsWith('### ')) return <h3 key={i} className="text-md font-bold text-gray-200 mt-2">{line.replace('### ', '')}</h3>
            if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-gray-600 pl-4 text-gray-400 italic my-2">{line.replace('> ', '')}</blockquote>
            if (line.startsWith('- ')) return <li key={i} className="ml-4 text-gray-300 list-disc">{line.replace('- ', '')}</li>
            if (line.includes('```json')) return <div key={i} className="text-xs text-gray-500 mt-1">JSON Data Below</div>
            if (line.startsWith('```')) return null; 
            if (line.trim() === '') return <div key={i} className="h-2"></div>
            return <p key={i} className="text-gray-300 leading-relaxed text-sm">{line}</p>
        });
    };
    return <div className="markdown-body">{renderContent(content)}</div>;
}

// --- Quant Dashboard Component (Original Alpha Reactor Edition - Preserved) ---
const QuantDashboard = ({ 
    prediction, hurst, fdi, entropy, hmmState, esnPrice, currentPrice, countdown, refreshCounter
}: { 
    prediction: PredictionModel | null, 
    hurst: number, 
    fdi: number, 
    entropy: number,
    hmmState: string,
    esnPrice: number | null,
    currentPrice: number,
    countdown: string,
    refreshCounter: number
}) => {
    if (!prediction) return null;

    const getHurstLabel = (h: number) => {
        if (h > 0.6) return { text: '强趋势 (Trend)', color: 'text-green-400' };
        if (h < 0.4) return { text: '均值回归 (Revert)', color: 'text-purple-400' };
        return { text: '随机漫步 (Random)', color: 'text-gray-400' };
    };
    const hInfo = getHurstLabel(hurst);

    const getHMMLabel = (s: string) => {
        if (s === 'TREND') return { text: '🚀 趋势体制', color: 'text-green-500 bg-green-500/10' };
        if (s === 'OSCILLATION') return { text: '〰️ 震荡体制', color: 'text-blue-500 bg-blue-500/10' };
        return { text: '⚠️ 混沌体制', color: 'text-gray-500 bg-gray-500/10' };
    };
    const hmmInfo = getHMMLabel(hmmState);

    const getPredColor = (p: PredictionModel) => {
        if (p.direction === 'UP') return 'text-green-500 bg-green-500/10 border-green-500/50';
        if (p.direction === 'DOWN') return 'text-red-500 bg-red-500/10 border-red-500/50';
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    };
    const predStyle = getPredColor(prediction);

    const esnDiff = esnPrice ? ((esnPrice - currentPrice) / currentPrice) * 100 : 0;
    const esnColor = esnDiff > 0 ? 'text-green-400' : 'text-red-400';

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 p-2 bg-dark-800 border-b border-dark-700">
            {/* 1. ML Prediction + ESN Neural */}
            <div className={`flex flex-col justify-between p-2 rounded border ${predStyle} relative`}>
                <div className="flex justify-between items-start">
                     <div className="text-[10px] uppercase font-bold opacity-70">KNN AI</div>
                     <div className="flex flex-col items-end">
                         <span className="text-[12px] font-mono font-bold tracking-tighter">{countdown}</span>
                     </div>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black tracking-tight">{prediction.direction}</span>
                    <span className="text-xs font-mono opacity-80">{(prediction.probability * 100).toFixed(0)}%</span>
                </div>
                {esnPrice && (
                    <div className="text-[9px] mt-1 border-t border-current/20 pt-1 flex justify-between">
                         <span className="opacity-70">ESN Neural:</span>
                         <span className={`font-mono ${esnColor}`}>{esnPrice.toFixed(2)} ({esnDiff > 0 ? '+' : ''}{esnDiff.toFixed(2)}%)</span>
                    </div>
                )}
            </div>

            {/* 2. HMM State Machine */}
            <div className={`flex flex-col justify-center p-2 rounded border border-dark-700 ${hmmInfo.color}`}>
                <div className="text-[10px] opacity-70 mb-1">HMM 市场状态机</div>
                <div className="text-lg font-bold">{hmmInfo.text}</div>
                <div className="w-full bg-black/20 h-1 rounded-full mt-2">
                    <div className="h-full bg-current opacity-70" style={{ width: `${(1-entropy)*100}%` }}></div>
                </div>
                <div className="text-[9px] text-right mt-0.5 opacity-60">Order: {((1-entropy)*100).toFixed(0)}%</div>
            </div>

            {/* 3. Hurst & FDI (Trend Physics) */}
            <div className="flex flex-col justify-center p-2 bg-dark-900 rounded border border-dark-700">
                 <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-gray-500">Hurst 指数</span>
                    <span className={`text-[10px] font-bold ${hInfo.color}`}>{hurst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-500">分形维数 (FDI)</span>
                    <span className={`text-[10px] font-bold text-gray-300`}>{fdi.toFixed(2)}</span>
                </div>
                <div className="text-[9px] text-gray-600 mt-1 text-right">{fdi < 1.45 ? "Strong Trend" : "Chaos"}</div>
            </div>

            {/* 4. Refresh & Controls */}
            <div className="flex flex-col justify-between p-2 bg-dark-900 rounded border border-dark-700">
                 <div className="text-[10px] text-gray-500">Alpha Reactor Status</div>
                 <div className="text-xs text-brand-500 font-mono flex items-center gap-2">
                     <span className="relative flex h-2 w-2">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                     </span>
                     ONLINE
                 </div>
                 <div className="w-full bg-dark-700 h-1 rounded-full mt-2 overflow-hidden">
                     <div 
                        className="h-full bg-brand-500 opacity-70 transition-all duration-1000 ease-linear" 
                        style={{ width: `${(refreshCounter / 15) * 100}%` }}
                     ></div>
                 </div>
            </div>
        </div>
    );
};


const getTimeframeSeconds = (tf: string): number => {
    const val = parseInt(tf);
    if (tf.endsWith('m')) return val * 60;
    if (tf.endsWith('h')) return val * 3600;
    if (tf.endsWith('d')) return val * 86400;
    if (tf.endsWith('w')) return val * 604800; 
    if (tf.endsWith('M')) return val * 2592000; 
    return 3600; 
};

const formatTimeRemaining = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const App: React.FC = () => {
  // --- Global State ---
  const [currentView, setCurrentView] = useState<'analysis' | 'assistant' | 'docs'>('docs');
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('chanlun-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQuantLabOpen, setIsQuantLabOpen] = useState(false); 
  const [showOverlays, setShowOverlays] = useState(true); // New: Visibility Toggle

  // --- Analysis State ---
  const [recentSymbols, setRecentSymbols] = useState<string[]>(() => {
      const saved = localStorage.getItem('chanlun-symbols');
      return saved ? JSON.parse(saved) : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  });
  const [symbol, setSymbol] = useState(recentSymbols[0] || 'BTCUSDT');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [timeframe, setTimeframe] = useState('1h');
  const [klines, setKlines] = useState<Kline[]>([]);
  const [chanLunData, setChanLunData] = useState<ChanLunFeatures | null>(null);
  const [harmonicData, setHarmonicData] = useState<HarmonicPattern[]>([]);
  const [marketContext, setMarketContext] = useState<MarketContext | null>(null);
  
  // New Math State (Alpha Reactor)
  const [kalmanData, setKalmanData] = useState<{time: number, value: number}[]>([]);
  const [dwtData, setDwtData] = useState<{time: number, value: number}[]>([]); 
  const [esnData, setEsnData] = useState<{time: number, value: number} | undefined>(undefined); 
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult | null>(null); 
  
  const [prediction, setPrediction] = useState<PredictionModel | null>(null);
  const [mathStats, setMathStats] = useState({ 
      hurst: 0.5, 
      fdi: 1.5, 
      entropy: 0.5, 
      hmmState: 'UNCERTAIN' 
  });
  const [chartSignals, setChartSignals] = useState<ChartSignal[]>([]);

  const [resultA, setResultA] = useState<string>("");
  const [resultB, setResultB] = useState<string>("");
  const [resultC, setResultC] = useState<string>("");
  const [resultSummary, setResultSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const REFRESH_INTERVAL_SEC = 15;
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_INTERVAL_SEC);
  const [candleTimeRemaining, setCandleTimeRemaining] = useState<string>("--:--");
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  // --- Assistant State ---
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // --- Docs State ---
  const [docPlan, setDocPlan] = useState<DocPlan | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [isDocGenerating, setIsDocGenerating] = useState(false);
  const [isSectionWriting, setIsSectionWriting] = useState(false);

  // --- Refs ---
  const chartRef = useRef<CryptoChartHandle>(null);

  // --- Analysis Logic ---
  const loadChartData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const limit = settings.klineLimit || 200;
      const data = await fetchKlines(symbol, timeframe, limit);
      if (data.length === 0) throw new Error("Empty data returned");

      setKlines(data);
      
      setChanLunData(calculateChanLun(data, settings));
      setHarmonicData(calculateHarmonics(data));
      
      const kalman = calculateKalmanFilter(data);
      const dwt = calculateDWT(data); 
      const esnVal = calculateESN(data); 
      const mc = calculateMonteCarlo(data); 
      const hmm = calculateHMMState(data); 

      const pred = calculateLorentzianPrediction(data);
      const hurst = calculateHurstExponent(data);
      const fdi = calculateFDI(data);
      const entropy = calculateEntropy(data);
      
      setKalmanData(kalman.map((v, i) => ({ time: data[i].time, value: v })));
      setDwtData(dwt.map((v, i) => ({ time: data[i].time, value: v })));
      
      const nextTime = data[data.length-1].time + getTimeframeSeconds(timeframe);
      setEsnData({ time: nextTime, value: esnVal });
      setMonteCarlo(mc);

      setPrediction(pred);
      setMathStats({ 
          hurst, 
          fdi: fdi[fdi.length-1] || 1.5, 
          entropy,
          hmmState: hmm
      });

      const signals = generateEnsembleMarkers(data);
      setChartSignals(signals);

      setErrorMsg(null);
      setToastMsg(null);
      
      if (currentView === 'assistant' || currentView === 'docs') {
          fetchFullMarketContext(symbol, settings).then(setMarketContext).catch(() => {});
      }
      
      fetchFullMarketContext(symbol, settings).then(setMarketContext).catch(() => {});

    } catch (e: any) {
      console.error(e);
      if (!silent) setErrorMsg(e.message || "Failed to fetch market data");
      else setToastMsg("最新数据获取失败，正在重试...");
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const performFullAnalysis = async () => {
      if (!klines.length) return;
      setIsAnalyzing(true);
      setResultA(""); setResultB(""); setResultC(""); setResultSummary("");
      
      try {
          let chartImage: string | undefined = undefined;
          if (chartRef.current) {
              const screenshot = chartRef.current.takeScreenshot();
              if (screenshot) {
                  chartImage = screenshot;
              }
          }

          const context = await fetchFullMarketContext(symbol, settings);
          setMarketContext(context);

          const results = await fetchComparativeAnalysis(settings, context, chartImage);
          setResultA(results.strategyA);
          setResultB(results.strategyB);
          setResultC(results.strategyC);
          setResultSummary(results.summary);
      } catch (e: any) {
          setResultA(`Error: ${e.message}`);
          setResultSummary(`Error: ${e.message}`);
      } finally {
          setIsAnalyzing(false);
      }
  };

  useEffect(() => {
      learner.checkSymbol(symbol);
  }, [symbol]);

  useEffect(() => {
    loadChartData();
    setRefreshCountdown(REFRESH_INTERVAL_SEC);
  }, [symbol, timeframe, settings]);

  useEffect(() => {
    const timer = setInterval(() => {
        const now = Date.now();
        const tfSeconds = getTimeframeSeconds(timeframe);
        const diff = (Math.ceil(now / (tfSeconds * 1000)) * (tfSeconds * 1000)) - now;
        setCandleTimeRemaining(formatTimeRemaining(diff));
        if (isAutoRefresh) {
            setRefreshCountdown(prev => {
                if (prev <= 1) { loadChartData(true); return REFRESH_INTERVAL_SEC; }
                return prev - 1;
            });
        }
    }, 1000);
    return () => clearInterval(timer);
  }, [timeframe, isAutoRefresh, symbol, settings]);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('chanlun-settings', JSON.stringify(newSettings));
    setIsSettingsOpen(false);
  };

  const handleAddSymbol = (e: React.FormEvent) => {
      e.preventDefault();
      const newSymbol = searchInput.toUpperCase().trim();
      if (!newSymbol) return;
      setSymbol(newSymbol);
      if (!recentSymbols.includes(newSymbol)) {
          const newList = [newSymbol, ...recentSymbols].slice(0, 8);
          setRecentSymbols(newList);
          localStorage.setItem('chanlun-symbols', JSON.stringify(newList));
      }
      setIsSearchOpen(false);
      setSearchInput("");
  };

  // --- Chat & Doc Logic ---
  
  const handleChatSend = async () => {
      if (!chatInput.trim() || isChatLoading) return;
      
      let currentContext = marketContext;
      if (!currentContext && klines.length > 0) {
           try {
               currentContext = await fetchFullMarketContext(symbol, settings);
               setMarketContext(currentContext);
           } catch (e) { console.error("Failed to fetch context for chat", e); }
      }

      const newUserMsg: Message = { id: uuidv4(), role: 'user', content: chatInput };
      const updatedMessages = [...chatMessages, newUserMsg];
      setChatMessages(updatedMessages);
      setChatInput('');
      setIsChatLoading(true);

      try {
          const response = await chatWithTrader(settings, updatedMessages, newUserMsg.content, currentContext);
          const newAiMsg: Message = { id: uuidv4(), role: 'assistant', content: response };
          setChatMessages([...updatedMessages, newAiMsg]);
      } catch (e: any) {
          const errorMsg: Message = { id: uuidv4(), role: 'assistant', content: `分析遇到问题: ${e.message}` };
          setChatMessages([...updatedMessages, errorMsg]);
      } finally {
          setIsChatLoading(false);
      }
  };

  const handleGeneratePlan = async () => {
      if (chatMessages.length === 0 || isDocGenerating) return;
      setIsDocGenerating(true);
      setCurrentView('docs'); 

      try {
          const contextStr = chatMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
          const fullContext = marketContext ? `Market: ${symbol}\n${JSON.stringify(marketContext.regime)}\n\nConversation:\n${contextStr}` : contextStr;
          
          const plan = await generateDocumentPlan(settings, fullContext);
          setDocPlan(plan);
          if (plan.sections.length > 0) setActiveSectionId(plan.sections[0].id);
      } catch (e: any) {
          console.error(e);
          setChatMessages(prev => [...prev, { id: uuidv4(), role: 'assistant', content: `⚠️ 生成文档大纲失败: ${e.message}` }]);
      } finally {
          setIsDocGenerating(false);
      }
  };

  const handleUpdateSectionContent = (id: string, newContent: string) => {
      if (!docPlan) return;
      const newSections = docPlan.sections.map(s => s.id === id ? { ...s, content: newContent } : s);
      setDocPlan({ ...docPlan, sections: newSections });
  };

  const handleAutoWriteSection = async () => {
      if (!docPlan || !activeSectionId || isSectionWriting) return;
      
      const section = docPlan.sections.find(s => s.id === activeSectionId);
      if (!section) return;

      setIsSectionWriting(true);
      try {
          const contextStr = chatMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
          const content = await generateSectionContent(settings, section, docPlan, contextStr, marketContext);
          handleUpdateSectionContent(activeSectionId, content);
      } catch (e: any) {
          console.error(e);
      } finally {
          setIsSectionWriting(false);
      }
  };

  const handleDownloadDoc = () => {
    if (!docPlan) return;
    const header = `# ${docPlan.title || 'Analysis Report'}\n\n> Target Audience: ${docPlan.targetAudience}\n> Tone: ${docPlan.tone}\n\n---\n\n`;
    const body = docPlan.sections.map(s => {
        return `## ${s.title}\n\n${s.content || '*(Section content is empty)*'}`;
    }).join('\n\n');
    const fullContent = header + body;
    const blob = new Blob([fullContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symbol}_Analysis_${new Date().toISOString().slice(0,10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-dark-900 text-gray-200">
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        currentSettings={settings}
      />
      
      <DeepQuantLab 
        isOpen={isQuantLabOpen}
        onClose={() => setIsQuantLabOpen(false)}
        context={marketContext}
      />

      {/* Header */}
      <header className="h-14 border-b border-dark-700 bg-dark-800 flex items-center justify-between px-3 z-10 shrink-0">
         <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-brand-500 font-bold text-lg shrink-0">
                <i className="fa-solid fa-layer-group"></i>
                <span className="hidden md:inline">ChanLun Pro</span>
             </div>
             
             <div className="flex bg-dark-900 rounded p-1 border border-dark-700">
                 <button 
                    onClick={() => setCurrentView('analysis')}
                    className={`px-3 py-1 text-xs font-bold rounded transition-colors flex items-center gap-2 ${currentView === 'analysis' ? 'bg-dark-700 text-brand-500 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                 >
                    <i className="fa-solid fa-chart-line"></i> 市场分析
                 </button>
                 <button 
                    onClick={() => setCurrentView('assistant')}
                    className={`px-3 py-1 text-xs font-bold rounded transition-colors flex items-center gap-2 ${currentView === 'assistant' ? 'bg-dark-700 text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                 >
                    <i className="fa-solid fa-robot"></i> AI 助手
                 </button>
                 <button 
                    onClick={() => setCurrentView('docs')}
                    className={`px-3 py-1 text-xs font-bold rounded transition-colors flex items-center gap-2 ${currentView === 'docs' ? 'bg-dark-700 text-purple-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                 >
                    <i className="fa-solid fa-file-pen"></i> 文档开发
                 </button>
             </div>
         </div>

         <div className="flex items-center gap-3">
             <button 
                onClick={() => setIsQuantLabOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-black text-xs font-bold rounded transition-all shadow-lg shadow-brand-500/20"
                title="深度量化实验室"
             >
                 <i className="fa-solid fa-flask"></i> 
                 <span className="hidden sm:inline">深度量化实验室</span>
             </button>

            <div className="hidden md:flex items-center gap-1 bg-dark-900 rounded p-1 border border-dark-700 overflow-x-auto max-w-[350px] scrollbar-hide">
                    {['1m', '5m', '15m', '30m', '1h', '2h', '4h', '12h', '1d', '3d', '1w'].map(tf => (
                        <button key={tf} onClick={() => setTimeframe(tf)} className={`px-2 py-0.5 text-xs font-medium rounded shrink-0 transition-colors ${timeframe === tf ? 'text-brand-500 bg-dark-700' : 'text-gray-500 hover:text-gray-300'}`}>{tf}</button>
                    ))}
            </div>
            
            <div className="flex items-center gap-2">
                {recentSymbols.slice(0, 2).map(s => (
                        <button key={s} onClick={() => setSymbol(s)} className={`px-2 py-1 text-xs rounded border ${symbol === s ? 'border-brand-500/50 text-brand-500' : 'border-dark-700 text-gray-500'}`}>{s}</button>
                ))}
                    {isSearchOpen ? (
                        <form onSubmit={handleAddSymbol}>
                            <input autoFocus type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)} onBlur={() => { if(!searchInput) setIsSearchOpen(false) }} placeholder="SYMBOL" className="w-20 bg-dark-800 border border-brand-600 rounded px-2 py-1 text-xs text-white uppercase" />
                        </form>
                    ) : (
                        <button onClick={() => setIsSearchOpen(true)} className="px-2 py-1 text-xs text-gray-400 hover:text-brand-500"><i className="fa-solid fa-plus"></i></button>
                    )}
            </div>

            <div className="h-6 w-px bg-dark-700 mx-2"></div>
            
            {currentView === 'analysis' && (
                <button 
                    onClick={performFullAnalysis}
                    disabled={isAnalyzing || klines.length === 0}
                    className="bg-brand-600 hover:bg-brand-500 text-dark-900 px-3 py-1.5 rounded text-xs font-bold transition-all shadow-lg shadow-brand-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                    {isAnalyzing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-brain"></i>}
                    <span className="hidden md:inline">{isAnalyzing ? "多模态计算" : "策略对抗"}</span>
                </button>
             )}
             
             <button onClick={() => setIsSettingsOpen(true)} className="text-gray-400 hover:text-white p-2"><i className="fa-solid fa-gear"></i></button>
         </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
          
          {/* VIEW: ANALYSIS */}
          {currentView === 'analysis' && (
              <>
                <div className="w-full md:w-1/2 flex flex-col border-r border-dark-700 relative min-w-[300px]">
                    {/* Draggable Eye for Toggling Overlays */}
                    <DraggableEye visible={showOverlays} onToggle={() => setShowOverlays(!showOverlays)} />

                    {isLoading && !klines.length ? (
                        <div className="flex-1 flex items-center justify-center"><i className="fa-solid fa-circle-notch animate-spin text-2xl text-gray-600"></i></div>
                    ) : errorMsg && !klines.length ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-red-400 p-6 text-center">
                            <i className="fa-solid fa-triangle-exclamation text-3xl mb-3 opacity-50"></i>
                            <p className="font-bold mb-2">数据获取失败</p>
                            <p className="text-xs text-gray-500 mb-4 break-all">{errorMsg}</p>
                            <button onClick={() => loadChartData()} className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded text-sm transition-colors">手动重试</button>
                        </div>
                    ) : (
                        <>
                           {/* Math Dashboard Overlay with Live Countdown */}
                           {showOverlays && (
                               <QuantDashboard 
                                    prediction={prediction} 
                                    hurst={mathStats.hurst} 
                                    fdi={mathStats.fdi} 
                                    entropy={mathStats.entropy}
                                    hmmState={mathStats.hmmState}
                                    esnPrice={esnData?.value || null}
                                    currentPrice={klines[klines.length-1]?.close || 0}
                                    countdown={candleTimeRemaining}
                                    refreshCounter={refreshCountdown}
                                />
                           )}
                           <div className="flex-1 relative">
                              <CryptoChart 
                                ref={chartRef} 
                                data={klines} 
                                chanLun={chanLunData} 
                                harmonics={harmonicData} 
                                settings={settings} 
                                kalmanData={kalmanData} 
                                dwtData={dwtData} 
                                esnData={esnData} 
                                monteCarlo={monteCarlo} 
                                chartSignals={chartSignals} 
                              />
                              {/* Stats Overlay */}
                              {showOverlays && (
                                  <div className="absolute top-2 left-2 bg-dark-900/80 px-2 py-1 rounded text-[10px] text-gray-400 border border-dark-700 backdrop-blur pointer-events-none z-10">
                                      <div className="font-mono text-xs text-white mb-1">{symbol} {timeframe}</div>
                                      <div>K:{klines.length} | 笔:{chanLunData?.biList.length} 段:{chanLunData?.segList.length}</div>
                                      {chanLunData?.trend && <div className="mt-0.5 text-brand-500">走势: {chanLunData.trend.toUpperCase()}</div>}
                                  </div>
                              )}
                           </div>
                        </>
                    )}
                </div>

                <div className="hidden md:flex flex-1 flex-col bg-dark-800">
                     <div className="flex-1 flex overflow-hidden">
                         <div className="flex-1 flex flex-col border-r border-dark-700">
                             <div className="h-8 bg-dark-700 flex items-center px-3 border-b border-dark-600 justify-between shrink-0">
                                 <span className="text-xs font-bold text-blue-400"><i className="fa-solid fa-file-invoice-dollar mr-1"></i> 策略A：盈利策略</span>
                             </div>
                             <div className="flex-1 overflow-y-auto p-4 bg-dark-900/50">
                                 {resultA ? <MarkdownDisplay content={resultA} /> : <div className="h-full flex items-center justify-center text-gray-700 text-xs">等待分析...</div>}
                             </div>
                         </div>
                         <div className="flex-1 flex flex-col border-r border-dark-700">
                             <div className="h-8 bg-dark-700 flex items-center px-3 border-b border-dark-600 justify-between shrink-0">
                                 <span className="text-xs font-bold text-purple-400"><i className="fa-solid fa-chart-line mr-1"></i> 策略B：V6.5 自适应</span>
                             </div>
                             <div className="flex-1 overflow-y-auto p-4 bg-dark-900/50">
                                 {resultB ? <MarkdownDisplay content={resultB} /> : <div className="h-full flex items-center justify-center text-gray-700 text-xs">等待分析...</div>}
                             </div>
                         </div>
                         <div className="flex-1 flex flex-col">
                             <div className="h-8 bg-dark-700 flex items-center px-3 border-b border-dark-600 justify-between shrink-0">
                                 <span className="text-xs font-bold text-red-400"><i className="fa-solid fa-shield-halved mr-1"></i> 策略C：风控暴君</span>
                             </div>
                             <div className="flex-1 overflow-y-auto p-4 bg-dark-900/50">
                                 {resultC ? <MarkdownDisplay content={resultC} /> : <div className="h-full flex items-center justify-center text-gray-700 text-xs">等待分析...</div>}
                             </div>
                         </div>
                     </div>
                     <div className="h-48 border-t border-dark-700 flex flex-col bg-dark-900/80 shrink-0">
                         <div className="h-8 bg-brand-600/10 flex items-center px-3 border-b border-dark-700 justify-between">
                             <span className="text-xs font-bold text-brand-500 flex items-center gap-2">
                                <i className="fa-solid fa-gavel"></i>
                                CIO 最终裁决
                             </span>
                         </div>
                         <div className="flex-1 overflow-y-auto p-4">
                             {resultSummary ? <MarkdownDisplay content={resultSummary} /> : <span className="text-xs text-gray-600">等待三方辩论结束...</span>}
                         </div>
                     </div>
                </div>
              </>
          )}

          {/* VIEW: AI ASSISTANT */}
          {currentView === 'assistant' && (
              <div className="w-full h-full bg-slate-100 flex overflow-hidden text-slate-800">
                  <div className="hidden lg:block w-1/3 border-r border-slate-200 bg-black">
                        <CryptoChart 
                            ref={chartRef} 
                            data={klines} 
                            chanLun={chanLunData} 
                            harmonics={harmonicData} 
                            settings={settings}
                            kalmanData={kalmanData} 
                            dwtData={dwtData}
                            esnData={esnData}
                            monteCarlo={monteCarlo}
                            chartSignals={chartSignals}
                        />
                  </div>
                  <div className="flex-1 bg-white flex flex-col">
                      <div className="flex-1 overflow-hidden p-2">
                          <ChatInterface 
                              messages={chatMessages} 
                              input={chatInput} 
                              onInputChange={setChatInput} 
                              onSend={handleChatSend} 
                              isLoading={isChatLoading}
                              onGeneratePlan={handleGeneratePlan}
                          />
                      </div>
                  </div>
              </div>
          )}

          {/* VIEW: DOCS ARCHITECT (Restored) */}
          {currentView === 'docs' && (
              <div className="w-full h-full bg-slate-50 flex overflow-hidden">
                  {/* Left: Plan Viewer */}
                  <div className="w-80 border-r border-slate-200 bg-white flex flex-col z-10 shrink-0">
                      <div className="h-full overflow-hidden p-3">
                          <PlanViewer 
                              plan={docPlan} 
                              activeSectionId={activeSectionId} 
                              onSelectSection={setActiveSectionId}
                              onUpdateSectionContent={handleUpdateSectionContent}
                              isGeneratingContent={isSectionWriting}
                              onDownload={handleDownloadDoc}
                          />
                      </div>
                  </div>
                  
                  {/* Right: Markdown Editor */}
                  <div className="flex-1 flex flex-col overflow-hidden p-3 bg-slate-50">
                      <MarkdownEditor 
                          section={docPlan?.sections.find(s => s.id === activeSectionId)}
                          onContentChange={(val) => activeSectionId && handleUpdateSectionContent(activeSectionId, val)}
                          onAutoWrite={handleAutoWriteSection}
                          isWriting={isSectionWriting}
                      />
                  </div>
              </div>
          )}
      </main>
    </div>
  );
};

export default App;
