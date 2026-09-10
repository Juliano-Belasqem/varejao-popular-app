"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function safeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "arquivo";
}

function uploadRules(network: string, type: string) {
  if (network === "instagram") {
    if (type === "carousel") return { accept: "image/*", multiple: true, maxItems: 10, allowImage: true, allowVideo: false, help: "Use de 2 a 10 imagens no carrossel do Instagram." };
    if (type === "reel") return { accept: "video/mp4,.mp4", multiple: false, maxItems: 1, allowImage: false, allowVideo: true, help: "Use exatamente 1 vídeo MP4 no Reel do Instagram." };
    return { accept: "image/*", multiple: false, maxItems: 1, allowImage: true, allowVideo: false, help: `Use exatamente 1 imagem no ${type === "story" ? "Story" : "Feed"} do Instagram.` };
  }

  if (type === "story") return { accept: "image/*,video/mp4,.mp4", multiple: false, maxItems: 1, allowImage: true, allowVideo: true, help: "Use exatamente 1 imagem ou 1 vídeo MP4 no Story do Facebook." };
  if (type === "reel") return { accept: "video/mp4,.mp4", multiple: false, maxItems: 1, allowImage: false, allowVideo: true, help: "Use exatamente 1 vídeo MP4 no Reel do Facebook." };
  return { accept: "image/*", multiple: false, maxItems: 1, allowImage: true, allowVideo: false, help: "Use exatamente 1 imagem no Feed do Facebook." };
}

export default function DirectMediaUploader({
  publicationId,
  campaignId,
  currentCount,
  network,
  type,
}: {
  publicationId: string;
  campaignId: string | null;
  currentCount: number;
  network: string;
  type: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const rules = uploadRules(network, type);

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    if (currentCount + files.length > rules.maxItems) {
      setMessage(rules.help);
      return;
    }

    setBusy(true);
    setMessage(`Enviando ${files.length} arquivo(s)...`);
    const supabase = createClient();
    const prefix = campaignId || "sem-campanha";

    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const isVideo = file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");
        const isImage = file.type.startsWith("image/");

        if (isVideo && !rules.allowVideo) throw new Error("Este tipo de publicação aceita apenas imagem.");
        if (isImage && !rules.allowImage) throw new Error("Este tipo de publicação aceita apenas vídeo MP4.");
        if (!isVideo && !isImage) throw new Error("Formato de arquivo não suportado para esta publicação.");

        if (isVideo && file.size > 50 * 1024 * 1024) throw new Error("Vídeos devem ter até 50 MB neste fluxo.");
        if (isImage && file.size > 10 * 1024 * 1024) throw new Error("Imagens devem ter até 10 MB cada.");

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const kind = isVideo ? "videos" : "images";
        const path = `${prefix}/${kind}/${publicationId}/${timestamp}-${index}-${safeName(file.name)}`;
        const contentType = isVideo ? "video/mp4" : file.type || "image/jpeg";

        const { error: uploadError } = await supabase.storage
          .from("social-media")
          .upload(path, file, { contentType, upsert: false, cacheControl: "3600" });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from("social-media").getPublicUrl(path);
        const { data: lastMedia } = await supabase
          .from("publication_media")
          .select("sort_order")
          .eq("publication_id", publicationId)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { error: mediaError } = await supabase.from("publication_media").insert({
          publication_id: publicationId,
          storage_path: path,
          public_url: publicUrlData.publicUrl,
          media_type: isVideo ? "video" : "image",
          sort_order: (lastMedia?.sort_order ?? -1) + 1,
        });

        if (mediaError) {
          await supabase.storage.from("social-media").remove([path]);
          throw mediaError;
        }
      }

      setMessage("Mídia enviada e vinculada à publicação.");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a mídia.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 14, marginTop: 16 }}>
      <strong>Enviar mídia</strong>
      <div className="muted" style={{ marginTop: 6 }}>{rules.help}</div>
      <input
        ref={inputRef}
        className="input"
        type="file"
        accept={rules.accept}
        multiple={rules.multiple}
        disabled={busy || currentCount >= rules.maxItems}
        style={{ marginTop: 10 }}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) void uploadFiles(files);
        }}
      />
      {busy && <div className="muted" style={{ marginTop: 8 }}>Enviando... não feche esta página.</div>}
      {message && <div className="muted" style={{ marginTop: 8 }}>{message}</div>}
      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
        Limites atuais: 10 MB por imagem · 50 MB por vídeo.
      </div>
    </div>
  );
}
