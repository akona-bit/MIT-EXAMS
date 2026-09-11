import axios from 'axios';
import { supabase } from '../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_BASE_URL,
});

client.interceptors.request.use(
  async (config) => {
    // 1. Try to get active Supabase session (this automatically handles token refresh for Teachers/Admins!)
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.access_token) {
      // Keep localStorage in sync for other parts of the app
      localStorage.setItem('access_token', session.access_token);
      config.headers.Authorization = `Bearer ${session.access_token}`;
    } else {
      // 2. Fallback for Student custom JWT (which doesn't use Supabase session)
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // ignore
      }
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
