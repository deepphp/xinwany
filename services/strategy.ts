
import { TimeframeData, ResonanceAnalysis, HarmonicPattern, ChanPivot, ChanPoint } from '../types';

/**
 * The Brain of the operation.
 * Calculates a 'Resonance Score' (0-100) based on multiple factors.
 */
export const analyzeResonance = (tf: TimeframeData): ResonanceAnalysis => {
    let score = 50; // Neutral start
    const factors: string[] = [];
    
    const klines = tf.klines;
    const kline = klines[klines.length - 1];
    const ind = tf.indicators;
    const chan = tf.chanlun;
    const harmonics = tf.harmonics || [];

    if (!kline || !ind) return { score, signal: 'NEUTRAL', factors };

    const price = kline.close;

    // --- Factor 1: ChanLun (Weight: 30%) ---
    if (chan.divergence.isDivergent) {
        if (chan.divergence.type === 'bottom') {
            score += 20;
            factors.push(`缠论底背驰 (强度 ${(chan.divergence.strength * 100).toFixed(0)}%)`);
        } else {
            score -= 20;
            factors.push(`缠论顶背驰 (强度 ${(chan.divergence.strength * 100).toFixed(0)}%)`);
        }
    }
    // 3rd Buy/Sell Points
    const lastSignal = chan.buySellPoints.length > 0 ? chan.buySellPoints[chan.buySellPoints.length - 1] : null;
    if (lastSignal) {
        if (lastSignal.type.includes('B')) {
            score += 15;
            factors.push(`缠论${lastSignal.desc}`);
        } else if (lastSignal.type.includes('S')) {
            score -= 15;
            factors.push(`缠论${lastSignal.desc}`);
        }
    }

    // --- Factor 2: Harmonic Patterns (Weight: 20%) ---
    if (harmonics.length > 0) {
        const pattern = harmonics[0];
        const distToD = Math.abs(price - pattern.entryZone) / price;
        
        if (distToD < 0.02) {
            const qualityScore = pattern.quality === 'Perfect' ? 25 : (pattern.quality === 'Standard' ? 20 : 15);
            if (pattern.subType === 'Bullish') {
                score += qualityScore;
                factors.push(`谐波看涨: ${pattern.name} (${pattern.quality})`);
            } else {
                score -= qualityScore;
                factors.push(`谐波看跌: ${pattern.name} (${pattern.quality})`);
            }
        }
    }

    // --- Factor 3: Advanced Math Models (Weight: 30%) ---
    
    // A. Lorentzian Distance (KNN)
    if (ind.prediction) {
        if (ind.prediction.direction === 'UP' && ind.prediction.probability > 0.6) {
            score += 15 * ind.prediction.probability;
            factors.push(`KNN历史匹配: 看涨 (${(ind.prediction.probability*100).toFixed(0)}%)`);
        } else if (ind.prediction.direction === 'DOWN' && ind.prediction.probability > 0.6) {
            score -= 15 * ind.prediction.probability;
            factors.push(`KNN历史匹配: 看跌 (${(ind.prediction.probability*100).toFixed(0)}%)`);
        }
    }

    // B. Kalman Filter vs Price
    if (ind.kalmanPrice) {
        // If Price is significantly above Kalman, it might mean strong trend OR overextension.
        // We use slope of Kalman for trend direction.
        // For simplicity here: Price > Kalman = Bullish bias in Trend Regime
        if (price > ind.kalmanPrice) {
             score += 5; 
             // factors.push("Kalman 趋势向上"); // Too noisy to list every time
        } else {
             score -= 5;
        }
    }

    // C. Fractal Dimension (Market State Filter)
    if (ind.fdi) {
        // If FDI < 1.4, strong trend. If > 1.6, mean reversion.
        if (ind.fdi < 1.45) {
            // Trend Confirmed -> Amplify existing score deviation from 50
            if (score > 50) score += 5;
            if (score < 50) score -= 5;
            factors.push(`分形维数(FDI): 线性趋势 (${ind.fdi.toFixed(2)})`);
        } else if (ind.fdi > 1.55) {
             factors.push(`分形维数(FDI): 随机震荡 (${ind.fdi.toFixed(2)})`);
             // Dampen score in chaos
             score = 50 + (score - 50) * 0.8;
        }
    }

    // --- Factor 4: Institutional & Trend (Weight: 20%) ---
    if (ind.vwap) {
        if (price > ind.vwap) score += 5; else score -= 5;
    }
    if (ind.superTrend) {
        if (ind.superTrend.direction === 'up') {
            score += 10; 
            factors.push("SuperTrend 多头");
        } else {
            score -= 10;
            factors.push("SuperTrend 空头");
        }
    }

    // Clamp Score
    score = Math.max(0, Math.min(100, score));

    let signal: ResonanceAnalysis['signal'] = 'NEUTRAL';
    if (score >= 80) signal = 'STRONG_BUY';
    else if (score >= 60) signal = 'BUY';
    else if (score <= 20) signal = 'STRONG_SELL';
    else if (score <= 40) signal = 'SELL';

    return { score, signal, factors };
};
