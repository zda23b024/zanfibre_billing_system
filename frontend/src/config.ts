export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const SOCKET_BASE_URL = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4) || '/'
  : API_BASE_URL;
