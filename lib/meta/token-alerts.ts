import { createAdminClient } from "@/lib/supabase/admin";
import type { MetaTokenHealth } from "@/lib/meta/token-health";

export async function recordMetaTokenAlert(health: MetaTokenHealth) {
  if (!health.available || !["warning", "critical"].includes(health.level)) return;

  const supabase = createAdminClient();
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const action = `meta_token_${health.level}`;

  const { data: recent } = await supabase
    .from("audit_logs")
    .select("id")
    .eq("action", action)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();

  if (recent) return;

  await supabase.from("audit_logs").insert({
    actor_id: null,
    action,
    entity_type: "meta_token",
    entity_id: "page_access_token",
    details: {
      level: health.level,
      valid: health.valid,
      expires_at: health.expiresAt,
      days_until_expiry: health.daysUntilExpiry,
      message: health.message,
    },
  });
}
