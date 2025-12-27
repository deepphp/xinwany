
import { Kline, MacroData } from '../types';

/**
 * Calculates Correlation Coefficient (Pearson) between two asset arrays.
 * Used for Tree E (Correlation Tree).
 */
export const calculateCorrelation = (assetA: Kline[], assetB: Kline[]): number => {
    const len = Math.min(assetA.length, assetB.length, 50); // Look back 50 periods
    if (len < 10) return 0;

    const sliceA = assetA.slice(-len);
    const sliceB = assetB.slice(-len);
    
    // Align via timestamp if possible, otherwise assume synchronized array tail
    // Since we fetch same limit, tail alignment is acceptable for this estimation

    const pricesA = sliceA.map(k => k.close);
    const pricesB = sliceB.map(k => k.close);

    const meanA = pricesA.reduce((a, b) => a + b, 0) / len;
    const meanB = pricesB.reduce((a, b) => a + b, 0) / len;

    let numerator = 0;
    let sumSqDiffA = 0;
    let sumSqDiffB = 0;

    for (let i = 0; i < len; i++) {
        const diffA = pricesA[i] - meanA;
        const diffB = pricesB[i] - meanB;
        numerator += diffA * diffB;
        sumSqDiffA += diffA * diffA;
        sumSqDiffB += diffB * diffB;
    }

    const denominator = Math.sqrt(sumSqDiffA) * Math.sqrt(sumSqDiffB);
    if (denominator === 0) return 0;

    return numerator / denominator;
};

/**
 * Calculates Macro Stress based on BTC Volatility and Divergence from Moving Average.
 * (A proxy for Macro environment when DXY API is unavailable).
 */
export const calculateMacroStress = (btcKlines: Kline[]): number => {
    if (!btcKlines || btcKlines.length < 50) return 0.5;
    
    const closes = btcKlines.map(k => k.close);
    const last = closes[closes.length - 1];
    
    // EMA 50
    const period = 50;
    const k = 2 / (period + 1);
    let ema = closes[0];
    for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
    
    const divergence = Math.abs(last - ema) / ema;
    
    // Volatility (ATR-like)
    let sumTr = 0;
    for(let i=1; i<btcKlines.length; i++) {
        sumTr += Math.abs(btcKlines[i].close - btcKlines[i-1].close);
    }
    const avgVol = (sumTr / (btcKlines.length-1)) / last;

    // Stress Index: Combination of high vol and high divergence
    // Normalized roughly to 0-1
    return Math.min(1, (divergence * 10) + (avgVol * 20));
};

export const fetchMacroContext = async (symbol: string, currentKlines: Kline[], btcKlines: Kline[]): Promise<MacroData> => {
    const correlation = symbol === 'BTCUSDT' ? 1.0 : calculateCorrelation(currentKlines, btcKlines);
    const stress = calculateMacroStress(btcKlines);
    
    // Market Dominance Proxy: Relative strength of this asset vs BTC recently
    const assetReturn = (currentKlines[currentKlines.length-1].close - currentKlines[0].close) / currentKlines[0].close;
    const btcReturn = (btcKlines[btcKlines.length-1].close - btcKlines[0].close) / btcKlines[0].close;
    const relStrength = assetReturn - btcReturn; // >0 means outperforming BTC

    return {
        btcCorrelation: correlation,
        macroStressIndex: stress,
        marketDominance: relStrength,
        timestamp: Date.now()
    };
};
