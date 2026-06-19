import { Suspense } from 'react';
import AnalysisResultsClient from './AnalysisResultsClient';

// This is a dynamic route (`[sessionId]`). For a static export (`output: 'export'`)
// Next.js requires `generateStaticParams` to return at least one entry — an empty
// array is rejected as "missing" in Next 14. Real session IDs are created at
// runtime and aren't known at build time, so we emit a single throwaway page.
// Actual deep links (e.g. /analyze/analysis-results/<realId>) are served by the
// CloudFront SPA fallback (403/404 -> /index.html, see
// amplify/frontend-hosting/resources.ts) and the client component reads the
// sessionId from the URL via `useParams()`.
export function generateStaticParams() {
  return [{ sessionId: 'placeholder' }];
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
