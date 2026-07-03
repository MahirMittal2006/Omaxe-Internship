import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { fetchCurrentUser, loginUser } from '../utils/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'claude-wrapper-token';

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsBootstrapping(false);
      return;
    }

    fetchCurrentUser(token)
      .then((currentUser) => {
        setIsAuthenticated(true);
        setUser(currentUser);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setIsBootstrapping(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const { token, user: authenticatedUser } = await loginUser(username, password);
    localStorage.setItem(TOKEN_KEY, token);
    setIsAuthenticated(true);
    setUser(authenticatedUser);
    return authenticatedUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isBootstrapping, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
