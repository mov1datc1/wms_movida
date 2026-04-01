import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { API } from '../config/api';

interface UserData {
  id: string;
  email: string;
  nombre: string;
  rolId: string | null;
  rolNombre: string | null;
  almacenId: string | null;
  isSuperAdmin: boolean;
  permisos: string[];
}

interface AuthContextType {
  user: UserData | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginOtp: (email: string, code: string) => Promise<void>;
  requestOtp: (email: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  hasPermission: (modulo: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  loginOtp: async () => {},
  requestOtp: async () => ({ success: false, message: '' }),
  logout: () => {},
  hasPermission: () => false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('wms_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  async function verifyToken(t: string) {
    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        setUser(await res.json());
      } else {
        localStorage.removeItem('wms_token');
        setToken(null);
      }
    } catch {
      // Backend down — allow offline but clear token
      localStorage.removeItem('wms_token');
      setToken(null);
    }
    setLoading(false);
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error de autenticación');
    }

    const data = await res.json();
    localStorage.setItem('wms_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function loginOtp(email: string, code: string) {
    const res = await fetch(`${API}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Código OTP inválido');
    }

    const data = await res.json();
    localStorage.setItem('wms_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function requestOtp(email: string) {
    const res = await fetch(`${API}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  }

  function logout() {
    localStorage.removeItem('wms_token');
    setToken(null);
    setUser(null);
  }

  function hasPermission(modulo: string) {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return user.permisos.includes(modulo);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginOtp, requestOtp, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}
