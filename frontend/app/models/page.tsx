"use client";
import React, { useState, useEffect } from "react";
import { BrainCircuit, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function ModelsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  
  const [selectedDataset, setSelectedDataset] = useState("");
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("RandomForest");
  const [modelName, setModelName] = useState("");
  const [trainingStatus, setTrainingStatus] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchData = async () => {
    try {
      const [dsRes, mdRes] = await Promise.all([
        fetch(`${API_BASE}/datasets`),
        fetch(`${API_BASE}/models`)
      ]);
      if (dsRes.ok) {
        const ds = await dsRes.json();
        setDatasets(ds);
        if (ds.length > 0 && !selectedDataset) setSelectedDataset(ds[0].id);
      }
      if (mdRes.ok) setModels(await mdRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Poll while any model is TRAINING
  useEffect(() => {
    const isTraining = models.some(m => m.status === 'TRAINING');
    if (isTraining) {
      const poll = setInterval(fetchData, 3000);
      return () => clearInterval(poll);
    }
  }, [models]);

  const handleTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrainingStatus("Training started...");
    try {
      const res = await fetch(`${API_BASE}/models/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: selectedDataset, algorithm: selectedAlgorithm, model_name: modelName })
      });
      if (res.ok) {
        setTrainingStatus("Model queued for training...");
        setModelName("");
        fetchData();
        setTimeout(() => setTrainingStatus(""), 3000);
      }
    } catch (e) {
      console.error(e);
      setTrainingStatus("Failed to start training.");
    }
  };

  const handleActivate = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to set ${name} as the ACTIVE model for all incoming traffic?`)) return;
    try {
      const res = await fetch(`${API_BASE}/models/${id}/activate`, {
        method: "PATCH"
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error("Failed to activate model", e);
    }
  };
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/models/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setExpandedModel(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to delete model");
      }
    } catch (e) {
      console.error("Failed to delete model", e);
    }
  };

  const getF1Color = (f1: number) => {
    if (f1 >= 0.9) return "text-white";
    if (f1 >= 0.7) return "text-amber-400";
    return "text-red-400";
  };

  const bestF1 = models.length > 0 ? Math.max(...models.map(m => m.macro_f1 || 0)) : 0;

  return (
    <div className="flex flex-col h-screen bg-black text-slate-300 font-sans text-sm overflow-hidden">
      <header className="flex-none h-12 border-b border-[#1a1a1a] bg-[#050505] flex items-center px-4">
        <div className="flex items-center gap-2 text-slate-100 font-semibold tracking-tight">
          <BrainCircuit className="w-4 h-4 text-white" />
          Model Management & Evaluation
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 space-y-6">
        <section className="bg-[#050505] border border-[#1a1a1a] rounded p-4">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Train New Model</h2>
          <form onSubmit={handleTrain} className="flex items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Dataset</label>
              <select value={selectedDataset} onChange={e => setSelectedDataset(e.target.value)} className="bg-black border border-[#222] rounded px-3 py-1.5 text-slate-300 focus:outline-none focus:border-slate-500 min-w-[200px]">
                {datasets.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.filename || ds.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Algorithm</label>
              <select value={selectedAlgorithm} onChange={e => setSelectedAlgorithm(e.target.value)} className="bg-black border border-[#222] rounded px-3 py-1.5 text-slate-300 focus:outline-none focus:border-slate-500">
                <option value="LogisticRegression">LogisticRegression</option>
                <option value="DecisionTree">DecisionTree</option>
                <option value="RandomForest">RandomForest</option>
                <option value="XGBoost">XGBoost</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Model Name</label>
              <input type="text" value={modelName} onChange={e => setModelName(e.target.value)} required className="bg-black border border-[#222] rounded px-3 py-1.5 text-slate-300 focus:outline-none focus:border-slate-500" placeholder="My Model" />
            </div>
            <button type="submit" disabled={!selectedDataset || !!trainingStatus} className="bg-[#111] hover:bg-[#1a1a1a] text-slate-100 px-4 py-1.5 rounded transition-colors border border-[#222] disabled:opacity-50">
              Train Model
            </button>
            {trainingStatus && <span className="text-white text-sm animate-pulse ml-2">{trainingStatus}</span>}
          </form>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Model Comparison</h2>
          <div className="border border-[#1a1a1a] rounded overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#050505]">
                <tr>
                  <th className="px-4 py-2 w-8"></th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Algorithm</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Accuracy</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Macro F1</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">ROC-AUC</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Status</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Trained Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a] bg-black">
                {models.map(m => {
                  const isBest = m.macro_f1 && m.macro_f1 === bestF1 && bestF1 > 0;
                  const isExpanded = expandedModel === m.id;
                  return (
                    <React.Fragment key={m.id}>
                      <tr className={`hover:bg-[#0a0a0a] cursor-pointer ${isBest ? 'bg-white/5 border-l-2 border-white' : ''}`} onClick={() => setExpandedModel(isExpanded ? null : m.id)}>
                        <td className="px-4 py-2 text-slate-500">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                        <td className="px-4 py-2 text-slate-300 font-medium">{m.algorithm} <span className="text-slate-500 text-xs ml-2">({m.name})</span></td>
                        <td className="px-4 py-2 font-mono text-slate-400">{m.accuracy?.toFixed(4) || '-'}</td>
                        <td className="px-4 py-2 font-mono text-slate-400">{m.macro_f1?.toFixed(4) || '-'}</td>
                        <td className="px-4 py-2 font-mono text-slate-400">{m.roc_auc?.toFixed(4) || '-'}</td>
                        <td className="px-4 py-2 font-mono text-slate-400">
                          {m.status === 'TRAINING' ? (
                            <span className="flex items-center gap-2 text-amber-400 animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> Training
                            </span>
                          ) : m.status === 'ACTIVE' ? (
                            <span className="text-white">{m.status}</span>
                          ) : (
                            m.status
                          )}
                        </td>
                        <td className="px-4 py-2 font-mono text-slate-400">{new Date(m.created_at).toLocaleString()}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-black border-b border-[#1a1a1a]">
                          <td colSpan={7} className="p-6">
                            <div className="flex items-center justify-between mb-4 border-b border-[#1a1a1a] pb-4">
                              <div className="text-xs text-slate-400 font-mono">
                                Model ID: {m.id} | Trained on: <Link href="/datasets" className="text-slate-200 hover:text-white underline decoration-slate-500 underline-offset-4">{m.dataset_name}</Link>
                              </div>
                              <div className="flex items-center gap-2">
                                {m.status === "READY" && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleActivate(m.id, m.name); }}
                                    className="bg-white/10 hover:bg-white/20 text-white border border-white/30 px-4 py-1.5 rounded text-xs font-medium transition-colors"
                                  >
                                    Set as Active Model
                                  </button>
                                )}
                                {m.status !== "ACTIVE" && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-1.5 rounded text-xs font-medium transition-colors"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                            {m.status === "FAILED" ? (
                              <div className="text-red-400 text-sm py-4">Training failed. No metrics available. Please check the dataset or try another algorithm.</div>
                            ) : m.metrics && m.metrics.classification_report ? (
                              <div className="grid grid-cols-2 gap-8">
                                <div>
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Per-Class Metrics</h3>
                                <table className="w-full text-left border-collapse border border-[#1a1a1a]">
                                  <thead className="bg-[#050505]">
                                    <tr>
                                      <th className="px-3 py-1.5 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Class</th>
                                      <th className="px-3 py-1.5 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Precision</th>
                                      <th className="px-3 py-1.5 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Recall</th>
                                      <th className="px-3 py-1.5 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">F1</th>
                                      <th className="px-3 py-1.5 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Support</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#1a1a1a]">
                                    {Object.entries(m.metrics.classification_report || {}).filter(([k]) => k !== 'accuracy' && k !== 'macro avg' && k !== 'weighted avg').map(([cls, metrics]: [string, any]) => {
                                      let clsColor = "text-slate-400";
                                      if (cls === "DoS") clsColor = "text-red-400";
                                      else if (cls === "Probe") clsColor = "text-amber-400";
                                      else if (cls === "R2L") clsColor = "text-orange-400";
                                      else if (cls === "U2R") clsColor = "text-purple-400";
                                      return (
                                        <tr key={cls} className="hover:bg-[#0a0a0a]">
                                          <td className={`px-3 py-1.5 font-mono text-xs uppercase ${clsColor}`}>{cls}</td>
                                          <td className="px-3 py-1.5 font-mono text-xs text-slate-400">{metrics.precision?.toFixed(4)}</td>
                                          <td className="px-3 py-1.5 font-mono text-xs text-slate-400">{metrics.recall?.toFixed(4)}</td>
                                          <td className={`px-3 py-1.5 font-mono text-xs ${getF1Color(metrics["f1-score"])}`}>{metrics["f1-score"]?.toFixed(4)}</td>
                                          <td className="px-3 py-1.5 font-mono text-xs text-slate-400">{metrics.support}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              <div>
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
                                  Confusion Matrix
                                  {m.roc_auc != null ? <span className="text-white">ROC-AUC: {m.roc_auc.toFixed(4)}</span> : null}
                                </h3>
                                <div className="border border-[#1a1a1a] rounded p-2 bg-[#050505] inline-block">
                                  <div className="grid grid-cols-6 gap-px bg-[#111]">
                                    <div className="bg-[#050505] p-2"></div>
                                    {['DoS', 'NORMAL', 'Probe', 'R2L', 'U2R'].map(c => (
                                      <div key={c} className="bg-[#050505] p-2 text-center text-[10px] font-mono text-slate-500 uppercase">{c}</div>
                                    ))}
                                    {['DoS', 'NORMAL', 'Probe', 'R2L', 'U2R'].map((c, i) => (
                                      <React.Fragment key={c}>
                                        <div className="bg-[#050505] p-2 text-right text-[10px] font-mono text-slate-500 uppercase flex items-center justify-end">{c}</div>
                                        {['DoS', 'NORMAL', 'Probe', 'R2L', 'U2R'].map((_, j) => {
                                          const val = m.metrics.confusion_matrix?.[i]?.[j] || 0;
                                          const isDiag = i === j;
                                          return (
                                            <div key={`${i}-${j}`} className={`bg-[#050505] p-2 text-center font-mono text-xs ${isDiag ? (val > 0 ? 'bg-white/10 text-white' : 'text-slate-500') : (val > 0 ? 'bg-red-500/5 text-red-400' : 'text-slate-600')}`}>
                                              {val}
                                            </div>
                                          );
                                        })}
                                      </React.Fragment>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                            ) : (
                              <div className="text-slate-500 text-sm py-4">Metrics not available yet.</div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
