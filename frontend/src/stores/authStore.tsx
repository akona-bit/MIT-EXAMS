import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { User, LoginRequest } from "../types";
import { getMe } from "../api/auth";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<User>;
  loginWithToken: (token: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('access_token');
      if (storedToken) {
        try {
          setToken(storedToken);
          const u = await getMe();
          setUser(u);
        } catch {
          localStorage.removeItem('access_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    setIsLoading(true);
    try {
      // Use Supabase signInWithPassword for password-based login
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase not configured");
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.username,
        password: data.password,
      });

      if (error) throw error;

      const jwtToken = authData.session.access_token;
      localStorage.setItem('access_token', jwtToken);
      setToken(jwtToken);

      const u = await getMe();
      setUser(u);
      return u;
    } catch (e) {
      setIsLoading(false);
      throw e;
    }
  }, []);

  const loginWithToken = useCallback(async (jwtToken: string) => {
    setIsLoading(true);
    try {
      localStorage.setItem('access_token', jwtToken);
      setToken(jwtToken);

      const u = await getMe();
      setUser(u);
      return u;
    } catch (e) {
      localStorage.removeItem('access_token');
      setToken(null);
      setUser(null);
      setIsLoading(false);
      throw e;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
