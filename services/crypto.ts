
import { Kline, MarketContext, TimeframeData, TechnicalIndicators, AppSettings, MarketRegime } from '../types';
import { calculateEMA, calculateRSI, calculateATR, calculateMACD, calculateVolumeAvg, calculateVWAP, calculateBollingerBands, calculateSuperTrend, calculateHurstExponent, calculateEntropy, calculateKalmanFilter, calculateFDI, calculateGARCH, calculateLorentzianPrediction, calculateDWT, calculateESN, calculateMonteCarlo, calculateHMMState, calculateEnsemblePrediction, calculateADX, calculateMFI, calculateOBV, calculateSAR, calculateKeltner, calculateKalmanZScore, calculateRVI, calculateLinReg, generateEnsembleMarkers } from './indicators';
import { calculateChanLun } from './chanlun';
import { calculateHarmonics } from './harmonics';
import { analyzeResonance } from './strategy';
import { fetchMacroContext } from './macro'; // New Macro Service

// --- Multi-Timeframe Fetcher ---

export const fetchFullMarketContext = async (symbol: string, settings: AppSettings): Promise<MarketContext> => {
    const limit = settings.klineLimit || 200;
    
    // Parallel fetch for speed
    const [klines15m, klines1h, klines4h] = await Promise.all([
        fetchKlines(symbol, '15m', limit),
        fetchKlines(symbol, '1h', limit),
        fetchKlines(symbol, '4h', limit)
    ]);
    
    // Fetch BTC for Macro Correlation (Real Data)
    let btcKlines: Kline[] = [];
    if (symbol !== 'BTCUSDT') {
        try {
            btcKlines = await fetchKlines('BTCUSDT', '4h', limit);
        } catch(e) { console.error("Macro BTC fetch failed", e); }
    } else {
        btcKlines = klines4h;
    }

    // 1. Calculate Regime & Macro
    const hurst = calculateHurstExponent(klines4h, Math.min(100, klines4h.length));
    const entropy = calculateEntropy(klines4h, 50);
    const macroData = await fetchMacroContext(symbol, klines4h, btcKlines);
    
    let regimeType: MarketRegime['regimeType'] = 'NOISE';
    if (hurst > 0.55) regimeType = 'TRENDING';
    else if (hurst < 0.45) regimeType = 'MEAN_REVERSION';
    else regimeType = 'NOISE';

    const regime: MarketRegime = {
        hurst,
        entropy,
        regimeType,
        volatilityState: 'NORMAL'
    };
    
    // Determine Volatility
    const atr4h = calculateATR(klines4h, 14);
    const lastClose = klines4h[klines4h.length-1].close;
    if (atr4h.length > 0) {
        const volatilityRatio = atr4h[atr4h.length-1] / lastClose;
        if (volatilityRatio > 0.03) regime.volatilityState = 'HIGH';
        else if (volatilityRatio < 0.005) regime.volatilityState = 'LOW';
    }

    // 2. Process Data for each timeframe
    const processData = (klines: Kline[], timeframe: string): TimeframeData => {
        // Standard Indicators
        const ema20 = calculateEMA(klines.map(k=>k.close), 20);
        const ema50 = calculateEMA(klines.map(k=>k.close), 50);
        const rsi = calculateRSI(klines, 14); // Legacy calc for display
        const atr = calculateATR(klines, 14);
        const macd = calculateMACD(klines);
        const volumeAvg = calculateVolumeAvg(klines, 20);
        const vwap = calculateVWAP(klines);
        const bollinger = calculateBollingerBands(klines, 20, 2);
        const superTrend = calculateSuperTrend(klines, 10, 3);
        const adx = calculateADX(klines, 14);
        
        // New Indicators (Forest Support)
        const mfi = calculateMFI(klines, 14);
        const obv = calculateOBV(klines);
        const sar = calculateSAR(klines);
        const keltner = calculateKeltner(klines, 20, 2);
        
        // Advanced Math Indicators
        const kalman = calculateKalmanFilter(klines);
        const fdi = calculateFDI(klines, 30);
        const garch = calculateGARCH(klines);
        
        // --- ALPHA REACTOR 6.0: PHYSICS ENGINE ---
        const kalmanZ = calculateKalmanZScore(klines);
        const rvi = calculateRVI(klines);
        const linReg = calculateLinReg(klines);
        
        // --- ALPHA REACTOR 4.0 (ENSEMBLE with MACRO) ---
        // Pass macro only if 4h, else undef (or pass scaled). 
        // We generally use Macro data for the main signal which is driven by 4h structure.
        const ensemble = calculateEnsemblePrediction(klines, timeframe === '4h' ? macroData : undefined, klines15m);
        
        const dwt = calculateDWT(klines);
        const esn = calculateESN(klines); 
        const monteCarlo = calculateMonteCarlo(klines);
        const hmm = calculateHMMState(klines);

        const indicators: TechnicalIndicators = {
            ema20: ema20.length ? ema20[ema20.length - 1] : null,
            ema50: ema50.length ? ema50[ema50.length - 1] : null,
            rsi: rsi.length ? rsi[rsi.length - 1] : null,
            atr: atr.length ? atr[atr.length - 1] : null,
            macd: macd.length ? macd[macd.length - 1] : null,
            volumeAvg,
            vwap: vwap.length ? vwap[vwap.length - 1] : null,
            bollinger: bollinger.length ? bollinger[bollinger.length - 1] : null,
            superTrend: superTrend.length ? superTrend[superTrend.length - 1] : null,
            adx: adx.length ? adx[adx.length-1] : null,

            // New Tech Factors
            mfi: mfi.length ? mfi[mfi.length - 1] : null,
            obv: obv.length ? obv[obv.length - 1] : null,
            sar: sar.length ? sar[sar.length - 1] : null,
            keltner: keltner.length ? keltner[keltner.length - 1] : null,

            // Advanced Math (Alpha Reactor 6.0)
            kalmanPrice: kalman.length ? kalman[kalman.length - 1] : null,
            kalmanZScore: kalmanZ.length ? kalmanZ[kalmanZ.length - 1] : null,
            rvi: rvi.length ? rvi[rvi.length - 1] : null,
            linRegSlope: linReg.slope.length ? linReg.slope[linReg.slope.length - 1] : null,
            linRegR2: linReg.r2.length ? linReg.r2[linReg.r2.length - 1] : null,

            fdi: fdi.length ? fdi[fdi.length - 1] : null,
            volatilityGARCH: garch.length ? garch[garch.length - 1] : null,
            prediction: {
                type: 'LORENTZIAN',
                direction: ensemble.consensusDirection,
                probability: Math.abs(ensemble.consensusScore) / 100,
                similarPatterns: 0
            },
            
            // Alpha Reactor Outputs
            dwtTrend: dwt.length ? dwt[dwt.length-1] : null,
            esnForecast: esn,
            monteCarlo: monteCarlo,
            hmmState: hmm,
            ensemble: ensemble // The full enhanced model
        };

        const chanlun = calculateChanLun(klines, settings);
        const harmonics = calculateHarmonics(klines);
        
        // --- GENERATE CHART SIGNALS FOR VISUALIZATION ---
        const chartSignals = generateEnsembleMarkers(klines);

        const tempData: TimeframeData = { 
            timeframe, 
            klines, 
            indicators, 
            chanlun, 
            harmonics, 
            analysis: {score: 50, signal: 'NEUTRAL', factors: []},
            chartSignals 
        };
        
        // Run Resonance Engine (Updated with Math Factors)
        tempData.analysis = analyzeResonance(tempData);
        
        // --- DEEP COMBINATION: Adjust Algorithmic Score based on Regime ---
        if (regime.entropy > 0.65) {
            tempData.analysis.score = 50 + (tempData.analysis.score - 50) * 0.5;
            tempData.analysis.factors.push(`⚠️ 高熵降权 (Entropy ${regime.entropy.toFixed(2)})`);
        }
        
        if (regime.hurst > 0.6 && tempData.analysis.score > 60) {
             tempData.analysis.score += 10;
             if(tempData.analysis.score > 100) tempData.analysis.score = 100;
             tempData.analysis.factors.push(`🚀 趋势共振 (Hurst ${regime.hurst.toFixed(2)})`);
        }

        return tempData;
    };

    const tf15m = processData(klines15m, '15m');
    const tf1h = processData(klines1h, '1h');
    const tf4h = processData(klines4h, '4h');

    // 3. Deep Calculation: Recursive Interval Nesting
    const intervalNesting: string[] = [];
    
    if (tf4h.chanlun.divergence.isDivergent && tf1h.chanlun.divergence.isDivergent) {
        if (tf4h.chanlun.divergence.type === tf1h.chanlun.divergence.type) {
            intervalNesting.push(`🔥 4H & 1H 同向背驰共振 (${tf4h.chanlun.divergence.type})`);
        }
    }
    if (tf4h.chanlun.trend === 'up' && tf15m.chanlun.buySellPoints.some(p => p.type === '3B')) {
         intervalNesting.push("🚀 4H趋势 + 15m三买 (顺势突破)");
    }
    if (tf4h.chanlun.trend === 'down' && tf15m.chanlun.buySellPoints.some(p => p.type === '3S')) {
         intervalNesting.push("🚀 4H趋势 + 15m三卖 (顺势下跌)");
    }

    const totalScore = Math.round(tf4h.analysis.score * 0.4 + tf1h.analysis.score * 0.3 + tf15m.analysis.score * 0.3);

    return {
        symbol,
        tf15m,
        tf1h,
        tf4h,
        regime,
        macro: macroData, // New Macro
        intervalNesting,
        totalScore
    };
};

/**
 * Fetches Real K-Line Data.
 */
export const fetchKlines = async (symbol: string = 'BTCUSDT', interval: string = '1h', limit: number = 200): Promise<Kline[]> => {
  let errors: string[] = [];
  try { return await fetchBybit(symbol, interval, limit); } catch (e: any) { errors.push(`Bybit: ${e.message}`); }
  try { return await fetchGateio(symbol, interval, limit); } catch (e: any) { errors.push(`GateIO: ${e.message}`); }
  try { return await fetchBinanceProxy(symbol, interval, limit); } catch (e: any) { errors.push(`BinanceProxy: ${e.message}`); }
  try { return await fetchCoinbase(symbol, interval, limit); } catch (e: any) { errors.push(`Coinbase: ${e.message}`); }
  console.error("Data Fetch Error Trace:", errors);
  throw new Error(`无法获取真实行情数据。\n尝试了: Bybit, Gate.io, Binance, Coinbase。\n最后错误: ${errors[errors.length-1]}`);
};

const fetchBybit = async (symbol: string, interval: string, limit: number): Promise<Kline[]> => {
    // Extended Bybit V5 Intervals
    const map: Record<string, string> = { 
        '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30', 
        '1h': '60', '2h': '120', '4h': '240', '6h': '360', '12h': '720', 
        '1d': 'D', '3d': 'D', '1w': 'W', '1M': 'M' 
    };
    // Note: Bybit doesn't strictly support 3d via API key but we map to D (will return D, imperfect but safe). 
    // Actually sticking to valid keys: 
    const tf = map[interval] || '60';
    
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol.toUpperCase()}&interval=${tf}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.retCode !== 0) throw new Error(`Bybit Error: ${json.retMsg}`);
    const list = json.result.list;
    if (!Array.isArray(list)) throw new Error("Invalid list");

    return list.map((d: string[]) => ({
        time: parseInt(d[0]) / 1000,
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5])
    })).sort((a: Kline, b: Kline) => a.time - b.time);
};

const fetchGateio = async (symbol: string, interval: string, limit: number): Promise<Kline[]> => {
    const pair = symbol.toUpperCase().replace('USDT', '_USDT');
    // GateIO supports: 10s, 1m, 5m, 15m, 30m, 1h, 4h, 8h, 1d, 7d
    let gateInterval = interval;
    if (interval === '1w') gateInterval = '7d';
    if (interval === '2h') gateInterval = '1h'; // Fallback approximation or fail
    if (interval === '12h') gateInterval = '8h'; // Approximation
    
    const url = `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${pair}&interval=${gateInterval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Invalid format");
    return data.map((d: any[]) => ({
        time: parseInt(d[0]),
        volume: parseFloat(d[1]),
        close: parseFloat(d[2]),
        high: parseFloat(d[3]),
        low: parseFloat(d[4]),
        open: parseFloat(d[5])
    })); 
};

const fetchBinanceProxy = async (symbol: string, interval: string, limit: number): Promise<Kline[]> => {
    // Binance supports full range
    const map: Record<string, string> = { 
        '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m', 
        '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
        '1d': '1d', '3d': '3d', '1w': '1w', '1M': '1M' 
    };
    const tf = map[interval] || '1h';
    const targetUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=${limit}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Invalid format");
    return data.map((d: any) => ({
      time: d[0] / 1000, 
      open: parseFloat(d[1]), 
      high: parseFloat(d[2]), 
      low: parseFloat(d[3]), 
      close: parseFloat(d[4]),
      volume: parseFloat(d[5])
    }));
};

const fetchCoinbase = async (symbol: string, interval: string, limit: number): Promise<Kline[]> => {
    const pair = symbol.toUpperCase().replace('USDT', '-USD').replace('BUSD', '-USD');
    let granularity = 3600;
    // Coinbase: 60, 300, 900, 3600, 21600 (6h), 86400 (1d)
    if (interval === '1m') granularity = 60;
    if (interval === '5m') granularity = 300;
    if (interval === '15m') granularity = 900;
    if (interval === '30m') granularity = 900; // Approx
    if (interval === '1h') granularity = 3600;
    if (interval === '2h') granularity = 3600; // Approx
    if (interval === '4h') granularity = 21600; // Approx to 6h
    if (interval === '6h') granularity = 21600;
    if (interval === '12h') granularity = 21600; // Approx
    if (interval === '1d') granularity = 86400;
    if (interval === '1w') granularity = 86400; // No weekly, just use daily

    const url = `https://api.exchange.coinbase.com/products/${pair}/candles?granularity=${granularity}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    const klines = data.map((d: number[]) => ({
        time: d[0],
        low: d[1],
        high: d[2],
        open: d[3],
        close: d[4],
        volume: d[5]
    })).sort((a: Kline, b: Kline) => a.time - b.time);
    return klines.slice(-limit);
};
