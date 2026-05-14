import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Loader2, ArrowLeft } from "lucide-react";

/**
 * Read-only blog viewer for embedding inside dashboards.
 * Lists published posts and lets the user open one inline.
 */
export default function BlogReader() {
  const [posts, setPosts] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.get("/blog").then((r) => setPosts(r.data || [])).catch(() => setPosts([]));
  }, []);

  if (open) {
    return (
      <article className="max-w-3xl" data-testid="blog-reader-post">
        <button
          onClick={() => setOpen(null)}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)] hover:text-[var(--dojo-ink)] mb-6"
          data-testid="blog-reader-back"
        >
          <ArrowLeft size={12} /> Back to posts
        </button>
        <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)] mb-2">
          {new Date(open.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        </div>
        <h1 className="font-serif text-4xl tracking-tight mb-2">{open.title}</h1>
        <div className="text-sm text-[var(--dojo-ink-soft)] mb-8">by {open.author_name}</div>
        {open.cover_image && (
          <img src={open.cover_image} alt="" className="w-full mb-10 border border-[var(--dojo-border)]" />
        )}
        <div className="prose prose-lg max-w-none whitespace-pre-wrap">{open.body}</div>
      </article>
    );
  }

  return (
    <div data-testid="blog-reader-list">
      {!posts ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div>
      ) : posts.length === 0 ? (
        <div className="border border-dashed border-[var(--dojo-border)] p-16 text-center text-[var(--dojo-ink-soft)]">
          No posts yet — check back soon.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {posts.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpen(p)}
              className="group text-left border border-[var(--dojo-border)] bg-[var(--dojo-paper)] hover:border-[var(--dojo-ink)] transition-colors"
              data-testid={`blog-reader-card-${p.slug}`}
            >
              {p.cover_image && (
                <div className="aspect-[16/9] overflow-hidden bg-[var(--dojo-input-bg)]">
                  <img src={p.cover_image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
              )}
              <div className="p-6">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)] mb-2">
                  {new Date(p.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </div>
                <h2 className="font-serif text-2xl tracking-tight group-hover:text-[var(--dojo-green)] transition-colors">{p.title}</h2>
                {p.excerpt && <p className="text-sm text-[var(--dojo-ink-soft)] mt-2 line-clamp-3">{p.excerpt}</p>}
                <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)] mt-4">{p.author_name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
