'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DomainsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/knowledge-domains');
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

