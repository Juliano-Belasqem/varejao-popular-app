"use client";
import { useRef, useState } from "react";
import {
  defaultTemplate,
  fieldLabels,
  validateLayout,
  type TemplateConfig,
  type LayoutField,
} from "@/lib/template-config";

async function normalizeBackground(
  file: File,
  quarter: boolean,
): Promise<File> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("O arquivo deve ter até 20 MB.");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
    try {
      const pdf = await task.promise;
      if (pdf.numPages !== 1)
        throw new Error("Use um PDF com uma única página.");
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(2400 / base.width, 3200 / base.height),
      });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    } finally {
      await task.destroy();
    }
  } else {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      throw new Error("Use PNG, JPG, WebP ou PDF.");
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / bitmap.width, 3200 / bitmap.height);
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
  }
  const output = document.createElement("canvas");
  output.width = quarter ? Math.floor(canvas.width / 2) : canvas.width;
  output.height = quarter ? Math.floor(canvas.height / 2) : canvas.height;
  output
    .getContext("2d")!
    .drawImage(
      canvas,
      0,
      0,
      output.width,
      output.height,
      0,
      0,
      output.width,
      output.height,
    );
  const blob = await new Promise<Blob>((resolve, reject) =>
    output.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao converter fundo."))),
      "image/png",
    ),
  );
  if (blob.size > 4 * 1024 * 1024)
    throw new Error("O fundo convertido excede 4 MB. Reduza a resolução.");
  return new File([blob], "template.png", { type: "image/png" });
}

export function TemplateEditor({
  config,
  onChange,
  onSaved,
  canEdit,
  ready,
}: {
  config: TemplateConfig;
  onChange: (config: TemplateConfig) => void;
  onSaved: () => Promise<void>;
  canEdit: boolean;
  ready: boolean;
}) {
  const [selected, setSelected] = useState(Object.keys(config.layout)[0]);
  const [file, setFile] = useState<File | null>(null);
  const [resetBackground, setResetBackground] = useState(false);
  const [quarter, setQuarter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const visualRef = useRef<HTMLDivElement>(null);
  const key =
    selected in config.layout ? selected : Object.keys(config.layout)[0];
  const field = config.layout[key];
  function patch(values: Partial<LayoutField>) {
    onChange({
      ...config,
      layout: { ...config.layout, [key]: { ...field, ...values } },
    });
  }
  function startDrag(event: React.PointerEvent<HTMLDivElement>, dragKey: string, resize = false) {
    if (!canEdit || !ready) return;
    event.preventDefault();
    setSelected(dragKey);
    const startX = event.clientX;
    const startY = event.clientY;
    const start = config.layout[dragKey];
    const rect = visualRef.current?.getBoundingClientRect();
    if (!rect) return;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => {
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100;
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100;
      if (resize) {
        const width = Math.max(2, Math.min(100 - start.x, start.width + dx));
        const height = Math.max(2, Math.min(100 - start.y, start.height + dy));
        onChange({ ...config, layout: { ...config.layout, [dragKey]: { ...start, width, height } } });
      } else {
        const x = Math.max(0, Math.min(100 - start.width, start.x + dx));
        const y = Math.max(0, Math.min(100 - start.height, start.y + dy));
        onChange({ ...config, layout: { ...config.layout, [dragKey]: { ...start, x, y } } });
      }
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  }
  async function upload(input: File) {
    setBusy(true);
    setStatus("Preparando fundo...");
    try {
      const normalized = await normalizeBackground(input, quarter);
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Falha na leitura."));
        reader.readAsDataURL(normalized);
      });
      setFile(normalized);
      setResetBackground(false);
      onChange({ ...config, backgroundUrl: url });
      setStatus("Fundo preparado. Salve para aplicar a todos os usuários.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      const layout = validateLayout(config.id, config.layout);
      const form = new FormData();
      form.set("id", config.id);
      form.set("revision", String(config.revision));
      form.set("layout", JSON.stringify(layout));
      form.set("resetBackground", String(resetBackground));
      if (file) form.set("file", file);
      const response = await fetch("/api/templates", {
        method: "PUT",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao salvar.");
      setFile(null);
      setResetBackground(false);
      await onSaved();
      setStatus("Template salvo. Fundo e posições persistidos.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="card no-print" style={{ marginBottom: 18 }}>
      <summary>Configurar template e campos</summary>
      <p className="muted">
        Troque apenas o fundo ou ajuste os campos separadamente. As alterações
        aparecem na prévia; salve para usar nas próximas artes.
      </p>
      <fieldset
        disabled={!canEdit || !ready || busy}
        style={{ border: 0, padding: 0, minWidth: 0 }}
      >
        {config.id === "validity" && (
          <label>
            <input
              type="checkbox"
              checked={quarter}
              onChange={(e) => setQuarter(e.target.checked)}
            />{" "}
            Arquivo A4 com 4 peças iguais: usar o quadrante superior esquerdo
          </label>
        )}
        <label className="field">
          Substituir fundo (PNG, JPG, WebP ou PDF de uma página)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(e) => {
              const input = e.target.files?.[0];
              if (input) void upload(input);
              e.target.value = "";
            }}
          />
        </label>
        <div
          ref={visualRef}
          aria-label="Editor visual do template mestre"
          style={{
            position: "relative", width: "100%", maxWidth: 720, margin: "18px auto",
            aspectRatio: config.id === "digital-story" ? "9 / 16" : "1 / 1",
            overflow: "hidden", borderRadius: 12, border: "1px solid var(--line)",
            background: config.backgroundUrl ? `url("${config.backgroundUrl}") center/cover no-repeat` : "rgba(255,255,255,.04)",
            touchAction: "none",
          }}
        >
          {Object.entries(config.layout).filter(([, item]) => item.visible).map(([name, item]) => (
            <div
              key={name}
              onPointerDown={(event) => startDrag(event, name)}
              onClick={() => setSelected(name)}
              title={fieldLabels[name]}
              style={{
                position: "absolute", left: `${item.x}%`, top: `${item.y}%`,
                width: `${item.width}%`, height: `${item.height}%`,
                border: name === key ? "2px solid currentColor" : "1px dashed currentColor",
                display: "grid", placeItems: "center", cursor: canEdit ? "move" : "default",
                opacity: item.opacity ?? 1, transform: `rotate(${item.rotation ?? 0}deg)`,
                zIndex: item.layer ?? 1, color: item.color, fontWeight: item.weight,
                fontSize: "clamp(10px, 2vw, 18px)", textAlign: item.align,
                background: name === key ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.06)",
                userSelect: "none",
              }}
            >
              {fieldLabels[name]}
              {name === key && canEdit ? (
                <span
                  aria-label="Redimensionar elemento"
                  onPointerDown={(event) => { event.stopPropagation(); startDrag(event, name, true); }}
                  style={{ position:"absolute", right:-5, bottom:-5, width:12, height:12, borderRadius:3, background:"currentColor", cursor:"nwse-resize" }}
                />
              ) : null}
            </div>
          ))}
        </div>
        <p className="muted">Arraste os elementos diretamente na prévia. Os controles abaixo permitem ajuste fino.</p>
        <div className="form-grid compact" style={{ marginTop: 16 }}>
          <label className="field">
            Campo
            <select
              aria-label="Campo"
              className="input"
              value={key}
              onChange={(e) => setSelected(e.target.value)}
            >
              {Object.keys(config.layout).map((name) => (
                <option key={name} value={name}>
                  {fieldLabels[name]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={field.visible}
              onChange={(e) => patch({ visible: e.target.checked })}
            />{" "}
            Mostrar campo
          </label>
          {(
            [
              ["x", "Posição X (%)"],
              ["y", "Posição Y (%)"],
              ["width", "Largura (%)"],
              ["height", "Altura (%)"],
              ["fontSize", "Tamanho da fonte"],
            ] as const
          ).map(([name, label]) => (
            <label className="field" key={name}>
              {label}
              <input
                className="input"
                type="number"
                min={name === "fontSize" ? 8 : 0}
                max={name === "fontSize" ? 500 : 100}
                step="0.5"
                value={field[name]}
                onChange={(e) => patch({ [name]: Number(e.target.value) })}
              />
            </label>
          ))}
          <label className="field">
            Alinhamento
            <select
              className="input"
              value={field.align}
              onChange={(e) =>
                patch({ align: e.target.value as LayoutField["align"] })
              }
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </label>
          <label className="field">
            Peso
            <select
              className="input"
              value={field.weight}
              onChange={(e) => patch({ weight: Number(e.target.value) })}
            >
              {[400, 500, 600, 700, 800, 900].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Opacidade
            <input className="input" type="number" min="0" max="1" step="0.05" value={field.opacity ?? 1} onChange={(e) => patch({ opacity: Number(e.target.value) })} />
          </label>
          <label className="field">
            Rotação (°)
            <input className="input" type="number" min="-180" max="180" step="1" value={field.rotation ?? 0} onChange={(e) => patch({ rotation: Number(e.target.value) })} />
          </label>
          <label className="field">
            Camada
            <input className="input" type="number" min="0" max="100" step="1" value={field.layer ?? 1} onChange={(e) => patch({ layer: Number(e.target.value) })} />
          </label>
          <label className="field">
            Cor
            <input
              type="color"
              value={field.color}
              onChange={(e) => patch({ color: e.target.value })}
            />
          </label>
        </div>
        <div className="preview-actions" style={{ marginTop: 16 }}>
          <button
            className="btn primary"
            type="button"
            onClick={() => void save()}
          >
            Salvar template
          </button>
          <button
            className="btn"
            type="button"
            onClick={() =>
              onChange({ ...config, layout: defaultTemplate(config.id).layout })
            }
          >
            Restaurar posições
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setFile(null);
              setResetBackground(true);
              onChange({ ...config, backgroundUrl: null });
            }}
          >
            Restaurar fundo padrão
          </button>
        </div>
      </fieldset>
      {!canEdit && ready && (
        <p className="muted">
          Somente administradores e editores podem alterar o template.
        </p>
      )}
      <p role="status">{status}</p>
    </details>
  );
}
