"use client";

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            active === t.key ? "bg-white text-[#121D55] shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span className={`ml-1.5 text-xs ${active === t.key ? "text-slate-400" : "text-slate-400"}`}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
