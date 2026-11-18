"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomeRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <div className="flex items-center justify-center py-20 text-sm text-muted">
      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
      Opening dashboard…
    </div>
  );
}
