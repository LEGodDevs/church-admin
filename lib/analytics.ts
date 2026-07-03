import type { Finance, AttendanceEvent, EvangelismRecord, Member } from "@/types/api";

// Chronological month buckets across the last N months (keys like "Jan 26")
function monthBuckets(months = 6): { key: string; year: number; month: number }[] {
  const out: { key: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return out;
}

const sameMonth = (d: string | Date, y: number, m: number) => {
  const date = new Date(d);
  return date.getFullYear() === y && date.getMonth() === m;
};

export function monthlyFinance(finances: Finance[], months = 6) {
  return monthBuckets(months).map((b) => ({
    month: b.key,
    total: finances.filter((f) => sameMonth(f.date, b.year, b.month)).reduce((s, f) => s + f.amount, 0),
  }));
}

export function financeByTypeSeries(byType: Record<string, number>) {
  return Object.entries(byType)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function attendanceTrend(sessions: AttendanceEvent[], months = 6) {
  return monthBuckets(months).map((b) => {
    const inMonth = sessions.filter((s) => sameMonth(s.date, b.year, b.month));
    let present = 0;
    let total = 0;
    for (const s of inMonth) {
      const att = s.attendees || [];
      present += att.filter((a) => a.status === "Attended").length;
      total += att.length;
    }
    return { month: b.key, rate: total ? Math.round((present / total) * 100) : 0, present };
  });
}

export function evangelismTrend(records: EvangelismRecord[], months = 6) {
  return monthBuckets(months).map((b) => {
    const inMonth = records.filter((r) => sameMonth(r.date, b.year, b.month));
    return {
      month: b.key,
      souls: inMonth.reduce((s, r) => s + (r.soulsWon || 0), 0),
      reached: inMonth.reduce((s, r) => s + (r.peopleReached || 0), 0),
    };
  });
}

export function memberGrowth(members: Member[], months = 6) {
  const buckets = monthBuckets(months);
  return buckets.map((b) => {
    const upTo = new Date(b.year, b.month + 1, 1).getTime();
    const cumulative = members.filter((m) => (m.createdAt ? new Date(m.createdAt).getTime() < upTo : true)).length;
    const added = members.filter((m) => m.createdAt && sameMonth(m.createdAt, b.year, b.month)).length;
    return { month: b.key, total: cumulative, added };
  });
}

// Present count for a single session
export function presentCount(s: AttendanceEvent): number {
  return (s.attendees || []).filter((a) => a.status === "Attended").length;
}
export function attendedRate(s: AttendanceEvent): number {
  const att = s.attendees || [];
  return att.length ? Math.round((att.filter((a) => a.status === "Attended").length / att.length) * 100) : 0;
}
