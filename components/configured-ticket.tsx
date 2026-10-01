import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { TemplateConfig } from "@/lib/template-config";

function FitText({children,padding=1,maxLines=1,fit=true}:{children:ReactNode;padding?:number;maxLines?:number;fit?:boolean}) {
  const ref=useRef<HTMLDivElement>(null);
  const [scale,setScale]=useState(1);
  useLayoutEffect(()=>{
    const el=ref.current;if(!el)return;
    const measure=()=>{el.style.transform="scale(1)";if(!fit){setScale(1);return}const sx=el.scrollWidth?el.clientWidth/el.scrollWidth:1;const sy=el.scrollHeight?el.clientHeight/el.scrollHeight:1;setScale(Math.max(.15,Math.min(1,sx,sy)));};
    measure();const ro=new ResizeObserver(measure);ro.observe(el);void document.fonts?.ready.then(measure);window.addEventListener("beforeprint",measure);return()=>{ro.disconnect();window.removeEventListener("beforeprint",measure)};
  },[children,fit,maxLines,padding]);
  return <div ref={ref} className="configured-fit-text" style={{transform:`scale(${scale})`,transformOrigin:"center center",width:"100%",height:"100%",boxSizing:"border-box",padding:`${padding}%`,display:"-webkit-box",WebkitBoxOrient:"vertical",WebkitLineClamp:maxLines,whiteSpace:maxLines===1?"nowrap":"normal",alignItems:"center",justifyContent:"inherit",overflow:"hidden"}}>{children}</div>;
}

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
          const cents=config.layout.physicalPriceCents;
          const pairedPrice=key==="physicalPriceReais"&&!!cents;
          const style: CSSProperties = {
            position: "absolute",
            left: `${field.x}%`,
            top: `${field.y}%`,
            width: `${pairedPrice?Math.max(field.width,cents!.x+cents!.width-field.x):field.width}%`,
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
            overflow: key === "offerPrice" || key === "producePrice" || pairedPrice ? "visible" : "hidden",
            overflowWrap: "anywhere",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          };
          if(key==="physicalPriceCents"&&values.physicalPriceReais!=null)return null;
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
                key === "price" || key === "producePrice" || key === "code" || pairedPrice ? values[key] : <FitText padding={field.padding} maxLines={field.maxLines} fit={field.fitMode!=="clip"}>{values[key]}</FitText>
              )}
            </div>
          );
        })}
    </article>
  );
}
