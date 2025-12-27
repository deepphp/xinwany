
import { AppSettings, MarketContext, TimeframeData, ChanLunFeatures, TechnicalIndicators, HarmonicPattern, Message, DocPlan, DocumentSection, MarketRegime, MacroData } from '../types';
import { GoogleGenAI } from "@google/genai";
import { STRATEGY_A_PROFITABLE, STRATEGY_B_V6_5, STRATEGY_C_RISK, STRATEGY_CIO_REFEREE } from './strategies';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: 'https://xyuapi.top/v1',
  apiKey: '',
  modelId: 'gemini-3-pro-preview',
  klineLimit: 200,

  // ChanLun Defaults
  biType: 'old',
  biStrict: true,
  biKCount: 5,
  
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,

  showBi: true,
  showSeg: true,
  showPivot: true,
  showSignals: true
};

// --- SEMANTIC FORMATTER ---

const formatHarmonics = (patterns: HarmonicPattern[] | undefined): string => {
    if (!patterns || patterns.length === 0) return "无显著谐波形态";
    return patterns.map(p => `⚠️ **${p.name} (${p.subType})** - 质量:${p.quality} | PRZ:${p.entryZone.toFixed(2)}`).join('\n');
};

const formatChanLun = (chan: ChanLunFeatures): string => {
    if (!chan) return "无缠论数据";
    let status = `当前趋势(Strict): ${chan.trend.toUpperCase()}`;
    if (chan.biList.length > 0) status += ` | 笔数:${chan.biList.length}`;
    if (chan.segList.length > 0) status += ` | 线段数:${chan.segList.length}`;
    
    // Find pivots closest to current price
    const biPivots = chan.pivots.filter(p => p.level === 'bi');
    const segPivots = chan.pivots.filter(p => p.level === 'seg');
    
    if (segPivots.length > 0) {
        const p = segPivots[segPivots.length - 1];
        status += `\n关键线段中枢: [ZD:${p.zd.toFixed(2)} - ZG:${p.zg.toFixed(2)}]`;
    } else if (biPivots.length > 0) {
        const p = biPivots[biPivots.length - 1];
        status += `\n最近笔中枢: [ZD:${p.zd.toFixed(2)} - ZG:${p.zg.toFixed(2)}]`;
    }
    
    const recentSignals = chan.buySellPoints.slice(-3);
    const signalStr = recentSignals.map(p => `[${p.isSegmentLevel ? '大级别' : '小级别'}${p.type}] ${p.desc} @ ${p.price}`).join('\n');
    
    return `${status}\n信号历史:\n${signalStr || "无近期信号"}`;
};

const formatSemanticContext = (tf: TimeframeData, regime?: MarketRegime, macro?: MacroData): string => {
    if (!tf || !tf.klines || tf.klines.length === 0) return "数据缺失";
    const k = tf.klines[tf.klines.length - 1];
    const ind = tf.indicators || {} as Partial<TechnicalIndicators>;
    const ens = ind.ensemble;

    // Advanced Ensemble String with ADAPTIVE RULES
    let ensembleStr = "N/A";
    let rulesStr = "";
    
    if (ens) {
        // --- Calculate Kelly Size Locally for Prompt Context ---
        let p = ind.prediction?.probability || 0.5;
        // Adjust P based on Regime/Macro
        if (regime && regime.entropy > 0.6) p *= 0.8;
        if (macro && macro.macroStressIndex > 0.6) p *= 0.7;
        
        const b = 1.5; // Assumed Reward/Risk ratio
        const q = 1 - p;
        let kelly = (b * p - q) / b;
        if (kelly < 0) kelly = 0;
        if (kelly > 0.5) kelly = 0.5;

        // LSTM Calculation
        const lstmTarget = ens.neural.lstmPrediction || k.close;
        const lstmDiffPct = ((lstmTarget - k.close) / k.close) * 100;
        
        // Model Health
        const activeCount = ens.modelHealth.filter(m => m.state === 'ACTIVE').length;
        const benchedModels = ens.modelHealth.filter(m => m.state === 'BENCHED').map(m => m.name).join(', ');

        ensembleStr = `
【☢️ DEEP QUANT LAB (Nuclear Core)】
- **AI Price Target (LSTM)**: ${lstmTarget.toFixed(2)} (${lstmDiffPct > 0 ? '+' : ''}${lstmDiffPct.toFixed(2)}%)
- **Rec. Position Size (Kelly)**: ${(kelly * 100).toFixed(1)}% (Adj. WinProb: ${(p*100).toFixed(0)}%)
- **Alpha Consensus**: ${ens.consensusDirection} (Score: ${ens.consensusScore})
- **Neural Brain (DQN)**: Action=${ens.neural.layers?.dqnAction.action} | Confidence=${ens.neural.layers?.dqnAction.qValue.toFixed(2)}
- **Random Forest (Physics)**: Trend=${ens.forest.trend.toFixed(1)} | Reversion=${ens.forest.reversion.toFixed(1)} | Vol=${ens.forest.volatility.toFixed(1)}
- **Model Health**: ${activeCount}/${ens.modelHealth.length} Active. (Benched: ${benchedModels || 'None'})
- **Divergence**: ${ens.divergenceScore === 1 ? '✅ Convergent' : '⚠️ Divergent (High Risk)'}
        `.trim();
        
        // Show the rules the system evolved to
        if (ens.learnedRules) {
            rulesStr = `
【🛡️ 在线学习进化规则 (Adaptive Rules)】
*SYSTEM HAS EVOLVED THE FOLLOWING CRITERIA:*
- **Z-Score Threshold**: +/- ${ens.learnedRules.zScoreThreshold.toFixed(1)} (Statistical Reversion)
- **Hurst Threshold**: > ${ens.learnedRules.hurstThreshold.toFixed(2)} (Trend Persistence)
- **Vol Regime**: ${ens.learnedRules.volatilityRegime}
            `.trim();
        }
    }

    return `
### ${tf.timeframe.toUpperCase()} 周期数据
*   **当前价格**: ${k.close}
${ensembleStr}
${rulesStr}
*   **物理与统计指标 (Alpha Reactor 6.0)**:
    - **Kalman Z-Score**: ${ind.kalmanZScore?.toFixed(2)} ( >2=超买, <-2=超卖 )
    - **Hurst Exponent**: ${tf.indicators.fdi ? (2 - tf.indicators.fdi).toFixed(2) : 'N/A'} (Approximation)
    - **LinReg Slope**: ${ind.linRegSlope?.toFixed(2)}% (Directional Velocity)
    - **RVI (Vol Intensity)**: ${ind.rvi?.toFixed(2)} ( -1 to 1 )
    - **GARCH Vol**: ${ind.volatilityGARCH ? (ind.volatilityGARCH*100).toFixed(2)+'%' : 'N/A'}
*   **缠论结构**: \n${formatChanLun(tf.chanlun)}
*   **谐波形态**: \n${formatHarmonics(tf.harmonics)}
`.trim();
};

const buildPrompt = (context: MarketContext) => {
  if (!context) return "无市场数据";
  
  // Inject Deep Calculation Data AT THE TOP
  const regimeStr = `
【🌍 宏观与体制 (Macro & Regime)】
- **Hurst Exponent**: ${context.regime.hurst.toFixed(2)} (范围0-1, >0.5=趋势, <0.5=震荡)
- **Market Entropy**: ${context.regime.entropy.toFixed(2)} (范围0-1, >0.6=混乱/高风险)
- **Macro Stress**: ${context.macro?.macroStressIndex.toFixed(2) || 'N/A'} (>0.6=系统性风险)
- **BTC Correlation**: ${context.macro?.btcCorrelation.toFixed(2) || 'N/A'}
`.trim();

  const nestingStr = context.intervalNesting.length > 0 
    ? `【⚡ 级别共振 (Recursive Structure)】\n${context.intervalNesting.map(s => `- ${s}`).join('\n')}`
    : `【⚡ 级别共振 (Recursive Structure)】\n无明显多周期共振，单打独斗，风险较高。`;

  return `
【全模态算法数学报告 - ${context.symbol}】
当前时间: ${new Date().toISOString()}

${regimeStr}

${nestingStr}

${formatSemanticContext(context.tf4h, context.regime, context.macro)}
${formatSemanticContext(context.tf1h, context.regime, context.macro)}
${formatSemanticContext(context.tf15m, context.regime, context.macro)}
`;
};

/**
 * Fetches analysis from AI using Multi-Modal Input (Text + Image).
 * Supports Fractal Multi-Vision Fusion by injecting the Chart Snapshot.
 */
export const fetchComparativeAnalysis = async (
  settings: AppSettings, 
  context: MarketContext,
  chartImageBase64?: string
): Promise<{ strategyA: string, strategyB: string, strategyC: string, summary: string }> => {
  const baseData = buildPrompt(context);
  const visualPrompt = chartImageBase64 
    ? `\n【👁️ 多模态分形视觉融合 (Fractal Multi-Vision Fusion)】\n已提供核心周期的高分辨率 K 线图层。请像人类交易员一样，结合数学数据与图像形态进行双向验证。\n请重点识别图中的：楔形形态、中枢结构、线段背驰、以及谐波形态的视觉对称性。` 
    : `\n【⚠️ 视觉缺失】未提供图表快照，请仅依赖数学数据。`;

  const promptA = `${STRATEGY_A_PROFITABLE}\n\n【实时市场数据】\n${baseData}${visualPrompt}`;
  const promptB = `${STRATEGY_B_V6_5}\n\n【实时市场数据】\n${baseData}${visualPrompt}`;
  const promptC = `${STRATEGY_C_RISK}\n\n【实时市场数据】\n${baseData}${visualPrompt}\n\n请针对以上数据和图像，给出你的风控否决意见。`;

  try {
    const [resA, resB, resC] = await Promise.all([
      callAI(settings, promptA, chartImageBase64),
      callAI(settings, promptB, chartImageBase64),
      callAI(settings, promptC, chartImageBase64)
    ]);

    const promptSummary = `${STRATEGY_CIO_REFEREE}\n\n--- 交易员 A 报告 ---\n${resA}\n\n--- 交易员 B 报告 ---\n${resB}\n\n--- 风控官 C 警告 ---\n${resC}\n\n--- 原始数据 ---\n${baseData}`;
    const resSum = await callAI(settings, promptSummary);
    
    return { strategyA: resA, strategyB: resB, strategyC: resC, summary: resSum };
  } catch (error: any) {
    return { 
        strategyA: `Error: ${error.message}`, 
        strategyB: `Error: ${error.message}`, 
        strategyC: `Error: ${error.message}`, 
        summary: `无法生成总结: ${error.message}` 
    };
  }
};

// --- TRADING ASSISTANT AGENT ---

const TRADER_ASSISTANT_PROMPT = `
You are an Advanced Crypto Trading Assistant specializing in ChanLun (缠论), Harmonic Patterns, and Statistical Math Models (Alpha Reactor 6.0).
Your goal is to answer the user's questions about the market based on the provided technical data context.

Tone: Professional, Concise, Analytical.
Language: Chinese (unless asked otherwise).

Key Capabilities:
1. Explain specific ChanLun structures (Bi, Seg, Pivot) currently visible.
2. Interpret the Alpha Reactor stats: Kalman Z-Score, Hurst, Entropy.
3. EXPLAIN THE ADVANCED MATH: If Z-Score > 2.0, explain it as a statistical anomaly event (Overbought).
4. EXPLAIN THE EVOLVED RULES: Look at the 'Adaptive Rules' section. If Z-Score Threshold is strict (e.g. 3.0), explain that the model has tightened criteria due to recent chaos.
5. REFER TO DEEP QUANT LAB: Use the LSTM Price Target and Kelly Size to guide the user.

Do NOT give financial advice. Always phrase as "technical analysis suggests..."
`;

export const chatWithTrader = async (settings: AppSettings, messages: Message[], input: string, context: MarketContext | null): Promise<string> => {
    const history = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const marketData = context ? buildPrompt(context) : "No live market data available currently.";

    const prompt = `
    ${TRADER_ASSISTANT_PROMPT}

    LATEST MARKET DATA CONTEXT:
    ${marketData}

    CONVERSATION HISTORY:
    ${history}

    USER: ${input}

    ASSISTANT:`;
    
    return callAI(settings, prompt);
};

// --- DOC ARCHITECT AGENT (Restored) ---

const DOC_PLANNER_PROMPT = `
You are an expert Technical Document Architect.
Your task is to analyze the conversation history and generate a structured documentation plan (outline) for a technical manual or analysis report.

Output Format: STRICT JSON only.
Structure:
{
  "title": "Document Title",
  "targetAudience": "Target Audience",
  "tone": "Formal/Casual/Technical",
  "sections": [
    {
      "title": "Section Title",
      "description": "Brief description of what this section should cover"
    }
  ]
}

Ensure the outline is logical, comprehensive, and derived from the user's requirements in the conversation.
`;

const DOC_WRITER_PROMPT = `
You are an expert Technical Writer specializing in Markdown documentation.
Your task is to write the content for a specific section of a document based on the plan and context provided.

Style: Professional, Clear, using Markdown formatting (headers, lists, bold, code blocks).
Content: detailed, high-quality, and directly addressing the section description.
`;

export const generateDocumentPlan = async (settings: AppSettings, context: string): Promise<DocPlan> => {
    const prompt = `
    ${DOC_PLANNER_PROMPT}

    CONTEXT:
    ${context}

    Generate the JSON plan now:
    `;
    
    // Force JSON response
    const raw = await callAI(settings, prompt);
    const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        const parsed = JSON.parse(jsonStr);
        // Add IDs
        parsed.sections = parsed.sections.map((s: any) => ({ ...s, id: uuidv4(), content: '' }));
        return parsed as DocPlan;
    } catch (e) {
        throw new Error("Failed to parse document plan JSON: " + raw);
    }
};

export const generateSectionContent = async (
    settings: AppSettings, 
    section: DocumentSection, 
    plan: DocPlan, 
    chatContext: string,
    marketContext: MarketContext | null
): Promise<string> => {
    const marketData = marketContext ? buildPrompt(marketContext) : "No live market data.";
    
    const prompt = `
    ${DOC_WRITER_PROMPT}

    DOCUMENT TITLE: ${plan.title}
    AUDIENCE: ${plan.targetAudience}
    TONE: ${plan.tone}

    SECTION TO WRITE:
    Title: ${section.title}
    Description: ${section.description}

    BACKGROUND CONTEXT (Chat History):
    ${chatContext}
    
    MARKET DATA (If relevant):
    ${marketData}

    Write the full content for this section in Markdown:
    `;

    return callAI(settings, prompt);
};

// --- CORE AI CALLER ---

async function callAI(settings: AppSettings, prompt: string, imageBase64?: string): Promise<string> {
  const isCustomUrl = settings.apiUrl && !settings.apiUrl.includes('googleapis.com');
  const apiKey = settings.apiKey || process.env.API_KEY || '';

  if (!apiKey) return "API Key Missing";

  if (isCustomUrl) {
      return fetchOpenAICompatible(settings, prompt);
  } else {
      const ai = new GoogleGenAI({ apiKey });
      const modelId = settings.modelId || 'gemini-3-pro-preview';
      
      let contents: any = prompt;

      if (imageBase64) {
          const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|webp);base64,/, "");
          contents = {
              parts: [
                  { text: prompt },
                  { inlineData: { mimeType: "image/png", data: base64Data } }
              ]
          };
      }

      const response = await ai.models.generateContent({
          model: modelId,
          contents: contents
      });
      return response.text || "No output";
  }
}

async function fetchOpenAICompatible(settings: AppSettings, prompt: string): Promise<string> {
    const url = settings.apiUrl.endsWith('/') ? settings.apiUrl : `${settings.apiUrl}`;
    const endpoint = url.includes('chat/completions') ? url : `${url}/chat/completions`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
            model: settings.modelId,
            messages: [
                { role: "system", content: "You are a crypto trading expert." },
                { role: "user", content: prompt }
            ],
            stream: false
        })
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "No content";
}

export const fetchAIAnalysis = async () => "";
