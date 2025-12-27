// This file is deprecated in favor of services/ai.ts which handles Custom API logic.
// Keeping a stub to prevent import errors if cached, but functionality moved.
import { AppSettings, Kline } from '../types';
import { fetchAIAnalysis } from './ai';

export const getGeminiClient = () => {
    throw new Error("Use services/ai.ts");
};
