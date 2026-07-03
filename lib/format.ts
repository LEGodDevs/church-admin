// Shared formatting helpers

export const ghc = (n: number | undefined | null): string =>
  `GH₵${Number(n ?? 0).toLocaleString("en-GH", { maximumFractionDigits: 0 })}`;

export const num = (n: number | undefined | null): string =>
  Number(n ?? 0).toLocaleString("en-GH");

export const compact = (n: number | undefined | null): string =>
  Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(n ?? 0));

export const dateShort = (d: string | Date | undefined): string => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export const dateLong = (d: string | Date | undefined): string => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

export const monthKey = (d: string | Date): string => {
  const date = new Date(d);
  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
};

export const initials = (first?: string, last?: string, full?: string): string => {
  if (full) {
    const parts = full.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return ((first?.[0] ?? "") + (last?.[0] ?? "")).toUpperCase() || "?";
};

export const splitName = (name: string): { firstName: string; lastName: string } => {
  const [firstName, ...rest] = (name || "").trim().split(/\s+/);
  return { firstName: firstName || "", lastName: rest.join(" ") };
};

// Deterministic pleasant color from a string (for avatars / chart series fallback)
export const colorFromString = (s: string): string => {
  const palette = ["#121D55", "#1e40af", "#0369a1", "#047857", "#7c3aed", "#b45309", "#be123c", "#0f766e"];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffff;
  return palette[Math.abs(h) % palette.length];
};
