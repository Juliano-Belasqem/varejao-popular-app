"use server";

import {revalidatePath} from "next/cache";
import {canEdit,requireProfile} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {validateVisualDocument,type VisualDocument} from "@/lib/visual-engine";

export async function saveVisualTemplate(input:{templateId?:string|null;name:string;category?:string;document:VisualDocument}){
  const profile=await requireProfile();
  if(!canEdit(profile.role))throw new Error("Sem permissão para salvar templates.");
  const document=validateVisualDocument(input.document);
  const name=input.name.trim();
  if(!name)throw new Error("Nome do template é obrigatório.");
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("save_visual_template",{
    p_template_id:input.templateId||null,
    p_name:name,
    p_category:input.category?.trim()||"custom",
    p_document:document,
    p_user_id:profile.id,
  });
  if(error)throw new Error(error.message);
  revalidatePath("/app/editor-visual");
  const saved=Array.isArray(data)?data[0]:data;
  if(!saved?.template_id||!saved?.version)throw new Error("Resposta inválida ao salvar template.");
  return {templateId:String(saved.template_id),version:Number(saved.version)};
}
