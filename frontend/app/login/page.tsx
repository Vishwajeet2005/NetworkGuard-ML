"use client";
import React, { useState } from "react";
import { Shield, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Hardcoded credentials for college project demo
    if (username === "admin" && password === "admin") {
      localStorage.setItem("networkguard_auth", "true");
      router.push("/");
    } else {
      setError("Invalid credentials. Hint: admin / admin");
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-black border border-[#222] border-t-2 border-t-white rounded p-8 relative overflow-hidden group">
        
        {/* Decorative corner brackets */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/50"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/50"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#333]"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#333]"></div>

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-12 h-12 bg-white/5 rounded flex items-center justify-center mb-4 border border-white/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-widest uppercase font-mono">NetworkGuard<span className="text-white">_ML</span></h1>
          <p className="text-[10px] font-mono text-slate-500 mt-2 uppercase tracking-[0.2em]">NIDS Pipeline Control</p>
          <div className="mt-4 px-2 py-0.5 bg-white/10 border border-white/20 text-white text-[9px] font-mono uppercase tracking-widest rounded-sm">System: Secure</div>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
          <div>
            <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5 flex justify-between">
              <span>Auth_ID</span>
              <span className="text-[#333]">[REQ]</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#050505] border border-[#222] rounded-sm px-3 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-white/50 focus:bg-black transition-colors"
              placeholder="root"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5 flex justify-between">
              <span>Pass_Key</span>
              <span className="text-[#333]">[REQ]</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#050505] border border-[#222] rounded-sm px-3 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-white/50 focus:bg-black transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-red-400 text-[10px] font-mono bg-red-500/10 border border-red-500/20 rounded-sm p-2 text-center uppercase tracking-wider">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/30 font-mono font-bold text-xs py-2.5 rounded-sm transition-all flex items-center justify-center gap-2 mt-6 uppercase tracking-widest"
          >
            <Lock className="w-3 h-3" /> Initialize Session
          </button>
        </form>
      </div>
    </div>
  );
}
