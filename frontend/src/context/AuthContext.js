import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);
const API = "http://localhost:8000/auth";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  const saveToken = (t) => {
    setToken(t);
    if (t) localStorage.setItem("token", t);
    else localStorage.removeItem("token");
  };

  // Restore session on mount
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${API}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setUser)
      .catch(() => {
        saveToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");

    saveToken(data.access_token);

    const meRes = await fetch(`${API}/me`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const userData = await meRes.json();
    setUser(userData);
  }, []);

  const register = useCallback(async (username, email, password) => {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Registration failed");

    // Auto-login after successful registration
    await login(username, password);
  }, [login]);

  const logout = useCallback(() => {
    saveToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
