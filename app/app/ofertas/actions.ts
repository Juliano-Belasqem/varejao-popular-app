"use server";

import { revalidatePath } from "next/cache";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseMoney } from "@/lib/money";

function money(value:FormDataEntryValue|null){return parseMoney(value)}
function text(value:FormDataEntryValue|null){const v=String(value??"").trim();return v||null}

export async function createOffer(formData:FormData){
  const profile=await requireProfile();
  if(!canEdit(profile.role))throw new Error("Sem permissão.");
  const productId=String(formData.get("product_id")??"");
  const offerPrice=money(formData.get("offer_price"));
  if(!productId||offerPrice===null)throw new Error("Produto e preço de oferta são obrigatórios.");
  const supabase=await createClient();
  const {error}=await supabase.from("offers").insert({
    product_id:productId,
    campaign_id:text(formData.get("campaign_id")),
    normal_price:money(formData.get("normal_price")),
    offer_price:offerPrice,
    unit:text(formData.get("unit")),
    starts_on:text(formData.get("starts_on")),
    ends_on:text(formData.get("ends_on")),
    notes:text(formData.get("notes")),
    created_by:profile.id,
    updated_by:profile.id,
  });
  if(error)throw new Error(error.message);
  revalidatePath("/app/ofertas");
}

export async function setOfferActive(formData:FormData){
  const profile=await requireProfile();
  if(!canEdit(profile.role))throw new Error("Sem permissão.");
  const id=String(formData.get("id")??"");
  const active=String(formData.get("active"))==="true";
  const supabase=await createClient();
  const {error}=await supabase.from("offers").update({active,updated_by:profile.id,updated_at:new Date().toISOString()}).eq("id",id);
  if(error)throw new Error(error.message);
  revalidatePath("/app/ofertas");
}
