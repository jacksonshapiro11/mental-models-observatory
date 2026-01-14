import fs from 'fs';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import path from 'path';
import ReactMarkdown from 'react-markdown';

interface BlogPost {
  title: string;
  date: string;
  slug: string;
  excerpt: string;
  readTime: number;
  content: string;
}

function getBlogPost(slug: string): BlogPost | null {
  const postsDirectory = path.join(process.cwd(), 'blog/posts');
  
  if (!fs.existsSync(postsDirectory)) {
    return null;
  }

  const fileNames = fs.readdirSync(postsDirectory);
  
  for (const fileName of fileNames) {
    if (!fileName.endsWith('.md')) continue;

    const filePath = path.join(postsDirectory, fileName);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    
    // Parse frontmatter
    const frontmatterMatch = fileContents.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch || !frontmatterMatch[1]) continue;

    const frontmatter = frontmatterMatch[1];
    const slugMatch = frontmatter.match(/slug:\s*(.+)/);
    
    if (slugMatch && slugMatch[1] && slugMatch[1].trim() === slug) {
      const titleMatch = frontmatter.match(/title:\s*(.+)/);
      const dateMatch = frontmatter.match(/date:\s*['"](.+?)['"]/);
      const excerptMatch = frontmatter.match(/excerpt:\s*['"](.+?)['"]/);
      const readTimeMatch = frontmatter.match(/readTime:\s*(\d+)/);
      
      const content = fileContents.replace(/^---\n[\s\S]*?\n---\n/, '');

      return {
        title: titleMatch?.[1]?.trim() ?? '',
        date: dateMatch?.[1]?.trim() ?? '',
        slug: slugMatch[1]?.trim() ?? slug,
        excerpt: excerptMatch?.[1]?.trim() ?? '',
        readTime: readTimeMatch?.[1] ? parseInt(readTimeMatch[1]) : 5,
        content,
      };
    }
  }

  return null;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[var(--espresso-bg-dark)]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-neutral-600 dark:text-[var(--espresso-body)] hover:text-neutral-900 dark:hover:text-[var(--espresso-h1)] mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        {/* Article header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-[var(--espresso-h1)] mb-4">
            {post.title}
          </h1>
          
          <div className="flex items-center justify-center gap-4 text-sm text-neutral-600 dark:text-[var(--espresso-body)]">
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
        </header>

        {/* Article content */}
        <article className="prose prose-lg dark:prose-invert max-w-none prose-headings:text-center prose-headings:font-bold prose-p:text-neutral-900 dark:prose-p:text-white prose-strong:text-neutral-900 dark:prose-strong:text-white prose-h2:text-neutral-900 dark:prose-h2:text-white prose-h3:text-neutral-900 dark:prose-h3:text-white prose-img:mx-auto prose-img:rounded-lg">
          <ReactMarkdown>
            {post.content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}

