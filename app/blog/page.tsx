import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { BookOpen, Calendar, Clock } from 'lucide-react';

interface BlogPost {
  title: string;
  date: string;
  slug: string;
  excerpt: string;
  readTime: number;
}

function getAllBlogPosts(): BlogPost[] {
  const postsDirectory = path.join(process.cwd(), 'blog/posts');
  
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(postsDirectory);
  const allPosts: BlogPost[] = [];

  fileNames.forEach((fileName) => {
    if (!fileName.endsWith('.md')) return;

    const filePath = path.join(postsDirectory, fileName);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    
    // Parse frontmatter
    const frontmatterMatch = fileContents.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch || !frontmatterMatch[1]) return;

    const frontmatter = frontmatterMatch[1];
    const titleMatch = frontmatter.match(/title:\s*(.+)/);
    const dateMatch = frontmatter.match(/date:\s*['"](.+?)['"]/);
    const slugMatch = frontmatter.match(/slug:\s*(.+)/);
    const excerptMatch = frontmatter.match(/excerpt:\s*['"](.+?)['"]/);
    const readTimeMatch = frontmatter.match(/readTime:\s*(\d+)/);

    if (titleMatch?.[1] && slugMatch?.[1]) {
      allPosts.push({
        title: titleMatch[1].trim(),
        date: dateMatch?.[1]?.trim() ?? '',
        slug: slugMatch[1].trim(),
        excerpt: excerptMatch?.[1]?.trim() ?? '',
        readTime: readTimeMatch?.[1] ? parseInt(readTimeMatch[1]) : 5,
      });
    }
  });

  // Sort by date, newest first
  return allPosts.sort((a, b) => {
    if (!a.date || !b.date) return 0;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

export default function BlogPage() {
  const posts = getAllBlogPosts();

  return (
    <div className="min-h-screen bg-white dark:bg-[var(--espresso-bg-dark)]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-[var(--espresso-h1)] mb-4">
            Blog
          </h1>
          <p className="text-lg text-neutral-600 dark:text-[var(--espresso-body)]">
            Insights, thoughts, and deep dives on mental models and learning.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-neutral-400 mb-4" />
            <p className="text-neutral-600 dark:text-[var(--espresso-body)]">
              No blog posts yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="border border-neutral-200 dark:border-[var(--espresso-accent)]/25 rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <Link href={`/blog/${post.slug}`}>
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-[var(--espresso-h1)] mb-3 hover:text-blue-600 dark:hover:text-[var(--espresso-accent)] transition-colors">
                    {post.title}
                  </h2>
                </Link>
                
                <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-[var(--espresso-body)] mb-4">
                  {post.date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <time dateTime={post.date}>
                        {new Date(post.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{post.readTime} min read</span>
                  </div>
                </div>

                {post.excerpt && (
                  <p className="text-neutral-700 dark:text-[var(--espresso-body)] mb-4 line-clamp-3">
                    {post.excerpt.replace(/\*\*/g, '')}
                  </p>
                )}

                <Link
                  href={`/blog/${post.slug}`}
                  className="text-blue-600 dark:text-[var(--espresso-accent)] hover:underline font-medium"
                >
                  Read more →
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
