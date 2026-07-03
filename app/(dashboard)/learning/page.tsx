"use client";
import { useCallback, useState } from "react";
import { Page } from "@/components/ui/Page";
import { Card, CardHeader } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/ui/States";
import { api } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import type { TrainingCategory, PodcastSeries, FMWPOVideo } from "@/types/api";

type Tab = "training" | "podcasts" | "fmwpo";

interface Bundle {
  categories: TrainingCategory[];
  podcasts: PodcastSeries[];
  fmwpo: FMWPOVideo[];
}

function Thumb({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="w-full h-32 object-cover rounded-lg mb-2" />;
}

export default function LearningPage() {
  const load = useCallback(async (): Promise<Bundle> => {
    const settle = <T,>(p: Promise<T>, fb: T) => p.catch(() => fb);
    const [categories, podcasts, fmwpo] = await Promise.all([
      settle(api.learningCategories(), []),
      settle(api.podcasts(), []),
      settle(api.fmwpo(), []),
    ]);
    return { categories, podcasts, fmwpo };
  }, []);

  const { data, loading, error, refetch } = useApi(load, []);
  const [tab, setTab] = useState<Tab>("training");

  const categories = data?.categories ?? [];
  const podcasts = data?.podcasts ?? [];
  const fmwpo = data?.fmwpo ?? [];
  const videoCount = categories.reduce((s, c) => s + c.videos.length, 0);
  const episodeCount = podcasts.reduce((s, p) => s + p.episodes.length, 0);

  return (
    <Page title="Learning Library" subtitle="Training, podcasts and 5MW P.O content available in the app">
      {loading ? (
        <Card><LoadingBlock /></Card>
      ) : error ? (
        <Card><ErrorBlock message={error} onRetry={refetch} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <StatCard label="Categories" value={categories.length} icon="📚" color="#121D55" />
            <StatCard label="Training videos" value={videoCount} icon="🎬" color="#7c3aed" />
            <StatCard label="Podcast episodes" value={episodeCount} icon="🎙️" color="#059669" />
            <StatCard label="5MW P.O videos" value={fmwpo.length} icon="📺" color="#d97706" />
          </div>

          <Card>
            <div className="mb-4">
              <Tabs
                active={tab}
                onChange={setTab}
                tabs={[
                  { key: "training", label: "Training", count: videoCount },
                  { key: "podcasts", label: "Podcasts", count: episodeCount },
                  { key: "fmwpo", label: "5MW P.O", count: fmwpo.length },
                ]}
              />
            </div>

            {tab === "training" &&
              (categories.length === 0 ? (
                <EmptyState icon="📚" title="No training content" />
              ) : (
                <div className="space-y-6">
                  {categories.map((c) => (
                    <div key={c.id}>
                      <CardHeader title={c.title} subtitle={`${c.videos.length} videos`} />
                      <div className="grid sm:grid-cols-3 gap-4">
                        {c.videos.map((v) => (
                          <div key={v.id} className="border border-slate-100 rounded-xl p-3">
                            <Thumb src={v.thumbnail} alt={v.title} />
                            <p className="text-sm font-medium text-slate-800 line-clamp-2">{v.title}</p>
                            <p className="text-xs text-slate-400 mt-1">{v.author}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {v.duration && <Badge tone="slate">{v.duration}</Badge>}
                              {v.views && <span className="text-xs text-slate-400">{v.views}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

            {tab === "podcasts" &&
              (podcasts.length === 0 ? (
                <EmptyState icon="🎙️" title="No podcasts" />
              ) : (
                <div className="space-y-6">
                  {podcasts.map((s) => (
                    <div key={s.id}>
                      <CardHeader title={s.title} subtitle={`${s.episodes.length} episodes`} />
                      <div className="divide-y divide-slate-100">
                        {s.episodes.map((ep) => (
                          <div key={ep.id} className="flex items-center gap-3 py-2.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ep.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{ep.title}</p>
                              <p className="text-xs text-slate-400">{ep.author}</p>
                            </div>
                            {ep.duration && <Badge tone="slate">{ep.duration}</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

            {tab === "fmwpo" &&
              (fmwpo.length === 0 ? (
                <EmptyState icon="📺" title="No 5MW P.O videos" />
              ) : (
                <div className="grid sm:grid-cols-3 gap-4">
                  {fmwpo.map((v) => (
                    <div key={v.id} className="border border-slate-100 rounded-xl p-3">
                      <Thumb src={v.thumbnail} alt={v.title} />
                      <p className="text-sm font-medium text-slate-800 line-clamp-2">{v.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">{v.date}</span>
                        {v.duration && <Badge tone="slate">{v.duration}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </Card>
        </>
      )}
    </Page>
  );
}
