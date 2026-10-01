import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { TemplateConfig } from "@/lib/template-config";

function FitText({children,padding=1,maxLines=1,fit=true,inkSafe=false}:{children:ReactNode;padding?:number;maxLines?:number;fit?:boolean;inkSafe?:boolean}) {
 const frame=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null);
 const [scale,setScale]=useState(1);
 const [tooLong,setTooLong]=useState(false);
 useLayoutEffect(()=>{
  const box=frame.current,inner=content.current;if(!box||!inner)return;
  const measure=()=>{
   if(!fit){setScale(1);setTooLong(false);return}
   const sx=box.clientWidth/Math.max(1,inner.scrollWidth);
   const sy=box.clientHeight/Math.max(1,inner.scrollHeight);
   const raw=Math.min(1,sx,sy);
   const next=Math.max(.55,raw);
   setTooLong(raw<.55);
   setScale(previous=>Math.abs(previous-next)>.005?next:previous);
  };
  measure();
  const observer=new ResizeObserver(measure);
  observer.observe(box);observer.observe(inner);
  void document.fonts?.ready.then(measure);
  window.addEventListener("beforeprint",measure);
  return()=>{observer.disconnect();window.removeEventListener("beforeprint",measure)};
 },[children,fit,maxLines,padding]);
 return <div ref={frame} className="configured-fit-text" title={tooLong?"Texto excede a área disponível; reduza o conteúdo ou aumente o campo.":scale<.995?"Fonte reduzida automaticamente para caber no campo.":undefined} style={{position:"relative",width:"100%",height:"100%",minWidth:0,minHeight:0,boxSizing:"border-box",padding:padding+"%",overflow:inkSafe?"visible":"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
  <div ref={content} style={{display:"block",width:maxLines===1?"max-content":"100%",maxWidth:"none",flex:"0 0 auto",whiteSpace:maxLines===1?"nowrap":"normal",overflowWrap:"normal",textAlign:"center",lineHeight:inkSafe?1.25:"inherit",paddingBlock:inkSafe?".12em":0,boxSizing:"border-box",transform:"scale("+scale+")",transformOrigin:"center center"}}>{children}</div>
  {(tooLong||scale<.995)&&<span aria-hidden="true" className={"configured-fit-indicator"+(tooLong?" configured-fit-warning":"")} title={tooLong?"Texto longo demais para leitura confortável":"Fonte ajustada automaticamente"}>{tooLong?"!":"↘"}</span>}
 </div>;
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
            overflow: key.startsWith("productLine") || key === "offerPrice" || key === "producePrice" || pairedPrice ? "visible" : "hidden",
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
                key === "price" || key === "producePrice" || key === "code" || pairedPrice ? values[key] : <FitText padding={field.padding} maxLines={field.maxLines} fit={field.fitMode!=="clip"} inkSafe={key.startsWith("productLine")}>{values[key]}</FitText>
              )}
            </div>
          );
        })}
    </article>
  );
}
