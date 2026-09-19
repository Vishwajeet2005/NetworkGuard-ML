"use client";
import { useState, useEffect } from "react";
import { Upload, Database as DbIcon, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [uploadStatus, setUploadStatus] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchDatasets = async () => {
    try {
      const res = await fetch(`${API_BASE}/datasets`);
      if (res.ok) setDatasets(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchDatasets(); }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/datasets/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setUploadStatus(data);
        fetchDatasets();
      } else {
        const err = await res.json().catch(() => ({}));
        setUploadStatus({ error: err.detail || `Upload failed (${res.status})` });
      }
    } catch (e: any) {
      setUploadStatus({ error: "Network error — is the backend running?" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-slate-300 font-sans text-sm overflow-hidden">
      <header className="flex-none h-12 border-b border-[#1a1a1a] bg-[#050505] flex items-center px-4">
        <div className="flex items-center gap-2 text-slate-100 font-semibold tracking-tight">
          <DbIcon className="w-4 h-4 text-white" />
          Dataset Management
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 space-y-6">
        <section>
          <div className={`relative border-2 border-dashed rounded-lg bg-[#050505] transition-colors p-8 flex flex-col items-center justify-center text-center group ${uploading ? 'border-amber-500/40 opacity-60 pointer-events-none' : 'border-[#222] hover:bg-[#0a0a0a] hover:border-slate-500'}`}>
            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} accept=".csv" disabled={uploading} />
            {uploading
              ? <><Loader2 className="w-8 h-8 text-amber-400 mb-3 animate-spin" /><p className="text-amber-400">Uploading and analyzing dataset...</p></>
              : <><Upload className="w-8 h-8 text-slate-500 mb-3 group-hover:text-slate-400" /><p className="text-slate-300">Drop a CSV network dataset here or click to browse</p><p className="text-slate-500 text-xs mt-1">Supports NSL-KDD, CICIDS2017, and compatible CSV formats</p></>
            }
          </div>

          {uploadStatus?.error && (
            <div className="mt-4 p-4 border border-red-500/20 bg-red-500/5 rounded flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 flex-none" />
              {uploadStatus.error}
            </div>
          )}

          {uploadStatus && !uploadStatus.error && (
            <div className="mt-4 p-4 border border-white/20 bg-white/5 rounded flex flex-col gap-2">
              <div className="flex items-center gap-2 text-white font-medium">
                <CheckCircle2 className="w-4 h-4" /> Upload Successful
              </div>
              <div className="grid grid-cols-5 gap-4 mt-2">
                <div><span className="text-slate-500 text-xs uppercase tracking-wider block">Filename</span><span className="font-mono text-xs">{uploadStatus.name}</span></div>
                <div><span className="text-slate-500 text-xs uppercase tracking-wider block">Rows</span><span className="font-mono text-xs">{(uploadStatus.row_count || 0).toLocaleString()}</span></div>
                <div><span className="text-slate-500 text-xs uppercase tracking-wider block">Features</span><span className="font-mono text-xs">{uploadStatus.feature_count}</span></div>
                <div><span className="text-slate-500 text-xs uppercase tracking-wider block">Label Column</span><span className="font-mono text-xs">{uploadStatus.label_column || '—'}</span></div>
                <div><span className="text-slate-500 text-xs uppercase tracking-wider block">Missing Values</span><span className="font-mono text-xs">{uploadStatus.missing_values ?? 0}</span></div>
              </div>
              {uploadStatus.preview && uploadStatus.preview.length > 0 && (
                <div className="mt-4 overflow-x-auto border border-[#1a1a1a] rounded">
                  <p className="text-xs text-slate-500 px-3 py-2 border-b border-[#1a1a1a] bg-[#050505]">Preview — first 5 rows</p>
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#050505]">
                      <tr>
                        {Object.keys(uploadStatus.preview[0] || {}).map(k => (
                          <th key={k} className="px-3 py-1.5 text-xs font-medium text-slate-500 border-b border-[#1a1a1a] whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1a1a]">
                      {uploadStatus.preview.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-[#0a0a0a]">
                          {Object.values(row).map((v: any, j: number) => (
                            <td key={j} className="px-3 py-1.5 font-mono text-xs text-slate-400 whitespace-nowrap">{String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Available Datasets</h2>
          <div className="border border-[#1a1a1a] rounded overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#050505]">
                <tr>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Name</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Rows</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Features</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Label Column</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Uploaded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a] bg-black">
                {datasets.map((ds: any) => (
                  <tr key={ds.id} className="hover:bg-[#0a0a0a] cursor-pointer">
                    <td className="px-4 py-2 text-slate-300 font-medium">{ds.name}</td>
                    <td className="px-4 py-2 font-mono text-slate-400 text-xs">{ds.row_count?.toLocaleString() ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-slate-400 text-xs">{ds.feature_count ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-slate-400 text-xs">{ds.label_column ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-slate-400 text-xs">{ds.created_at ? new Date(ds.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
                {datasets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No datasets uploaded yet. Upload a CSV above to get started.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
