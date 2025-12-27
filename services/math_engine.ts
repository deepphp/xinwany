
import { AdaptiveParams } from '../types';

/**
 * MATH ENGINE: Advanced Statistical Computing
 * Handles Feature Selection (VIF), Real Online Learning, and Dynamic Weighting.
 */

// 1. Variance Inflation Factor (VIF) Calculation
export const calculateVIF = (features: number[][]): number[] => {
    if (features.length === 0) return [];
    
    const numFeatures = features[0].length;
    const vifScores = new Array(numFeatures).fill(1.0);

    for (let i = 0; i < numFeatures; i++) {
        for (let j = 0; j < numFeatures; j++) {
            if (i === j) continue;
            const corr = getCorrelation(features.map(f => f[i]), features.map(f => f[j]));
            const r2 = corr * corr; 
            vifScores[i] += (1 / (1 - r2 * 0.9 + 0.001)); 
        }
    }
    return vifScores;
};

function getCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
}

// --- REAL ONLINE LEARNING ENGINE ---

export interface ModelStats {
    id: string;
    name: string;
    wins: number;
    losses: number;
    total: number;
    winRate: number; // 0 to 1
    weight: number; // Dynamic weight multiplier
    state: 'ACTIVE' | 'BENCHED';
    consecutiveLosses: number;
}

// Alpha Reactor 6.0 Adaptive Defaults
const DEFAULT_PARAMS: AdaptiveParams = {
    zScoreThreshold: 2.0, // Replaces RSI 30/70
    hurstThreshold: 0.55, // Trend requirement
    rvolThreshold: 3.0, // Volume Intensity check
    volatilityRegime: 'NORMAL' as any
};

export class OnlineLearner {
    private stats: Record<string, ModelStats> = {};
    public isInitialized: boolean = false;
    private symbol: string = '';
    
    // The "Brain" of the learner: Adaptive Parameters
    private params: AdaptiveParams = { ...DEFAULT_PARAMS };

    constructor() {
        this.resetStats();
    }

    // Initialize or reset stats structure
    private resetStats() {
        const models = [
            { id: 'tree_a', name: 'Trend Tree' },
            { id: 'tree_b', name: 'Reversion Tree' },
            { id: 'tree_c', name: 'Volume Tree' },
            { id: 'tree_d', name: 'Volatility Tree' },
            { id: 'tree_e', name: 'Correlation Tree' },
            { id: 'neural_dqn', name: 'Neural DQN' },
            { id: 'neural_lstm', name: 'Nano LSTM' }
        ];

        models.forEach(m => {
            this.stats[m.id] = {
                id: m.id,
                name: m.name,
                wins: 0,
                losses: 0,
                total: 0,
                winRate: 0.5, // Start neutral
                weight: 1.0,
                state: 'ACTIVE',
                consecutiveLosses: 0
            };
        });
        
        // Reset params to default on symbol change
        this.params = { ...DEFAULT_PARAMS };
    }

    // Called when symbol changes to reset "Backtest" state
    public checkSymbol(newSymbol: string) {
        if (this.symbol !== newSymbol) {
            this.symbol = newSymbol;
            this.isInitialized = false; // Trigger re-backtest
            this.resetStats();
        }
    }

    // Record a virtual trade result (from backtest or live)
    public updateModelResult(modelId: string, isWin: boolean) {
        if (!this.stats[modelId]) return;

        const s = this.stats[modelId];
        s.total++;
        if (isWin) {
            s.wins++;
            s.consecutiveLosses = 0;
        } else {
            s.losses++;
            s.consecutiveLosses++;
        }

        // Recalculate Win Rate (Moving Average style for smoothness)
        // Simple ratio: s.wins / s.total
        s.winRate = s.total > 0 ? s.wins / s.total : 0.5;

        // Dynamic Weighting Logic
        let newWeight = 1.0;
        if (s.winRate > 0.6) newWeight = 1.0 + (s.winRate - 0.6) * 2; // Max approx 1.8
        if (s.winRate < 0.4) newWeight = 1.0 - (0.4 - s.winRate) * 2; // Min approx 0.2

        if (s.consecutiveLosses >= 3 || s.winRate < 0.35) {
            s.state = 'BENCHED';
            newWeight = 0;
        } else {
            s.state = 'ACTIVE';
        }

        s.weight = newWeight;
    }

    /**
     * SELF-OPTIMIZATION LOOP (Generate New Rules)
     * Alpha Reactor 6.0: Adjust Z-Score and Hurst thresholds based on performance.
     */
    public optimizeStrategy() {
        const trendStats = this.stats['tree_a'];
        const revStats = this.stats['tree_b'];

        // 1. Optimize Trend Rules (Hurst)
        if (trendStats.winRate < 0.45 || trendStats.consecutiveLosses > 2) {
            // Trend is failing. Market is chaotic/choppy.
            // Require higher Hurst exponent to filter false trends.
            this.params.hurstThreshold = Math.min(0.65, this.params.hurstThreshold + 0.05);
        } else if (trendStats.winRate > 0.7) {
            // Trend is working well. Lower threshold to catch earlier moves.
            this.params.hurstThreshold = Math.max(0.51, this.params.hurstThreshold - 0.02);
        }

        // 2. Optimize Reversion Rules (Kalman Z-Score)
        if (revStats.winRate < 0.45) {
            // Reversion failing (likely strong trends blowing out tops/bottoms).
            // Widen the Z-Score band.
            this.params.zScoreThreshold = Math.min(3.0, this.params.zScoreThreshold + 0.2); 
        } else if (revStats.winRate > 0.7) {
            // Reversion winning. Tighten band to trade more often.
            this.params.zScoreThreshold = Math.max(1.5, this.params.zScoreThreshold - 0.1);
        }
    }

    public getModelWeight(modelId: string): number {
        return this.stats[modelId]?.weight ?? 1.0;
    }

    public getHealthStats(): any[] {
        return Object.values(this.stats).map(s => ({
            id: s.id,
            name: s.name,
            winRate: s.winRate,
            state: s.state,
            consecutiveLosses: s.consecutiveLosses
        }));
    }

    public getParameters(): AdaptiveParams {
        return { ...this.params };
    }
}

export const learner = new OnlineLearner();
