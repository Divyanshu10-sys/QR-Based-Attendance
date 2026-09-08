// API endpoint configuration.
// Local development automatically uses the local Express server.
// For production, set PRODUCTION_API_BASE_URL to your Render backend URL
// including /api, for example: https://your-backend.onrender.com/api
window.PRODUCTION_API_BASE_URL = window.PRODUCTION_API_BASE_URL || '';

window.API_BASE_URL = (function () {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }

  // If a production backend URL was configured, use it.
  if (window.PRODUCTION_API_BASE_URL && !window.PRODUCTION_API_BASE_URL.includes('YOUR-RENDER')) {
    return window.PRODUCTION_API_BASE_URL.replace(/\/$/, '');
  }

  // Relative /api keeps the frontend functional if Vercel is configured to proxy
  // /api to the backend. Otherwise, the request error will clearly identify the
  // missing production backend configuration.
  return '/api';
})();
