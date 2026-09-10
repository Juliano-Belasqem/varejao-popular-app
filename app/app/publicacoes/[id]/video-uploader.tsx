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
    .slice(0, 100) || "video.mp4";
}

export default function VideoUploader({
  publicationId,
  campaignId,
  purpose = "Reel",
}: {
  publicationId: string;
  campaignId: string | null;
  purpose?: "Reel" | "Story";
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function uploadVideo(file: File) {
    if (file.type !== "video/mp4" && !file.name.toLowerCase().endsWith(".mp4")) {
      setMessage(`Use um arquivo MP4 para o ${purpose}.`);
      return;
    }

    const maxBytes = 50 * 1024 * 1024;
    if (file.size > maxBytes) {
      setMessage("O upload aceita vídeos de até 50 MB neste momento.");
      return;
    }

    setBusy(true);
    setMessage("Enviando vídeo para o armazenamento...");
    const supabase = createClient();
    const prefix = campaignId || "sem-campanha";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `${prefix}/videos/${publicationId}/${timestamp}-${safeName(file.name)}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("social-media")
        .upload(path, file, { contentType: "video/mp4", upsert: false, cacheControl: "3600" });
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
        media_type: "video",
        sort_order: (lastMedia?.sort_order ?? -1) + 1,
      });

      if (mediaError) {
        await supabase.storage.from("social-media").remove([path]);
        throw mediaError;
      }

      setMessage("Vídeo enviado e vinculado à publicação.");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o vídeo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 14, marginTop: 16 }}>
      <strong>Vídeo para {purpose}</strong>
      <div className="muted" style={{ marginTop: 6 }}>
        Envie um MP4 diretamente para o armazenamento. Para publicar, deixe somente um vídeo vinculado à publicação.
      </div>
      <input
        ref={inputRef}
        className="input"
        type="file"
        accept="video/mp4,.mp4"
        disabled={busy}
        style={{ marginTop: 10 }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadVideo(file);
        }}
      />
      {busy && <div className="muted" style={{ marginTop: 8 }}>Enviando... não feche esta página.</div>}
      {message && <div className="muted" style={{ marginTop: 8 }}>{message}</div>}
      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>Limite atual do fluxo: 50 MB · formato MP4.</div>
    </div>
  );
}
