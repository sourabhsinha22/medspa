"use client";

import { useEffect, useState } from "react";
import { fetchRecentSessions, getPhotoUrl } from "@/lib/db";
import Link from "next/link";

type Session = Awaited<ReturnType<typeof fetchRecentSessions>>[number];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 animate-pulse">
      <div className="w-16 h-16 rounded-xl bg-gray-200 flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="h-3 bg-gray-100 rounded w-40" />
        <div className="h-3 bg-gray-100 rounded w-32" />
      </div>
      <div className="flex flex-col gap-1 items-end">
        <div className="h-3 bg-gray-200 rounded w-16" />
        <div className="h-3 bg-gray-100 rounded w-12" />
      </div>
    </div>
  );
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [photosLoading, setPhotosLoading] = useState(true);

  useEffect(() => {
    fetchRecentSessions()
      .then(async (data) => {
        setSessions(data);
        setLoading(false);

        // Fetch signed URLs after sessions are shown
        const urls: Record<string, string> = {};
        await Promise.all(
          data
            .filter((s) => s.photo_url)
            .map(async (s) => {
              try {
                urls[s.id] = await getPhotoUrl(s.photo_url!);
              } catch {
                // ignore individual failures
              }
            })
        );
        setPhotoUrls(urls);
        setPhotosLoading(false);
      })
      .catch(() => {
        setError("Could not load sessions. Check your Supabase connection.");
        setLoading(false);
        setPhotosLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">M</span>
          </div>
          <span className="font-semibold text-gray-900 hidden sm:block">MedSpa</span>
          <span className="text-gray-300 hidden sm:block">|</span>
          <span className="text-sm text-gray-500">Patient Sessions</span>
        </div>
        <Link
          href="/"
          className="px-4 py-2 bg-rose-600 text-white rounded-full text-sm font-medium hover:bg-rose-700 transition-colors"
        >
          + New Patient
        </Link>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex flex-col gap-3">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-1" />
            {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No sessions yet.</p>
            <Link href="/" className="text-rose-600 text-sm mt-2 inline-block hover:underline">
              Start your first patient →
            </Link>
          </div>
        )}

        {sessions.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-400 mb-1">
              {sessions.length} recent session{sessions.length !== 1 ? "s" : ""}
            </p>
            {sessions.map((s) => {
              const patient = s.patients as unknown as { age: number; concerns: string[] } | null;
              const date = new Date(s.created_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              });
              const time = new Date(s.created_at).toLocaleTimeString("en-US", {
                hour: "numeric", minute: "2-digit",
              });

              return (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">
                  {/* Thumbnail with skeleton */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {photosLoading ? (
                      <div className="w-full h-full bg-gray-200 animate-pulse" />
                    ) : photoUrls[s.id] ? (
                      <img src={photoUrls[s.id]} alt="Patient" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">👤</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">Age {patient?.age ?? "—"}</span>
                      {s.consented_at && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Consented</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {(s.selected_zone_ids as string[]).slice(0, 4).map((z: string) => (
                        <span key={z} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                          {z.replace(/_/g, " ")}
                        </span>
                      ))}
                      {(s.selected_zone_ids as string[]).length > 4 && (
                        <span className="text-xs text-gray-400">+{(s.selected_zone_ids as string[]).length - 4} more</span>
                      )}
                    </div>
                    {s.clinician_notes && (
                      <p className="text-xs text-gray-400 truncate">{s.clinician_notes}</p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">{date}</p>
                    <p className="text-xs text-gray-400">{time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
