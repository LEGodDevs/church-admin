interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  icon: string;
  color?: string;
}

export default function StatCard({ label, value, delta, deltaPositive, icon, color = "#121D55" }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          {icon}
        </div>
        {delta && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${deltaPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
            {deltaPositive ? "↑" : "↓"} {delta}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-sm text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}
