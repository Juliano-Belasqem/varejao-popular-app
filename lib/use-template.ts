"use client";
import { useCallback, useEffect, useState } from "react";
import {
  defaultTemplate,
  type TemplateConfig,
  type TemplateId,
} from "./template-config";

export function useTemplate(id: TemplateId) {
  const [config, setConfig] = useState<TemplateConfig>(() =>
    defaultTemplate(id),
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setReady(false);
      try {
        const response = await fetch(`/api/templates?id=${id}`, {
          cache: "no-store",
          signal,
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Falha ao carregar template.");
        if (signal?.aborted) return;
        setConfig(data.config);
        setCanEdit(data.canEdit);
        setError(null);
        setReady(true);
      } catch (e) {
        if (!signal?.aborted) {
          setError(
            e instanceof Error ? e.message : "Falha ao carregar template.",
          );
          setReady(false);
        }
      }
    },
    [id],
  );
  useEffect(() => {
    const controller = new AbortController();
    setConfig(defaultTemplate(id));
    void load(controller.signal);
    return () => controller.abort();
  }, [id, load]);
  return {
    config,
    setConfig,
    ready: ready && config.id === id,
    error,
    canEdit,
    reload: load,
  };
}
