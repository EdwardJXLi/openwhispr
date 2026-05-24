import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { FolderOpen, Copy, Check, Gauge } from "lucide-react";
import { useToast } from "./ui/useToast";
import { Toggle } from "./ui/toggle";
import { useSettingsLayout } from "./ui/useSettingsLayout";
import logger from "../utils/logger";
import { useSettings } from "../hooks/useSettings";

export default function DeveloperSection() {
  const { t } = useTranslation();
  const { isCompact } = useSettingsLayout();
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [benchRunning, setBenchRunning] = useState(false);
  const [benchStatus, setBenchStatus] = useState<string | null>(null);
  const [benchResult, setBenchResult] = useState<
    | {
        stats: { min: number; max: number; mean: number; median: number };
        audioDurationSec: number;
        rtfMedian: number;
        transcript: string;
        route: string;
        model: string | null;
        language: string | null;
      }
    | null
  >(null);
  const { toast } = useToast();
  const {
    useLocalWhisper,
    localTranscriptionProvider,
    whisperModel,
    parakeetModel,
    preferredLanguage,
    customDictionary,
  } = useSettings();

  const activeProviderLabel = !useLocalWhisper
    ? "Cloud (not benchmarkable)"
    : localTranscriptionProvider === "nvidia"
      ? "Parakeet (local)"
      : "Whisper (local)";
  const activeModel =
    localTranscriptionProvider === "nvidia" ? parakeetModel : whisperModel;

  const loadDebugState = useCallback(async () => {
    try {
      setIsLoading(true);
      const state = await window.electronAPI.getDebugState();
      setDebugEnabled(state.enabled);
      setLogPath(state.logPath);
    } catch (error) {
      logger.error("Failed to load debug state", { error }, "developer");
      toast({
        title: t("developerSection.toasts.loadFailed.title"),
        description: t("developerSection.toasts.loadFailed.description"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    loadDebugState();
  }, [loadDebugState]);

  const handleToggleDebug = async () => {
    if (isToggling) return;

    try {
      setIsToggling(true);
      const newState = !debugEnabled;
      const result = await window.electronAPI.setDebugLogging(newState);

      if (!result.success) {
        throw new Error(result.error || "Failed to update debug logging");
      }

      setDebugEnabled(newState);
      await loadDebugState();

      toast({
        title: newState
          ? t("developerSection.toasts.debugEnabled.title")
          : t("developerSection.toasts.debugDisabled.title"),
        description: newState
          ? t("developerSection.toasts.debugEnabled.description")
          : t("developerSection.toasts.debugDisabled.description"),
        variant: "success",
      });
    } catch (error) {
      toast({
        title: t("developerSection.toasts.updateFailed.title"),
        description: t("developerSection.toasts.updateFailed.description"),
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleOpenLogsFolder = async () => {
    try {
      const result = await window.electronAPI.openLogsFolder();
      if (!result.success) {
        throw new Error(result.error || "Failed to open folder");
      }
    } catch (error) {
      toast({
        title: t("developerSection.toasts.openLogsFailed.title"),
        description: t("developerSection.toasts.openLogsFailed.description"),
        variant: "destructive",
      });
    }
  };

  const handleRunBenchmark = async () => {
    if (benchRunning) return;
    setBenchRunning(true);
    setBenchResult(null);
    setBenchStatus(t("developerSection.benchmark.warmup"));

    const unsubscribe = window.electronAPI.onBenchmarkProgress((p) => {
      if (p.phase === "downloading") {
        setBenchStatus(t("developerSection.benchmark.downloading"));
      } else if (p.phase === "warmup") {
        setBenchStatus(t("developerSection.benchmark.warmup"));
      } else if (p.phase === "run" && p.index && p.total && typeof p.ms === "number") {
        setBenchStatus(
          t("developerSection.benchmark.running", {
            index: p.index,
            total: p.total,
            ms: p.ms.toFixed(0),
          })
        );
      }
    });

    try {
      const result: any = await window.electronAPI.benchmarkTranscription({
        runs: 5,
        settings: {
          useLocalWhisper,
          localTranscriptionProvider,
          whisperModel,
          parakeetModel,
          language: preferredLanguage,
          customDictionary,
        },
      });
      if (!result.success) {
        toast({
          title: t("developerSection.benchmark.toasts.failed.title"),
          description: t("developerSection.benchmark.toasts.failed.description", {
            error: result.error,
          }),
          variant: "destructive",
        });
        return;
      }
      setBenchResult({
        stats: result.stats,
        audioDurationSec: result.audioDurationSec,
        rtfMedian: result.rtfMedian,
        transcript: result.transcript,
        route: result.route,
        model: result.model,
        language: result.language,
      });
    } catch (error) {
      logger.error("Benchmark failed", { error }, "developer");
      toast({
        title: t("developerSection.benchmark.toasts.failed.title"),
        description: t("developerSection.benchmark.toasts.failed.description", {
          error: error instanceof Error ? error.message : String(error),
        }),
        variant: "destructive",
      });
    } finally {
      unsubscribe();
      setBenchStatus(null);
      setBenchRunning(false);
    }
  };

  const handleCopyPath = async () => {
    if (!logPath) return;

    try {
      await navigator.clipboard.writeText(logPath);
      setCopiedPath(true);
      toast({
        title: t("developerSection.toasts.copied.title"),
        description: t("developerSection.toasts.copied.description"),
        variant: "success",
        duration: 2000,
      });
      setTimeout(() => setCopiedPath(false), 2000);
    } catch (error) {
      toast({
        title: t("developerSection.toasts.copyFailed.title"),
        description: t("developerSection.toasts.copyFailed.description"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
          {t("developerSection.title")}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {t("developerSection.description")}
        </p>
      </div>

      {/* Debug Toggle */}
      <div className="rounded-xl border border-border/60 dark:border-border-subtle bg-card dark:bg-surface-2 divide-y divide-border/40 dark:divide-border-subtle">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-foreground">
                  {t("developerSection.debugMode.label")}
                </p>
                <div
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    debugEnabled ? "bg-success" : "bg-muted-foreground/30"
                  }`}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {debugEnabled
                  ? t("developerSection.debugMode.enabledDescription")
                  : t("developerSection.debugMode.disabledDescription")}
              </p>
            </div>
            <div className="shrink-0">
              <Toggle
                checked={debugEnabled}
                onChange={handleToggleDebug}
                disabled={isLoading || isToggling}
              />
            </div>
          </div>
        </div>

        {/* Log Path — only when active */}
        {debugEnabled && logPath && (
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">
              {t("developerSection.currentLogFile")}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-muted-foreground font-mono break-all leading-relaxed bg-muted/30 dark:bg-surface-raised/30 px-3 py-2 rounded-lg border border-border/30">
                {logPath}
              </code>
              <Button
                onClick={handleCopyPath}
                variant="ghost"
                size="sm"
                className="shrink-0 h-8 w-8 p-0"
              >
                {copiedPath ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        {debugEnabled && (
          <div className="px-5 py-4">
            <Button onClick={handleOpenLogsFolder} variant="outline" size="sm" className="w-full">
              <FolderOpen className="mr-2 h-3.5 w-3.5" />
              {t("developerSection.openLogsFolder")}
            </Button>
          </div>
        )}
      </div>

      {/* Transcription benchmark */}
      <div>
        <div className="mb-5">
          <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
            {t("developerSection.benchmark.title")}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {t("developerSection.benchmark.description")}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 dark:border-border-subtle bg-card dark:bg-surface-2">
          <div className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              <span className="text-muted-foreground">
                {t("developerSection.benchmark.activeProvider")}
              </span>
              <span className="font-mono text-foreground">{activeProviderLabel}</span>
              <span className="text-muted-foreground">
                {t("developerSection.benchmark.activeModel")}
              </span>
              <span className="font-mono text-foreground break-all">{activeModel || "—"}</span>
              <span className="text-muted-foreground">
                {t("developerSection.benchmark.activeLanguage")}
              </span>
              <span className="font-mono text-foreground">{preferredLanguage || "auto"}</span>
              <span className="text-muted-foreground">
                {t("developerSection.benchmark.activeDictionary")}
              </span>
              <span className="font-mono text-foreground">{customDictionary.length}</span>
            </div>

            {!useLocalWhisper && (
              <p className="text-xs text-warning leading-relaxed">
                {t("developerSection.benchmark.cloudWarning")}
              </p>
            )}

            <Button
              onClick={handleRunBenchmark}
              variant="outline"
              size="sm"
              disabled={benchRunning || !useLocalWhisper}
              className="w-full"
            >
              <Gauge className="mr-2 h-3.5 w-3.5" />
              {benchRunning
                ? t("developerSection.benchmark.runningButton")
                : t("developerSection.benchmark.runButton")}
            </Button>

            {benchStatus && (
              <p className="text-xs text-muted-foreground font-mono">{benchStatus}</p>
            )}

            {benchResult && (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                    {t("developerSection.benchmark.resultsTitle")}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground truncate">
                    {benchResult.route} · {benchResult.model || "—"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("developerSection.benchmark.median")}
                    </span>
                    <span className="font-mono">{benchResult.stats.median.toFixed(0)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("developerSection.benchmark.mean")}
                    </span>
                    <span className="font-mono">{benchResult.stats.mean.toFixed(0)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("developerSection.benchmark.min")}
                    </span>
                    <span className="font-mono">{benchResult.stats.min.toFixed(0)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("developerSection.benchmark.max")}
                    </span>
                    <span className="font-mono">{benchResult.stats.max.toFixed(0)} ms</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/30 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t("developerSection.benchmark.rtf")}
                    </span>
                    <span className="font-mono">{benchResult.rtfMedian.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">&nbsp;</span>
                    <span className="font-mono text-success">
                      {t("developerSection.benchmark.speedup", {
                        x: (1 / benchResult.rtfMedian).toFixed(2),
                      })}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/30">
                  <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">
                    {t("developerSection.benchmark.transcript")}
                  </p>
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    "{benchResult.transcript}"
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* What gets logged */}
      <div>
        <div className="mb-5">
          <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
            {t("developerSection.whatGetsLogged.title")}
          </h3>
        </div>
        <div className="rounded-xl border border-border/60 dark:border-border-subtle bg-card dark:bg-surface-2">
          <div className="px-5 py-4">
            <div
              className={`grid gap-y-2 ${isCompact ? "grid-cols-1 gap-x-0" : "grid-cols-2 gap-x-6"}`}
            >
              {[
                t("developerSection.whatGetsLogged.items.audioProcessing"),
                t("developerSection.whatGetsLogged.items.apiRequests"),
                t("developerSection.whatGetsLogged.items.ffmpegOperations"),
                t("developerSection.whatGetsLogged.items.systemDiagnostics"),
                t("developerSection.whatGetsLogged.items.transcriptionPipeline"),
                t("developerSection.whatGetsLogged.items.errorDetails"),
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-muted-foreground/30 shrink-0" />
                  <span className="text-xs text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Performance note — conditional */}
      {debugEnabled && (
        <div className="rounded-xl border border-warning/20 bg-warning/5 dark:bg-warning/10">
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-warning">
                {t("developerSection.performanceNote.label")}
              </span>{" "}
              {t("developerSection.performanceNote.description")}
            </p>
          </div>
        </div>
      )}

      {/* Sharing instructions — conditional */}
      {debugEnabled && (
        <div>
          <div className="mb-5">
            <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
              {t("developerSection.sharing.title")}
            </h3>
          </div>
          <div className="rounded-xl border border-border/60 dark:border-border-subtle bg-card dark:bg-surface-2">
            <div className="px-5 py-4">
              <div className="space-y-2">
                {[
                  t("developerSection.sharing.steps.0"),
                  t("developerSection.sharing.steps.1"),
                  t("developerSection.sharing.steps.2"),
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="shrink-0 text-xs font-mono text-muted-foreground/40 mt-0.5 w-4 text-right">
                      {i + 1}
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground/40 mt-4 pt-3 border-t border-border/20">
                {t("developerSection.sharing.footer")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
