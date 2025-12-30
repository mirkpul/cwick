import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/api';
import { User } from '../types';
import { getToken, getUser, saveAuth, clearAuth } from '../utils/authStorage';
import { getErrorMessage } from '../utils/apiErrors';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  register: (email: string, password: string, fullName: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      const savedUser = getUser();

      if (token && savedUser) {
        try {
          setUser(savedUser as User);
          // Optionally verify token with backend
          const response = await authAPI.getMe();
          setUser(response.data.user as User);
        } catch {
          clearAuth();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login({ email, password });
      const { user, token } = response.data;

      saveAuth(token, user);
      setUser(user as User);

      return { success: true, user: user as User };
    } catch (error: unknown) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    try {
      const response = await authAPI.register({ email, password, fullName });
      const { user, token } = response.data;

      saveAuth(token, user);
      setUser(user as User);

      return { success: true, user: user as User };
    } catch (error: unknown) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
