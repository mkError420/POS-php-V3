const getApiBaseUrl = () => {
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocalhost) {
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  }

  // Production build: use relative backend directory from current host origin
  return `${window.location.origin}/backend`;
};

const rawBaseUrl = getApiBaseUrl();
const API_BASE_URL = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;

export default API_BASE_URL;
