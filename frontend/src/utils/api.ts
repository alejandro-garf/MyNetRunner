import axios, { AxiosError } from 'axios';
import type { AuthCredentials, RegisterCredentials, AuthResponse } from '../types';

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Token management functions
export const getToken = (): string | null => {
  return localStorage.getItem('token');
};

export const setToken = (token: string): void => {
  localStorage.setItem('token', token);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem('refreshToken');
};

export const setRefreshToken = (token: string): void => {
  localStorage.setItem('refreshToken', token);
};

export const removeTokens = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
};

export const removeToken = (): void => {
  removeTokens();
};

export const getUsername = (): string | null => {
  return localStorage.getItem('username');
};

export const setUsername = (username: string): void => {
  localStorage.setItem('username', username);
};

export const getUserId = (): number | null => {
  const userId = localStorage.getItem('userId');
  return userId ? parseInt(userId) : null;
};

export const setUserId = (userId: number | undefined): void => {
  if (userId !== undefined && userId !== null) {
    localStorage.setItem('userId', userId.toString());
  }
};

// Auth API calls
export const authAPI = {
  // Register new user
  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    try {
      const { confirmPassword, ...registerData } = credentials;
      const response = await api.post('/api/auth/register', registerData);

      console.log('Register response:', response.data);

      const data = response.data;
      return {
        token: '',
        username: data.username,
        userId: data.userId || 0,
        message: data.message,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        console.error('Register error:', error.response?.data);
        throw new Error(error.response?.data?.error || 'Registration failed');
      }
      throw new Error('An unexpected error occurred');
    }
  },

  // Login user
  login: async (credentials: AuthCredentials): Promise<AuthResponse> => {
    try {
      const response = await api.post('/api/auth/login', credentials);

      console.log('Login response:', response.data);

      const data = response.data;

      if (!data.userId) {
        console.error('Backend did not return userId! Full response:', data);
      }

      // Store refresh token if provided
      if (data.refreshToken) {
        setRefreshToken(data.refreshToken);
      }

      return {
        token: data.token,
        username: data.username,
        userId: data.userId || 0,
        message: data.message,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        console.error('Login error:', error.response?.data);
        throw new Error(error.response?.data?.error || 'Login failed');
      }
      throw new Error('An unexpected error occurred');
    }
  },

  // Refresh access token
  refreshToken: async (): Promise<string | null> => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        return null;
      }

      const response = await api.post('/api/auth/refresh', { refreshToken });
      const newToken = response.data.token;

      if (newToken) {
        setToken(newToken);
        return newToken;
      }
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  },

  // Logout user
  logout: async (): Promise<void> => {
    try {
      const token = getToken();
      const refreshToken = getRefreshToken();

      if (token) {
        await api.post('/api/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local storage
      removeTokens();
      localStorage.removeItem('username');
      localStorage.removeItem('userId');
    }
  },
};

// User API calls
export const userAPI = {
  // Get user online status
  getUserStatus: async (username: string): Promise<{ username: string; online: boolean }> => {
    try {
      const response = await api.get(`/api/users/${username}/status`);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to fetch user status');
      }
      throw new Error('An unexpected error occurred');
    }
  },

  // Get all online users
  getOnlineUsers: async (): Promise<{ count: number; users: string[] }> => {
    try {
      const response = await api.get('/api/users/online');
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Failed to fetch online users');
      }
      throw new Error('An unexpected error occurred');
    }
  },

  // Get user by username (for encryption - need userId)
  getByUsername: async (username: string): Promise<{ id: number; username: string } | null> => {
    try {
      const response = await api.get(`/api/users/by-username/${username}`);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        return null;
      }
      console.error('Failed to get user by username:', error);
      return null;
    }
  },
};

export default api;