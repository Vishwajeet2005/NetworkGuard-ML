"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Database, BrainCircuit, Bell, LogOut } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Datasets", href: "/datasets", icon: Database },
    { name: "Models", href: "/models", icon: BrainCircuit },
    { name: "Alerts", href: "/alerts", icon: Bell },
  ];

  const handleLogout = () => {
    localStorage.removeItem("networkguard_auth");
    router.push("/login");
  };

  return (
    <nav className="w-14 flex-none bg-[#050505] border-r border-[#1a1a1a] flex flex-col items-center py-3">
      <div className="flex flex-col gap-2 flex-1 w-full items-center">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.name}
              className={`p-2.5 rounded-lg transition-colors flex items-center justify-center ${
                isActive ? "bg-[#111] text-slate-100" : "text-slate-500 hover:text-slate-100 hover:bg-[#1e222a]"
              }`}
            >
              <item.icon className="w-5 h-5" />
            </Link>
          );
        })}
      </div>
      
      <button 
        onClick={handleLogout}
        title="Logout"
        className="mt-auto p-2.5 rounded-lg transition-colors flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-950/30"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </nav>
  );
}
