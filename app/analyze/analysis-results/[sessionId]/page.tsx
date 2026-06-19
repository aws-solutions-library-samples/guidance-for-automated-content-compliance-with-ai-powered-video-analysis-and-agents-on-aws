import { Suspense } from 'react';
import AnalysisResultsClient from './AnalysisResultsClient';

// This is a dynamic route (`[sessionId]`). For a static export (`output: 'export'`)
// Next.js requires `generateStaticParams`. The session IDs aren't known at build
// time — they're created at runtime — so we don't pre-render any specific pages
// here. CloudFront serves `index.html` as a fallback for these deep links (see the
// SPA error responses in amplify/frontend-hosting/resources.ts) and the client
// component below reads the sessionId from the URL via `useParams()`.
export function generateStaticParams() {
  return [];
}

// `AnalysisResultsClient` uses `useSearchParams()`, which must be wrapped in a
// Suspense boundary when statically rendered/exported.
export default function AnalysisResultsPage() {
  return (
    <Suspense>
      <AnalysisResultsClient />
    </Suspense>
  );
}
