// Central API configuration — reads from VITE_API_URL env variable
// In production (Vercel): set VITE_API_URL to your Render backend URL
// In development: defaults to localhost:3001
export const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';
