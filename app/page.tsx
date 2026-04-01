'use client';

import dynamic from 'next/dynamic';

const SwapComponent = dynamic(() => import('../components/Swap'), {
  ssr: false,           // ← This prevents build error
});

export default function SwapPage() {
  return <SwapComponent />;
}
