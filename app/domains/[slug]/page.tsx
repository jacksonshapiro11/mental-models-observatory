'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function DomainRedirect({ params }: PageProps) {
  const router = useRouter();

  useEffect(() => {
    const redirect = async () => {
      const { slug } = await params;
      router.replace(`/knowledge-domains/${slug}`);
    };
    redirect();
  }, [params, router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}


