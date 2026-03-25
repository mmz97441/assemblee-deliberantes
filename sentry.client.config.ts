import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Session replay for debugging
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0, // 100% when error occurs

  // Environment
  environment: process.env.NODE_ENV,

  // Don't send PII (names, emails) — this is a sensitive app
  sendDefaultPii: false,

  // Ignore common non-errors
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'Load failed',
    'Failed to fetch',
  ],
})
