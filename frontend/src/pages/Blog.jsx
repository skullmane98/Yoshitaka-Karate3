import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PublicLayout from "@/components/PublicLayout";
import api from "@/lib/api";
import { Loader2 } from "lucide-react";

export function BlogList() {
  const [posts, setPosts] = useState(null);

  useEffect(() => {
    api.get("/blog").then((r) => setPosts(r.data || [])).catch(() => setPosts([]));
  }, []);

  return (
    <PublicLayout>
      <section className="max-w-5xl mx-auto px-6 py-16" data-testid="blog-list-page">
        <div className="mb-12">
          <span className="hinomaru-dot inline-block mb-4" />
          <h1 className="font-serif text-5xl md:text-6xl tracking-tight">Dojo Blog</h1>
          <p className="text-[var(--dojo-ink-soft)] mt-3 max-w-2xl">
            News, belt tests, tournament recaps and reflections from the mat.
          </p>
        </div>
        {!posts ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div>
        ) : posts.length === 0 ? (
          <div className="border border-dashed border-[var(--dojo-border)] p-16 text-center text-[var(--dojo-ink-soft)]">
            No posts yet — check back soon.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-10">
            {posts.map((p) => (
              <Link
                key={p.id}
                to={`/blog/${p.slug}`}
                className="group block border border-[var(--dojo-border)] bg-[var(--dojo-paper)] hover:border-[var(--dojo-ink)] transition-colors"
                data-testid={`blog-card-${p.slug}`}
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
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get(`/blog/${slug}`).then((r) => setPost(r.data)).catch(() => setErr("Post not found."));
  }, [slug]);

  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-6 py-16" data-testid="blog-post-page">
        <Link to="/blog" className="text-xs uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)] hover:text-[var(--dojo-ink)]">← Back to blog</Link>
        {err && <div className="mt-10 text-[var(--dojo-hinomaru)]">{err}</div>}
        {!post && !err && <div className="mt-10"><Loader2 className="animate-spin" /></div>}
        {post && (
          <>
            <div className="mt-6 mb-2 text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)]">
              {new Date(post.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </div>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight mb-2">{post.title}</h1>
            <div className="text-sm text-[var(--dojo-ink-soft)] mb-8">by {post.author_name}</div>
            {post.cover_image && (
              <img src={post.cover_image} alt="" className="w-full mb-10 border border-[var(--dojo-border)]" />
            )}
            <div className="prose prose-lg max-w-none whitespace-pre-wrap">{post.body}</div>
          </>
        )}
      </article>
    </PublicLayout>
  );
}
