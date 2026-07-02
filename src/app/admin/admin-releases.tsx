"use client";

import { useEffect, useState } from "react";

type Release = {
  id: string;
  version: string;
  versionCode: number;
  fileName: string;
  size: number;
  notes: string | null;
  uploadedAt: string;
  uploadedBy: string;
};

function formatBytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export function AdminReleases() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchReleases();
  }, []);

  async function fetchReleases() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/releases");
      if (res.ok) setReleases(await res.json() as Release[]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, version: string) {
    if (!confirm(`Delete release ${version}? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/releases/${id}`, { method: "DELETE" });
      if (res.ok) setReleases((prev) => prev.filter((r) => r.id !== id));
      else alert("Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownload(id: string) {
    setDownloadingId(id);
    try {
      const res = await fetch("/api/releases/download-link");
      if (!res.ok) { alert("Could not get download link."); return; }
      const { url } = await res.json() as { url: string };
      window.location.href = url;
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) return <p className="text-sm text-fern-600">Loading releases…</p>;

  if (releases.length === 0) {
    return (
      <div className="rounded-lg border border-fern-200 bg-fern-50 p-6 text-center">
        <p className="text-sm text-fern-600">No releases yet. Push a version bump to <code className="text-xs bg-fern-100 px-1 rounded">main</code> to publish one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {releases.map((r, i) => (
        <div key={r.id} className="rounded-xl border border-fern-200 bg-white p-5 flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-fern-900">{r.version}</span>
              {i === 0 && (
                <span className="text-xs font-medium bg-fern-100 text-fern-700 px-2 py-0.5 rounded-full">Latest</span>
              )}
              <span className="text-xs text-fern-500">build {r.versionCode}</span>
            </div>
            <p className="text-sm text-fern-600">{formatBytes(r.size)} · {r.fileName}</p>
            <p className="text-xs text-fern-400">{new Date(r.uploadedAt).toLocaleString()} · {r.uploadedBy}</p>
            {r.notes && <p className="text-sm text-fern-700 mt-1">{r.notes}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => { void handleDownload(r.id); }}
              disabled={downloadingId === r.id}
              className="text-sm font-medium text-fern-700 border border-fern-300 rounded-lg px-3 py-1.5 hover:bg-fern-50 disabled:opacity-50"
            >
              {downloadingId === r.id ? "…" : "Download"}
            </button>
            <button
              onClick={() => { void handleDelete(r.id, r.version); }}
              disabled={deletingId === r.id}
              className="text-sm font-medium text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
            >
              {deletingId === r.id ? "…" : "Delete"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
