import { ReactNode } from "react";

type Tone = "navy" | "green" | "amber" | "red" | "purple" | "blue" | "slate" | "teal";

const TONES: Record<Tone, string> = {
  navy: "bg-[#121D55]/10 text-[#121D55]",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
  blue: "bg-blue-100 text-blue-700",
  slate: "bg-slate-100 text-slate-600",
  teal: "bg-teal-100 text-teal-700",
};

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

// Role → tone mapping shared across pages
export const ROLE_TONE: Record<string, Tone> = {
  BISHOP: "purple",
  ADMIN: "purple",
  ZONE_LEADER: "blue",
  BRANCH_HEAD: "green",
  BC_HEAD: "teal",
  MC_HEAD: "amber",
  CELL_LEADER: "navy",
  SHEPHERD: "slate",
};

export const UNIT_TONE: Record<string, Tone> = {
  CHURCH: "purple",
  ZONE: "blue",
  BRANCH: "green",
  MC: "amber",
  BC: "teal",
  CELL: "navy",
  SHEPHERD: "slate",
  ADMIN: "red",
};
