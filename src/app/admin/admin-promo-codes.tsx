"use client";

import { useState, useCallback, useEffect } from "react";

type PromoCode = {
  id: string;
  code: string;
  numberOfLoads: number;
  redemptionCount: number;
  createdAt: string;
};

const inputClass =
  "rounded-lg border border-fern-200 bg-white px-3 py-2 text-sm text-fern-900 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20 w-full";

export function AdminPromoCodes() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Generate form
  const [showGenerate, setShowGenerate] = useState(false);
  const [genCount, setGenCount] = useState("5");
  const [genLoads, setGenLoads] = useState("1");
  const [generating, setGenerating] = useState(false);

  // Edit state: codeId → editing loads value
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLoads, setEditLoads] = useState("");
  const [saving, setSaving] = useState(false);

  // Copied state for clipboard feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadCodes = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/promo-codes")
      .then((r) => r.json())
      .then((data) => {
        setCodes(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  async function generateCodes() {
    const count = parseInt(genCount, 10);
    const numberOfLoads = parseInt(genLoads, 10);
    if (!count || count < 1 || !numberOfLoads || numberOfLoads < 1) {
      setMessage("Enter valid count and loads values.");
      return;
    }
    setGenerating(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, numberOfLoads }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Failed to generate codes.");
        setGenerating(false);
        return;
      }
      setCodes((prev) => [...(Array.isArray(data) ? data : []), ...prev]);
      setShowGenerate(false);
      setMessage(`Generated ${(Array.isArray(data) ? data : []).length} code(s).`);
    } catch {
      setMessage("Something went wrong.");
    }
    setGenerating(false);
  }

  function startEdit(code: PromoCode) {
    setEditingId(code.id);
    setEditLoads(String(code.numberOfLoads));
    setMessage("");
  }

  async function saveEdit(id: string) {
    const numberOfLoads = parseInt(editLoads, 10);
    if (!numberOfLoads || numberOfLoads < 1) {
      setMessage("Number of loads must be ≥ 1.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numberOfLoads }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Failed to update.");
        setSaving(false);
        return;
      }
      setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
      setEditingId(null);
      setMessage("Updated.");
    } catch {
      setMessage("Something went wrong.");
    }
    setSaving(false);
  }

  function copyCode(code: PromoCode) {
    navigator.clipboard.writeText(code.code).then(() => {
      setCopiedId(code.id);
      setTimeout(() => setCopiedId((prev) => (prev === code.id ? null : prev)), 1500);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setShowGenerate((v) => !v); setMessage(""); }}
          className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600"
        >
          {showGenerate ? "Cancel" : "Generate codes"}
        </button>
        {message && <p className="text-sm text-fern-600">{message}</p>}
      </div>

      {showGenerate && (
        <div className="rounded-xl border border-fern-200 bg-fern-50 p-4 space-y-3 max-w-sm">
          <h3 className="text-sm font-semibold text-fern-800">Generate promo codes</h3>
          <div>
            <label className="block text-sm text-fern-700 mb-1">Number of codes to create</label>
            <input
              type="number"
              min={1}
              max={500}
              value={genCount}
              onChange={(e) => setGenCount(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-fern-700 mb-1">Free loads per code</label>
            <input
              type="number"
              min={1}
              value={genLoads}
              onChange={(e) => setGenLoads(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={generateCodes}
            disabled={generating}
            className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 disabled:opacity-50 w-full"
          >
            {generating ? "Generating…" : "Generate"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-fern-500">Loading codes…</p>
      ) : codes.length === 0 ? (
        <p className="text-sm text-fern-500">No promo codes yet. Generate some above.</p>
      ) : (
        <div className="rounded-xl border border-fern-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fern-100 bg-fern-50">
                <th className="text-left px-4 py-2.5 font-medium text-fern-700">Code</th>
                <th className="text-left px-4 py-2.5 font-medium text-fern-700">Free loads</th>
                <th className="text-left px-4 py-2.5 font-medium text-fern-700">Redeemed</th>
                <th className="text-left px-4 py-2.5 font-medium text-fern-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fern-100">
              {codes.map((c) => (
                <tr key={c.id} className="hover:bg-fern-50/50">
                  <td className="px-4 py-2.5 font-mono font-semibold text-fern-900">{c.code}</td>
                  <td className="px-4 py-2.5 text-fern-700">
                    {editingId === c.id ? (
                      <input
                        type="number"
                        min={1}
                        value={editLoads}
                        onChange={(e) => setEditLoads(e.target.value)}
                        className="rounded border border-fern-300 px-2 py-1 text-sm w-20"
                        autoFocus
                      />
                    ) : (
                      c.numberOfLoads
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-fern-500">{c.redemptionCount}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {editingId === c.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit(c.id)}
                            disabled={saving}
                            className="text-xs font-medium text-fern-600 hover:text-fern-800 disabled:opacity-50"
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-xs text-fern-400 hover:text-fern-600"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="text-xs font-medium text-fern-600 hover:text-fern-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => copyCode(c)}
                            className="text-xs text-fern-400 hover:text-fern-600"
                          >
                            {copiedId === c.id ? "Copied!" : "Copy"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
