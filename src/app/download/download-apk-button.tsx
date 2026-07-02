"use client";

import { useState } from "react";

export function DownloadApkButton() {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch("/api/releases/download-link");
      if (!res.ok) { alert("Could not get download link. Try again."); return; }
      const { url } = await res.json() as { url: string };
      window.location.href = url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={() => { void handleDownload(); }}
      disabled={loading}
      className="bg-fern-600 hover:bg-fern-700 disabled:opacity-50 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
    >
      {loading ? "Getting link…" : "Download APK"}
    </button>
  );
}
