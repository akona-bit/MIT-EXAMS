import posthog from 'posthog-js';

const posthogKey = import.meta.env.VITE_POSTHOG_KEY || '';
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    autocapture: true,
    capture_pageview: true,
  });
} else {
  console.warn('PostHog Key is missing. Analytics will be disabled.');
}

export default posthog;
