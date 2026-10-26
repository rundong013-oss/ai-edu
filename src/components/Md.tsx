// 极简 markdown：小标题（###）、段落、引用、有序/无序列表、**加粗**。课程目标和教案够用了。
function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <strong key={i} className="text-ink">{p.slice(2, -2)}</strong> : p));
}

export function Md({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className={`space-y-3 text-sm leading-relaxed text-ink/80 ${className}`}>
      {blocks.map((b, i) => {
        if (/^#{1,4}\s/.test(b) && !b.includes("\n"))
          return (
            <h3 key={i} className="pt-2 text-[15px] font-semibold text-ink">
              {inline(b.replace(/^#{1,4}\s/, ""))}
            </h3>
          );
        const lines = b.split("\n");
        if (lines.every((l) => /^\d+\.\s/.test(l)))
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\d+\.\s/, ""))}</li>
              ))}
            </ol>
          );
        if (lines.every((l) => /^[-*]\s/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^[-*]\s/, ""))}</li>
              ))}
            </ul>
          );
        if (b.startsWith(">"))
          return (
            <blockquote key={i} className="border-l-2 border-amber/60 pl-3 text-muted">
              {inline(b.replace(/^>\s?/gm, ""))}
            </blockquote>
          );
        return <p key={i}>{inline(b)}</p>;
      })}
    </div>
  );
}
