"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { downloadRemoteImage } from "@/lib/remote-image";

async function editorContext() {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) throw new Error("Sem permissão para editar imagens.");
  return { profile, supabase: await createClient() };
}

function imageExtension(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function isOpenFactsImageUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "openfoodfacts.org" || host.endsWith(".openfoodfacts.org") || host === "openfoodfacts.net" || host.endsWith(".openfoodfacts.net");
  } catch {
    return false;
  }
}

function actionMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível salvar a imagem selecionada.";
}

async function saveApprovedRemoteImage({
  productId,
  sourceUrl,
  source,
  prefix,
  recordedSourceUrl,
}: {
  productId: string;
  sourceUrl: string;
  source: string;
  prefix: string;
  recordedSourceUrl?: string;
}) {
  const { profile, supabase } = await editorContext();
  const { bytes, contentType, finalUrl } = await downloadRemoteImage(sourceUrl);
  const storagePath = `${productId}/${Date.now()}-${prefix}-${crypto.randomUUID()}.${imageExtension(contentType)}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(storagePath, bytes, { contentType, upsert: false });
  if (uploadError) throw new Error(`Falha ao salvar a imagem: ${uploadError.message}`);

  await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
  const { error: insertError } = await supabase.from("product_images").insert({
    product_id: productId,
    storage_path: storagePath,
    source,
    source_url: recordedSourceUrl || finalUrl,
    approved: true,
    is_primary: true,
    created_by: profile.id,
  });

  if (insertError) {
    await supabase.storage.from("product-images").remove([storagePath]);
    throw new Error(insertError.message);
  }

  revalidatePath("/app/produtos");
  revalidatePath(`/app/produtos/${productId}`);
}

export async function uploadProductImage(formData: FormData) {
  const { profile, supabase } = await editorContext();
  const productId = String(formData.get("product_id") ?? "");
  const file = formData.get("file");

  if (!productId) throw new Error("Produto inválido.");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione uma imagem.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Use uma imagem JPG, PNG ou WEBP.");
  }

  const extension = imageExtension(file.type);
  const storagePath = `${productId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(`Falha ao enviar a imagem: ${uploadError.message}`);

  await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
  const { error: insertError } = await supabase.from("product_images").insert({
    product_id: productId,
    storage_path: storagePath,
    source: "manual",
    approved: true,
    is_primary: true,
    created_by: profile.id,
  });

  if (insertError) {
    await supabase.storage.from("product-images").remove([storagePath]);
    throw new Error(insertError.message);
  }

  revalidatePath("/app/produtos");
  revalidatePath(`/app/produtos/${productId}`);
}

export async function importOpenFactsImage(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "").trim();
  const sourceUrl = String(formData.get("source_url") ?? "").trim();

  if (!productId) throw new Error("Produto inválido.");
  if (!sourceUrl || !isOpenFactsImageUrl(sourceUrl)) throw new Error("URL de imagem do Open Facts inválida.");

  await saveApprovedRemoteImage({
    productId,
    sourceUrl,
    source: "open_food_facts",
    prefix: "open-facts",
  });
}

export async function importSerpApiImage(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "").trim();
  const sourceUrl = String(formData.get("source_url") ?? "").trim();
  const thumbnailUrl = String(formData.get("thumbnail_url") ?? "").trim();

  if (!productId) throw new Error("Produto inválido.");
  if (!sourceUrl) throw new Error("Imagem não informada.");

  let destination = `/app/produtos/${productId}`;
  try {
    try {
      await saveApprovedRemoteImage({
        productId,
        sourceUrl,
        source: "google_images",
        prefix: "google-images",
        recordedSourceUrl: sourceUrl,
      });
    } catch (originalError) {
      if (!thumbnailUrl || thumbnailUrl === sourceUrl) throw originalError;
      await saveApprovedRemoteImage({
        productId,
        sourceUrl: thumbnailUrl,
        source: "google_images",
        prefix: "google-images-fallback",
        recordedSourceUrl: sourceUrl,
      });
    }
    destination = `/app/produtos/${productId}?image_import_ok=${encodeURIComponent("Imagem salva no catálogo com sucesso.")}`;
  } catch (error) {
    destination = `/app/produtos/${productId}?image_import_error=${encodeURIComponent(actionMessage(error))}`;
  }

  redirect(destination);
}

export async function setPrimaryProductImage(formData: FormData) {
  const { supabase } = await editorContext();
  const productId = String(formData.get("product_id") ?? "");
  const imageId = String(formData.get("image_id") ?? "");
  if (!productId || !imageId) throw new Error("Imagem inválida.");

  const { error: clearError } = await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
  if (clearError) throw new Error(clearError.message);

  const { error } = await supabase.from("product_images").update({ is_primary: true, approved: true }).eq("id", imageId).eq("product_id", productId);
  if (error) throw new Error(error.message);

  revalidatePath("/app/produtos");
  revalidatePath(`/app/produtos/${productId}`);
}

export async function removeProductImage(formData: FormData) {
  const { supabase } = await editorContext();
  const productId = String(formData.get("product_id") ?? "");
  const imageId = String(formData.get("image_id") ?? "");
  if (!productId || !imageId) throw new Error("Imagem inválida.");

  const { data: image, error: imageError } = await supabase
    .from("product_images")
    .select("storage_path,is_primary")
    .eq("id", imageId)
    .eq("product_id", productId)
    .single();
  if (imageError || !image) throw new Error("Imagem não encontrada.");

  const { error: storageError } = await supabase.storage.from("product-images").remove([image.storage_path]);
  if (storageError) throw new Error(storageError.message);

  const { error } = await supabase.from("product_images").delete().eq("id", imageId).eq("product_id", productId);
  if (error) throw new Error(error.message);

  if (image.is_primary) {
    const { data: replacement } = await supabase.from("product_images").select("id").eq("product_id", productId).eq("approved", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (replacement) await supabase.from("product_images").update({ is_primary: true }).eq("id", replacement.id);
  }

  revalidatePath("/app/produtos");
  revalidatePath(`/app/produtos/${productId}`);
}
