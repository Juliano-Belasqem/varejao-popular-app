"use client";

import { useMemo, useState } from "react";
import { publicationTargets } from "@/lib/publications/targets";

export default function TargetFields() {
  const [network, setNetwork] = useState<"instagram" | "facebook">("instagram");
  const options = useMemo(() => publicationTargets.filter((item) => item.network === network), [network]);

  return (
    <>
      <label className="field">
        <span>Rede</span>
        <select
          className="input"
          name="network"
          value={network}
          onChange={(event) => setNetwork(event.target.value as "instagram" | "facebook")}
          required
        >
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
        </select>
      </label>

      <label className="field">
        <span>Tipo</span>
        <select className="input" name="type" defaultValue="feed" key={network} required>
          {options.map((item) => (
            <option key={item.value} value={item.type}>{item.label.split(" · ")[1]}</option>
          ))}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>
          Mostramos apenas os formatos atualmente suportados para esta rede.
        </span>
      </label>
    </>
  );
}
