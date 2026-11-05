import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Eye,
  EyeOff,
  ExternalLink,
  Zap,
  X,
  ShieldCheck
} from "lucide-react";
import {
  AVAILABLE_MODELS,
  useUserAiConfig,
} from "../hooks/useUserAiConfig";

/**
 * AI Configuration Modal Dialog.
 * Mirrors NEXUS Workspace Compass AiConfigDialog.
 * Allows hiring managers to configure OpenRouter, Gemini, or OpenAI API keys,
 * test keys in real time, choose models (including free models), and manage quotas.
 */
export function AiConfigDialog() {
  const [open, setOpen] = useState(false);
  const { config, stats, isConnected, saveConfig, clearConfig, resetUsage } =
    useUserAiConfig();

  const [provider, setProvider] = useState("openrouter");
  const [providerKeys, setProviderKeys] = useState({
    openrouter: "",
    gemini: "",
    openai: "",
  });
  const [model, setModel] = useState("openrouter/free");
  const [dailyLimit, setDailyLimit] = useState(50);
  const [showKey, setShowKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = "success") => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync state when modal opens or config updates
  useEffect(() => {
    if (config) {
      setProvider(config.provider || "openrouter");
      const savedKeys = {
        openrouter:
          config.providerKeys?.openrouter ??
          (config.provider === "openrouter" ? config.apiKey : ""),
        gemini:
          config.providerKeys?.gemini ??
          (config.provider === "gemini" ? config.apiKey : ""),
        openai:
          config.providerKeys?.openai ??
          (config.provider === "openai" ? config.apiKey : ""),
      };
      setProviderKeys(savedKeys);
      setModel(
        config.model ||
          (config.provider === "openrouter" ? "openrouter/free" : "gemini-2.5-flash")
      );
      setDailyLimit(config.customDailyLimit || 50);
    } else {
      setProvider("openrouter");
      setProviderKeys({ openrouter: "", gemini: "", openai: "" });
      setModel("openrouter/free");
      setDailyLimit(50);
    }
    setTestResult(null);
  }, [config, open]);

  // Listen to open event from any part of the UI
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-termjobs-ai-config", handleOpen);
    return () => window.removeEventListener("open-termjobs-ai-config", handleOpen);
  }, []);

  const filteredModels = AVAILABLE_MODELS.filter((m) => m.provider === provider);

  const handleKeyChange = (val) => {
    setTestResult(null);
    setProviderKeys((prev) => ({ ...prev, [provider]: val }));
  };

  const handleProviderChange = (p) => {
    setProvider(p);
    setTestResult(null);
    const defaultModel =
      p === "openrouter"
        ? "openrouter/free"
        : p === "gemini"
        ? "gemini-2.5-flash"
        : "gpt-4o";
    setModel(defaultModel);
  };

  const handleTestKey = async () => {
    const keyToTest = (providerKeys[provider] || "").trim();
    if (!keyToTest) {
      showToast(`Please enter your ${provider} API key first.`, "error");
      return;
    }
    setTestingKey(true);
    setTestResult(null);
    try {
      if (provider === "openrouter") {
        if (!keyToTest.startsWith("sk-or-")) {
          setTestResult({
            ok: false,
            message:
              "OpenRouter keys must start with 'sk-or-v1-'. Please check your key from openrouter.ai/keys.",
          });
          return;
        }
        const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
          headers: { Authorization: `Bearer ${keyToTest}` },
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          const errCode = data?.error?.code || res.status;
          const errMsg = data?.error?.message || `HTTP ${res.status}`;
          const isTruncated = keyToTest.length < 65;
          setTestResult({
            ok: false,
            message: isTruncated
              ? `OpenRouter returned ${errCode}: "${errMsg}". Your key has only ${keyToTest.length} characters (valid keys are ~73 characters). It looks like the key was partially copied—please copy the full key from openrouter.ai/keys.`
              : `OpenRouter returned ${errCode}: "${errMsg}". Please check your key at openrouter.ai/keys.`,
          });
        } else {
          const label = data.data?.label ? ` (${data.data.label})` : "";
          const limitStr = data.data?.limit != null ? ` · Credit Limit: $${data.data.limit}` : "";
          setTestResult({
            ok: true,
            message: `Valid key${label}! Successfully connected to OpenRouter.${limitStr}`,
          });
        }
      } else if (provider === "gemini") {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${keyToTest}`
        );
        const data = await res.json();
        if (!res.ok || data.error) {
          setTestResult({
            ok: false,
            message: `Google Gemini returned: ${data?.error?.message || "Invalid key"}.`,
          });
        } else {
          setTestResult({
            ok: true,
            message: "Valid key! Successfully connected to Google Gemini.",
          });
        }
      } else if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${keyToTest}` },
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setTestResult({
            ok: false,
            message: `OpenAI returned: ${data?.error?.message || "Invalid key"}.`,
          });
        } else {
          setTestResult({
            ok: true,
            message: "Valid key! Successfully connected to OpenAI.",
          });
        }
      }
    } catch (e) {
      setTestResult({
        ok: false,
        message: `Network check failed: ${e.message}`,
      });
    } finally {
      setTestingKey(false);
    }
  };

  const handleSave = () => {
    const trimmed = (providerKeys[provider] || "").trim();
    const providerNames = {
      gemini: "Google Gemini",
      openai: "OpenAI",
      openrouter: "OpenRouter",
    };

    if (!trimmed) {
      showToast(`Please enter an API key for ${providerNames[provider]}.`, "error");
      return;
    }

    if (provider === "openrouter" && trimmed.length < 60) {
      showToast(
        `This OpenRouter key looks incomplete (${trimmed.length} characters). OpenRouter keys usually have ~73 characters.`,
        "error"
      );
      return;
    }

    saveConfig({
      provider,
      apiKey: trimmed,
      model,
      customDailyLimit: Number(dailyLimit) || 50,
      providerKeys: { ...providerKeys, [provider]: trimmed },
    });

    showToast(`Connected successfully to ${providerNames[provider]}!`);
    setTimeout(() => setOpen(false), 300);
  };

  const handleReset = () => {
    clearConfig();
    setProviderKeys({ openrouter: "", gemini: "", openai: "" });
    setTestResult(null);
    showToast("AI configuration and limits reset successfully.");
    setTimeout(() => setOpen(false), 300);
  };

  if (!open) return null;

  const selectedModelInfo =
    AVAILABLE_MODELS.find((m) => m.id === model) || filteredModels[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Toast Banner */}
      {toastMessage && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 border ${
            toastMessage.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}
        >
          {toastMessage.type === "error" ? (
            <AlertCircle className="size-4" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* Modal Dialog Box */}
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-[#DDD7CB] bg-white shadow-2xl flex flex-col p-5 sm:p-6 text-slate-800">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#F0ECE1]">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
              <Sparkles className="size-4.5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Configure Personal AI
              </h3>
              <p className="text-xs text-slate-500">
                Use your personal API key to configure models, free switching, and rate limits.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 py-4 text-xs sm:text-sm">
          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">AI Provider</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleProviderChange("openrouter")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition cursor-pointer ${
                  provider === "openrouter"
                    ? "border-slate-900 bg-slate-900 text-white font-semibold shadow-xs"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <Sparkles
                  className={`size-3.5 ${
                    provider === "openrouter" ? "text-emerald-400" : "text-indigo-500"
                  }`}
                />
                <span>OpenRouter</span>
                <span
                  className={`rounded px-1 py-0.2 text-[9px] font-bold ${
                    provider === "openrouter"
                      ? "bg-emerald-400/20 text-emerald-300"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  Free
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleProviderChange("gemini")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition cursor-pointer ${
                  provider === "gemini"
                    ? "border-slate-900 bg-slate-900 text-white font-semibold shadow-xs"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <Zap
                  className={`size-3.5 ${
                    provider === "gemini" ? "text-amber-400" : "text-amber-500"
                  }`}
                />
                <span>Gemini</span>
              </button>

              <button
                type="button"
                onClick={() => handleProviderChange("openai")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition cursor-pointer ${
                  provider === "openai"
                    ? "border-slate-900 bg-slate-900 text-white font-semibold shadow-xs"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <Sparkles className="size-3.5" />
                <span>OpenAI</span>
              </button>
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                {provider === "openrouter"
                  ? "OpenRouter API Key"
                  : provider === "gemini"
                  ? "Gemini API Key"
                  : "OpenAI API Key"}
              </label>
              {provider === "openrouter" ? (
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline font-semibold"
                >
                  Get free OpenRouter key <ExternalLink className="size-2.5" />
                </a>
              ) : provider === "gemini" ? (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline font-semibold"
                >
                  Get free Gemini key <ExternalLink className="size-2.5" />
                </a>
              ) : (
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline font-semibold"
                >
                  Get OpenAI key <ExternalLink className="size-2.5" />
                </a>
              )}
            </div>

            <div className="flex gap-2 items-center">
              <div className="relative flex-1 min-w-0">
                <input
                  type={showKey ? "text" : "password"}
                  placeholder={
                    provider === "openrouter"
                      ? "sk-or-v1-..."
                      : provider === "gemini"
                      ? "AIzaSy..."
                      : "sk-proj-..."
                  }
                  value={providerKeys[provider] || ""}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-9 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestKey}
                disabled={testingKey || !(providerKeys[provider] || "").trim()}
                className="shrink-0 flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
              >
                {testingKey ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="size-3.5 text-amber-500" />
                    <span>Test Key</span>
                  </>
                )}
              </button>
            </div>

            {/* Test result feedback banner */}
            {testResult && (
              <div
                className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 animate-in fade-in ${
                  testResult.ok
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed">{testResult.message}</div>
              </div>
            )}

            <p className="text-[11px] text-slate-500">
              {provider === "openrouter"
                ? "OpenRouter keys start with 'sk-or-v1-' and are 73 characters long. Verify with 'Test Key' to check balance."
                : provider === "gemini"
                ? "Your Google Gemini API key is saved safely in your browser."
                : "Your OpenAI key is used securely for reasoning and tool execution."}
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Available Model
              </label>
              {provider === "openrouter" && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Includes Free Models (:free)
                </span>
              )}
            </div>

            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              {filteredModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.isFree ? "(100% Free)" : ""} — {m.rpmLimit} RPM
                </option>
              ))}
            </select>
            {selectedModelInfo && (
              <p className="text-[11px] text-slate-500">
                {selectedModelInfo.description} · Limit: {selectedModelInfo.rpmLimit} RPM
              </p>
            )}
          </div>

          {/* Personal Limits & Quota Section */}
          <div className="rounded-xl border border-[#DDD7CB] bg-[#FAF8F5] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Your Personal Limits & Quota
              </span>
              <button
                type="button"
                onClick={resetUsage}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
                title="Reset usage counter"
              >
                <RotateCcw className="size-3" />
                <span>Reset counter</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <div className="text-[11px] text-slate-500">Rate Limit (Rolling 60s)</div>
                <div className="mt-0.5 text-sm font-bold text-slate-900">
                  {stats.rpmCount} / {selectedModelInfo?.rpmLimit ?? 20}{" "}
                  <span className="text-[11px] font-normal text-slate-500">RPM</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      stats.rpmPercent >= 80
                        ? "bg-rose-500"
                        : stats.rpmPercent >= 50
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${stats.rpmPercent}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <div className="text-[11px] text-slate-500">Used Today</div>
                <div className="mt-0.5 text-sm font-bold text-slate-900">
                  {stats.dailyCount} / {dailyLimit}{" "}
                  <span className="text-[11px] font-normal text-slate-500">Requests</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      stats.dailyPercent >= 80
                        ? "bg-rose-500"
                        : stats.dailyPercent >= 50
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${stats.dailyPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="text-[11px] text-slate-600 font-medium">
                Personal daily safety cap (requests / day)
              </label>
              <input
                type="number"
                min={5}
                max={1500}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="h-7 w-24 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#F0ECE1]">
          {isConnected ? (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset & Disconnect</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black active:scale-95 transition cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              <span>Save & Connect</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AiConfigDialog;
