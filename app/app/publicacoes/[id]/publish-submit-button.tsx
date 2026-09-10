"use client";

import { useFormStatus } from "react-dom";

export default function PublishSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button
        className="btn primary"
        type="submit"
        disabled={pending}
        aria-busy={pending}
        style={{ minWidth: 150, opacity: pending ? 0.78 : 1, cursor: pending ? "wait" : "pointer" }}
      >
        {pending ? "Publicando..." : "Publicar agora"}
      </button>
      {pending && (
        <div className="muted" role="status" aria-live="polite" style={{ fontSize: 13 }}>
          Enviando para a Meta. Não feche esta página até concluir.
        </div>
      )}
    </div>
  );
}
