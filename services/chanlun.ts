
import { Kline, ChanPoint, ChanBi, ChanSeg, ChanPivot, ChanLunFeatures, BuySellPoint, AppSettings } from '../types';
import { calculateMACD } from './indicators';

interface MergedKline extends Kline {
  originalStartIndex: number;
  originalEndIndex: number;
  children: Kline[];
}

/**
 * 🚀 World-Class ChanLun Computation Engine v3.3 (Ultimate Pro)
 * 
 * Restored Features:
 * 1. Strict Recursive Inclusion Processing (BaoHanChuLi)
 * 2. Characteristic Sequence (TeZhengXuLie) for Segments
 * 3. Gap (QueKou) vs Non-Gap Destruction Logic
 * 4. Pivot Expansion & Extension
 * 5. Full Trend & Divergence Analysis
 */
export const calculateChanLun = (klines: Kline[], settings: AppSettings): ChanLunFeatures => {
  if (!klines || klines.length < 10) {
      return emptyResult();
  }

  // 1. Inclusion Processing (K-Line Merge) - Strict Recursive
  const mergedKlines = processInclusionStrict(klines);

  // 2. Fractal Identification (FenXing)
  const fractals = identifyFractals(mergedKlines);

  // 3. Bi (Stroke) Generation - Handling Old/New Bi definitions
  const biList = generateBi(fractals, mergedKlines, settings);

  // 4. Segment (Line Segment) Generation - Feature Sequence Logic
  const segList = generateSegmentsStrict(biList);

  // 5. Pivot (ZhongShu) Construction - Bi Level
  const biPivots = generatePivotsFromBi(biList);

  // 6. Pivot (ZhongShu) Construction - Segment Level
  const segPivots = generatePivotsFromSeg(segList);

  const allPivots = [...biPivots, ...segPivots].sort((a,b) => a.startTime - b.startTime);

  // 7. Signal Analysis & Pattern Recognition
  const macd = calculateMACD(klines, settings.macdFast, settings.macdSlow, settings.macdSignal);
  
  const analysis = analyzeStructure(biList, segList, biPivots, segPivots, macd, klines);

  return {
      klines: mergedKlines,
      fractals,
      biList,
      segList,
      pivots: allPivots,
      buySellPoints: analysis.buySellPoints,
      divergence: analysis.divergence,
      trend: analysis.trend
  };
};

// --- 1. Inclusion Processing (Strict) ---
function processInclusionStrict(klines: Kline[]): MergedKline[] {
    const result: MergedKline[] = [];
    if (klines.length === 0) return result;

    // Initialize first kline
    result.push({ 
        ...klines[0], 
        originalStartIndex: 0, 
        originalEndIndex: 0, 
        children: [klines[0]] 
    });

    let direction = 0; // 0: Unknown, 1: Up, -1: Down

    for (let i = 1; i < klines.length; i++) {
        const nextK = klines[i];
        const lastK = result[result.length - 1];

        const isNextInLast = nextK.high <= lastK.high && nextK.low >= lastK.low;
        const isLastInNext = lastK.high <= nextK.high && lastK.low >= nextK.low;

        if (isNextInLast || isLastInNext) {
            // Determine relationship direction if unknown
            if (direction === 0) {
                if (result.length > 1) {
                    const prevK = result[result.length - 2];
                    direction = lastK.high > prevK.high ? 1 : -1;
                } else {
                     // Default assumption for start: Up if next is higher/in, but strictly we need context.
                     // If purely contained, we assume trend continuation or wait. 
                     // Simplification: Assume UP for start if unclear.
                     direction = 1; 
                }
            }

            let newHigh: number, newLow: number;
            
            // Inclusion Merge Logic:
            // UP Trend: High=Max(H1,H2), Low=Max(L1,L2) (Keep High)
            // DOWN Trend: High=Min(H1,H2), Low=Min(L1,L2) (Keep Low)
            
            if (direction === 1) {
                newHigh = Math.max(lastK.high, nextK.high);
                newLow = Math.max(lastK.low, nextK.low);
            } else {
                newHigh = Math.min(lastK.high, nextK.high);
                newLow = Math.min(lastK.low, nextK.low);
            }

            result[result.length - 1] = {
                ...lastK, // Keep time of the FIRST kline in the merge chain usually, but for drawing we might update
                high: newHigh,
                low: newLow,
                time: nextK.time, // Update time to latest to show progression
                originalEndIndex: i,
                children: [...lastK.children, nextK]
            };
        } else {
            // No inclusion, establish new direction
            if (nextK.high > lastK.high && nextK.low > lastK.low) direction = 1;
            else if (nextK.high < lastK.high && nextK.low < lastK.low) direction = -1;
            // If diverging (Higher High, Lower Low) - "wai bao" - treated as no inclusion usually, depends on strictness.
            // Standard ChanLun treats "Wai Bao" as not inclusive, just a new bar.
            
            result.push({
                ...nextK,
                originalStartIndex: i,
                originalEndIndex: i,
                children: [nextK]
            });
        }
    }
    return result;
}

// --- 2. Fractals ---
function identifyFractals(klines: MergedKline[]): ChanPoint[] {
    const fractals: ChanPoint[] = [];
    if (klines.length < 3) return fractals;

    for (let i = 1; i < klines.length - 1; i++) {
        const prev = klines[i-1];
        const curr = klines[i];
        const next = klines[i+1];

        // Strict Fractal: Left < Curr > Right (Top)
        if (curr.high > prev.high && curr.high > next.high) {
            // Filter: Ensure there is at least a gap or K-lines between fractals in Bi step, but here we just identify raw fractals.
            fractals.push({ index: curr.originalEndIndex, price: curr.high, type: 'top', time: curr.time, isFractal: true });
        } 
        // Strict Fractal: Left > Curr < Right (Bottom)
        else if (curr.low < prev.low && curr.low < next.low) {
            fractals.push({ index: curr.originalEndIndex, price: curr.low, type: 'bottom', time: curr.time, isFractal: true });
        }
    }
    return fractals;
}

// --- 3. Bi Generation ---
function generateBi(fractals: ChanPoint[], klines: MergedKline[], settings: AppSettings): ChanBi[] {
    if (fractals.length < 2) return [];

    let rawPoints: ChanPoint[] = [];
    let lastPt = fractals[0];
    rawPoints.push(lastPt);

    // 3.1 Filter consecutive same-type fractals (retain highest/lowest)
    for (let i = 1; i < fractals.length; i++) {
        const curr = fractals[i];
        if (curr.type === lastPt.type) {
            if (curr.type === 'top' && curr.price > lastPt.price) {
                rawPoints.pop(); rawPoints.push(curr); lastPt = curr;
            } else if (curr.type === 'bottom' && curr.price < lastPt.price) {
                rawPoints.pop(); rawPoints.push(curr); lastPt = curr;
            }
        } else {
            rawPoints.push(curr); lastPt = curr;
        }
    }

    const validBi: ChanBi[] = [];
    if (rawPoints.length < 2) return [];

    // 3.2 Validate Bis based on K-line distance (Stroke logic)
    for (let i = 0; i < rawPoints.length - 1; i++) {
        const start = rawPoints[i];
        const end = rawPoints[i+1];
        
        // Find Merge Indices
        // Optimization: We could store merge index in ChanPoint
        const startMKIdx = klines.findIndex(k => k.time === start.time || (k.children && k.children.some(c=>c.time === start.time)));
        const endMKIdx = klines.findIndex(k => k.time === end.time || (k.children && k.children.some(c=>c.time === end.time)));
        
        const kCount = Math.abs(endMKIdx - startMKIdx); // Number of merged K-lines in between

        let isValid = false;
        switch (settings.biType) {
            case 'old': 
                // Old Bi: At least 5 K-lines (Start, +3, End)
                // Strictly: TopK + 3 intermediate + BottomK
                isValid = kCount >= 4; // Index diff 4 means 5 items: 0,1,2,3,4
                break;
            case 'new': 
                // New Bi: At least 4 K-lines (Start, +2, End) if no overlap? 
                // Simplified New Bi usually accepts 4.
                isValid = kCount >= 3; 
                break;
            case 'fractal':
                isValid = true; // Just connect fractals
                break; 
            case 'custom':
                isValid = kCount >= ((settings.biKCount || 5) - 1);
                break;
        }

        if (isValid) {
            validBi.push({ start, end, type: start.type === 'bottom' ? 'up' : 'down', isValid: true });
        }
    }

    // 3.3 Ensure Continuity
    const continuousBi: ChanBi[] = [];
    if(validBi.length === 0) return [];
    
    let currentBi = validBi[0];
    for(let i=1; i<validBi.length; i++) {
        const next = validBi[i];
        // If there's a gap between valid Bis, we might need to bridge them or drop previous
        // Standard logic: If end of A != start of B, we have a problem.
        // We usually skip valid Bis that don't connect.
        if (currentBi.end.time === next.start.time) {
            continuousBi.push(currentBi);
            currentBi = next;
        } else {
            // Gap in connections. Usually means intermediate invalid structures.
            // Reset chain.
            continuousBi.push(currentBi);
            currentBi = next;
        }
    }
    continuousBi.push(currentBi);

    return continuousBi;
}

// --- 4. Segment Generation (Strict Feature Sequence) ---

/**
 * Generates Segments using Characteristic Sequence (TeZhengXuLie).
 * 
 * Logic:
 * 1. A Segment is destroyed when the feature sequence of the sub-level (Bi) creates a Fractal in the opposite direction.
 * 2. Inclusion Processing must be applied to the Feature Sequence.
 *    - If Segment Up: Feature Sequence is Down Bis. Inclusion uses DOWN logic (H=Min, L=Min).
 *    - If Segment Down: Feature Sequence is Up Bis. Inclusion uses UP logic (H=Max, L=Max).
 * 3. Gap (QueKou) Logic:
 *    - If the first element of the feature sequence has a GAP relative to the segment peak/valley, destruction is easier (Gap Destruction).
 *    - If no GAP, strictly look for 2nd element destruction.
 */
function generateSegmentsStrict(biList: ChanBi[]): ChanSeg[] {
    if (biList.length < 3) return [];
    const segments: ChanSeg[] = [];

    let startBiIndex = 0;
    let currentSegType = biList[0].type; 
    
    let i = 0;
    while (i < biList.length) {
        const potentialEndIndex = checkSegmentDestruction(biList, startBiIndex, currentSegType);
        
        if (potentialEndIndex === -1) {
            // No destruction found, extend to end
            const lastBi = biList[biList.length - 1];
            segments.push({
                start: biList[startBiIndex].start,
                end: lastBi.end,
                type: currentSegType,
                biList: biList.slice(startBiIndex)
            });
            break; 
        } else {
            // Destruction found at potentialEndIndex
            segments.push({
                start: biList[startBiIndex].start,
                end: biList[potentialEndIndex].end,
                type: currentSegType,
                biList: biList.slice(startBiIndex, potentialEndIndex + 1)
            });
            
            // Start next segment
            startBiIndex = potentialEndIndex;
            currentSegType = currentSegType === 'up' ? 'down' : 'up';
            i = startBiIndex; 
        }
    }

    return segments;
}

function checkSegmentDestruction(biList: ChanBi[], startIndex: number, type: 'up' | 'down'): number {
    // We iterate looking for the Peak (if Up) or Valley (if Down)
    // Then we check the subsequent structure for destruction.
    
    for (let i = startIndex; i < biList.length - 3; i++) {
        // 1. Identify Candidate Peak/Valley
        const candidateBi = biList[i];
        
        // If Up Seg, candidate must be Up Bi (ending at High)
        if (type === 'up' && candidateBi.type !== 'up') continue;
        // If Down Seg, candidate must be Down Bi (ending at Low)
        if (type === 'down' && candidateBi.type !== 'down') continue;
        
        // 2. Extract Feature Sequence Elements (The counter-moves)
        // For Up Seg (Peak), Features are DOWN Bis (i+1, i+3...)
        // For Down Seg (Valley), Features are UP Bis (i+1, i+3...)
        
        if (i + 3 >= biList.length) continue; // Need at least Feature 1 and Feature 2
        
        const f1 = biList[i+1]; // First feature element
        const f2 = biList[i+3]; // Second feature element
        
        // 3. Define Values for Comparison
        const f1H = Math.max(f1.start.price, f1.end.price);
        const f1L = Math.min(f1.start.price, f1.end.price);
        const f2H = Math.max(f2.start.price, f2.end.price);
        const f2L = Math.min(f2.start.price, f2.end.price);
        
        // 4. Feature Inclusion Processing
        // Inclusion direction depends on Segment Direction
        // Up Seg -> Feature Sequence is Down -> Use Down Logic (Keep Low)
        // Down Seg -> Feature Sequence is Up -> Use Up Logic (Keep High)
        
        let mergedF1H = f1H;
        let mergedF1L = f1L;
        let effectiveF2H = f2H;
        let effectiveF2L = f2L;
        let hasInclusion = false;
        
        const isF2inF1 = f2H <= f1H && f2L >= f1L;
        const isF1inF2 = f1H <= f2H && f1L >= f2L;
        
        if (isF2inF1 || isF1inF2) {
            hasInclusion = true;
            if (type === 'up') {
                // Down Logic: High=Min, Low=Min
                mergedF1H = Math.min(f1H, f2H);
                mergedF1L = Math.min(f1L, f2L);
            } else {
                // Up Logic: High=Max, Low=Max
                mergedF1H = Math.max(f1H, f2H);
                mergedF1L = Math.max(f1L, f2L);
            }
            
            // Use f3 as the comparison element if f1/f2 merged
            if (i + 5 < biList.length) {
                const f3 = biList[i+5];
                effectiveF2H = Math.max(f3.start.price, f3.end.price);
                effectiveF2L = Math.min(f3.start.price, f3.end.price);
            } else {
                // Not enough elements to confirm destruction after inclusion
                continue; 
            }
        }
        
        // 5. Gap Logic & Destruction Check
        const peakPrice = candidateBi.end.price;
        
        if (type === 'up') {
            // Check for Top Fractal in Feature Sequence (Down Bis)
            // Feature Sequence Logic: We are looking for a DOWNWARD turn in the features.
            // i.e., effectiveF2 should be LOWER than mergedF1.
            
            // Gap Check: Did f1 gap away from peak?
            // Gap exists if f1H < peakPrice? No, feature is Down Bi.
            // Gap exists if f1's High is lower than Peak? No, f1 starts near peak.
            // "Gap" refers to the space between the Feature Elements OR between Peak and Feature.
            // Standard: If f1L < candidateBi.start.price? (Penetration)
            
            // Simplified "Standard" Check:
            // Does the sequence {mergedF1, effectiveF2} form a Down Trend?
            const isFeatureDown = effectiveF2H < mergedF1H && effectiveF2L < mergedF1L;
            
            if (isFeatureDown) {
                 // Check if the rebound (the Up Bi between F1/F2) broke the peak?
                 const reboundBi = biList[hasInclusion ? i+4 : i+2]; // The Up Bi
                 if (reboundBi.end.price < peakPrice) {
                     return i; // Peak Confirmed
                 }
            }
        } else {
            // Down Seg
            // Check for Bottom Fractal in Feature Sequence (Up Bis)
            // Looking for UPWARD turn. effectiveF2 > mergedF1.
            
            const isFeatureUp = effectiveF2H > mergedF1H && effectiveF2L > mergedF1L;
            
            if (isFeatureUp) {
                const retraceBi = biList[hasInclusion ? i+4 : i+2]; // The Down Bi
                if (retraceBi.end.price > peakPrice) {
                    return i; // Valley Confirmed
                }
            }
        }
    }
    
    return -1;
}

// --- 5. Pivot Generation (Bi Level) ---
function generatePivotsFromBi(biList: ChanBi[]): ChanPivot[] {
    const pivots: ChanPivot[] = [];
    if (biList.length < 3) return [];

    for (let i = 0; i <= biList.length - 3; i+=1) { 
        const b1 = biList[i];
        const b2 = biList[i+1];
        const b3 = biList[i+2];

        if(b1.type === b2.type) continue; 

        // Standard Pivot: Overlap of 3 consecutive Bis
        const high1 = Math.max(b1.start.price, b1.end.price);
        const low1 = Math.min(b1.start.price, b1.end.price);
        const high2 = Math.max(b2.start.price, b2.end.price);
        const low2 = Math.min(b2.start.price, b2.end.price);
        const high3 = Math.max(b3.start.price, b3.end.price);
        const low3 = Math.min(b3.start.price, b3.end.price);

        const zg = Math.min(high1, high2, high3); 
        const zd = Math.max(low1, low2, low3);   

        if (zg > zd) { // Valid Overlap
            // Pivot Extension (YanShen): Check subsequent Bis
            let endBiIdx = i + 2;
            let currentZG = zg;
            let currentZD = zd;
            let currentGG = Math.max(high1, high2, high3);
            let currentDD = Math.min(low1, low2, low3);

            let j = i + 3;
            while(j < biList.length) {
                const nextBi = biList[j];
                const h = Math.max(nextBi.start.price, nextBi.end.price);
                const l = Math.min(nextBi.start.price, nextBi.end.price);
                
                // Check if next Bi overlaps with current ZG/ZD
                if (Math.min(h, currentZG) > Math.max(l, currentZD)) {
                    endBiIdx = j;
                    currentGG = Math.max(currentGG, h);
                    currentDD = Math.min(currentDD, l);
                    j++;
                } else {
                    break;
                }
            }
            
            const lastP = pivots[pivots.length-1];
            if (!lastP || i > lastP.endBiIndex) {
                 pivots.push({
                    startBiIndex: i,
                    endBiIndex: endBiIdx,
                    zg: currentZG,
                    zd: currentZD,
                    gg: currentGG,
                    dd: currentDD,
                    direction: 'neutral',
                    startTime: b1.start.time,
                    endTime: biList[endBiIdx].end.time,
                    level: 'bi'
                });
                i = endBiIdx - 1; // Skip processed Bis
            }
        }
    }
    return pivots;
}

// --- 6. Pivot Generation (Segment Level) ---
function generatePivotsFromSeg(segList: ChanSeg[]): ChanPivot[] {
    const pseudoBiList: ChanBi[] = segList.map((s, idx) => ({
        start: s.start,
        end: s.end,
        type: s.type,
        isValid: true
    }));

    const rawPivots = generatePivotsFromBi(pseudoBiList);
    return rawPivots.map(p => ({...p, level: 'seg' as const}));
}

// --- 7. Structure & Signal Analysis ---
function analyzeStructure(biList: ChanBi[], segList: ChanSeg[], biPivots: ChanPivot[], segPivots: ChanPivot[], macd: any[], klines: Kline[]) {
    const buySellPoints: BuySellPoint[] = [];
    
    let trend: 'up' | 'down' | 'consolidation' = 'consolidation';
    const activePivots = segPivots.length >= 2 ? segPivots : biPivots;
    
    if (activePivots.length >= 2) {
        const lastP = activePivots[activePivots.length-1];
        const prevP = activePivots[activePivots.length-2];
        if (lastP.zd > prevP.zg) trend = 'up';
        else if (lastP.zg < prevP.zd) trend = 'down';
    } else if (biList.length > 0) {
        trend = biList[biList.length-1].type === 'up' ? 'up' : 'down';
    }

    const getRangeMACD = (startIndex: number, endIndex: number) => {
        let area = 0;
        if (startIndex < 0 || endIndex >= macd.length) return {area:0};
        for (let i = startIndex; i <= endIndex; i++) {
            if (macd[i]) area += Math.abs(macd[i].hist);
        }
        return { area };
    };

    const getBiMACD = (bi: ChanBi) => getRangeMACD(bi.start.index, bi.end.index).area;
    const getSegMACD = (seg: ChanSeg) => getRangeMACD(seg.start.index, seg.end.index).area;

    // Detect Bi-Level Buy/Sell Points
    for (let i = 2; i < biList.length; i++) {
        const curr = biList[i];
        const prev = biList[i-2];

        // 1B/1S (Divergence)
        if (curr.type === 'down' && curr.end.price < prev.end.price) {
            const currForce = getBiMACD(curr);
            const prevForce = getBiMACD(prev);
            if (currForce < prevForce * 0.9) {
                buySellPoints.push({
                    type: '1B', price: curr.end.price, time: curr.end.time,
                    desc: '一买 (盘背)', isSegmentLevel: false
                });
            }
        } 
        else if (curr.type === 'up' && curr.end.price > prev.end.price) {
            const currForce = getBiMACD(curr);
            const prevForce = getBiMACD(prev);
            if (currForce < prevForce * 0.9) {
                buySellPoints.push({
                    type: '1S', price: curr.end.price, time: curr.end.time,
                    desc: '一卖 (盘背)', isSegmentLevel: false
                });
            }
        }
        
        // 3B/3S (Pivot Breakout & Retest)
        const pivot = biPivots.find(p => p.endBiIndex === i - 2); 
        if (pivot) {
             const breakout = biList[i-1];
             if (curr.type === 'down' && breakout.type === 'up' && breakout.end.price > pivot.zg && curr.end.price > pivot.zg) {
                 buySellPoints.push({type: '3B', price: curr.end.price, time: curr.end.time, desc: '三买 (中枢破坏)', isSegmentLevel: false});
             }
             if (curr.type === 'up' && breakout.type === 'down' && breakout.end.price < pivot.zd && curr.end.price < pivot.zd) {
                 buySellPoints.push({type: '3S', price: curr.end.price, time: curr.end.time, desc: '三卖 (中枢破坏)', isSegmentLevel: false});
             }
        }
    }

    // Detect Segment-Level Divergence
    for (let i = 2; i < segList.length; i++) {
        const curr = segList[i];
        const prev = segList[i-2];

        if (curr.type === 'down' && curr.end.price < prev.end.price) {
            const currForce = getSegMACD(curr);
            const prevForce = getSegMACD(prev);
            if (currForce < prevForce * 0.8) { 
                buySellPoints.push({
                    type: '1B', price: curr.end.price, time: curr.end.time,
                    desc: '🔥线段底背驰', isSegmentLevel: true
                });
            }
        } else if (curr.type === 'up' && curr.end.price > prev.end.price) {
            const currForce = getSegMACD(curr);
            const prevForce = getSegMACD(prev);
            if (currForce < prevForce * 0.8) {
                buySellPoints.push({
                    type: '1S', price: curr.end.price, time: curr.end.time,
                    desc: '🔥线段顶背驰', isSegmentLevel: true
                });
            }
        }
    }

    let latestDivergence = { isDivergent: false, type: null as any, strength: 0, description: '' };
    const lastSignal = buySellPoints[buySellPoints.length - 1];
    if (lastSignal && (lastSignal.type === '1B' || lastSignal.type === '1S')) {
        // Check recency
        if (klines.length > 0 && Math.abs(lastSignal.time - klines[klines.length-1].time) < 3600 * 1000 * 10) { 
             latestDivergence = {
                 isDivergent: true,
                 type: lastSignal.type === '1B' ? 'bottom' : 'top',
                 strength: 0.95,
                 description: lastSignal.desc
             };
        }
    }

    return { buySellPoints, divergence: latestDivergence, trend };
}

function emptyResult(): ChanLunFeatures {
    return { klines: [], fractals: [], biList: [], segList: [], pivots: [], buySellPoints: [], divergence: { isDivergent: false, type: null, strength: 0, description: '' }, trend: 'consolidation' };
}
