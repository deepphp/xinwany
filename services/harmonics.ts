
import { Kline, HarmonicPattern, ChanPoint } from '../types';

// --- Constants & Types ---

// Tolerances
const TOL_PERFECT = 0.03; 
const TOL_NORMAL = 0.08; 
const TOL_LOOSE = 0.12;  

// Ratios
const R_0382 = 0.382;
const R_0500 = 0.500;
const R_0618 = 0.618;
const R_0707 = 0.707;
const R_0786 = 0.786;
const R_0886 = 0.886;
const R_1130 = 1.130;
const R_1270 = 1.272;
const R_1414 = 1.414;
const R_1618 = 1.618;
const R_2000 = 2.000;
const R_2240 = 2.240;
const R_2618 = 2.618;
const R_3140 = 3.140;
const R_3618 = 3.618;

// Helper: Check if val matches target within tolerance
const match = (val: number, target: number, tol = TOL_NORMAL) => Math.abs(val - target) <= (target * tol);
// Helper: Check if val is inside range
const between = (val: number, min: number, max: number) => val >= min && val <= max;

interface Ratios {
    XB: number; 
    AC: number; 
    BD: number; 
    XD: number; 
    lenAB: number;
    lenCD: number;
    lenXA: number;
    lenBC: number;
}

interface PatternValidator {
    name: string;
    check: (r: Ratios, p: {X:ChanPoint, A:ChanPoint, B:ChanPoint, C:ChanPoint, D:ChanPoint}, isBullish: boolean) => HarmonicPattern | null;
}

// --- Validators ---

const validators: PatternValidator[] = [
    {
        name: 'Gartley',
        check: (r, p, isBullish) => {
            if (!match(r.XB, R_0618, 0.05)) return null;
            if (!match(r.XD, R_0786, 0.05)) return null;
            if (!between(r.AC, 0.382, 0.886)) return null;

            const isPerfect = match(r.XB, R_0618, TOL_PERFECT) && 
                              match(r.XD, R_0786, TOL_PERFECT) && 
                              match(r.lenAB, r.lenCD, 0.1); 

            return {
                name: 'Gartley',
                subType: isBullish ? 'Bullish' : 'Bearish',
                quality: isPerfect ? 'Perfect' : 'Standard',
                description: isPerfect 
                    ? "完美加特利: B=0.618, D=0.786, 且AB=CD严格对称" 
                    : "标准加特利: B=0.618, D=0.786",
                points: p, ratios: r,
                entryZone: p.D.price,
                stopLoss: p.X.price, 
                takeProfit1: p.D.price + (p.A.price - p.D.price) * 0.382
            };
        }
    },
    {
        name: 'Bat',
        check: (r, p, isBullish) => {
            if (!between(r.XB, 0.382, 0.55)) return null;
            if (!match(r.XD, R_0886, 0.05)) return null;
            if (!between(r.AC, 0.382, 0.886)) return null;

            const isAlt = match(r.XB, R_0382, 0.03);

            return {
                name: 'Bat',
                subType: isBullish ? 'Bullish' : 'Bearish',
                quality: isAlt ? 'Alternative' : 'Standard',
                description: "蝙蝠形态: B<0.618 (0.382-0.5), D=0.886 深回调",
                points: p, ratios: r,
                entryZone: p.D.price,
                stopLoss: p.X.price,
                takeProfit1: p.D.price + (p.A.price - p.D.price) * 0.382
            };
        }
    },
    {
        name: 'Crab',
        check: (r, p, isBullish) => {
            if (!match(r.XD, R_1618, 0.06)) return null;

            if (match(r.XB, R_0618, 0.05)) {
                return {
                    name: 'Crab',
                    subType: isBullish ? 'Bullish' : 'Bearish',
                    quality: 'Perfect',
                    description: "完美螃蟹: B=0.618, D=1.618 黄金延伸",
                    points: p, ratios: r,
                    entryZone: p.D.price,
                    stopLoss: p.D.price * (isBullish ? 0.98 : 1.02),
                    takeProfit1: p.D.price + (p.A.price - p.D.price) * 0.382
                };
            }

            if (match(r.XB, R_0886, 0.05)) {
                return {
                    name: 'Deep Crab',
                    subType: isBullish ? 'Bullish' : 'Bearish',
                    quality: 'Alternative',
                    description: "深海螃蟹: B=0.886, D=1.618 极限延伸",
                    points: p, ratios: r,
                    entryZone: p.D.price,
                    stopLoss: p.D.price * (isBullish ? 0.98 : 1.02),
                    takeProfit1: p.D.price + (p.A.price - p.D.price) * 0.382
                };
            }

            if (between(r.XB, 0.382, 0.65)) {
                 return {
                    name: 'Crab',
                    subType: isBullish ? 'Bullish' : 'Bearish',
                    quality: 'Standard',
                    description: "普通螃蟹: B点0.382-0.618, D=1.618",
                    points: p, ratios: r,
                    entryZone: p.D.price,
                    stopLoss: p.D.price * (isBullish ? 0.98 : 1.02),
                    takeProfit1: p.D.price + (p.A.price - p.D.price) * 0.382
                };
            }
            return null;
        }
    },
    {
        name: 'Butterfly',
        check: (r, p, isBullish) => {
            if (!between(r.XD, 1.13, 3.8)) return null;

            if (match(r.XB, R_0786, 0.06)) {
                if (match(r.XD, R_1270, 0.06) || match(r.XD, R_1618, 0.06)) {
                     const isPerfect = match(r.XD, R_1270, TOL_PERFECT) && match(r.lenAB, r.lenCD * 1.27, 0.2); 
                     return {
                        name: 'Butterfly',
                        subType: isBullish ? 'Bullish' : 'Bearish',
                        quality: isPerfect ? 'Perfect' : 'Standard',
                        description: `蝴蝶形态: B=0.786, D=${r.XD.toFixed(2)} (1.27/1.618)`,
                        points: p, ratios: r,
                        entryZone: p.D.price,
                        stopLoss: p.D.price * (isBullish ? 0.98 : 1.02),
                        takeProfit1: p.D.price + (p.A.price - p.D.price) * 0.382
                    };
                }
            }

            if (match(r.XB, R_0382, 0.06)) {
                if (match(r.XD, R_1618, 0.1) || match(r.XD, R_2618, 0.1) || match(r.XD, R_3618, 0.1)) {
                     return {
                        name: 'Alt Butterfly',
                        subType: isBullish ? 'Bullish' : 'Bearish',
                        quality: 'Alternative',
                        description: `备用蝴蝶: B=0.382, D=${r.XD.toFixed(2)} 极限延伸`,
                        points: p, ratios: r,
                        entryZone: p.D.price,
                        stopLoss: p.D.price * (isBullish ? 0.98 : 1.02),
                        takeProfit1: p.D.price + (p.A.price - p.D.price) * 0.382
                    };
                }
            }
            return null;
        }
    },
    {
        name: 'AB=CD',
        check: (r, p, isBullish) => {
            const symmetry = Math.abs(r.lenAB - r.lenCD) / ((r.lenAB + r.lenCD)/2);
            if (symmetry > 0.15) return null; 

            if (match(r.AC, R_0618, 0.05) && match(r.BD, R_1618, 0.05)) {
                return {
                    name: 'AB=CD',
                    subType: isBullish ? 'Bullish' : 'Bearish',
                    quality: 'Perfect',
                    description: "完美AB=CD: C=0.618, D=1.618 (黄金分割对称)",
                    points: p, ratios: r,
                    entryZone: p.D.price,
                    stopLoss: p.D.price - (p.C.price - p.D.price) * 0.1,
                    takeProfit1: p.D.price + (p.C.price - p.D.price) * 0.382
                };
            }

            if (match(r.AC, R_0786, 0.06) && match(r.BD, R_1270, 0.06)) {
                 return {
                    name: 'AB=CD',
                    subType: isBullish ? 'Bullish' : 'Bearish',
                    quality: 'Alternative',
                    description: "AB=CD (0.786/1.27): 强趋势回调",
                    points: p, ratios: r,
                    entryZone: p.D.price,
                    stopLoss: p.D.price - (p.C.price - p.D.price) * 0.1,
                    takeProfit1: p.D.price + (p.C.price - p.D.price) * 0.382
                };
            }
            
            if (match(r.AC, R_0500, 0.06) && match(r.BD, R_2000, 0.06)) {
                 return {
                    name: 'AB=CD',
                    subType: isBullish ? 'Bullish' : 'Bearish',
                    quality: 'Alternative',
                    description: "AB=CD (0.5/2.0): 中性回调位",
                    points: p, ratios: r,
                    entryZone: p.D.price,
                    stopLoss: p.D.price - (p.C.price - p.D.price) * 0.1,
                    takeProfit1: p.D.price + (p.C.price - p.D.price) * 0.382
                };
            }

            return {
                name: 'AB=CD',
                subType: isBullish ? 'Bullish' : 'Bearish',
                quality: 'Standard',
                description: "普通AB=CD: 价格/时间等距对称",
                points: p, ratios: r,
                entryZone: p.D.price,
                stopLoss: p.D.price - (p.C.price - p.D.price) * 0.1,
                takeProfit1: p.D.price + (p.C.price - p.D.price) * 0.382
            };
        }
    },
    {
        name: 'Shark',
        check: (r, p, isBullish) => {
            if (between(r.AC, 1.10, 1.70)) {
                const lenXC = Math.abs(p.C.price - p.X.price);
                const retraceD_XC = Math.abs(p.C.price - p.D.price) / lenXC;

                if (match(retraceD_XC, R_0886, 0.05) || match(retraceD_XC, R_1130, 0.05)) {
                    return {
                        name: 'Shark',
                        subType: isBullish ? 'Bullish' : 'Bearish',
                        quality: 'Standard',
                        description: `鲨鱼形态: C破位AB (ext ${r.AC.toFixed(2)}), D回撤XC (${retraceD_XC.toFixed(2)})`,
                        points: p, ratios: r,
                        entryZone: p.D.price,
                        stopLoss: p.D.price * (isBullish ? 0.98 : 1.02),
                        takeProfit1: p.D.price + (p.C.price - p.D.price) * 0.5
                    };
                }
            }
            return null;
        }
    },
    {
        name: '5-0',
        check: (r, p, isBullish) => {
            if (between(r.XB, 1.13, 1.618)) {
                if (between(r.AC, 1.618, 2.24)) {
                     if (match(r.BD, R_0500, 0.05)) {
                         return {
                            name: '5-0',
                            subType: isBullish ? 'Bullish' : 'Bearish',
                            quality: 'Perfect',
                            description: "5-0形态: 剧烈扩强后的 0.5 回调",
                            points: p, ratios: r,
                            entryZone: p.D.price,
                            stopLoss: p.C.price * (isBullish ? 0.98 : 1.02), 
                            takeProfit1: p.D.price + (p.C.price - p.D.price) * 0.5
                        };
                     }
                }
            }
            return null;
        }
    }
];

// --- Main Engine ---

function calculateZigZag(klines: Kline[], depth: number = 4): ChanPoint[] {
    const points: ChanPoint[] = [];
    if (klines.length < depth * 2) return points;
    let lastType: 'top' | 'bottom' | null = null;

    for (let i = depth; i < klines.length - depth; i++) {
        const curr = klines[i];
        let isHigh = true; 
        let isLow = true;

        for (let j = 1; j <= depth; j++) {
            if (klines[i - j].high > curr.high || klines[i + j].high > curr.high) isHigh = false;
            if (klines[i - j].low < curr.low || klines[i + j].low < curr.low) isLow = false;
        }

        if (isHigh) {
            if (lastType === 'top') {
                 if (points.length > 0 && curr.high > points[points.length-1].price) {
                     points[points.length-1] = { index: i, price: curr.high, type: 'top', time: curr.time };
                 }
            } else {
                points.push({ index: i, price: curr.high, type: 'top', time: curr.time });
                lastType = 'top';
            }
        } 
        if (isLow) {
            if (lastType === 'bottom') {
                 if (points.length > 0 && curr.low < points[points.length-1].price) {
                     points[points.length-1] = { index: i, price: curr.low, type: 'bottom', time: curr.time };
                 }
            } else {
                points.push({ index: i, price: curr.low, type: 'bottom', time: curr.time });
                lastType = 'bottom';
            }
        }
    }
    
    const clean: ChanPoint[] = [];
    if (points.length > 0) clean.push(points[0]);
    for(let i=1; i<points.length; i++) {
        const prev = clean[clean.length-1];
        const curr = points[i];
        if (prev.type !== curr.type) clean.push(curr);
        else {
            if ((prev.type === 'top' && curr.price > prev.price) || (prev.type === 'bottom' && curr.price < prev.price)) {
                clean[clean.length-1] = curr;
            }
        }
    }
    return clean;
}

export const calculateHarmonics = (klines: Kline[]): HarmonicPattern[] => {
    // Increased ZigZag depth to 5 for stronger structure identification
    const points = calculateZigZag(klines, 5); 
    const patterns: HarmonicPattern[] = [];

    if (points.length < 5) return patterns;

    const lookback = Math.min(points.length - 5, 30); // Increased lookback window

    for (let i = points.length - 5; i >= points.length - 5 - lookback && i >= 0; i--) {
        const X = points[i];
        const A = points[i+1];
        const B = points[i+2];
        const C = points[i+3];
        const D = points[i+4];

        const isBullish = X.type === 'bottom' && A.type === 'top' && B.type === 'bottom' && C.type === 'top' && D.type === 'bottom';
        const isBearish = X.type === 'top' && A.type === 'bottom' && B.type === 'top' && C.type === 'bottom' && D.type === 'top';

        if (!isBullish && !isBearish) continue;

        const lenXA = Math.abs(A.price - X.price);
        const lenAB = Math.abs(B.price - A.price);
        const lenBC = Math.abs(C.price - B.price);
        const lenCD = Math.abs(D.price - C.price);
        const lenXD = Math.abs(D.price - X.price);

        const r: Ratios = {
            XB: lenAB / (lenXA || 1),
            AC: lenBC / (lenAB || 1),
            BD: lenCD / (lenBC || 1),
            XD: lenXD / (lenXA || 1),
            lenAB, lenCD, lenXA, lenBC
        };

        const pts = { X, A, B, C, D };

        for (const v of validators) {
            const result = v.check(r, pts, isBullish);
            if (result) {
                patterns.push(result);
                // REMOVED 'break' to allow all overlapping patterns
            }
        }
    }

    return patterns;
};
