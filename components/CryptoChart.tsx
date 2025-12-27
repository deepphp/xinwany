
import React, { useEffect, useRef, useMemo, useImperativeHandle, forwardRef } from 'react';
import { 
    createChart, 
    ColorType, 
    IChartApi, 
    ISeriesApi, 
    IPriceLine, 
    LineStyle,
    Time,
    CandlestickSeries, 
    HistogramSeries, 
    LineSeries,
    SeriesMarker,
    SeriesMarkerPosition,
    SeriesMarkerShape
} from 'lightweight-charts';
import { Kline, ChanLunFeatures, HarmonicPattern, AppSettings, MonteCarloResult, ChartSignal } from '../types';

interface CryptoChartProps {
  data: Kline[];
  chanLun: ChanLunFeatures | null;
  harmonics?: HarmonicPattern[]; 
  settings: AppSettings;
  kalmanData?: {time: number, value: number | null}[]; 
  dwtData?: {time: number, value: number | null}[]; 
  esnData?: {time: number, value: number}; 
  monteCarlo?: MonteCarloResult | null; 
  chartSignals?: ChartSignal[]; // NEW: AI Strategy Signals
}

export interface CryptoChartHandle {
    takeScreenshot: () => string | null;
}

// Helper: Ensure data is sorted, unique, and strictly valid
function safeSeriesData(data: {time: number, value: number | null | undefined}[]) {
    const valid = data
        .filter(d => 
            d.time !== null && 
            d.time !== undefined && 
            !isNaN(d.time) && 
            d.value !== null && 
            d.value !== undefined && 
            !isNaN(d.value) && 
            Math.abs(d.value) > 0.0000001 // Allow small negative values if needed, but filter 0/NaN
        )
        .map(d => ({ 
            time: d.time as Time, 
            value: d.value as number 
        }))
        .sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));

    // Deduplicate timestamps (keep last update for same time)
    const unique: typeof valid = [];
    if (valid.length > 0) {
        unique.push(valid[0]);
        for (let i = 1; i < valid.length; i++) {
            const prev = unique[unique.length - 1];
            const curr = valid[i];
            if ((curr.time as unknown as number) === (prev.time as unknown as number)) {
                unique[unique.length - 1] = curr;
            } else {
                unique.push(curr);
            }
        }
    }
    return unique;
}

export const CryptoChart = forwardRef<CryptoChartHandle, CryptoChartProps>(({ data, chanLun, harmonics, settings, kalmanData, dwtData, esnData, monteCarlo, chartSignals }, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  
  const biSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const segSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  
  const pivotZGSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const pivotZDSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const kalmanSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const dwtSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const esnSeriesRef = useRef<ISeriesApi<"Line"> | null>(null); 
  
  const mcUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const mcLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const mcMeanSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const pivotPriceLinesRef = useRef<IPriceLine[]>([]);
  
  const isChartInitialized = useRef(false);
  const prevDataLength = useRef(0);

  useImperativeHandle(ref, () => ({
      takeScreenshot: () => {
          if (chartRef.current) {
              return chartRef.current.takeScreenshot().toDataURL('image/png');
          }
          return null;
      }
  }));

  // 1. DATA SANITIZATION (CRITICAL FOR SCALE)
  const validData = useMemo(() => {
      if (!data) return [];
      return data
        .filter(d => 
            d.time !== null && !isNaN(d.time) &&
            d.close > 0 && d.high > 0 && d.low > 0 && d.open > 0
        )
        .map(d => ({
            ...d,
            time: d.time as Time
        }));
  }, [data]);

  const volumeData = useMemo(() => {
      return validData.map(d => ({
          time: d.time,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)',
      }));
  }, [validData]);

  const timeStep = useMemo(() => {
      if (validData.length < 2) return 3600; 
      const last = validData[validData.length - 1].time as unknown as number;
      const secondLast = validData[validData.length - 2].time as unknown as number;
      return last - secondLast;
  }, [validData]);

  // Init Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Dispose old chart if any
    if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
    }

    isChartInitialized.current = false;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e11' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937', style: LineStyle.Dotted },
        horzLines: { color: '#1f2937', style: LineStyle.Dotted },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
      },
      handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
      },
      timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#374151',
          rightOffset: 5,
          barSpacing: 10, // Reasonable default
          minBarSpacing: 0.5,
          fixLeftEdge: false,
          fixRightEdge: false,
      },
      rightPriceScale: {
          borderColor: '#374151',
          scaleMargins: {
              top: 0.1,
              bottom: 0.2,
          },
          autoScale: true,
          mode: 0, // 0 = Normal, 1 = Logarithmic
      }
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '', 
    });
    
    chart.priceScale('').applyOptions({
        scaleMargins: {
            top: 0.8,
            bottom: 0,
        },
    });

    // Math Layers
    const pivotZGSeries = chart.addSeries(LineSeries, { color: 'rgba(239, 68, 68, 0.4)', lineWidth: 1, crosshairMarkerVisible: false });
    const pivotZDSeries = chart.addSeries(LineSeries, { color: 'rgba(34, 197, 94, 0.4)', lineWidth: 1, crosshairMarkerVisible: false });
    const mcUpperSeries = chart.addSeries(LineSeries, { color: 'rgba(56, 189, 248, 0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, crosshairMarkerVisible: false, title: 'MC Upper' });
    const mcLowerSeries = chart.addSeries(LineSeries, { color: 'rgba(56, 189, 248, 0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, crosshairMarkerVisible: false, title: 'MC Lower' });
    const mcMeanSeries = chart.addSeries(LineSeries, { color: 'rgba(56, 189, 248, 0.8)', lineWidth: 1, lineStyle: LineStyle.Solid, crosshairMarkerVisible: false, title: 'MC Mean' });
    const biSeries = chart.addSeries(LineSeries, { color: 'rgba(252, 213, 53, 0.3)', lineWidth: 1, lineStyle: LineStyle.Dashed, crosshairMarkerVisible: false, title: "Bi" });
    const segSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2, lineStyle: LineStyle.Solid, crosshairMarkerVisible: false, title: "Seg" });
    const kalmanSeries = chart.addSeries(LineSeries, { color: 'rgba(168, 85, 247, 0.6)', lineWidth: 1, crosshairMarkerVisible: false, title: "Kalman" });
    const dwtSeries = chart.addSeries(LineSeries, { color: '#ffffff', lineWidth: 2, crosshairMarkerVisible: false, title: "Wavelet Trend" });
    const esnSeries = chart.addSeries(LineSeries, { color: '#f97316', lineWidth: 2, lineStyle: LineStyle.Dotted, pointMarkersVisible: true, title: "ESN Neural" });

    // Main Candle Series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#2ebd85',
      downColor: '#f6465d',
      borderVisible: false,
      wickUpColor: '#2ebd85',
      wickDownColor: '#f6465d',
    });
    
    // Assign Refs
    volumeSeriesRef.current = volumeSeries;
    candleSeriesRef.current = candlestickSeries;
    biSeriesRef.current = biSeries;
    segSeriesRef.current = segSeries;
    pivotZGSeriesRef.current = pivotZGSeries;
    pivotZDSeriesRef.current = pivotZDSeries;
    kalmanSeriesRef.current = kalmanSeries;
    dwtSeriesRef.current = dwtSeries;
    esnSeriesRef.current = esnSeries;
    mcUpperSeriesRef.current = mcUpperSeries;
    mcLowerSeriesRef.current = mcLowerSeries;
    mcMeanSeriesRef.current = mcMeanSeries;

    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(entries => {
        if (!chartRef.current || entries.length === 0 || !entries[0].contentRect) return;
        const { width, height } = entries[0].contentRect;
        if (width === 0 || height === 0) return; 
        chartRef.current.applyOptions({ width, height });
        // Force refresh timescale on resize
        setTimeout(() => chartRef.current?.timeScale().fitContent(), 0);
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
      }
      // Clean up series refs to prevent stale usage
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      biSeriesRef.current = null;
      segSeriesRef.current = null;
      kalmanSeriesRef.current = null;
      dwtSeriesRef.current = null;
      esnSeriesRef.current = null;
      pivotZGSeriesRef.current = null;
      pivotZDSeriesRef.current = null;
      mcUpperSeriesRef.current = null;
      mcLowerSeriesRef.current = null;
      mcMeanSeriesRef.current = null;
    };
  }, []); 

  // Price & Volume Updates
  useEffect(() => {
      if (candleSeriesRef.current && volumeSeriesRef.current && validData.length > 0) {
          candleSeriesRef.current.setData(validData);
          volumeSeriesRef.current.setData(volumeData);
          
          if (chartRef.current) {
              const totalBars = validData.length;
              const isSignificantUpdate = Math.abs(totalBars - prevDataLength.current) > 5;
              
              if (!isChartInitialized.current || isSignificantUpdate) {
                  // Only reset view on first load or massive data change
                  chartRef.current.timeScale().setVisibleRange({
                      from: validData[Math.max(0, validData.length - 80)].time, // Show last 80 bars
                      to: validData[validData.length - 1].time,
                  });
                  isChartInitialized.current = true;
              }
              prevDataLength.current = totalBars;
          }
      }
  }, [validData, volumeData]);

  // Math Layer Updates (With STRICT Sanitization)
  useEffect(() => {
      if (kalmanSeriesRef.current && kalmanData) {
          kalmanSeriesRef.current.setData(safeSeriesData(kalmanData));
      }
      if (dwtSeriesRef.current && dwtData) {
          dwtSeriesRef.current.setData(safeSeriesData(dwtData));
      }
      
      if (esnSeriesRef.current && esnData && validData.length > 0 && esnData.value > 0) {
          const last = validData[validData.length-1];
          // Ensure we don't pass null/undefined time or values
          if (last.time && esnData.time && esnData.value) {
            esnSeriesRef.current.setData([
                { time: last.time, value: last.close },
                { time: esnData.time as Time, value: esnData.value }
            ]);
          }
      } else if (esnSeriesRef.current) {
          esnSeriesRef.current.setData([]);
      }
      
      if (mcMeanSeriesRef.current && mcUpperSeriesRef.current && mcLowerSeriesRef.current && monteCarlo && validData.length > 0) {
          const last = validData[validData.length-1];
          const lastTime = last.time as unknown as number;

          const mapPath = (path: number[]) => path.map((price, idx) => ({
             time: (lastTime + (idx + 1) * timeStep) as Time,
             value: price
          })).filter(d => d.value > 0); // Sanitize 0s

          const meanData = mapPath(monteCarlo.meanPath);
          const upperData = mapPath(monteCarlo.upperPath);
          const lowerData = mapPath(monteCarlo.lowerPath);
            
          const lastPoint = { time: last.time, value: last.close };

          if (meanData.length) mcMeanSeriesRef.current.setData([lastPoint, ...meanData]);
          if (upperData.length) mcUpperSeriesRef.current.setData([lastPoint, ...upperData]);
          if (lowerData.length) mcLowerSeriesRef.current.setData([lastPoint, ...lowerData]);
      } else {
          mcMeanSeriesRef.current?.setData([]);
          mcUpperSeriesRef.current?.setData([]);
          mcLowerSeriesRef.current?.setData([]);
      }
  }, [kalmanData, dwtData, esnData, monteCarlo, validData, timeStep]);

  // Chart Signals (Markers)
  useEffect(() => {
      if (!candleSeriesRef.current) return;
      
      const markers: SeriesMarker<Time>[] = [];
      
      // 1. Add ChanLun Signals
      if (chanLun?.buySellPoints && settings.showSignals) {
          chanLun.buySellPoints.forEach(p => {
              if (p.time && p.price) {
                  markers.push({
                      time: p.time as Time,
                      position: p.type.includes('B') ? 'belowBar' : 'aboveBar',
                      color: p.type.includes('B') ? '#e91e63' : '#2196f3',
                      shape: p.type.includes('B') ? 'arrowUp' : 'arrowDown',
                      text: p.desc,
                      size: p.isSegmentLevel ? 2 : 1
                  });
              }
          });
      }

      // 2. Add AI Strategy Signals (Alpha Reactor)
      if (chartSignals && chartSignals.length > 0) {
          chartSignals.forEach(s => {
              if (s.time) {
                  markers.push({
                      time: s.time as Time,
                      position: s.type === 'buy' ? 'belowBar' : 'aboveBar',
                      color: s.type === 'buy' ? '#fcd535' : '#a855f7',
                      shape: s.type === 'buy' ? 'arrowUp' : 'arrowDown',
                      text: s.label,
                      size: 2
                  });
              }
          });
      }
      
      // Sort markers by time
      markers.sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));
      
      // Safely call setMarkers
      const series = candleSeriesRef.current as any;
      if (series && typeof series.setMarkers === 'function') {
          series.setMarkers(markers);
      }
  }, [chanLun, settings, chartSignals]);

  // ChanLun Overlay Updates
  useEffect(() => {
      if (biSeriesRef.current && chanLun?.biList && settings.showBi) {
          const lineData = chanLun.biList.map((bi) => {
              // Expand bi to points
              return [
                { time: bi.start.time, value: bi.start.price },
                { time: bi.end.time, value: bi.end.price }
              ];
          }).flat();
          const uniquePoints = safeSeriesData(lineData);
          biSeriesRef.current.setData(uniquePoints);
      } else if (biSeriesRef.current) biSeriesRef.current.setData([]);

      if (segSeriesRef.current && chanLun?.segList && settings.showSeg) {
          const lineData = chanLun.segList.map(seg => ([
              { time: seg.start.time, value: seg.start.price },
              { time: seg.end.time, value: seg.end.price }
          ])).flat();
          segSeriesRef.current.setData(safeSeriesData(lineData));
      } else if (segSeriesRef.current) segSeriesRef.current.setData([]);
      
      // Pivot Lines (Price Lines)
      pivotPriceLinesRef.current.forEach(line => candleSeriesRef.current?.removePriceLine(line));
      pivotPriceLinesRef.current = [];

      // Pivot Boxes (using lines for ZG/ZD history)
      if (pivotZGSeriesRef.current) pivotZGSeriesRef.current.setData([]);
      if (pivotZDSeriesRef.current) pivotZDSeriesRef.current.setData([]);

      if (chanLun?.pivots && settings.showPivot) {
          const pivots = chanLun.pivots.filter(p => p.level === 'seg');
          const showList = pivots.length > 0 ? pivots : chanLun.pivots;

          const zgData: {time: number, value: number}[] = [];
          const zdData: {time: number, value: number}[] = [];

          showList.forEach(p => {
              // Draw box top/bottom as time spans
              if (p.zg > 0 && p.startTime && p.endTime) {
                zgData.push({ time: p.startTime, value: p.zg });
                zgData.push({ time: p.endTime, value: p.zg });
              }
              if (p.zd > 0 && p.startTime && p.endTime) {
                zdData.push({ time: p.startTime, value: p.zd });
                zdData.push({ time: p.endTime, value: p.zd });
              }
          });
          
          if (pivotZGSeriesRef.current) pivotZGSeriesRef.current.setData(safeSeriesData(zgData));
          if (pivotZDSeriesRef.current) pivotZDSeriesRef.current.setData(safeSeriesData(zdData));
      }
  }, [chanLun, settings]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
});
