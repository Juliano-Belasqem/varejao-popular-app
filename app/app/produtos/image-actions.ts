"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { downloadRemoteImage } from "@/lib/remote-image";
import { isRasterBytes } from "@/lib/raster-file";

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
  const { supabase } = await editorContext();
  const { bytes, contentType, finalUrl } = await downloadRemoteImage(sourceUrl);
  const storagePath = `${productId}/${Date.now()}-${prefix}-${crypto.randomUUID()}.${imageExtension(contentType)}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(storagePath, bytes, { contentType, upsert: false });
  if (uploadError) throw new Error(`Falha ao salvar a imagem: ${uploadError.message}`);

  const { error: insertError } = await supabase.rpc("register_product_image", {
    p_product_id: productId,
    p_storage_path: storagePath,
    p_source: source,
    p_source_url: recordedSourceUrl || finalUrl,
  });

  if (insertError) {
    await supabase.storage.from("product-images").remove([storagePath]);
    throw new Error(insertError.message);
  }

  revalidatePath("/app/produtos");
  revalidatePath(`/app/produtos/${productId}`);
}

export async function uploadProductImage(formData: FormData) {
  const { supabase } = await editorContext();
  const productId = String(formData.get("product_id") ?? "");
  const file = formData.get("file");

  if (!productId) throw new Error("Produto inválido.");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione uma imagem.");
  if (file.size > 4 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 4 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Use uma imagem JPG, PNG ou WEBP.");
  }

  const extension = imageExtension(file.type);
  const storagePath = `${productId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  if(!isRasterBytes(bytes,file.type))throw new Error("O arquivo não contém uma imagem válida.");

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(`Falha ao enviar a imagem: ${uploadError.message}`);

  const { error: insertError } = await supabase.rpc("register_product_image", {
    p_product_id: productId,
    p_storage_path: storagePath,
    p_source: "manual",
    p_source_url: null,
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

  const { error } = await supabase.rpc("set_product_primary_image", {p_product_id:productId,p_image_id:imageId});
  if (error) throw new Error(error.message);

  revalidatePath("/app/produtos");
  revalidatePath(`/app/produtos/${productId}`);
}

export async function removeProductImage(formData: FormData) {
  const { supabase } = await editorContext();
  const productId = String(formData.get("product_id") ?? "");
  const imageId = String(formData.get("image_id") ?? "");
  if (!productId || !imageId) throw new Error("Imagem inválida.");

  const {data:path,error}=await supabase.rpc("remove_product_image",{p_product_id:productId,p_image_id:imageId});
  if(error)throw new Error(error.message);
  if(path){
    const {error:storageError}=await supabase.storage.from("product-images").remove([path]);
    if(storageError)console.error("Product image cleanup failed",storageError.message);
  }

  revalidatePath("/app/produtos");
  revalidatePath(`/app/produtos/${productId}`);
}
