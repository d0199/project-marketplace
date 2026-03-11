import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import Layout from "@/components/Layout";
import { blogStore, type BlogPost } from "@/lib/blogStore";
import { BASE_URL } from "@/lib/siteUrl";

interface Props {
  posts: BlogPost[];
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const posts = await blogStore.getPublished();
  return { props: { posts } };
};

export default function BlogIndex({ posts }: Props) {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog` },
    ],
  };

  return (
    <>
      <Head>
        <title>Gym & Fitness Blog — mynextgym.com.au</title>
        <meta
          name="description"
          content="Tips, guides, and insights on finding the right gym, choosing a personal trainer, and getting the most out of your fitness journey across Australia."
        />
        <meta property="og:title" content="Gym & Fitness Blog — mynextgym.com.au" />
        <meta property="og:description" content="Tips, guides, and insights on finding the right gym and personal trainer across Australia." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${BASE_URL}/blog`} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Gym & Fitness Blog — mynextgym.com.au" />
        <meta name="twitter:description" content="Tips, guides, and insights on finding the right gym and personal trainer across Australia." />
        <link rel="canonical" href={`${BASE_URL}/blog`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      </Head>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Blog</h1>
          <p className="text-gray-500 mb-8">Tips, guides, and insights for your fitness journey.</p>

          {posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400">No posts yet. Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <article key={post.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  <Link href={`/blog/${post.slug}`} className="block">
                    {post.coverImage && (
                      <div className="relative h-48 sm:h-56 bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.coverImage}
                          alt={post.coverImageAlt || post.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {post.tags.map((tag) => (
                            <span key={tag} className="text-xs bg-orange-50 text-brand-orange px-2 py-0.5 rounded-full font-medium">{tag}</span>
                          ))}
                        </div>
                      )}
                      <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-brand-orange">{post.title}</h2>
                      {post.excerpt && <p className="text-gray-500 text-sm leading-relaxed mb-3">{post.excerpt}</p>}
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {post.authorName && <span>By {post.authorName}</span>}
                        {post.publishedAt && (
                          <time dateTime={post.publishedAt}>
                            {new Date(post.publishedAt).toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })}
                          </time>
                        )}
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
