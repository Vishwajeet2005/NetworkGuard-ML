"use client";
import "./globals.css";
import Sidebar from "./Sidebar";
import AuthGuard from "./AuthGuard";
import { usePathname } from "next/navigation";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <html lang="en">
      <body className="bg-black bg-grid-pattern font-sans text-slate-300 relative">
        <AuthGuard>
          <div className="flex h-screen">
            {!isLoginPage && <Sidebar />}
            <div className="flex-1 overflow-hidden">{children}</div>
          </div>
        </AuthGuard>
      </body>
    </html>
  );
}
