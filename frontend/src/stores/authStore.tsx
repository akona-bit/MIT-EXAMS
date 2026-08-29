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
import { supabase } from "../lib/supabase";
import posthog from "../lib/posthog";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setToken(session.access_token);
        try {
          // getMe() calls the backend, which now will lazily create/sync the user
          // based on the Supabase JWT.
          const u = await getMe();
          setUser(u);
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            posthog.identify(session.user.id, { email: session.user.email });
          }
        } catch (e) {
          console.error("Failed to fetch user profile", e);
          setUser(null);
        }
      } else {
        setToken(null);
        setUser(null);
        posthog.reset();
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    setIsLoading(true);
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.username, // Using the username field as email
      password: data.password,
    });
    
    if (error) {
      setIsLoading(false);
      throw error;
    }
    
    // onAuthStateChange will trigger, but we also return immediately
    setToken(authData.session.access_token);
    try {
      const u = await getMe();
      setUser(u);
      return u;
    } catch (e) {
      setIsLoading(false);
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
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
