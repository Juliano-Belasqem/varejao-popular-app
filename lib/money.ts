export function parseMoney(value: FormDataEntryValue | string | null | undefined) {
  const input = String(value ?? "").trim().replace(/\s/g, "");
  if (!input) return null;

  const normalized = input.includes(",")
    ? input.replace(/\./g, "").replace(",", ".")
    : input;

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
