export type VisualElementType = "text" | "image" | "shape" | "barcode" | "group";

export type VisualTransform = {
  x:number; y:number; width:number; height:number;
  rotation:number; opacity:number; layer:number;
};

export type VisualTextStyle = {
  fontFamily?:string; fontSize?:number; fontWeight?:number;
  fontStyle?:"normal"|"italic"; textAlign?:"left"|"center"|"right";
  color?:string; letterSpacing?:number; lineHeight?:number;
  strokeColor?:string; strokeWidth?:number;
  shadowColor?:string; shadowBlur?:number; shadowX?:number; shadowY?:number;
};

export type VisualElement = {
  id:string;
  type:VisualElementType;
  name:string;
  visible:boolean;
  locked:boolean;
  transform:VisualTransform;
  binding?:string;
  text?:string;
  textStyle?:VisualTextStyle;
  source?:string;
  fit?:"contain"|"cover"|"fill";
  shape?:{kind:"rectangle"|"ellipse"|"line";fill:string;stroke:string;strokeWidth:number;borderRadius?:number};
  children?:string[];
};

export type VisualDocument = {
  version:1;
  name:string;
  width:number;
  height:number;
  unit:"px"|"mm";
  background:{color:string;image?:string};
  elements:VisualElement[];
};

export const visualBindings = [
  "product.name","product.brand","product.specification","product.ean","product.image",
  "offer.normalPrice","offer.price","offer.priceReais","offer.priceCents","offer.unit",
  "offer.startsOn","offer.endsOn","campaign.name","brand.logo",
] as const;

export function createVisualDocument(name="Novo template",width=1080,height=1080):VisualDocument{
  return {version:1,name,width,height,unit:"px",background:{color:"#ffffff"},elements:[]};
}

function finite(value:number){return typeof value==="number"&&Number.isFinite(value)}

export function validateVisualDocument(value:unknown):VisualDocument{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Documento visual inválido.");
  const doc=value as VisualDocument;
  if(doc.version!==1||!doc.name?.trim()||!finite(doc.width)||!finite(doc.height)||doc.width<=0||doc.height<=0||!["px","mm"].includes(doc.unit))throw new Error("Prancheta inválida.");
  if(!doc.background||!/^#[0-9a-f]{6}$/i.test(doc.background.color)||!Array.isArray(doc.elements))throw new Error("Estrutura visual inválida.");
  const ids=new Set<string>();
  for(const el of doc.elements){
    if(!el?.id||ids.has(el.id)||!["text","image","shape","barcode","group"].includes(el.type))throw new Error("Elemento visual inválido.");
    ids.add(el.id);
    const t=el.transform;
    if(!t||![t.x,t.y,t.width,t.height,t.rotation,t.opacity,t.layer].every(finite)||t.width<=0||t.height<=0||t.opacity<0||t.opacity>1)throw new Error(`Transformação inválida: ${el.name||el.id}.`);
    if(typeof el.visible!=="boolean"||typeof el.locked!=="boolean")throw new Error(`Estado inválido: ${el.name||el.id}.`);
  }
  for(const el of doc.elements)for(const child of el.children??[])if(!ids.has(child))throw new Error(`Grupo com referência inválida: ${el.name}.`);
  return doc;
}

export function resolveBinding(binding:string|undefined,data:Record<string,unknown>):unknown{
  if(!binding)return undefined;
  return binding.split(".").reduce<unknown>((current,key)=>current&&typeof current==="object"?(current as Record<string,unknown>)[key]:undefined,data);
}
