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
  const startsOn=text(formData.get("starts_on"));
  const endsOn=text(formData.get("ends_on"));
  if(startsOn&&endsOn&&startsOn>endsOn)throw new Error("A data final não pode ser anterior à data inicial.");
  const supabase=await createClient();
  const {error}=await supabase.rpc("create_offer_with_campaign",{
    p_product_id:productId,
    p_campaign_id:text(formData.get("campaign_id")),
    p_normal_price:money(formData.get("normal_price")),
    p_offer_price:offerPrice,
    p_unit:text(formData.get("unit")),
    p_starts_on:startsOn,
    p_ends_on:endsOn,
    p_notes:text(formData.get("notes")),
    p_user_id:profile.id,
  });
  if(error)throw new Error(error.message);
  revalidatePath("/app/ofertas");
  revalidatePath("/app/campanhas");
  const campaignId=text(formData.get("campaign_id"));
  if(campaignId)revalidatePath(`/app/campanhas/${campaignId}`);
}

export async function setOfferActive(formData:FormData){
  const profile=await requireProfile();
  if(!canEdit(profile.role))throw new Error("Sem permissão.");
  const id=String(formData.get("id")??"");
  const active=String(formData.get("active"))==="true";
  const supabase=await createClient();
  const {error}=await supabase.rpc("set_offer_active",{p_offer_id:id,p_active:active,p_user_id:profile.id});
  if(error)throw new Error(error.message);
  revalidatePath("/app/ofertas");
  revalidatePath("/app/campanhas");
}
