"use client";
import React, { useState, useEffect } from "react";
import { Bell, Filter, ChevronDown, ChevronRight } from "lucide-react";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("Any");
  const [severityFilter, setSeverityFilter] = useState("Any");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}/alerts`);
      if (res.ok) setAlerts(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredAlerts = alerts.filter(a => {
    let match = true;
    if (statusFilter !== "Any" && a.status !== statusFilter) match = false;
    if (severityFilter !== "Any" && a.severity !== severityFilter) match = false;
    return match;
  });

  const getSeverityBadge = (sev: string) => {
    if (sev === "CRITICAL") return "bg-purple-500/20 text-purple-400 border border-purple-500/30";
    if (sev === "HIGH") return "bg-red-500/20 text-red-400 border border-red-500/30";
    if (sev === "MEDIUM") return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
    return "bg-slate-800 text-slate-400 border border-slate-700";
  };

  const getStatusBadge = (st: string) => {
    if (st === "NEW") return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
    if (st === "ACKNOWLEDGED") return "bg-slate-800 text-slate-400 border border-slate-700";
    if (st === "RESOLVED") return "bg-white/20 text-white border border-white/30";
    return "bg-slate-800 text-slate-400 border border-slate-700";
  };

  return (
    <div className="flex flex-col h-screen bg-black text-slate-300 font-sans text-sm overflow-hidden">
      <header className="flex-none h-12 border-b border-[#1a1a1a] bg-[#050505] flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-slate-100 font-semibold tracking-tight">
          <Bell className="w-4 h-4 text-white" />
          Alert Investigation
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="appearance-none pl-8 pr-8 py-1.5 bg-[#0a0a0a] text-slate-300 border border-[#222] rounded hover:bg-[#111] transition-colors cursor-pointer outline-none focus:border-slate-500 text-sm">
              <option value="Any">Severity: Any</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
            <Filter className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="appearance-none pl-8 pr-8 py-1.5 bg-[#0a0a0a] text-slate-300 border border-[#222] rounded hover:bg-[#111] transition-colors cursor-pointer outline-none focus:border-slate-500 text-sm">
              <option value="Any">Status: Any</option>
              <option value="NEW">NEW</option>
              <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
            <Filter className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 space-y-6">
        <div className="border border-[#1a1a1a] rounded overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#050505]">
              <tr>
                <th className="px-4 py-2 w-8"></th>
                <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">ID</th>
                <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Severity</th>
                <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Status</th>
                <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Prediction</th>
                <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Confidence</th>
                <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a] bg-black">
              {filteredAlerts.map(a => {
                const isExpanded = expandedAlert === a.id;
                return (
                  <React.Fragment key={a.id}>
                    <tr className="hover:bg-[#0a0a0a] cursor-pointer" onClick={() => setExpandedAlert(isExpanded ? null : a.id)}>
                      <td className="px-4 py-2 text-slate-500">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                      <td className="px-4 py-2 font-mono text-slate-400 text-xs">{a.id}</td>
                      <td className="px-4 py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-[2px] text-[10px] font-mono font-bold uppercase ${getSeverityBadge(a.severity)}`}>{a.severity}</span></td>
                      <td className="px-4 py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-[2px] text-[10px] font-mono font-bold uppercase ${getStatusBadge(a.status)}`}>{a.status}</span></td>
                      <td className="px-4 py-2 font-mono text-slate-300 text-xs">{a.prediction || '—'}</td>
                      <td className="px-4 py-2 font-mono text-slate-400 text-xs">
                        {a.confidence != null ? `${(a.confidence * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-2 font-mono text-slate-400 text-xs">
                        {a.timestamp ? new Date(a.timestamp).toLocaleString() : '—'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-black border-b border-[#1a1a1a]">
                        <td colSpan={7} className="p-6">
                          <div className="flex gap-6">
                            <div className="flex-1 bg-[#050505] border border-[#1a1a1a] rounded p-4">
                              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Alert Details</h3>
                              <div className="space-y-2">
                                <div className="grid grid-cols-4 gap-4">
                                  <div><span className="text-slate-500 text-xs uppercase tracking-wider block">Packet ID</span><span className="font-mono text-xs">{a.packet_id}</span></div>
                                  <div><span className="text-slate-500 text-xs uppercase tracking-wider block">Source</span><span className="font-mono text-xs">{a.details?.src || '-'}</span></div>
                                  <div><span className="text-slate-500 text-xs uppercase tracking-wider block">Destination</span><span className="font-mono text-xs">{a.details?.dst || '-'}</span></div>
                                  <div><span className="text-slate-500 text-xs uppercase tracking-wider block">Protocol</span><span className="font-mono text-xs">{a.details?.protocol || '-'}</span></div>
                                </div>
                              </div>
                              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2">Actions</h3>
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(a.id, "ACKNOWLEDGED"); }}
                                  disabled={a.status === "ACKNOWLEDGED" || a.status === "RESOLVED"}
                                  className="px-3 py-1.5 bg-[#0a0a0a] hover:bg-[#111] text-slate-300 border border-[#222] hover:border-slate-500 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >Acknowledge</button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUpdateStatus(a.id, "RESOLVED"); }}
                                  disabled={a.status === "RESOLVED"}
                                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/30 hover:border-white/50 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >Resolve</button>
                              </div>
                            </div>
                            <div className="flex-1 bg-[#050505] border border-[#1a1a1a] rounded p-4">
                              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Raw Features</h3>
                              <pre className="text-[10px] font-mono text-slate-400 bg-black border border-[#1a1a1a] rounded p-2 max-h-40 overflow-y-auto">
                                {JSON.stringify(a.details?.raw_features || {}, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
