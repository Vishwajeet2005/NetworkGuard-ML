"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const auth = localStorage.getItem("networkguard_auth");
    if (auth === "true") {
      setIsAuthenticated(true);
      if (pathname === "/login") {
        router.push("/");
      }
    } else {
      setIsAuthenticated(false);
      if (pathname !== "/login") {
        router.push("/login");
      }
    }
  }, [pathname, router]);

  if (isAuthenticated === null) {
    return <div className="h-screen w-screen bg-black flex items-center justify-center text-slate-500">Loading...</div>;
  }

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return <>{children}</>;
}
