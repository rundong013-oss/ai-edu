"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";

export function LicenseToggle({ studentId, courseId, on }: { studentId: string; courseId: string; on: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(on);
  return (
    <button
      aria-pressed={v}
      aria-label={v ? "取消授权" : "授权"}
      onClick={async () => {
        setV(!v);
        await fetch("/api/admin/licenses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentId, courseId, grant: !v }) });
        router.refresh();
      }}
      className={`grid h-7 w-7 place-items-center rounded-md border transition-colors ${v ? "border-spark bg-spark text-night" : "border-line text-transparent hover:border-muted"}`}
    >
      <Check size={15} />
    </button>
  );
}
