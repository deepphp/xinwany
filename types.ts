
export interface AppSettings {
  apiUrl: string;
  apiKey: string;
  modelId: string;
  klineLimit: number;

  // --- ChanLun Pro Settings ---
  // Bi (Stroke) Settings
  biType: 'old' | 'new' | 'fractal' | 'custom'; // 老笔, 新笔, 分型笔, 任意笔
  biStrict: boolean; // 是否严格处理包含关系
  biKCount: number; // 任意笔的K线数量限制

  // Recursion & Structure
  showBi: boolean; // 显示笔
  showSeg: boolean; // 显示线段
  showPivot: boolean; // 显示中枢
  showSignals: boolean; // 显示买卖点

  // MACD Settings
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
}

export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; 
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

export interface SuperTrend {
  value: number;
  direction: 'up' | 'down';
}

export interface PredictionModel {
    type: 'LORENTZIAN' | 'LSTM_LITE';
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    probability: number; // 0-1
    similarPatterns: number; // How many historical matches found
}

// New: Neural Matrix Outputs
export interface NeuralOutputs {
    lstmPrediction: number; // Price Target
    esnVolatility: number; // Predicted Volatility Range
    perceptronSignal: number; // -1 (Bear) to 1 (Bull)
}

// New: Forest Detailed Votes
export interface ForestVotes {
    trend: number; // -1 to 1
    reversion: number; // -1 to 1
    volume: number; // -1 to 1
    volatility: number; // 0 to 1 (Intensity)
    correlation: number; // -1 to 1 (Tree E)
}

// New: Macro & Correlation Data
export interface MacroData {
    btcCorrelation: number; // Beta against BTC
    marketDominance: number; // Estimated strength vs Market
    macroStressIndex: number; // Derived from Volatility of major assets
    timestamp: number;
}

// New: Model Health Monitoring
export interface ModelHealth {
    id: string;
    name: string;
    winRate: number; // 0-1 (Last 20 epochs)
    state: 'ACTIVE' | 'BENCHED';
    consecutiveLosses: number;
}

// New: Dynamic Rules learned by the system
export interface AdaptiveParams {
    zScoreThreshold: number; // Evolved from 2.0
    hurstThreshold: number; // Evolved from 0.55
    rvolThreshold: number; // Evolved from 3.0
    volatilityRegime: 'LOW' | 'HIGH';
}

// New: Neural Layer Debug Info
export interface NeuralLayerOutputs {
    inputFeatures: { name: string, value: number, vif: number }[]; // VIF filtered inputs
    contextScore: number; // Multi-TF Trend alignment
    dqnAction: { action: 'LONG' | 'SHORT' | 'WAIT', qValue: number };
    attentionWeight: number; // 0-1 (ESN Attention)
}

// New: Ensemble Model Result (Enhanced)
export interface EnsembleModel {
    consensusDirection: 'UP' | 'DOWN' | 'NEUTRAL';
    consensusScore: number; // -100 to 100
    neural: NeuralOutputs & { layers?: NeuralLayerOutputs }; // Extended with Layers
    forest: ForestVotes;
    regimeWeight: string; // Description of current weighting logic
    divergenceScore: number; // 0-1 (Agreement among models)
    modelHealth: ModelHealth[]; // Status of all models
    signalTimestamp: number; // For Time Decay
    learnedRules: AdaptiveParams; // The current set of optimized rules
}

// New: Chart Marker Signal
export interface ChartSignal {
    time: number;
    type: 'buy' | 'sell';
    label: string; // e.g., "DQ Buy"
    score: number;
    details?: string;
}

// New Math Types
export interface MonteCarloResult {
    upper95: number;
    lower95: number;
    meanPath: number[];
    upperPath: number[]; // Full path for 95th percentile
    lowerPath: number[]; // Full path for 5th percentile
}

export interface TechnicalIndicators {
  ema20: number | null;
  ema50: number | null;
  rsi: number | null;
  atr: number | null;
  macd: MACDResult | null;
  volumeAvg: number | null;
  vwap: number | null;           
  bollinger: BollingerBands | null; 
  superTrend: SuperTrend | null;    
  adx: number | null; 
  
  // --- New Tech Factors ---
  mfi: number | null; // Money Flow Index
  obv: number | null; // On Balance Volume
  sar: number | null; // Parabolic SAR
  keltner: { upper: number, lower: number, middle: number } | null;

  // --- Advanced Math (Alpha Reactor 6.0) ---
  kalmanPrice: number | null; 
  kalmanZScore: number | null; // NEW: Z-Score for Reversion
  rvi: number | null; // NEW: Relative Volume Intensity
  linRegSlope: number | null; // NEW: Linear Regression Slope
  linRegR2: number | null; // NEW: Linear Regression Quality

  fdi: number | null;         
  volatilityGARCH: number | null; 
  prediction: PredictionModel | null; 

  // --- Alpha Reactor Outputs ---
  dwtTrend: number | null; 
  esnForecast: number | null; 
  monteCarlo: MonteCarloResult | null; 
  hmmState: 'TREND' | 'OSCILLATION' | 'UNCERTAIN'; 
  ensemble: EnsembleModel | null; // New: Full Ensemble Result
}

export interface ResonanceAnalysis {
  score: number; // 0-100
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  factors: string[]; 
}

export interface HarmonicPattern {
    name: string; 
    subType: 'Bullish' | 'Bearish';
    quality: 'Perfect' | 'Standard' | 'Alternative'; 
    points: { X: ChanPoint, A: ChanPoint, B: ChanPoint, C: ChanPoint, D: ChanPoint };
    ratios: {
        XB: number; 
        AC: number; 
        BD: number; 
        XD: number; 
    };
    entryZone: number;
    stopLoss: number;
    takeProfit1: number;
    description: string;
}

export interface TimeframeData {
  timeframe: string;
  klines: Kline[];
  indicators: TechnicalIndicators;
  chanlun: ChanLunFeatures;
  harmonics: HarmonicPattern[]; 
  analysis: ResonanceAnalysis; 
  chartSignals: ChartSignal[]; // NEW: Signals to display on chart
}

export interface MarketRegime {
    hurst: number; // 0-0.5 Mean Reversion, 0.5 Random, 0.5-1 Trend
    entropy: number; // Market Disorder/Chaos
    regimeType: 'TRENDING' | 'MEAN_REVERSION' | 'NOISE';
    volatilityState: 'HIGH' | 'LOW' | 'NORMAL';
}

export interface MarketContext {
  symbol: string;
  tf15m: TimeframeData;
  tf1h: TimeframeData;
  tf4h: TimeframeData;
  regime: MarketRegime; // New: Mathematical Market State
  macro?: MacroData; // New: Macro Correlation Data
  intervalNesting: string[]; // New: Recursive Analysis
  totalScore: number; 
}

export interface AnalysisResult {
  timestamp: number;
  prediction: string;
}

// --- Chan Lun Types ---

export interface ChanPoint {
  index: number;
  price: number;
  type: 'top' | 'bottom';
  time: number;
  isFractal?: boolean; // Is this a raw fractal or a confirmed point?
}

// Bi is a Stroke (Basic Component)
export interface ChanBi {
    start: ChanPoint;
    end: ChanPoint;
    type: 'up' | 'down';
    isValid: boolean;
}

// Segment is a Higher Level Component (Recursive)
export interface ChanSeg {
    start: ChanPoint;
    end: ChanPoint;
    type: 'up' | 'down';
    biList: ChanBi[]; // Composed of Bis
}

export interface ChanPivot {
  startBiIndex: number;
  endBiIndex: number;
  zg: number; 
  zd: number; 
  gg: number; // Pivot High (Max)
  dd: number; // Pivot Low (Min)
  direction: 'neutral' | 'up' | 'down';
  startTime: number;
  endTime: number;
  level: 'bi' | 'seg'; // Bi Pivot or Segment Pivot
}

export interface MACDResult {
  dif: number;
  dea: number;
  hist: number;
}

export interface CandlePattern {
    name: string; 
    type: 'bull' | 'bear' | 'neutral';
    significance: 'high' | 'medium' | 'low';
}

export interface BuySellPoint {
    type: '1B' | '2B' | '3B' | '1S' | '2S' | '3S';
    price: number;
    time: number;
    desc: string;
    isSegmentLevel: boolean;
}

export interface ChanLunFeatures {
  klines: Kline[]; // Merged Klines
  fractals: ChanPoint[];
  biList: ChanBi[];
  segList: ChanSeg[];
  pivots: ChanPivot[];
  trend: 'up' | 'down' | 'consolidation';
  buySellPoints: BuySellPoint[];
  divergence: {
    isDivergent: boolean;
    type: 'top' | 'bottom' | null;
    strength: number; 
    description: string;
  };
}

// --- Documentation Architect Types ---

export interface DocumentSection {
  id: string;
  title: string;
  description: string;
  content: string;
}

export interface DocPlan {
  title: string;
  targetAudience: string;
  tone: string;
  sections: DocumentSection[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}
