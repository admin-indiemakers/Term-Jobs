// Client-side manager for personal AI API keys, model preferences, and rate limit quotas.
// Modeled directly on NEXUS Workspace Compass architecture.
import { useState, useEffect, useCallback } from 'react';

export const AVAILABLE_MODELS = [
  // OpenRouter Free & Popular Models (Primary for TermJobs)
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free Router',
    provider: 'openrouter',
    rpmLimit: 20,
    rpdLimit: 200,
    description: 'Auto-routes to currently active free models with tool calling support (100% Free)',
    isFree: true,
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Google Gemma 4 31B (Free)',
    provider: 'openrouter',
    rpmLimit: 20,
    rpdLimit: 200,
    description: 'Next-gen open model by Google with tools support (Free)',
    isFree: true,
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Google Gemma 4 26B (Free)',
    provider: 'openrouter',
    rpmLimit: 20,
    rpdLimit: 200,
    description: 'Fast multimodal open model by Google (Free)',
    isFree: true,
  },
  {
    id: 'nvidia/nemotron-3.5-super-vl:free',
    name: 'NVIDIA Nemotron 3.5 Super (Free)',
    provider: 'openrouter',
    rpmLimit: 20,
    rpdLimit: 200,
    description: 'High-capability reasoning model by NVIDIA (Free)',
    isFree: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Meta Llama 3.3 70B',
    provider: 'openrouter',
    rpmLimit: 30,
    rpdLimit: 500,
    description: 'Flagship 70B parameter open intelligence by Meta',
  },
  // Google Gemini
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    rpmLimit: 15,
    rpdLimit: 1500,
    description: 'Fastest & stable (Recommended default, ~2s responses)',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'gemini',
    rpmLimit: 15,
    rpdLimit: 1500,
    description: 'High volume throughput with fresh quota',
  },
  // OpenAI
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    rpmLimit: 500,
    rpdLimit: 10000,
    description: 'OpenAI flagship omni intelligence',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    rpmLimit: 500,
    rpdLimit: 10000,
    description: 'Affordable and fast OpenAI model',
  },
];

const STORAGE_KEY_CONFIG = 'termjobs_aura_ai_config';
const STORAGE_KEY_USAGE = 'termjobs_aura_ai_usage';
const EVENT_NAME = 'termjobs-ai-config-changed';
const EVENT_OPEN_DIALOG = 'open-termjobs-ai-config';

// Default pre-configured key for zero-config out-of-the-box operation
const DEFAULT_PRESET_KEY = '';

export function openAiConfigDialog() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_OPEN_DIALOG));
  }
}

export function getUserAiConfig() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) {
      // Return default initial preset if none configured yet
      return {
        provider: 'openrouter',
        apiKey: DEFAULT_PRESET_KEY,
        model: 'openrouter/free',
        customDailyLimit: 50,
        providerKeys: {
          openrouter: DEFAULT_PRESET_KEY,
          gemini: '',
          openai: ''
        }
      };
    }
    const cfg = JSON.parse(raw);
    if (!cfg.providerKeys) {
      cfg.providerKeys = { [cfg.provider || 'openrouter']: cfg.apiKey || DEFAULT_PRESET_KEY };
    }
    return cfg;
  } catch {
    return null;
  }
}

export function saveUserAiConfig(config) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    STORAGE_KEY_CONFIG,
    JSON.stringify({ ...config, connectedAt: new Date().toISOString() })
  );
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function clearUserAiConfig() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_CONFIG);
  resetAiUsage();
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function getStoredUsage() {
  const today = new Date().toISOString().slice(0, 10);
  if (typeof window === 'undefined') {
    return { date: today, dailyCount: 0, recentTimestamps: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USAGE);
    if (!raw) return { date: today, dailyCount: 0, recentTimestamps: [] };
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const validTimestamps = (parsed.recentTimestamps || []).filter(
      (ts) => now - ts < 60_000
    );
    if (parsed.date !== today) {
      return { date: today, dailyCount: 0, recentTimestamps: validTimestamps };
    }
    return { ...parsed, recentTimestamps: validTimestamps };
  } catch {
    return { date: today, dailyCount: 0, recentTimestamps: [] };
  }
}

export function recordAiRequest() {
  if (typeof window === 'undefined') return;
  const current = getStoredUsage();
  const now = Date.now();
  const updatedTimestamps = [...current.recentTimestamps, now].filter(
    (ts) => now - ts < 60_000
  );
  const updated = {
    date: current.date,
    dailyCount: current.dailyCount + 1,
    recentTimestamps: updatedTimestamps,
  };
  localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(updated));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function resetAiUsage() {
  if (typeof window === 'undefined') return;
  const today = new Date().toISOString().slice(0, 10);
  const reset = { date: today, dailyCount: 0, recentTimestamps: [] };
  localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(reset));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useUserAiConfig() {
  const [config, setConfig] = useState(() => getUserAiConfig());
  const [usage, setUsage] = useState(() => getStoredUsage());

  const refresh = useCallback(() => {
    setConfig(getUserAiConfig());
    setUsage(getStoredUsage());
  }, []);

  useEffect(() => {
    refresh();
    const handleEvent = () => refresh();
    window.addEventListener(EVENT_NAME, handleEvent);
    window.addEventListener('storage', handleEvent);

    // Refresh every 4s to prune rolling 60-second RPM window
    const interval = setInterval(() => {
      setUsage(getStoredUsage());
    }, 4000);

    return () => {
      window.removeEventListener(EVENT_NAME, handleEvent);
      window.removeEventListener('storage', handleEvent);
      clearInterval(interval);
    };
  }, [refresh]);

  const activeModelId = config?.model || 'openrouter/free';
  const activeModel =
    AVAILABLE_MODELS.find((m) => m.id === activeModelId) || AVAILABLE_MODELS[0];

  const rpmLimit = activeModel.rpmLimit || 20;
  const rpmCount = usage.recentTimestamps ? usage.recentTimestamps.length : 0;
  const rpmPercent = Math.min(100, Math.round((rpmCount / rpmLimit) * 100));

  const dailyLimit = config?.customDailyLimit || 50;
  const dailyCount = usage.dailyCount || 0;
  const dailyPercent = Math.min(100, Math.round((dailyCount / dailyLimit) * 100));

  const isNearRpmLimit = rpmCount >= Math.max(1, rpmLimit - 2);
  const isConnected = Boolean(config?.apiKey && config.apiKey.trim().length > 0);

  const stats = {
    rpmCount,
    rpmLimit,
    rpmPercent,
    dailyCount,
    dailyLimit,
    dailyPercent,
    isNearRpmLimit,
    model: activeModel,
    selectedModel: activeModelId,
  };

  return {
    config,
    usage,
    stats,
    isConnected,
    saveConfig: saveUserAiConfig,
    clearConfig: clearUserAiConfig,
    resetUsage: resetAiUsage,
    refresh,
  };
}
