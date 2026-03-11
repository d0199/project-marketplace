import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import Layout from "@/components/Layout";
import { blogStore, type BlogPost } from "@/lib/blogStore";
import { BASE_URL } from "@/lib/siteUrl";

interface Props {
  post: BlogPost;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ params }) => {
  const slug = params?.slug as string;
  try {
    console.log("[blog] Looking up slug:", slug);
    const post = await blogStore.getBySlug(slug);
    console.log("[blog] Found:", post ? `id=${post.id} status=${post.status}` : "null");
    if (!post || post.status !== "published") {
      return { notFound: true };
    }
    return { props: { post } };
  } catch (err) {
    console.error("[blog] Error fetching post:", err);
    return { notFound: true };
  }
};

/** Render blog content — if it already contains HTML tags (from TipTap editor), use as-is; otherwise convert legacy markdown */
function renderContent(content: string): string {
  // If content starts with an HTML tag, it's from TipTap — use directly
  if (/^\s*<[a-z]/.test(content)) return content;

  // Legacy markdown fallback
  let html = content
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  html = html.replace(/(<li>[\s\S]*?<\/li>)(?=\s*(?!<li>))/g, "<ul>$1</ul>");

  html = html
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<[huo]/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return html;
}

export default function BlogPostPage({ post }: Props) {
  const title = post.seoTitle || `${post.title} — mynextgym.com.au`;
  const description = post.seoDescription || post.excerpt || post.title;
  const url = `${BASE_URL}/resources/${post.slug}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description,
    url,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    ...(post.authorName && {
      author: { "@type": "Person", name: post.authorName },
    }),
    ...(post.coverImage && {
      image: post.coverImage,
    }),
    publisher: {
      "@type": "Organization",
      name: "mynextgym.com.au",
      url: BASE_URL,
      logo: { "@type": "ImageObject", url: `${BASE_URL}/icon-192.png` },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Resources", item: `${BASE_URL}/resources` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={url} />
        {post.coverImage && <meta property="og:image" content={post.coverImage} />}
        <meta property="article:published_time" content={post.publishedAt} />
        {post.tags.map((tag) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}
        <meta name="twitter:card" content={post.coverImage ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {post.coverImage && <meta name="twitter:image" content={post.coverImage} />}
        <link rel="canonical" href={url} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      </Head>
      <Layout>
        <article className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <nav className="text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-brand-orange">Home</Link>
            {" / "}
            <Link href="/resources" className="hover:text-brand-orange">Resources</Link>
            {" / "}
            <span className="text-gray-800 font-medium">{post.title}</span>
          </nav>

          {/* Header */}
          <header className="mb-8">
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {post.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-orange-50 text-brand-orange px-2 py-0.5 rounded-full font-medium">{tag}</span>
                ))}
              </div>
            )}
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">{post.title}</h1>
            {post.excerpt && (
              <p className="text-lg text-gray-500 leading-relaxed">{post.excerpt}</p>
            )}
            <div className="flex items-center gap-3 mt-4 text-sm text-gray-400">
              {post.authorName && <span>By {post.authorName}</span>}
              {post.publishedAt && (
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })}
                </time>
              )}
            </div>
          </header>

          {/* Cover image */}
          {post.coverImage && (
            <div className="mb-8 rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.coverImage}
                alt={post.coverImageAlt || post.title}
                className="w-full h-auto"
                loading="eager"
              />
            </div>
          )}

          {/* Content */}
          <div
            className="prose prose-gray max-w-none
              prose-headings:text-gray-900 prose-headings:font-semibold
              prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
              prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
              prose-a:text-brand-orange prose-a:font-medium hover:prose-a:underline
              prose-li:text-gray-700 prose-ul:my-4 prose-ol:my-4
              prose-strong:text-gray-900
              prose-img:rounded-xl"
            dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
          />

          {/* Footer CTA */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="bg-orange-50 rounded-xl p-6 text-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Find your next gym</h2>
              <p className="text-sm text-gray-500 mb-4">Search gyms and personal trainers near you across Australia.</p>
              <Link
                href="/"
                className="inline-flex items-center px-5 py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Search now
              </Link>
            </div>
          </div>

          {/* Back link */}
          <div className="mt-8">
            <Link href="/resources" className="text-sm text-brand-orange hover:underline font-medium">
              &larr; Back to all resources
            </Link>
          </div>
        </article>
      </Layout>
    </>
  );
}
