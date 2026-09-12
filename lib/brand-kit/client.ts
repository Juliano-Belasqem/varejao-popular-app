"use client";

import { useEffect, useState } from "react";

export type BrandFieldFonts = Record<string,string>;
export type BrandFont = { id:string; name:string; family:string; url:string|null };
export type BrandKitState = {
  logoUrl: string | null;
  fieldFonts: BrandFieldFonts;
  fonts: BrandFont[];
  ready: boolean;
};

const fallbackFonts: BrandFieldFonts = {
  title:"Arial, sans-serif",
  product:"Arial, sans-serif",
  brand:"Arial, sans-serif",
  specification:"Arial, sans-serif",
  price:"Arial, sans-serif",
  validity:"Arial, sans-serif",
  body:"Arial, sans-serif",
  footer:"Arial, sans-serif",
};

export function useBrandKit(): BrandKitState {
  const [state,setState]=useState<BrandKitState>({logoUrl:null,fieldFonts:fallbackFonts,fonts:[],ready:false});

  useEffect(()=>{
    let active=true;
    void (async()=>{
      try{
        const response=await fetch("/api/brand-kit",{cache:"no-store"});
        const data=await response.json() as {settings?:{logo_url?:string|null;field_fonts?:BrandFieldFonts};fonts?:BrandFont[]};
        if(!response.ok) throw new Error("Falha ao carregar Kit da Marca");
        const fonts=data.fonts??[];
        await Promise.all(fonts.map(async font=>{
          if(!font.url)return;
          try{
            const face=new FontFace(font.family,`url(${font.url})`);
            await face.load();
            document.fonts.add(face);
          }catch{}
        }));
        if(active)setState({logoUrl:data.settings?.logo_url??null,fieldFonts:{...fallbackFonts,...(data.settings?.field_fonts??{})},fonts,ready:true});
      }catch{
        if(active)setState(current=>({...current,ready:true}));
      }
    })();
    return()=>{active=false};
  },[]);

  return state;
}
