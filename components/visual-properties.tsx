"use client";
import {
  visualBindings,
  type VisualElement,
  type VisualPage,
} from "@/lib/visual-engine";

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        type="number"
        value={Number(value.toFixed(4))}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (
            Number.isFinite(v) &&
            !(min !== undefined && v < min) &&
            !(max !== undefined && v > max)
          )
            onChange(v);
        }}
      />
    </label>
  );
}
export function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="visual-color">
        <input
          aria-label={label}
          type="color"
          value={/^#[\da-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          aria-pressed={value === "transparent"}
          onClick={() =>
            onChange(value === "transparent" ? "#000000" : "transparent")
          }
        >
          Transparente
        </button>
      </div>
    </label>
  );
}
export function PageProperties({
  page,
  patch,
  upload,
  disabled,
}: {
  page: VisualPage;
  patch: (p: Partial<VisualPage>) => void;
  upload: (file: File, target: "background" | "image") => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="visual-fields">
      <TextField
        label="Nome da prancheta"
        value={page.name}
        onChange={(name) => patch({ name })}
      />
      <label className="field">
        <span>Formato</span>
        <select
          aria-label="Formato"
          className="input"
          defaultValue=""
          onChange={(e) => {
            const [width, height, unit] = e.target.value.split(",");
            if (width)
              patch({
                width: Number(width),
                height: Number(height),
                unit: unit as "px" | "mm",
              });
          }}
        >
          <option value="">Personalizado</option>
          <option value="1080,1080,px">Feed · 1080 × 1080</option>
          <option value="1080,1920,px">Story · 1080 × 1920</option>
          <option value="210,297,mm">A4 · retrato</option>
          <option value="297,210,mm">A4 · paisagem</option>
          <option value="105,148.5,mm">¼ A4 · validade</option>
        </select>
      </label>
      <div className="visual-pair">
        <NumberField
          label="Largura da prancheta"
          min={0.1}
          value={page.width}
          onChange={(width) => patch({ width })}
        />
        <NumberField
          label="Altura da prancheta"
          min={0.1}
          value={page.height}
          onChange={(height) => patch({ height })}
        />
      </div>
      <label className="field">
        <span>Unidade da prancheta</span>
        <select
          aria-label="Unidade da prancheta"
          className="input"
          value={page.unit}
          onChange={(e) => patch({ unit: e.target.value as "px" | "mm" })}
        >
          <option value="px">Pixels</option>
          <option value="mm">Milímetros</option>
        </select>
      </label>
      <label className="field">
        <span>Cor do fundo</span>
        <input
          aria-label="Cor do fundo"
          type="color"
          value={page.background.color}
          onChange={(e) =>
            patch({ background: { ...page.background, color: e.target.value } })
          }
        />
      </label>
      <label className="field">
        <span>Enviar fundo</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file, "background");
            e.target.value = "";
          }}
        />
      </label>
      {page.background.image && (
        <button
          className="btn"
          onClick={() =>
            patch({ background: { color: page.background.color } })
          }
        >
          Remover fundo
        </button>
      )}
      <p className="muted">
        O fundo é independente dos campos. PNG, JPEG ou WebP, até 4 MB por
        arquivo.
      </p>
    </fieldset>
  );
}

export function ElementProperties({
  element: e,
  patch,
  disabled,
  upload,
  fonts,
}: {
  element: VisualElement;
  patch: (value: Partial<VisualElement>) => void;
  disabled: boolean;
  upload: (file: File, target: "background" | "image") => void;
  fonts: { family: string; name: string }[];
}) {
  const t = e.transform,
    s = e.textStyle ?? {},
    d = e.decoration ?? {},
    shape = e.shape ?? {
      kind: "rectangle" as const,
      fill: "#ffffff",
      stroke: "#111111",
      strokeWidth: 1,
    };
  return (
    <>
      <div className="visual-pair">
        <label>
          <input
            type="checkbox"
            checked={e.visible}
            disabled={disabled}
            onChange={(event) => patch({ visible: event.target.checked })}
          />{" "}
          Visível
        </label>
        <label>
          <input
            type="checkbox"
            checked={e.locked}
            disabled={disabled}
            onChange={(event) => patch({ locked: event.target.checked })}
          />{" "}
          Bloqueado
        </label>
      </div>
      <fieldset disabled={disabled || e.locked} className="visual-fields">
        <TextField
          label="Nome do elemento"
          value={e.name}
          onChange={(name) => patch({ name })}
        />
        <details className="visual-property-section" open>
          <summary>Transformação</summary>
          <div className="visual-pair">
          {(
            [
              ["x", "Posição X"],
              ["y", "Posição Y"],
              ["width", "Largura"],
              ["height", "Altura"],
              ["rotation", "Rotação"],
              ["opacity", "Opacidade"],
              ["skewX", "Inclinação X"],
              ["skewY", "Inclinação Y"],
              ["scaleX", "Escala X"],
              ["scaleY", "Escala Y"],
            ] as const
          ).map(([key, label]) => (
            <NumberField
              key={key}
              label={label}
              value={t[key] ?? (key.startsWith("scale") ? 1 : 0)}
              min={
                key === "opacity"
                  ? 0
                  : ["width", "height", "scaleX", "scaleY"].includes(key)
                    ? 0.1
                    : key.startsWith("skew")
                      ? -88
                      : undefined
              }
              max={
                key === "opacity" ? 1 : key.startsWith("skew") ? 88 : undefined
              }
              step={key === "opacity" ? 0.05 : 0.1}
              onChange={(value) => patch({ transform: { ...t, [key]: value } })}
            />
          ))}
          </div>
        </details>
        {e.type !== "group" && e.type !== "shape" && (
          <details className="visual-property-section">
            <summary>Dados vinculados</summary>
          <label className="field">
            <span>Vínculo de dados</span>
            <input
              className="input"
              list="visual-bindings"
              value={e.binding ?? ""}
              onChange={(event) =>
                patch({ binding: event.target.value || undefined })
              }
            />
            <datalist id="visual-bindings">
              {visualBindings.map((binding) => (
                <option key={binding} value={binding} />
              ))}
            </datalist>
          </label>
          </details>
        )}
        {(e.type === "text" || e.type === "barcode") && (
          <details className="visual-property-section" open>
            <summary>{e.type === "barcode" ? "Código de barras" : "Texto"}</summary>
          <label className="field">
            <span>
              {e.type === "barcode"
                ? "EAN (12 ou 13 dígitos)"
                : "Texto livre / alternativa"}
            </span>
            <textarea
              aria-label={
                e.type === "barcode"
                  ? "EAN (12 ou 13 dígitos)"
                  : "Texto livre / alternativa"
              }
              className="input"
              rows={3}
              value={e.text ?? ""}
              onChange={(event) => patch({ text: event.target.value })}
            />
          </label>
          </details>
        )}
        {e.type === "text" && (
          <details className="visual-property-section" open>
            <summary>Tipografia</summary>
            <TextField
              label="Família da fonte"
              value={s.fontFamily ?? "Arial"}
              onChange={(fontFamily) =>
                patch({ textStyle: { ...s, fontFamily } })
              }
            />
            <label className="field">
              <span>Fonte do Kit da Marca</span>
              <select
                aria-label="Fonte do Kit da Marca"
                className="input"
                value={
                  fonts.some((f) => f.family === s.fontFamily)
                    ? s.fontFamily
                    : ""
                }
                onChange={(event) => {
                  if (event.target.value)
                    patch({
                      textStyle: { ...s, fontFamily: event.target.value },
                    });
                }}
              >
                <option value="">Escolher fonte</option>
                {fonts.map((font) => (
                  <option key={font.family} value={font.family}>
                    {font.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="visual-pair">
              <NumberField
                label="Tamanho da fonte"
                min={0.1}
                value={s.fontSize ?? 32}
                onChange={(fontSize) =>
                  patch({ textStyle: { ...s, fontSize } })
                }
              />
              <NumberField
                label="Peso da fonte"
                min={1}
                max={1000}
                step={100}
                value={s.fontWeight ?? 400}
                onChange={(fontWeight) =>
                  patch({ textStyle: { ...s, fontWeight } })
                }
              />
              <NumberField
                label="Espaço entre letras"
                value={s.letterSpacing ?? 0}
                onChange={(letterSpacing) =>
                  patch({ textStyle: { ...s, letterSpacing } })
                }
              />
              <NumberField
                label="Altura da linha"
                min={0.1}
                value={s.lineHeight ?? 1.15}
                onChange={(lineHeight) =>
                  patch({ textStyle: { ...s, lineHeight } })
                }
              />
            </div>
            <label>
              <input
                type="checkbox"
                checked={s.fontStyle === "italic"}
                onChange={(event) =>
                  patch({
                    textStyle: {
                      ...s,
                      fontStyle: event.target.checked ? "italic" : "normal",
                    },
                  })
                }
              />{" "}
              Itálico
            </label>
            <label className="field">
              <span>Alinhamento do texto</span>
              <select
                aria-label="Alinhamento do texto"
                className="input"
                value={s.textAlign ?? "left"}
                onChange={(event) =>
                  patch({
                    textStyle: {
                      ...s,
                      textAlign: event.target.value as
                        "left" | "center" | "right",
                    },
                  })
                }
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </label>
            <ColorField
              label="Cor do texto"
              value={s.color ?? "#111111"}
              onChange={(color) => patch({ textStyle: { ...s, color } })}
            />
            <ColorField
              label="Cor do contorno do texto"
              value={s.strokeColor ?? "transparent"}
              onChange={(strokeColor) =>
                patch({ textStyle: { ...s, strokeColor } })
              }
            />
            <NumberField
              label="Contorno do texto"
              min={0}
              value={s.strokeWidth ?? 0}
              onChange={(strokeWidth) =>
                patch({ textStyle: { ...s, strokeWidth } })
              }
            />
            <details className="visual-property-section">
              <summary>Contorno deslocado</summary>
              <div className="visual-fields">
                <ColorField
                  label="Cor do contorno deslocado"
                  value={s.offsetStrokeColor ?? "transparent"}
                  onChange={(offsetStrokeColor) => patch({ textStyle: { ...s, offsetStrokeColor } })}
                />
                <NumberField
                  label="Espessura do contorno deslocado"
                  min={0}
                  value={s.offsetStrokeWidth ?? 0}
                  onChange={(offsetStrokeWidth) => patch({ textStyle: { ...s, offsetStrokeWidth } })}
                />
                <div className="visual-pair">
                  <NumberField label="Deslocamento X" value={s.offsetStrokeX ?? 0} onChange={(offsetStrokeX) => patch({ textStyle: { ...s, offsetStrokeX } })} />
                  <NumberField label="Deslocamento Y" value={s.offsetStrokeY ?? 0} onChange={(offsetStrokeY) => patch({ textStyle: { ...s, offsetStrokeY } })} />
                </div>
                <button type="button" className="btn" onClick={() => patch({ textStyle: { ...s, offsetStrokeColor: "#667085", offsetStrokeWidth: Math.max(2, s.strokeWidth ?? 2), offsetStrokeX: 5, offsetStrokeY: 5 } })}>Aplicar efeito deslocado</button>
              </div>
            </details>
          </details>
        )}
        {e.type === "image" && (
          <details className="visual-property-section" open>
            <summary>Imagem</summary>
            <label className="field">
              <span>Enviar imagem</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload(file, "image");
                  event.target.value = "";
                }}
              />
            </label>
            <TextField
              label="Endereço da imagem"
              value={e.source ?? ""}
              onChange={(source) => patch({ source })}
            />
            <label className="field">
              <span>Enquadramento</span>
              <select
                aria-label="Enquadramento"
                className="input"
                value={e.fit ?? "contain"}
                onChange={(event) =>
                  patch({ fit: event.target.value as VisualElement["fit"] })
                }
              >
                <option value="contain">Imagem inteira</option>
                <option value="cover">Preencher e recortar</option>
                <option value="fill">Esticar</option>
              </select>
            </label>
            <NumberField
              label="Recorte horizontal (%)"
              value={(e.imagePosition?.x ?? 0.5) * 100}
              min={0}
              max={100}
              onChange={(v) =>
                patch({
                  imagePosition: { x: v / 100, y: e.imagePosition?.y ?? 0.5 },
                })
              }
            />
            <NumberField
              label="Recorte vertical (%)"
              value={(e.imagePosition?.y ?? 0.5) * 100}
              min={0}
              max={100}
              onChange={(v) =>
                patch({
                  imagePosition: { x: e.imagePosition?.x ?? 0.5, y: v / 100 },
                })
              }
            />
          </details>
        )}
        {e.type === "shape" && (
          <details className="visual-property-section" open>
            <summary>Forma</summary>
            <label className="field">
              <span>Forma</span>
              <select
                aria-label="Forma"
                className="input"
                value={shape.kind}
                onChange={(event) =>
                  patch({
                    shape: {
                      ...shape,
                      kind: event.target.value as typeof shape.kind,
                    },
                  })
                }
              >
                <option value="rectangle">Retângulo</option>
                <option value="ellipse">Elipse</option>
                <option value="line">Linha</option>
              </select>
            </label>
            <ColorField
              label="Preenchimento da forma"
              value={shape.fill}
              onChange={(fill) => patch({ shape: { ...shape, fill } })}
            />
            <ColorField
              label="Contorno da forma"
              value={shape.stroke}
              onChange={(stroke) => patch({ shape: { ...shape, stroke } })}
            />
            <NumberField
              label="Espessura da forma"
              min={0}
              value={shape.strokeWidth}
              onChange={(strokeWidth) =>
                patch({ shape: { ...shape, strokeWidth } })
              }
            />
            <NumberField
              label="Cantos da forma"
              min={0}
              value={shape.borderRadius ?? 0}
              onChange={(borderRadius) =>
                patch({ shape: { ...shape, borderRadius } })
              }
            />
          </details>
        )}
        <details className="visual-property-section">
          <summary>Fundo, borda e sombra</summary>
          <div className="visual-fields">
            <ColorField
              label="Fundo do elemento"
              value={d.fill ?? "transparent"}
              onChange={(fill) => patch({ decoration: { ...d, fill } })}
            />
            <ColorField
              label="Cor da borda"
              value={d.stroke ?? "transparent"}
              onChange={(stroke) => patch({ decoration: { ...d, stroke } })}
            />
            <NumberField
              label="Espessura da borda"
              min={0}
              value={d.strokeWidth ?? 0}
              onChange={(strokeWidth) =>
                patch({ decoration: { ...d, strokeWidth } })
              }
            />
            <NumberField
              label="Raio da borda"
              min={0}
              value={d.borderRadius ?? 0}
              onChange={(borderRadius) =>
                patch({ decoration: { ...d, borderRadius } })
              }
            />
            <ColorField
              label="Cor da sombra"
              value={d.shadowColor ?? s.shadowColor ?? "transparent"}
              onChange={(shadowColor) =>
                patch({ decoration: { ...d, shadowColor } })
              }
            />
            {(
              [
                ["shadowBlur", "Desfoque da sombra"],
                ["shadowX", "Sombra X"],
                ["shadowY", "Sombra Y"],
              ] as const
            ).map(([key, label]) => (
              <NumberField
                key={key}
                label={label}
                min={key === "shadowBlur" ? 0 : undefined}
                value={d[key] ?? s[key] ?? 0}
                onChange={(value) =>
                  patch({ decoration: { ...d, [key]: value } })
                }
              />
            ))}
          </div>
        </details>
      </fieldset>
    </>
  );
}
