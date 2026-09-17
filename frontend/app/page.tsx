"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, ShieldCheck, Activity } from "lucide-react";
import { useState } from "react";

const mockData = [
  { time: "10:00", requests: 120, alerts: 2 },
  { time: "10:05", requests: 300, alerts: 15 },
  { time: "10:10", requests: 150, alerts: 1 },
  { time: "10:15", requests: 800, alerts: 45 },
  { time: "10:20", requests: 110, alerts: 0 },
];

const mockAlerts = [
  { id: 1, type: "DoS", severity: "HIGH", src: "192.168.1.10", dst: "10.0.0.5", time: "10:15:22" },
  { id: 2, type: "Probe", severity: "MEDIUM", src: "192.168.1.15", dst: "10.0.0.2", time: "10:15:30" },
  { id: 3, type: "U2R", severity: "CRITICAL", src: "172.16.0.4", dst: "10.0.0.8", time: "10:15:45" },
];

export default function Dashboard() {
  const [stats] = useState({ total: 1480, threats: 63, uptime: "99.9%" });

  return (
    <main className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NetworkGuard ML</h1>
          <p className="text-gray-500">Real-time NSL-KDD Intrusion Detection System</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="font-medium text-sm">System Active</span>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Activity size={24} /></div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Packets (1h)</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border flex items-start gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg"><AlertTriangle size={24} /></div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Threats Blocked</p>
            <p className="text-3xl font-bold">{stats.threats}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border flex items-start gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg"><ShieldCheck size={24} /></div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Uptime</p>
            <p className="text-3xl font-bold">{stats.uptime}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
          <h2 className="text-lg font-semibold mb-6">Traffic & Alerts</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="alerts" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-col">
          <h2 className="text-lg font-semibold mb-4">Recent Alerts</h2>
          <div className="flex-1 overflow-auto space-y-4">
            {mockAlerts.map(alert => (
              <div key={alert.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-1 text-xs font-bold rounded-md ${
                    alert.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                    alert.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {alert.severity}
                  </span>
                  <span className="text-xs text-gray-500">{alert.time}</span>
                </div>
                <div className="text-sm font-medium">{alert.type} Attack Detected</div>
                <div className="text-xs text-gray-500 mt-1">
                  {alert.src} → {alert.dst}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
