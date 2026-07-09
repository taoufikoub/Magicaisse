import React, { createContext, useContext, useEffect, useState } from "react";

export interface DBUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: "owner" | "manager" | "cashier" | "stock manager" | "accountant";
  createdAt: string;
}

interface AuthContextType {
  user: any | null;
  dbUser: DBUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logOut: () => Promise<void>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [dbUser, setDbUser] = useState<DBUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const storedToken = token || localStorage.getItem("toyhub_token");
    const headers = {
      ...options.headers,
      "Content-Type": "application/json",
      ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
    };
    return fetch(url, { ...options, headers });
  };

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("toyhub_token");
      const storedUser = localStorage.getItem("toyhub_user");

      if (storedToken && storedUser) {
        setToken(storedToken);
        try {
          const parsedUser = JSON.parse(storedUser);
          setDbUser(parsedUser);

          // Verify with the backend to ensure the token is still valid
          const res = await fetch("/api/users/me", {
            headers: {
              Authorization: `Bearer ${storedToken}`,
              "Content-Type": "application/json",
            },
          });

          if (res.ok) {
            const freshProfile = await res.json();
            setDbUser(freshProfile);
            localStorage.setItem("toyhub_user", JSON.stringify(freshProfile));
          } else {
            // Token is invalid/expired
            clearAuth();
          }
        } catch (err) {
          console.error("Failed to parse stored user profile", err);
          clearAuth();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const clearAuth = () => {
    localStorage.removeItem("toyhub_token");
    localStorage.removeItem("toyhub_user");
    setToken(null);
    setDbUser(null);
  };

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const res = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem("toyhub_token", data.token);
        localStorage.setItem("toyhub_user", JSON.stringify(data.user));
        setToken(data.token);
        setDbUser(data.user);
        setLoading(false);
        return { success: true };
      } else {
        setLoading(false);
        return { success: false, error: data.error || "Login failed" };
      }
    } catch (err: any) {
      setLoading(false);
      return { success: false, error: err.message || "Network error" };
    }
  };

  const logOut = async () => {
    setLoading(true);
    clearAuth();
    setLoading(false);
  };

  // user state is mapped to dbUser for easy retro-compatibility
  return (
    <AuthContext.Provider
      value={{
        user: dbUser,
        dbUser,
        token,
        loading,
        login,
        logOut,
        fetchWithAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
