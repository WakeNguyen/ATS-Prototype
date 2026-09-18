"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Backward compatibility route for /candidates/[id].
 * Smoothly redirects to canonical Candidate 360 Workbench at /candidates?id=[id].
 */
export default function CandidateIdRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.id) {
      router.replace(`/candidates?id=${params.id}`);
    } else {
      router.replace("/candidates");
    }
  }, [params, router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-3 min-h-[calc(100vh-60px)]">
      <Loader2 size={32} className="animate-spin text-emerald-400" />
      <span className="text-xs font-semibold">Opening Candidate 360° Profile...</span>
    </div>
  );
}
