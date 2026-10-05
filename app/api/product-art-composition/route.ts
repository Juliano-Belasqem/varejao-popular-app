import {canEdit,requireProfile} from "@/lib/auth";
import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

const validFormat=(value:string|null):value is "feed"|"story"=>value==="feed"||value==="story";
const finiteNumber=(value:unknown,fallback:number)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;};
const safeImageUrl=(value:unknown)=>{
  if(typeof value!=="string"||value.length>2048)return "";
  try{
    const url=new URL(value);
    return url.protocol==="https:"||url.protocol==="http:"?url.toString():"";
  }catch{return "";}
};

export async function GET(request:Request){
  const url=new URL(request.url);
  const productId=url.searchParams.get("product_id");
  const format=url.searchParams.get("format");
  if(!productId||!validFormat(format))return NextResponse.json({error:"Parâmetros inválidos"},{status:400});
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Não autenticado"},{status:401});
  const {data,error}=await supabase.from("product_art_compositions").select("images,updated_at").eq("product_id",productId).eq("format",format).maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:503});
  return NextResponse.json({composition:data??null});
}

export async function PUT(request:Request){
  const profile=await requireProfile();
  if(!canEdit(profile.role))return NextResponse.json({error:"Sem permissão para alterar composições."},{status:403});
  const body=await request.json().catch(()=>null) as {product_id?:string;format?:string;images?:unknown}|null;
  if(!body?.product_id||!validFormat(body.format??null)||!Array.isArray(body.images))return NextResponse.json({error:"Dados inválidos"},{status:400});
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Não autenticado"},{status:401});
  const images=body.images.slice(0,12).filter((entry):entry is Record<string,unknown>=>!!entry&&typeof entry==="object"&&!Array.isArray(entry)).map((entry,index)=>({
    id:String(entry.id||`image-${index+1}`).slice(0,120),
    url:safeImageUrl(entry.url),
    label:String(entry.label||`Imagem ${index+1}`).slice(0,160),
    x:finiteNumber(entry.x,0),y:finiteNumber(entry.y,0),scale:Math.min(3,Math.max(.2,finiteNumber(entry.scale,1))),
  })).filter(entry=>entry.url);
  const {error}=await supabase.from("product_art_compositions").upsert({product_id:body.product_id,format:body.format,images,updated_by:profile.id,updated_at:new Date().toISOString()},{onConflict:"product_id,format"});
  if(error)return NextResponse.json({error:error.message},{status:503});
  return NextResponse.json({ok:true,images});
}
