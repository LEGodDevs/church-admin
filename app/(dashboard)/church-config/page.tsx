"use client";
import { useCallback, useEffect, useState } from "react";
import { Page } from "@/components/ui/Page";
import { Card, CardHeader } from "@/components/ui/Card";
import { LoadingBlock, ErrorBlock } from "@/components/ui/States";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useScope } from "@/hooks/useScope";
import type { Theme, MissionVision } from "@/types/api";

interface Bundle {
  theme: Theme | null;
  mv: MissionVision | null;
}

export default function ChurchConfigPage() {
  const { isAdmin } = useScope();
  const load = useCallback(async (): Promise<Bundle> => {
    const settle = <T,>(p: Promise<T>, fb: T) => p.catch(() => fb);
    const [theme, mv] = await Promise.all([settle(api.theme(), null), settle(api.missionVision(), null)]);
    return { theme, mv };
  }, []);
  const { data, loading, error, refetch } = useApi(load, []);

  const [mission, setMission] = useState("");
  const [vision, setVision] = useState("");
  const [themeName, setThemeName] = useState("");
  const [themeColor, setThemeColor] = useState("#121D55");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setMission(data.mv?.mission ?? "");
      setVision(data.mv?.vision ?? "");
      setThemeName((data.theme?.name as string) ?? "");
      setThemeColor((data.theme?.primaryColor as string) ?? "#121D55");
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        api.setMissionVision({ mission: mission.trim(), vision: vision.trim() }),
        api.setTheme({ name: themeName.trim(), primaryColor: themeColor.trim() }),
      ]);
      setSaved(true);
      refetch();
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#121D55] focus:ring-2 focus:ring-[#121D55]/10";

  return (
    <Page
      title="Church Info"
      subtitle="Mission, vision and app theme shown across the platform"
      action={
        isAdmin && (
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-[#121D55] text-white text-sm font-medium hover:bg-[#1e2f7a] disabled:opacity-60">
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </button>
        )
      }
    >
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : error ? (
        <Card><ErrorBlock message={error} onRetry={refetch} /></Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader title="Mission" subtitle="The church's purpose" />
            <textarea className={field} rows={5} value={mission} onChange={(e) => setMission(e.target.value)} disabled={!isAdmin} placeholder="Enter mission statement…" />
          </Card>
          <Card>
            <CardHeader title="Vision" subtitle="Where the church is headed" />
            <textarea className={field} rows={5} value={vision} onChange={(e) => setVision(e.target.value)} disabled={!isAdmin} placeholder="Enter vision statement…" />
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="App theme" subtitle="Primary color and name used by the mobile app" />
            <div className="flex flex-wrap items-end gap-5">
              <div className="flex-1 min-w-48">
                <label className="block text-xs text-slate-400 mb-1">Theme name</label>
                <input className={field} value={themeName} onChange={(e) => setThemeName(e.target.value)} disabled={!isAdmin} placeholder="e.g. Deep Navy" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Primary color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    disabled={!isAdmin}
                    className="w-11 h-11 rounded-lg border border-slate-200 cursor-pointer"
                  />
                  <input className={`${field} w-32`} value={themeColor} onChange={(e) => setThemeColor(e.target.value)} disabled={!isAdmin} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl shadow-inner" style={{ background: themeColor }} />
                <span className="text-sm text-slate-500">Preview</span>
              </div>
            </div>
          </Card>
          {!isAdmin && (
            <p className="lg:col-span-2 text-sm text-slate-400 text-center">Only Bishops and Administrators can edit church info.</p>
          )}
        </div>
      )}
    </Page>
  );
}
