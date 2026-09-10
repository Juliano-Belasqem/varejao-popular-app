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

export default function DirectMediaUploader({
  publicationId,
  campaignId,
  currentCount,
}: {
  publicationId: string;
  campaignId: string | null;
  currentCount: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    if (currentCount + files.length > 10) {
      setMessage("Uma publicação pode ter no máximo 10 mídias neste fluxo.");
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
        if (!isVideo && !isImage) throw new Error("Use imagens ou vídeo MP4.");

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
      <div className="muted" style={{ marginTop: 6 }}>
        Envie imagens para Feed, Story ou Carrossel. Vídeos MP4 podem ser usados em Reel e em Story do Facebook. Carrosséis aceitam múltiplas imagens.
      </div>
      <input
        ref={inputRef}
        className="input"
        type="file"
        accept="image/*,video/mp4,.mp4"
        multiple
        disabled={busy || currentCount >= 10}
        style={{ marginTop: 10 }}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) void uploadFiles(files);
        }}
      />
      {busy && <div className="muted" style={{ marginTop: 8 }}>Enviando... não feche esta página.</div>}
      {message && <div className="muted" style={{ marginTop: 8 }}>{message}</div>}
      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
        Limites atuais: 10 MB por imagem · 50 MB por vídeo · até 10 mídias por publicação.
      </div>
    </div>
  );
}
