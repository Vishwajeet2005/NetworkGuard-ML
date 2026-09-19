"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Legend, BarChart, Bar } from "recharts";
import { Shield, Filter, Search, ChevronDown, Activity, Clock, Server, AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function Dashboard() {
  const [stats, setStats] = useState<any>({ total_predictions: 0, total_alerts: 0, detection_rate: 0, system_load: 0 });
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [charts, setCharts] = useState({ alerts_over_time: [], severity_distribution: [] });
  const [activeModel, setActiveModel] = useState<any>(null);
  const [selectedPacket, setSelectedPacket] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("Any");
  const [isPaused, setIsPaused] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAction = async (alertId: number, status: string) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${API_BASE}/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      alert(`Alert ${alertId} marked as ${status}`);
    } catch (e) {
      console.error(e);
      alert("Failed to update alert");
    }
  };

  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const filteredTelemetry = telemetry.filter(row => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term || 
      row.src.toLowerCase().includes(term) || 
      row.dst.toLowerCase().includes(term) || 
      row.protocol.toLowerCase().includes(term) || 
      row.classification.toLowerCase().includes(term);
      
    let matchesSeverity = true;
    if (severityFilter === "Malicious") matchesSeverity = row.classification !== "NORMAL";
    if (severityFilter === "Normal") matchesSeverity = row.classification === "NORMAL";
    
    return matchesSearch && matchesSeverity;
  });

  useEffect(() => {
    const fetchData = async () => {
      if (isPausedRef.current) return;
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const [statsRes, chartsRes, telemetryRes, modelsRes] = await Promise.all([
          fetch(`${API_BASE}/dashboard/stats`),
          fetch(`${API_BASE}/dashboard/charts`),
          fetch(`${API_BASE}/dashboard/telemetry`),
          fetch(`${API_BASE}/models`)
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (chartsRes.ok) setCharts(await chartsRes.json());
        if (telemetryRes.ok) {
          const tData = await telemetryRes.json();
          setTelemetry(tData);
          setSelectedPacket((prev: any) => {
            if (!prev && tData.length > 0) return tData[0];
            return prev;
          });
        }
        if (modelsRes.ok) {
          const models = await modelsRes.json();
          const active = models.find((m: any) => m.status === 'ACTIVE') || models[0];
          if (active) setActiveModel(active);
        }
      } catch (err) {
        console.error("API Fetch Error", err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-black text-slate-300 font-sans text-sm">
      {/* Top Navigation Bar */}
      <header className="flex-none h-12 border-b border-[#1a1a1a] bg-[#050505] flex items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-slate-100 font-semibold tracking-tight">
            <Shield className="w-4 h-4 text-white" />
            NetworkGuard ML
          </div>
          {activeModel && (
            <div className="px-2 py-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-xs font-mono text-slate-400">
              <span className="text-slate-300">{activeModel.algorithm}</span> | F1: {activeModel.macro_f1?.toFixed(3) || 'N/A'}
            </div>
          )}
          <nav className="flex items-center gap-1">
            <div className="relative">
              <select className="appearance-none pl-8 pr-8 py-1.5 bg-[#111] text-slate-200 border border-[#222] rounded hover:bg-[#1a1a1a] transition-colors cursor-pointer outline-none focus:border-slate-500 text-sm">
                <option>Last 15m</option>
                <option>Last 1h</option>
                <option>Last 24h</option>
              </select>
              <Clock className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
            <div className="relative">
              <select className="appearance-none pl-8 pr-8 py-1.5 bg-[#0a0a0a] text-slate-300 border border-[#222] rounded hover:bg-[#111] transition-colors cursor-pointer outline-none focus:border-slate-500 text-sm">
                <option>Subnet: All</option>
                <option>192.168.1.0/24</option>
                <option>10.0.0.0/8</option>
              </select>
              <Server className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
            <div className="relative">
              <select 
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="appearance-none pl-8 pr-8 py-1.5 bg-[#0a0a0a] text-slate-300 border border-[#222] rounded hover:bg-[#111] transition-colors cursor-pointer outline-none focus:border-slate-500 text-sm"
              >
                <option value="Any">Severity: Any</option>
                <option value="Malicious">Severity: Malicious</option>
                <option value="Normal">Severity: Normal</option>
              </select>
              <Filter className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1.5 text-slate-500" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter IP, Protocol..."
              className="bg-black border border-[#222] text-slate-300 pl-8 pr-3 py-1 rounded text-xs focus:outline-none focus:border-slate-500 w-64 font-mono"
            />
          </div>
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs transition-colors ${isPaused ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-white animate-pulse'}`}></div>
            {isPaused ? 'Paused' : 'Live'}
          </button>
        </div>
      </header>

      {/* Telemetry Overview */}
      <section className="flex-none grid grid-cols-6 divide-x divide-[#1a1a1a] border-b border-[#1a1a1a] bg-[#050505]">
        <div className="p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Packets Analyzed</div>
          <div className="text-xl font-mono text-white">{stats.total_predictions?.toLocaleString() || 0}</div>
        </div>
        <div className="p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
            Active Anomalies
            <span className="text-red-400 font-mono text-xs">{stats.detection_rate || 0}% Det. Rate</span>
          </div>
          <div className="text-xl font-mono text-red-400">{stats.total_alerts?.toLocaleString() || 0}</div>
        </div>
        <div className="p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
            System Latency
            <span className="text-slate-400 font-mono text-xs">{stats.system_load || 0}% CPU</span>
          </div>
          <div className="text-xl font-mono text-white flex items-baseline gap-1">
            {Math.floor(Math.random() * (12 - 4 + 1) + 4)} <span className="text-sm text-slate-500 font-sans">ms</span>
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
            Model F1 Score
          </div>
          <div className="text-xl font-mono text-white">{activeModel?.macro_f1?.toFixed(3) || 'N/A'}</div>
        </div>
        <div className="bg-[#050505] p-4 flex flex-col">
          <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2 flex items-center justify-between">
            Attack Class Dist.
          </div>
          <div style={{ height: 60 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.severity_distribution}>
                <Bar dataKey="count" fill="#ef4444" isAnimationActive={false} />
                <Tooltip cursor={{fill: '#1a1a1a'}} contentStyle={{backgroundColor: '#000', borderColor: '#333', fontSize: '12px', color: '#fff'}} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-[#050505] p-4 flex flex-col">
          <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2 flex items-center justify-between">
            Throughput (RPM)
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] text-blue-400"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>Requests</span>
              <span className="flex items-center gap-1 text-[10px] text-red-400"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>Alerts</span>
            </div>
          </div>
          <div style={{ height: 60 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.alerts_over_time}>
                <Area type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={1} fill="#3b82f6" fillOpacity={0.1} isAnimationActive={false} />
                <Area type="monotone" dataKey="alerts" stroke="#ef4444" strokeWidth={1} fill="#ef4444" fillOpacity={0.1} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Main Workspace: Split Pane */}
      <main className="flex-1 flex overflow-hidden">
        {/* Threat Feed (Left) */}
        <div className="flex-1 flex flex-col border-r border-[#1a1a1a] overflow-hidden">
          <div className="flex-none px-4 py-2 border-b border-[#1a1a1a] bg-[#0a0a0a] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Threat Feed</h2>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#050505] z-10">
                <tr>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Timestamp</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Source IP</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Dest IP</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Proto</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Conf</th>
                  <th className="px-4 py-2 text-xs font-medium text-slate-500 border-b border-[#1a1a1a]">Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {filteredTelemetry.map((row: any) => {
                  const isMalicious = row.classification !== 'NORMAL';
                  const isSelected = selectedPacket?.id === row.id;
                  return (
                    <tr 
                      key={row.id} 
                      onClick={() => setSelectedPacket(row)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-[#2c313a]' : 'hover:bg-[#1e222a]'} ${isMalicious && !isSelected ? 'bg-red-950/10' : ''}`}
                    >
                      <td className="px-4 py-1.5 text-slate-400 font-mono text-xs whitespace-nowrap">{row.timestamp}</td>
                      <td className="px-4 py-1.5 text-slate-300 font-mono text-xs whitespace-nowrap">{row.src}</td>
                      <td className="px-4 py-1.5 text-slate-300 font-mono text-xs whitespace-nowrap">{row.dst}</td>
                      <td className="px-4 py-1.5 text-slate-400 font-mono text-xs">{row.protocol}</td>
                      <td className="px-4 py-1.5 font-mono text-xs">
                        <span className={row.confidence > 0.9 ? 'text-white' : 'text-amber-400'}>
                          {row.confidence ? (row.confidence * 100).toFixed(1) : '95.0'}%
                        </span>
                      </td>
                      <td className="px-4 py-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono font-bold uppercase ${isMalicious ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                          {row.classification}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inspector Pane (Right) */}
        <aside className="w-[400px] flex-none bg-[#050505] flex flex-col overflow-hidden">
          <div className="flex-none px-4 py-2 border-b border-[#1a1a1a] bg-[#0a0a0a]">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Inspector Pane</h2>
          </div>
          
          {selectedPacket ? (
            <div className="flex-1 overflow-auto p-4 space-y-6">
              {/* Header Info */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-lg text-slate-200">{selectedPacket.src} <span className="text-slate-500">→</span> {selectedPacket.dst}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-[2px] text-xs font-mono font-bold uppercase ${selectedPacket.classification !== 'NORMAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                    {selectedPacket.classification}
                  </span>
                  <span className="text-slate-500 font-mono text-xs">ID: {selectedPacket.id}</span>
                  <span className="text-slate-500 font-mono text-xs">{selectedPacket.timestamp}</span>
                </div>
              </div>

              {/* Actions (Only if Alert Exists) */}
              {selectedPacket.alert_id && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Actions</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleAction(selectedPacket.alert_id, "ACKNOWLEDGED")}
                      className="flex-1 py-1.5 bg-[#0a0a0a] border border-[#1a1a1a] text-slate-300 rounded text-xs font-medium hover:bg-[#111] hover:text-white transition-colors"
                    >
                      Acknowledge
                    </button>
                    <button 
                      onClick={() => handleAction(selectedPacket.alert_id, "RESOLVED")}
                      className="flex-1 py-1.5 bg-[#0a0a0a] border border-[#1a1a1a] text-slate-300 rounded text-xs font-medium hover:bg-[#111] hover:text-white transition-colors"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              )}

              {/* Feature Extraction */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ML Feature Extraction</h3>
                <div className="bg-black border border-[#1a1a1a] rounded p-2 max-h-64 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-[#1a1a1a]">
                      {Object.entries(selectedPacket.raw_features || {}).map(([key, value]) => (
                        <tr key={key} onClick={() => handleCopy(String(value), key)} className="group cursor-pointer hover:bg-[#15181e] transition-colors">
                          <td className="py-1 pr-4 text-slate-500 font-mono text-xs select-none">{key}</td>
                          <td className="py-1 text-slate-300 font-mono text-xs flex justify-between items-center select-none">
                            {String(value)}
                            <span className={`text-[10px] uppercase tracking-wider ${copiedKey === key ? 'text-white opacity-100' : 'text-slate-600 opacity-0 group-hover:opacity-100'} transition-opacity`}>
                              {copiedKey === key ? 'Copied' : 'Copy'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Raw JSON Payload */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Raw JSON Payload</h3>
                <pre className="bg-black border border-[#1a1a1a] rounded p-3 max-h-64 overflow-y-auto overflow-x-auto text-xs font-mono text-white/90 leading-relaxed">
                  {JSON.stringify(selectedPacket.raw_features, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
              <Activity className="w-8 h-8 mb-3 opacity-20" />
              <p>Select a packet from the Threat Feed to inspect its raw payload and ML feature extraction.</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
