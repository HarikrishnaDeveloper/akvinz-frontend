"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAdminToken } from "@/lib/adminApi";

export default function AdminIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getAdminToken() ? "/admin/dashboard" : "/admin/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#131724] flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  );
}
