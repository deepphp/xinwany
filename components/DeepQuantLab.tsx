
import React, { useMemo } from 'react';
import { MarketContext, Kline } from '../types';

interface DeepQuantLabProps {
  isOpen: boolean;
  onClose: () => void;
  context: MarketContext | null;
}

export const DeepQuantLab: React.FC<DeepQuantLabProps> = ({ isOpen, onClose, context }) => {
  if (!isOpen) return null;

  if (!context) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md">
        <div className="text-white text-center">
            <i className="fa-solid fa-circle-notch animate-spin text-4xl text-brand-500 mb-4"></i>
            <p>正在初始化深度量化实验室数据...</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-dark-700 rounded hover:bg-dark-600">关闭</button>
        </div>
      </div>
    );
  }

  const { indicators, klines } = context.tf4h; // Using 4H data for main analysis
  const { regime, macro } = context;
  const ensemble = indicators.ensemble;
  const health = ensemble?.modelHealth || [];

  // --- Real-Time Calculations ---
  const stats = useMemo(() => {
     if (!klines || klines.length === 0) return null;
     const lastPrice = klines[klines.length-1].close;

     // 1. CVD (Cumulative Volume Delta)
     let buyVol = 0;
     let sellVol = 0;
     klines.slice(-50).forEach(k => {
         if (k.close > k.open) buyVol += k.volume;
         else sellVol += k.volume;
     });
     const totalVol = buyVol + sellVol;
     const buyingPressure = totalVol > 0 ? buyVol / totalVol : 0.5;

     // 2. Kelly Criterion (Adjusted by Macro Stress)
     const b = 1.5;
     let p = 0.5;
     if (indicators.prediction && indicators.prediction.probability > 0) {
         p = indicators.prediction.probability;
         if (regime.entropy > 0.6) p *= 0.8; 
         if (macro && macro.macroStressIndex > 0.7) p *= 0.7; // Macro Stress penalty
     }
     const q = 1 - p;
     let kelly = (b * p - q) / b;
     if (kelly < 0) kelly = 0; 
     if (kelly > 0.5) kelly = 0.5; 

     return { buyingPressure, kelly };
  }, [klines, indicators, regime, macro]);

  // --- AI Price Prediction Logic ---
  const prediction = useMemo(() => {
      if (!ensemble || !klines.length) return null;
      const currentPrice = klines[klines.length-1].close;
      
      // Use Nano LSTM prediction as primary target
      // If LSTM is 0 or invalid, fallback to Consensus Direction projection
      let target = ensemble.neural.lstmPrediction || 0;
      
      // Fallback logic if LSTM hasn't warmed up
      if (target === 0) {
          const dir = ensemble.consensusScore > 0 ? 1 : -1;
          const strength = Math.abs(ensemble.consensusScore) / 200; // conservative move
          target = currentPrice * (1 + (dir * strength));
      }

      const diff = target - currentPrice;
      const diffPct = (diff / currentPrice) * 100;
      
      // Determine Confidence Range based on Volatility Tree
      // Volatility metric is roughly 0-1, we map it to a realistic ATR multiple approx
      const volFactor = Math.max(0.005, (ensemble.forest.volatility || 0) * 0.03); 
      const rangeUpper = target * (1 + volFactor);
      const rangeLower = target * (1 - volFactor);

      return {
          target,
          diff,
          diffPct,
          rangeUpper,
          rangeLower,
          isBullish: target > currentPrice
      };
  }, [ensemble, klines]);

  if (!stats) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b0e11] text-gray-200 overflow-y-auto font-sans">
      {/* Header */}
      <div className="sticky top-0 bg-dark-800 border-b border-dark-700 px-6 py-4 flex justify-between items-center z-10 shadow-lg">
        <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-brand-600 rounded flex items-center justify-center text-black text-xl font-bold">
                 <i className="fa-solid fa-flask"></i>
             </div>
             <div>
                 <h1 className="text-xl font-bold text-white tracking-tight">Alpha Reactor 6.0 <span className="text-brand-500 text-sm align-top">PHYSICS-QUANT</span></h1>
                 <p className="text-xs text-gray-500 uppercase tracking-widest">混合神经森林 + 统计物理场 (Hybrid Physics Forest)</p>
             </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-dark-700 hover:bg-red-500/20 hover:text-red-500 transition-all flex items-center justify-center">
            <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        
        {/* ROW 1: Macro & Factor Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Macro Monitor */}
            <div className="bg-dark-800 rounded-xl border border-dark-600 p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10"><i className="fa-solid fa-earth-americas text-6xl"></i></div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Macro Environment</h2>
                
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span>BTC Correlation</span>
                            <span className={macro?.btcCorrelation! > 0.7 ? 'text-brand-500' : 'text-gray-400'}>{macro?.btcCorrelation.toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-dark-700 h-1 rounded overflow-hidden">
                            <div className="h-full bg-brand-500" style={{width: `${Math.abs(macro?.btcCorrelation||0)*100}%`}}></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span>Market Stress</span>
                            <span className={macro?.macroStressIndex! > 0.6 ? 'text-red-500' : 'text-green-500'}>{macro?.macroStressIndex.toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-dark-700 h-1 rounded overflow-hidden">
                            <div className={`h-full ${macro?.macroStressIndex! > 0.6 ? 'bg-red-500' : 'bg-green-500'}`} style={{width: `${(macro?.macroStressIndex||0)*100}%`}}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* VIF Factor Selection (Heatmap) - REPLACED RSI WITH Z-SCORE */}
            <div className="lg:col-span-3 bg-dark-800 rounded-xl border border-dark-600 p-4">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest"><i className="fa-solid fa-filter mr-1"></i> Dynamic Factor Selection (VIF)</h2>
                    <span className="text-[10px] bg-dark-700 px-2 py-0.5 rounded text-gray-400">Features Active</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {ensemble?.neural.layers?.inputFeatures.map((f, i) => (
                        <div key={i} className={`p-2 rounded border ${f.vif < 5 ? 'bg-dark-900 border-dark-700' : 'bg-red-900/20 border-red-900/50 opacity-50'}`}>
                            <div className="flex justify-between text-[10px] text-gray-400">
                                <span>{f.name}</span>
                                <span>VIF: {f.vif.toFixed(1)}</span>
                            </div>
                            <div className="text-sm font-mono mt-1 text-white">{f.value.toFixed(2)}</div>
                        </div>
                    ))}
                    {/* NEW METRICS: Z-Score & RVI */}
                     <div className="p-2 rounded border bg-dark-900 border-dark-700">
                            <div className="flex justify-between text-[10px] text-gray-400"><span>Kalman Z-Score</span><span>VIF: 1.2</span></div>
                            <div className={`text-sm font-mono mt-1 ${Math.abs(indicators.kalmanZScore || 0) > 2 ? 'text-red-400 font-bold' : 'text-white'}`}>
                                {indicators.kalmanZScore?.toFixed(2)} σ
                            </div>
                    </div>
                    <div className="p-2 rounded border bg-dark-900 border-dark-700">
                            <div className="flex justify-between text-[10px] text-gray-400"><span>LinReg Slope</span><span>VIF: 1.5</span></div>
                            <div className="text-sm font-mono mt-1 text-white">{indicators.linRegSlope?.toFixed(2)}%</div>
                    </div>
                    <div className="p-2 rounded border bg-dark-900 border-dark-700">
                            <div className="flex justify-between text-[10px] text-gray-400"><span>RVI (Vol Int)</span><span>VIF: 1.8</span></div>
                            <div className="text-sm font-mono mt-1 text-white">{indicators.rvi?.toFixed(2)}</div>
                    </div>
                </div>
            </div>
        </div>

        {/* ROW 2: Hierarchical Neural Brain */}
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-1 relative">
             <div className="bg-dark-900/50 p-4 border-b border-dark-700 flex justify-between items-center">
                 <h2 className="font-bold text-purple-400 flex items-center gap-2"><i className="fa-solid fa-brain"></i> 分层神经网络 (Hierarchical Neural Matrix)</h2>
             </div>
             <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                 
                 {/* Layer 1: Bottom */}
                 <div className="flex flex-col items-center">
                     <div className="w-full bg-dark-900 border border-dark-700 rounded-lg p-3 text-center mb-2">
                         <div className="text-[10px] text-gray-500 uppercase">Layer 1: Input</div>
                         <div className="font-bold text-blue-400">Feature Extraction</div>
                         <div className="text-xs mt-1">Score: {ensemble?.neural.layers?.inputFeatures[0].value.toFixed(2)}</div>
                     </div>
                     <i className="fa-solid fa-arrow-up text-gray-600"></i>
                 </div>

                 {/* Layer 2: Middle */}
                 <div className="flex flex-col items-center">
                     <div className="w-full bg-dark-900 border border-dark-700 rounded-lg p-3 text-center mb-2">
                         <div className="text-[10px] text-gray-500 uppercase">Layer 2: Context</div>
                         <div className="font-bold text-yellow-400">Multi-TF Alignment</div>
                         <div className="text-xs mt-1">Score: {ensemble?.neural.layers?.contextScore.toFixed(2)}</div>
                     </div>
                     <i className="fa-solid fa-arrow-up text-gray-600"></i>
                 </div>

                 {/* Layer 3: Top */}
                 <div className="flex flex-col items-center">
                     <div className="w-full bg-brand-900/20 border border-brand-500/50 rounded-lg p-3 text-center mb-2 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                         <div className="text-[10px] text-gray-500 uppercase">Layer 3: Decision</div>
                         <div className="font-bold text-brand-500">DQN Policy Head</div>
                         <div className="text-xl font-black mt-1">{ensemble?.neural.layers?.dqnAction.action}</div>
                         <div className="text-[9px] text-gray-400">Q-Value: {ensemble?.neural.layers?.dqnAction.qValue.toFixed(2)}</div>
                     </div>
                 </div>

             </div>
        </div>

        {/* ROW 3: Forest & Model Health */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* Forest Votes - UPDATED LABELS */}
             <div className="bg-dark-800 rounded-xl border border-dark-600 p-4">
                 <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Random Forest (Physics Trees)</h2>
                 <div className="space-y-3">
                     {[
                         { name: 'Tree A: Trend (Hurst+LinReg)', val: ensemble?.forest.trend },
                         { name: 'Tree B: Reversion (Z-Score)', val: ensemble?.forest.reversion },
                         { name: 'Tree C: Volume (RVI+VSA)', val: ensemble?.forest.volume },
                         { name: 'Tree D: Volatility (GARCH)', val: ensemble?.forest.volatility },
                         { name: 'Tree E: Correlation (Macro)', val: ensemble?.forest.correlation },
                     ].map((t, i) => (
                         <div key={i} className="flex items-center gap-3">
                             <div className="w-40 text-xs text-gray-400">{t.name}</div>
                             <div className="flex-1 bg-dark-900 h-2 rounded overflow-hidden flex">
                                 <div className="h-full bg-red-500" style={{ width: `${t.val! < 0 ? Math.abs(t.val!)*50 : 0}%`, marginLeft: 'auto' }}></div>
                                 <div className="w-0.5 h-full bg-gray-600"></div>
                                 <div className="h-full bg-green-500" style={{ width: `${t.val! > 0 ? t.val!*50 : 0}%`, marginRight: 'auto' }}></div>
                             </div>
                             <div className="w-8 text-right text-xs font-mono">{t.val?.toFixed(1)}</div>
                         </div>
                     ))}
                 </div>
             </div>

             {/* Model Health Monitor */}
             <div className="bg-dark-800 rounded-xl border border-dark-600 p-4">
                 <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Model Health (Pooling)</h2>
                 <div className="space-y-2">
                     {health.map((m, i) => (
                         <div key={i} className="flex items-center justify-between p-2 bg-dark-900 rounded border border-dark-700">
                             <div>
                                 <div className="text-xs font-bold text-gray-300">{m.name}</div>
                                 <div className="text-[10px] text-gray-500">WinRate (20): {(m.winRate * 100).toFixed(0)}%</div>
                             </div>
                             <div className={`px-2 py-1 rounded text-[10px] font-bold ${m.state === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                 {m.state}
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
        </div>

        {/* ROW 4: Total Consensus & PRICE PREDICTION */}
        <div className="bg-gradient-to-r from-dark-800 to-dark-900 rounded-xl border border-dark-600 p-6 shadow-lg grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
             
             {/* LEFT: Consensus Score */}
             <div className="border-r border-dark-700 pr-6">
                 <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Final Alpha Consensus</div>
                 <div className="text-3xl font-black text-white tracking-tight flex items-baseline gap-3">
                     {ensemble?.consensusDirection}
                     <span className={`text-lg font-mono px-2 py-0.5 rounded ${ensemble?.consensusScore! > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                         {ensemble?.consensusScore.toFixed(0)}
                     </span>
                 </div>
                 <div className="text-xs text-gray-400 mt-2">
                     Weight Regime: <span className="text-brand-500">{ensemble?.regimeWeight}</span>
                 </div>
             </div>

             {/* CENTER: AI Price Prediction (NEW COMPONENT) */}
             <div className="text-center px-4">
                 {prediction && (
                     <>
                        <div className="text-xs text-brand-500 font-bold uppercase tracking-widest mb-1 animate-pulse">
                            AI Target (Next Candle)
                        </div>
                        <div className={`text-3xl font-black tracking-tighter ${prediction.isBullish ? 'text-green-400' : 'text-red-400'}`}>
                            {prediction.target.toFixed(2)}
                            <span className="text-sm font-normal text-gray-500 ml-2">
                                ({prediction.diff > 0 ? '+' : ''}{prediction.diffPct.toFixed(2)}%)
                            </span>
                        </div>
                        <div className="mt-2 flex justify-between text-[10px] text-gray-500 font-mono bg-dark-900/50 rounded px-3 py-1 border border-dark-700/50">
                             <span>Low: {prediction.rangeLower.toFixed(2)}</span>
                             <span className="text-gray-700">|</span>
                             <span>High: {prediction.rangeUpper.toFixed(2)}</span>
                        </div>
                     </>
                 )}
             </div>

             {/* RIGHT: Risk & Sizing */}
             <div className="border-l border-dark-700 pl-6 text-right">
                  <div className="text-xs text-gray-500 mb-1">Kelly Position Size</div>
                  <div className="text-2xl font-bold text-white">{(stats.kelly * 100).toFixed(1)}%</div>
                  <div className="text-[10px] text-gray-600 mt-1">Divergence Score: {(ensemble?.divergenceScore! * 100).toFixed(0)}%</div>
             </div>
        </div>

      </div>
    </div>
  );
};
