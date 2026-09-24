import type { CSSProperties, ReactNode } from "react";
import type { TemplateConfig } from "@/lib/template-config";

export function ConfiguredTicket({
  config,
  values,
  fonts,
  logoUrl,
}: {
  config: TemplateConfig;
  values: Record<string, ReactNode>;
  fonts: Record<string, string>;
  logoUrl: string | null;
}) {
  return (
    <article
      className="configured-ticket"
      style={{
        backgroundImage: config.backgroundUrl ? `url("${config.backgroundUrl}")` : config.id === "validity" ? `url("/media-templates/validity-background.png")` : "none",
      }}
    >
      {Object.entries(config.layout)
        .filter(([, field]) => field.visible)
        .map(([key, field]) => {
          const style: CSSProperties = {
            position: "absolute",
            left: `${field.x}%`,
            top: `${field.y}%`,
            width: `${field.width}%`,
            height: `${field.height}%`,
            fontSize: `${field.fontSize / 10}cqw`,
            fontFamily: field.fontFamily || fonts[key] || fonts.body,
            color: field.color,
            fontWeight: field.weight,
            fontStyle: field.fontStyle ?? "normal",
            textTransform: field.textTransform === "none" ? undefined : field.textTransform,
            textAlign: field.align,
            opacity: field.opacity ?? 1,
            transform: `rotate(${field.rotation ?? 0}deg)`,
            transformOrigin: "center center",
            zIndex: field.layer ?? 1,
            lineHeight: field.lineHeight ?? 1.05,
            letterSpacing: `${field.letterSpacing ?? 0}px`,
            overflow: key === "offerPrice" || key === "producePrice" ? "visible" : "hidden",
            overflowWrap: "anywhere",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          };
          return (
            <div key={key} style={style}>
              {key === "logo" ? (
                logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      background: "white",
                      borderRadius: "50%",
                    }}
                  />
                ) : null
              ) : (
                values[key]
              )}
            </div>
          );
        })}
    </article>
  );
}
