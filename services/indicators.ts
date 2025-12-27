
import { Kline, MACDResult, BollingerBands, SuperTrend, PredictionModel, MonteCarloResult, EnsembleModel, ForestVotes, NeuralOutputs, MacroData, ModelHealth, AdaptiveParams, ChartSignal } from '../types';
import { calculateCorrelation } from './macro'; 
import { learner } from './math_engine'; 
import { HierarchicalNeuralNet } from './neural_layers';

// --- Standard Indicators ---

export const calculateMACD = (klines: Kline[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MACDResult[] => {
    if (klines.length === 0) return [];
    const closePrices = klines.map(k => k.close);
    const emaFast = calculateEMA(closePrices, fastPeriod);
    const emaSlow = calculateEMA(closePrices, slowPeriod);
    const macdResults: MACDResult[] = [];
    const difs: number[] = [];
    
    for (let i = 0; i < closePrices.length; i++) {
        const dif = emaFast[i] - emaSlow[i];
        difs.push(dif);
    }
    const dea = calculateEMA(difs, signalPeriod);
    for (let i = 0; i < closePrices.length; i++) {
        macdResults.push({ dif: difs[i], dea: dea[i], hist: (difs[i] - dea[i]) * 2 });
    }
    return macdResults;
};

export const calculateEMA = (data: number[], period: number): number[] => {
    if (data.length === 0) return [];
    const k = 2 / (period + 1);
    const emaArray: number[] = [];
    emaArray[0] = data[0];
    for (let i = 1; i < data.length; i++) {
        emaArray.push(data[i] * k + emaArray[i - 1] * (1 - k));
    }
    return emaArray;
};

// RSI retained for legacy display only, removed from Core Forest
export const calculateRSI = (klines: Kline[], period = 14): number[] => {
    if (klines.length < period + 1) return new Array(klines.length).fill(50);
    const changes = [];
    for (let i = 1; i < klines.length; i++) changes.push(klines[i].close - klines[i-1].close);
    
    const rsiArray: number[] = new Array(period).fill(0);
    let avgGain = 0, avgLoss = 0;
    
    for (let i = 0; i < period; i++) {
        const chg = changes[i];
        if (chg > 0) avgGain += chg;
        else avgLoss += Math.abs(chg);
    }
    avgGain /= period; avgLoss /= period;
    rsiArray.push(100 - (100 / (1 + avgGain / (avgLoss || 1))));

    for (let i = period; i < changes.length; i++) {
        const chg = changes[i];
        const gain = chg > 0 ? chg : 0;
        const loss = chg < 0 ? Math.abs(chg) : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        rsiArray.push(100 - (100 / (1 + avgGain / (avgLoss || 0.00001))));
    }
    return rsiArray;
};

export const calculateATR = (klines: Kline[], period = 14): number[] => {
    if (klines.length < period) return new Array(klines.length).fill(0);
    const trs = [];
    for (let i = 0; i < klines.length; i++) {
        const high = klines[i].high;
        const low = klines[i].low;
        if (i === 0) { trs.push(high - low); continue; }
        const closePrev = klines[i-1].close;
        trs.push(Math.max(high - low, Math.abs(high - closePrev), Math.abs(low - closePrev)));
    }
    const atrArray: number[] = [];
    let sum = 0;
    for (let i = 0; i < period; i++) sum += trs[i];
    let prevATR = sum / period;
    for(let i=0; i<period-1; i++) atrArray.push(0);
    atrArray.push(prevATR);
    for (let i = period; i < trs.length; i++) {
        const atr = (prevATR * (period - 1) + trs[i]) / period;
        atrArray.push(atr);
        prevATR = atr;
    }
    return atrArray;
};

export const calculateVolumeAvg = (klines: Kline[], period = 20): number => {
    if (klines.length < period) return 0;
    let sum = 0, count = 0;
    for(let i = klines.length - period; i < klines.length; i++) {
        sum += klines[i].volume || 0;
        count++;
    }
    return count > 0 ? sum / count : 0;
};

export const calculateVWAP = (klines: Kline[]): number[] => {
    const vwap: number[] = [];
    let cumVol = 0;
    let cumVolPrice = 0;

    for (const k of klines) {
        const typicalPrice = (k.high + k.low + k.close) / 3;
        const vol = k.volume || 0;
        
        cumVol += vol;
        cumVolPrice += typicalPrice * vol;
        
        vwap.push(cumVolPrice / (cumVol || 1));
    }
    return vwap;
};

export const calculateBollingerBands = (klines: Kline[], period = 20, mult = 2.0): BollingerBands[] => {
    if (klines.length < period) return new Array(klines.length).fill({upper:0, middle:0, lower:0});

    const bbs: BollingerBands[] = [];
    const closePrices = klines.map(k => k.close);

    for (let i = 0; i < closePrices.length; i++) {
        if (i < period - 1) {
            bbs.push({upper:0, middle:0, lower:0});
            continue;
        }
        
        let sum = 0;
        for (let j = 0; j < period; j++) sum += closePrices[i - j];
        const sma = sum / period;

        let sumSqDiff = 0;
        for (let j = 0; j < period; j++) {
            sumSqDiff += Math.pow(closePrices[i - j] - sma, 2);
        }
        const stdDev = Math.sqrt(sumSqDiff / period);

        bbs.push({
            middle: sma,
            upper: sma + mult * stdDev,
            lower: sma - mult * stdDev
        });
    }
    return bbs;
};

export const calculateSuperTrend = (klines: Kline[], period = 10, multiplier = 3.0): SuperTrend[] => {
    const atrs = calculateATR(klines, period);
    const results: SuperTrend[] = [];
    
    let prevUpper = 0;
    let prevLower = 0;
    let prevTrend: 'up' | 'down' = 'up';

    for (let i = 0; i < klines.length; i++) {
        if (i < period) {
            results.push({ value: 0, direction: 'up' });
            continue;
        }

        const k = klines[i];
        const prevK = klines[i-1];
        const atr = atrs[i];
        
        const basicUpper = (k.high + k.low) / 2 + multiplier * atr;
        const basicLower = (k.high + k.low) / 2 - multiplier * atr;

        let upper = basicUpper;
        if (prevUpper > 0 && basicUpper > prevUpper && prevK.close < prevUpper) {
            upper = prevUpper; 
        } else if (prevUpper > 0 && basicUpper < prevUpper) {
             // Allow moving down
        } 
        
        if (i > period && prevUpper) {
             upper = (basicUpper < prevUpper || prevK.close > prevUpper) ? basicUpper : prevUpper;
        }

        let lower = basicLower;
        if (i > period && prevLower) {
             lower = (basicLower > prevLower || prevK.close < prevLower) ? basicLower : prevLower;
        }

        let direction = prevTrend;
        if (prevTrend === 'up' && k.close < lower) {
            direction = 'down';
        } else if (prevTrend === 'down' && k.close > upper) {
            direction = 'up';
        }

        results.push({
            value: direction === 'up' ? lower : upper,
            direction
        });

        prevUpper = upper;
        prevLower = lower;
        prevTrend = direction;
    }
    return results;
};

export const calculateADX = (klines: Kline[], period=14): number[] => {
    if (klines.length < period * 2) return new Array(klines.length).fill(20);
    const adx: number[] = new Array(period).fill(0);
    
    const trs = calculateATR(klines, period);
    for(let i=period; i<klines.length; i++) {
        const upMove = klines[i].high - klines[i-1].high;
        const downMove = klines[i-1].low - klines[i].low;
        let pdm = (upMove > downMove && upMove > 0) ? upMove : 0;
        let mdm = (downMove > upMove && downMove > 0) ? downMove : 0;
        
        const tr = trs[i] || 1;
        const pdi = (pdm / tr) * 100;
        const mdi = (mdm / tr) * 100;
        
        const dx = (Math.abs(pdi - mdi) / (pdi + mdi + 0.001)) * 100;
        const prevAdx = adx[adx.length-1] || dx;
        adx.push((prevAdx * (period - 1) + dx) / period);
    }
    return adx;
}

// --- NEW ALPHA REACTOR 6.0 INDICATORS ---

export const calculateKalmanZScore = (klines: Kline[], period=50): number[] => {
    // 1. Calculate Kalman Estimates
    const kalman = calculateKalmanFilter(klines);
    const zScores: number[] = [];

    // 2. Calculate Residuals and Z-Score rolling
    // Need buffer
    const residuals: number[] = [];
    
    for (let i = 0; i < klines.length; i++) {
        const price = klines[i].close;
        const est = kalman[i];
        const res = price - est;
        residuals.push(res);
        
        if (i < period) {
            zScores.push(0);
            continue;
        }
        
        const slice = residuals.slice(i - period, i + 1);
        const mean = slice.reduce((a,b) => a+b, 0) / slice.length;
        const variance = slice.reduce((a,b) => a + Math.pow(b-mean, 2), 0) / slice.length;
        const std = Math.sqrt(variance);
        
        if (std === 0) zScores.push(0);
        else zScores.push(res / std);
    }
    return zScores;
};

export const calculateRVI = (klines: Kline[], period=50): number[] => {
    // Relative Volume Intensity = RVOL * (Directional Intensity)
    const rvi: number[] = [];
    const volumes = klines.map(k => k.volume);
    
    // Calculate SMA of Volume
    const smaVol = calculateEMA(volumes, period); // Approximation using EMA for smoothness
    
    for (let i = 0; i < klines.length; i++) {
        const k = klines[i];
        const avgVol = smaVol[i] || 1;
        const rvol = k.volume / avgVol;
        
        const range = k.high - k.low;
        const body = k.close - k.open;
        
        // Intensity: How much of the candle range was directional move?
        // -1 to 1
        const intensity = range === 0 ? 0 : body / range;
        
        rvi.push(rvol * intensity);
    }
    return rvi;
};

export const calculateLinReg = (klines: Kline[], period=20): {slope: number[], r2: number[]} => {
    const slopeArr: number[] = [];
    const r2Arr: number[] = [];
    
    for (let i = 0; i < klines.length; i++) {
        if (i < period) {
            slopeArr.push(0);
            r2Arr.push(0);
            continue;
        }
        
        // x = 0, 1, 2... period-1
        // y = prices
        const slice = klines.slice(i - period + 1, i + 1);
        const y = slice.map(k => k.close);
        const x = Array.from({length: period}, (_, idx) => idx);
        
        const n = period;
        const sumX = x.reduce((a,b)=>a+b,0);
        const sumY = y.reduce((a,b)=>a+b,0);
        const sumXY = x.reduce((a,b,idx)=>a+b*y[idx],0);
        const sumX2 = x.reduce((a,b)=>a+b*b,0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // R2 calculation
        const yMean = sumY / n;
        const ssTot = y.reduce((a,b) => a + Math.pow(b - yMean, 2), 0);
        const ssRes = y.reduce((a,b,idx) => a + Math.pow(b - (slope*x[idx] + intercept), 2), 0);
        const r2 = 1 - (ssRes / (ssTot || 1));
        
        // Normalize slope by price to make it percentage based (approx)
        const normSlope = slope / yMean * 100;
        
        slopeArr.push(normSlope);
        r2Arr.push(r2);
    }
    
    return { slope: slopeArr, r2: r2Arr };
};

// --- LEGACY HELPERS (Still used for some charts/macros) ---

export const calculateMFI = (klines: Kline[], period=14): number[] => {
    if (klines.length < period) return new Array(klines.length).fill(50);
    const mfi: number[] = new Array(period-1).fill(50);
    
    for(let i=period; i<klines.length; i++) {
        let posFlow = 0;
        let negFlow = 0;
        for(let j=0; j<period; j++) {
            const idx = i-j;
            const k = klines[idx];
            const prev = klines[idx-1];
            const tp = (k.high + k.low + k.close) / 3;
            const prevTp = (prev.high + prev.low + prev.close) / 3;
            const flow = tp * k.volume;
            if(tp > prevTp) posFlow += flow;
            else if (tp < prevTp) negFlow += flow;
        }
        const ratio = posFlow / (negFlow || 1);
        mfi.push(100 - (100 / (1 + ratio)));
    }
    return mfi;
};

export const calculateOBV = (klines: Kline[]): number[] => {
    const obv: number[] = [0];
    for(let i=1; i<klines.length; i++) {
        const k = klines[i];
        const prev = klines[i-1];
        let val = obv[i-1];
        if (k.close > prev.close) val += k.volume;
        else if (k.close < prev.close) val -= k.volume;
        obv.push(val);
    }
    return obv;
};

export const calculateSAR = (klines: Kline[], start=0.02, inc=0.02, max=0.2): number[] => {
    // Simplified SAR for logic tree
    const sar: number[] = new Array(klines.length).fill(0);
    let isLong = true;
    let acc = start;
    let ep = klines[0].high;
    sar[0] = klines[0].low;
    
    for(let i=1; i<klines.length; i++) {
        const prevSar = sar[i-1];
        if (isLong) {
            sar[i] = prevSar + acc * (ep - prevSar);
            if (klines[i].low < sar[i]) { // Reversal
                isLong = false;
                sar[i] = ep;
                ep = klines[i].low;
                acc = start;
            } else {
                if (klines[i].high > ep) {
                    ep = klines[i].high;
                    acc = Math.min(acc + inc, max);
                }
            }
        } else {
            sar[i] = prevSar - acc * (prevSar - ep);
            if (klines[i].high > sar[i]) { // Reversal
                isLong = true;
                sar[i] = ep;
                ep = klines[i].high;
                acc = start;
            } else {
                if (klines[i].low < ep) {
                    ep = klines[i].low;
                    acc = Math.min(acc + inc, max);
                }
            }
        }
    }
    return sar;
};

export const calculateKeltner = (klines: Kline[], period=20, mult=2.0): {upper:number, lower:number, middle:number}[] => {
    const ema = calculateEMA(klines.map(k=>k.close), period);
    const atr = calculateATR(klines, period);
    const res = [];
    for(let i=0; i<klines.length; i++) {
        res.push({
            middle: ema[i],
            upper: ema[i] + mult * atr[i],
            lower: ema[i] - mult * atr[i]
        });
    }
    return res;
};

// --- ADVANCED MATH & NEURAL MODELS ---

export const calculateKalmanFilter = (klines: Kline[]): number[] => {
    const result: number[] = [];
    let estimate = klines[0]?.close || 0;
    let errorEstimate = 1;
    let kalmanGain = 0;
    const Q = 0.1; const R = 0.5;
    for (const k of klines) {
        const measurement = k.close;
        errorEstimate = errorEstimate + Q;
        kalmanGain = errorEstimate / (errorEstimate + R);
        estimate = estimate + kalmanGain * (measurement - estimate);
        errorEstimate = (1 - kalmanGain) * errorEstimate;
        result.push(estimate);
    }
    return result;
};

export const calculateFDI = (klines: Kline[], period = 30): number[] => {
    const fdi: number[] = [];
    for (let i = 0; i < klines.length; i++) {
        if (i < period) { fdi.push(1.5); continue; }
        let pathLength = 0;
        let maxHigh = -Infinity;
        let minLow = Infinity;
        for (let j = 0; j < period; j++) {
            const idx = i - j;
            const prev = klines[idx - 1];
            const curr = klines[idx];
            if (prev) pathLength += Math.abs(curr.close - prev.close);
            if (curr.high > maxHigh) maxHigh = curr.high;
            if (curr.low < minLow) minLow = curr.low;
        }
        const range = maxHigh - minLow;
        if (range === 0) fdi.push(1.5);
        else fdi.push(1 + (Math.log(pathLength / range) + Math.log(2)) / Math.log(2 * period));
    }
    return fdi;
};

export const calculateGARCH = (klines: Kline[], lambda = 0.94): number[] => {
    const vol: number[] = [];
    let variance = 0;
    if (klines.length > 1) {
        const r = (klines[1].close - klines[0].close) / klines[0].close;
        variance = r * r;
    }
    vol.push(Math.sqrt(variance));
    for (let i = 1; i < klines.length; i++) {
        const ret = (klines[i].close - klines[i-1].close) / klines[i-1].close;
        variance = lambda * variance + (1 - lambda) * (ret * ret);
        vol.push(Math.sqrt(variance));
    }
    return vol;
};

// --- MULTI-NEURAL MATRIX IMPLEMENTATION ---

export const calculateNanoLSTM = (klines: Kline[]): number => {
    if (klines.length < 50) return klines[klines.length-1].close;
    
    // Normalize input window
    const window = 30;
    const subset = klines.slice(-window);
    const prices = subset.map(k => k.close);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    const normalized = prices.map(p => (p - min) / (range || 1));
    
    // LSTM Cell State Proxies
    let c = 0; // Cell State
    let h = 0; // Hidden State
    
    // Heuristic Weights (simulating trained weights for demonstration)
    const Wf = 0.7; // Forget gate weight
    const Wi = 0.3; // Input gate weight
    const Wo = 0.5; // Output gate weight
    
    for (let i = 0; i < normalized.length; i++) {
        const x = normalized[i];
        const ft = 1 / (1 + Math.exp(-(Wf * x + 0.1 * h))); 
        const it = 1 / (1 + Math.exp(-(Wi * x - 0.1 * h)));
        const C_tilde = Math.tanh(x); 
        c = ft * c + it * C_tilde;
        const ot = 1 / (1 + Math.exp(-(Wo * x + 0.1 * h)));
        h = ot * Math.tanh(c);
    }
    
    const nextNorm = normalized[normalized.length-1] + (h * 0.1); 
    return nextNorm * range + min;
};

export const calculateDeepESN = (klines: Kline[]): number => {
    const window = 50;
    if (klines.length < window) return 0;
    
    const raw = [];
    for(let i=klines.length-window; i<klines.length; i++) {
        const k = klines[i];
        const prev = klines[i-1];
        const tr = Math.max(k.high-k.low, Math.abs(k.high-prev.close), Math.abs(k.low-prev.close));
        raw.push(tr);
    }
    
    const min = Math.min(...raw); const max = Math.max(...raw);
    const input = raw.map(x => (x - min) / ((max - min) || 1));
    
    const resSize = 15;
    let X = new Array(resSize).fill(0);
    const leak = 0.3;
    
    for(let t=0; t<input.length; t++) {
        const u = input[t];
        const x_new = [];
        for(let i=0; i<resSize; i++) {
            const activation = Math.sin(i * u + X[(i+1)%resSize] * 2.5); 
            x_new[i] = (1-leak)*X[i] + leak*Math.tanh(activation);
        }
        X = x_new;
    }
    
    const activity = X.reduce((a,b)=>a+Math.abs(b),0) / resSize;
    const predNorm = input[input.length-1] * 0.7 + activity * 0.3;
    
    return predNorm * (max - min) + min;
};

export const calculatePerceptron = (klines: Kline[]): number => {
    const k = klines[klines.length-1];
    
    // Perceptron now uses Physics inputs (ZScore, RVI) instead of simple RSI/MACD
    const zScores = calculateKalmanZScore(klines);
    const rvi = calculateRVI(klines);
    const ema50 = calculateEMA(klines.map(x=>x.close), 50);
    
    const x1 = zScores[zScores.length-1] / 3; // Normalize roughly -1 to 1
    const x2 = rvi[rvi.length-1]; // Already -1 to 1 (intensity)
    const x3 = (k.close - ema50[ema50.length-1]) / (k.close * 0.05); // Dist to EMA
    
    const w1 = 0.5; // Weight on ZScore
    const w2 = 0.3; // Weight on Volume Intensity
    const w3 = 0.2;
    const bias = 0.0;
    
    const z = x1*w1 + x2*w2 + x3*w3 + bias;
    return Math.tanh(z); // Output -1 to 1
};

/**
 * ALPHA REACTOR 6.0 FOREST: STAT ARB & PHYSICS
 * Replaced RSI/EMA/OBV with Z-Score/LinReg/RVI/GARCH
 */
export const calculateForestVotes = (klines: Kline[], sliceIndex: number = -1, macro?: MacroData, params?: AdaptiveParams): ForestVotes => {
    // If sliceIndex is -1, use full array. Otherwise, simulate being at that index.
    const effLength = sliceIndex === -1 ? klines.length : sliceIndex + 1;
    if (effLength < 60) return { trend: 0, reversion: 0, volume: 0, volatility: 0, correlation: 0 };
    
    const relevantKlines = klines.slice(0, effLength);
    // Note: Re-calculating full series for each step is slow (O(N^2)). 
    // Optimized version would pass pre-calculated series indices.
    // For this demo, we assume the inputs are pre-calc'd or we take the hit for robustness on short arrays.
    
    // To optimize, we assume this function is called once for "latest".
    // For historical generation, we will use a separate optimized function.
    
    const zScores = calculateKalmanZScore(relevantKlines);
    const rviArr = calculateRVI(relevantKlines);
    const linReg = calculateLinReg(relevantKlines);
    const garch = calculateGARCH(relevantKlines);
    const hurst = calculateHurstExponent(relevantKlines, 50);
    
    const cZScore = zScores[zScores.length-1];
    const cRVI = rviArr[rviArr.length-1];
    const cSlope = linReg.slope[linReg.slope.length-1];
    const cR2 = linReg.r2[linReg.r2.length-1];
    const cVol = garch[garch.length-1];

    // --- Tree A: Trend Tree (Hurst + LinReg) ---
    // NO EMA CROSS. Pure Physics.
    // Adaptive Threshold from Params (e.g., hurst > 0.55)
    const hurstLimit = params?.hurstThreshold || 0.55;
    let trendVote = 0;
    
    if (hurst > hurstLimit) {
        // We have persistence
        if (cSlope > 0.1 && cR2 > 0.6) trendVote = 0.8; // Strong Uptrend
        else if (cSlope < -0.1 && cR2 > 0.6) trendVote = -0.8; // Strong Downtrend
        else trendVote = cSlope > 0 ? 0.3 : -0.3; // Weak Trend
    } else {
        // Mean Reversion Regime - Trend Tree should be neutral or counter-trend?
        // Usually Trend Tree stays quiet in Chaos.
        trendVote = 0;
    }
    
    // --- Tree B: Reversion Tree (Kalman Z-Score) ---
    // NO RSI. Pure Stat Arb.
    // Threshold: +/- 2.0 Sigma (Adaptive)
    const zThresh = params?.zScoreThreshold || 2.0;
    let revVote = 0;
    
    if (cZScore > zThresh) revVote = -1.0; // Stat Overbought -> Short
    else if (cZScore < -zThresh) revVote = 1.0; // Stat Oversold -> Long
    else if (cZScore > 1.0) revVote = -0.3;
    else if (cZScore < -1.0) revVote = 0.3;
    
    // --- Tree C: Volume Tree (RVI & VSA) ---
    // NO OBV Slope. Pure Intensity.
    // RVOL > Threshold (e.g. 3.0) + Small Price Move = Stopping Volume
    // We approximate "Small Price Move" by low RVI directional component compared to raw volume?
    // Using RVI directly: High Positive RVI = Strong Buying. High Negative RVI = Strong Selling.
    let volVote = 0;
    if (cRVI > 0.5) volVote = 0.8;
    else if (cRVI < -0.5) volVote = -0.8;
    
    // VSA Check: High Volume (implied by high RVOL calc inside RVI) but low Intensity?
    // We need raw rvol for that. Let's infer from RVI.
    // If RVI is near 0 but Vol was high? Hard to separate here without raw rvol.
    // Simply use RVI direction for now.
    
    // --- Tree D: Volatility Tree (GARCH) ---
    // Used for sizing, not direction usually. But High Volatility -> Mean Reversion bias?
    let volatility = 0;
    const volThreshold = 0.02; // 2% daily var?
    if (cVol > volThreshold) volatility = 1.0;
    else volatility = 0.0;

    // --- Tree E: Correlation (Macro) ---
    let corrVote = 0;
    if (macro) {
        if (macro.marketDominance > 0) corrVote += 0.5; 
        else corrVote -= 0.5;
        if (macro.btcCorrelation > 0.8) corrVote *= 1.2;
    }
    
    return {
        trend: Math.max(-1, Math.min(1, trendVote)),
        reversion: Math.max(-1, Math.min(1, revVote)),
        volume: Math.max(-1, Math.min(1, volVote)),
        volatility: Math.max(0, Math.min(1, volatility)),
        correlation: Math.max(-1, Math.min(1, corrVote))
    };
};

/**
 * ALPHA REACTOR 5.0: SELF-OPTIMIZING ENGINE
 * Now with AUTO-BACKTEST & DYNAMIC RULE GENERATION.
 */
export const calculateEnsemblePrediction = (klines: Kline[], macro?: MacroData, tf15m?: Kline[]): EnsembleModel => {
    
    // 0. CHECK INITIALIZATION & SYMBOL & TRAINING
    if (!learner.isInitialized && klines.length > 100) {
        const lookback = 50; // Replay last 50 candles as "Daily Training"
        const startIdx = klines.length - lookback;
        
        // Use current params for the backtest initially
        const currentParams = learner.getParameters();

        for (let i = startIdx; i < klines.length - 1; i++) {
            // 1. Simulate prediction
            const votes = calculateForestVotes(klines, i, macro, currentParams);
            const neuralInput = HierarchicalNeuralNet.calculateInputLayer(klines.slice(0, i+1));
            const neuralContext = HierarchicalNeuralNet.calculateContextLayer(klines.slice(0, i+1), klines.slice(0, i+1)); 
            const neuralDQN = HierarchicalNeuralNet.calculateDQNLayer(neuralInput.score, neuralContext);
            
            // 2. Determine Outcome
            const currentClose = klines[i].close;
            const nextClose = klines[i+1].close;
            const pctChange = (nextClose - currentClose) / currentClose;
            
            // 3. Train Models (Feed Result to Learner)
            if (votes.trend > 0.3) learner.updateModelResult('tree_a', pctChange > 0);
            if (votes.trend < -0.3) learner.updateModelResult('tree_a', pctChange < 0);
            
            if (votes.reversion > 0.3) learner.updateModelResult('tree_b', pctChange > 0); 
            if (votes.reversion < -0.3) learner.updateModelResult('tree_b', pctChange < 0); 
            
            if (votes.volatility > 0.5) learner.updateModelResult('tree_d', Math.abs(pctChange) > 0.01); // Volatility prediction check

            if (neuralDQN.action === 'LONG') learner.updateModelResult('neural_dqn', pctChange > 0);
            if (neuralDQN.action === 'SHORT') learner.updateModelResult('neural_dqn', pctChange < 0);
        }
        
        // 4. GENERATE NEW RULES (Self-Optimization)
        // Based on the backtest results, the learner will tweak ADX, RSI, etc.
        learner.optimizeStrategy();
        
        learner.isInitialized = true;
    }

    // 1. Get Optimized Rules
    const learnedRules = learner.getParameters();

    // 2. Current Calculation (Live) using OPTIMIZED Params
    const forest = calculateForestVotes(klines, -1, macro, learnedRules);
    
    const lstmPrice = calculateNanoLSTM(klines);
    const esnVol = calculateDeepESN(klines);
    const perceptron = calculatePerceptron(klines);
    
    // Neural Layers
    const neuralInput = HierarchicalNeuralNet.calculateInputLayer(klines);
    const neuralContext = HierarchicalNeuralNet.calculateContextLayer(klines, tf15m || klines); 
    const neuralDQN = HierarchicalNeuralNet.calculateDQNLayer(neuralInput.score, neuralContext);
    const neuralAttention = HierarchicalNeuralNet.calculateAttentionESN(klines, esnVol > 0.8 ? 'HIGH' : 'NORMAL');

    // 3. Regime
    const hurst = calculateHurstExponent(klines, 50);
    const entropy = calculateEntropy(klines, 50);
    
    // 4. Scoring ( -100 to 100 )
    // Get Weights derived from the Backtest
    const wTreeA = learner.getModelWeight('tree_a');
    const wTreeB = learner.getModelWeight('tree_b');
    const wTreeC = learner.getModelWeight('tree_c');
    const wTreeE = learner.getModelWeight('tree_e');
    const wNeural = learner.getModelWeight('neural_dqn');

    let score = 0;
    let regimeDesc = "";
    
    let regimeModTrend = 1.0;
    let regimeModRev = 1.0;
    
    if (hurst > 0.55 && entropy < 0.6) {
        regimeDesc = "STRONG TREND";
        regimeModTrend = 1.5;
        regimeModRev = 0.5;
    } else if (hurst < 0.45 || entropy > 0.7) {
        regimeDesc = "MEAN REVERSION / CHAOS";
        regimeModTrend = 0.5;
        regimeModRev = 1.5;
    } else {
        regimeDesc = "NEUTRAL / ACCUMULATION";
    }
    
    score += forest.trend * 20 * wTreeA * regimeModTrend;
    score += forest.reversion * 20 * wTreeB * regimeModRev;
    score += forest.volume * 15 * wTreeC;
    score += forest.correlation * 10 * wTreeE; 
    
    score += perceptron * 15 * wNeural;
    if (neuralDQN.action === 'LONG') score += 20 * wNeural;
    if (neuralDQN.action === 'SHORT') score -= 20 * wNeural;
    
    const lastPrice = klines[klines.length-1].close;
    const lstmDiff = (lstmPrice - lastPrice) / lastPrice;
    if (lstmDiff > 0.002) score += 10 * wNeural;
    else if (lstmDiff < -0.002) score -= 10 * wNeural;
    
    const now = Date.now();
    const health = learner.getHealthStats();

    let consensusDirection: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    if (score > 15) consensusDirection = 'UP';
    if (score < -15) consensusDirection = 'DOWN';
    
    const forestDir = forest.trend > 0 ? 1 : -1;
    const neuralDir = neuralDQN.action === 'LONG' ? 1 : (neuralDQN.action === 'SHORT' ? -1 : 0);
    const divergence = forestDir === neuralDir ? 1.0 : 0.0; 

    return {
        consensusDirection,
        consensusScore: score,
        neural: {
            lstmPrediction: lstmPrice,
            esnVolatility: esnVol,
            perceptronSignal: perceptron,
            layers: {
                inputFeatures: neuralInput.features,
                contextScore: neuralContext,
                dqnAction: neuralDQN,
                attentionWeight: neuralAttention
            }
        },
        forest,
        regimeWeight: regimeDesc,
        divergenceScore: divergence,
        modelHealth: health,
        signalTimestamp: now,
        learnedRules // Pass for UI/AI
    };
};

// --- NEW HELPER: Generate Historical Signals for Chart Visualization ---
export const generateEnsembleMarkers = (klines: Kline[]): ChartSignal[] => {
    // Generate markers for the last 100 candles based on simplified Deep Quant logic
    // We avoid full backtest weight for performance, focusing on key Physics signals.
    if (klines.length < 50) return [];
    
    const signals: ChartSignal[] = [];
    const lookback = Math.min(100, klines.length - 20);
    const startIdx = klines.length - lookback;
    
    // Pre-calculate full series for efficiency
    const zScores = calculateKalmanZScore(klines);
    const linReg = calculateLinReg(klines);
    const garch = calculateGARCH(klines);
    
    // Iterate
    for (let i = startIdx; i < klines.length; i++) {
        const k = klines[i];
        
        // Get values at index i
        const z = zScores[i];
        const slope = linReg.slope[i];
        const vol = garch[i];
        
        // Logic: Z-Score Reversion + LinReg Trend
        // This mirrors Tree A and Tree B of the Forest
        let signal: ChartSignal | null = null;
        
        // 1. Strong Reversion Buy
        if (z < -2.2) {
             signal = {
                 time: k.time,
                 type: 'buy',
                 label: 'DQ Oversold',
                 score: Math.abs(z) * 10
             };
        }
        // 2. Strong Reversion Sell
        else if (z > 2.2) {
             signal = {
                 time: k.time,
                 type: 'sell',
                 label: 'DQ Overbought',
                 score: Math.abs(z) * 10
             };
        }
        // 3. Trend Breakout (High Vol + Slope)
        else if (vol > 0.01 && slope > 0.2 && z > -1 && z < 1) {
             signal = {
                 time: k.time,
                 type: 'buy',
                 label: 'DQ Trend',
                 score: 60
             };
        }
        else if (vol > 0.01 && slope < -0.2 && z > -1 && z < 1) {
             signal = {
                 time: k.time,
                 type: 'sell',
                 label: 'DQ Trend',
                 score: 60
             };
        }
        
        if (signal) {
            // Dedup: Don't spam signals if previous was same type within 5 bars
            const last = signals.length > 0 ? signals[signals.length-1] : null;
            if (!last || last.type !== signal.type || (k.time - last.time > 5 * (klines[1].time - klines[0].time))) {
                signals.push(signal);
            }
        }
    }
    
    return signals;
};

// --- Alpha Reactor Modules (DWT, Monte Carlo, HMM remain same) ---

export const calculateDWT = (klines: Kline[]): number[] => {
    const data = klines.map(k => k.close);
    if (data.length < 2) return data;
    const n = Math.pow(2, Math.floor(Math.log2(data.length)));
    const signal = data.slice(data.length - n);
    const trend: number[] = [];
    const detail: number[] = [];
    for (let i = 0; i < n; i += 2) {
        const sum = (signal[i] + signal[i+1]) / Math.sqrt(2);
        const diff = (signal[i] - signal[i+1]) / Math.sqrt(2);
        trend.push(sum);
        detail.push(diff);
    }
    if (detail.length === 0) return data;
    const threshold = 0.5 * stdDev(detail);
    const cleanedDetail = detail.map(d => Math.abs(d) > threshold ? d : 0);
    const output: number[] = [];
    for (let i = 0; i < trend.length; i++) {
        const s = trend[i];
        const d = cleanedDetail[i];
        output.push((s + d) / Math.sqrt(2));
        output.push((s - d) / Math.sqrt(2));
    }
    const padding = new Array(data.length - n).fill(null);
    return [...padding, ...output];
};

function stdDev(arr: number[]): number {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a,b) => a+b, 0) / arr.length;
    return Math.sqrt(arr.reduce((a,b) => a + Math.pow(b-mean, 2), 0) / arr.length);
}

export const calculateESN = (klines: Kline[]): number => {
    return calculateDeepESN(klines); // Now maps to Volatility, UI should handle this
};

export const calculateMonteCarlo = (klines: Kline[], steps = 10, simulations = 50): MonteCarloResult => {
    if (klines.length < 20) return { upper95: 0, lower95: 0, meanPath: [], upperPath: [], lowerPath: [] };
    const closes = klines.map(k => k.close);
    const returns = [];
    for(let i=1; i<closes.length; i++) returns.push(Math.log(closes[i]/closes[i-1]));
    const mean = returns.reduce((a,b)=>a+b,0) / returns.length;
    const variance = returns.reduce((a,b)=>a+Math.pow(b-mean,2),0) / returns.length;
    const std = Math.sqrt(variance);
    const lastPrice = closes[closes.length-1];
    const paths: number[][] = [];
    for(let sim=0; sim<simulations; sim++) {
        let price = lastPrice;
        const path = [];
        for(let t=0; t<steps; t++) {
            const shock = boxMullerTransform();
            const drift = mean - 0.5 * variance;
            const change = Math.exp(drift + std * shock);
            price = price * change;
            path.push(price);
        }
        paths.push(path);
    }
    const meanPath: number[] = [];
    const upperPath: number[] = [];
    const lowerPath: number[] = [];
    for(let t=0; t<steps; t++) {
        const stepPrices = paths.map(p => p[t]);
        stepPrices.sort((a,b) => a-b);
        const sum = stepPrices.reduce((a,b) => a+b, 0);
        meanPath.push(sum / simulations);
        const lowIdx = Math.floor(simulations * 0.05);
        const highIdx = Math.floor(simulations * 0.95);
        lowerPath.push(stepPrices[lowIdx] || stepPrices[0]);
        upperPath.push(stepPrices[highIdx] || stepPrices[stepPrices.length-1]);
    }
    return { upper95: upperPath[steps-1], lower95: lowerPath[steps-1], meanPath, upperPath, lowerPath };
};

function boxMullerTransform() {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0;
}

export const calculateHMMState = (klines: Kline[]): 'TREND' | 'OSCILLATION' | 'UNCERTAIN' => {
    if (klines.length < 50) return 'UNCERTAIN';
    const hurst = calculateHurstExponent(klines, 50);
    const entropy = calculateEntropy(klines, 50);
    const adx = calculateADX(klines, 14); 
    const lastADX = adx[adx.length-1];

    let trendScore = 0;
    if (hurst > 0.55) trendScore++;
    if (entropy < 0.5) trendScore++;
    if (lastADX > 25) trendScore++;
    
    if (trendScore >= 2) return 'TREND';
    
    let rangeScore = 0;
    if (hurst < 0.45) rangeScore++;
    if (entropy > 0.6) rangeScore++;
    if (lastADX < 20) rangeScore++;
    
    if (rangeScore >= 2) return 'OSCILLATION';
    
    return 'UNCERTAIN';
};

export const calculateHurstExponent = (klines: Kline[], period = 100): number => {
    if (klines.length < period) return 0.5;
    const slice = klines.slice(-period);
    const closes = slice.map(k => k.close);
    const logReturns = [];
    for(let i=1; i<closes.length; i++) logReturns.push(Math.log(closes[i] / closes[i-1]));
    const mean = logReturns.reduce((a,b) => a+b, 0) / logReturns.length;
    let currentSum = 0;
    const cumDev = [];
    for(let r of logReturns) { currentSum += (r - mean); cumDev.push(currentSum); }
    const R = Math.max(...cumDev) - Math.min(...cumDev);
    const variance = logReturns.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / logReturns.length;
    const S = Math.sqrt(variance);
    if (S === 0 || R === 0) return 0.5;
    const H = Math.log(R/S) / Math.log(logReturns.length);
    return Math.max(0, Math.min(1, H));
};

export const calculateEntropy = (klines: Kline[], period = 50): number => {
    if (klines.length < period) return 0;
    const slice = klines.slice(-period);
    const closes = slice.map(k => k.close);
    const returns = [];
    for(let i=1; i<closes.length; i++) returns.push(closes[i] - closes[i-1]);
    const min = Math.min(...returns);
    const max = Math.max(...returns);
    const bins = 10;
    const binSize = (max - min) / bins;
    if (binSize === 0) return 0;
    const counts = new Array(bins).fill(0);
    for(let r of returns) {
        let binIndex = Math.floor((r - min) / binSize);
        if (binIndex >= bins) binIndex = bins - 1;
        counts[binIndex]++;
    }
    let entropy = 0;
    const total = returns.length;
    for(let count of counts) {
        if (count > 0) {
            const p = count / total;
            entropy -= p * Math.log2(p);
        }
    }
    return entropy / Math.log2(bins);
};

export const calculateLorentzianPrediction = (klines: Kline[]): PredictionModel => {
    // Keeping simpler implementation for the legacy 'prediction' field compatibility, 
    // but the heavy lifting is now in the Ensemble
    if (klines.length < 50) return { type: 'LORENTZIAN', direction: 'NEUTRAL', probability: 0, similarPatterns: 0 };
    const ensemble = calculateEnsemblePrediction(klines);
    return {
        type: 'LORENTZIAN',
        direction: ensemble.consensusDirection,
        probability: Math.abs(ensemble.consensusScore)/100,
        similarPatterns: 0
    };
};
