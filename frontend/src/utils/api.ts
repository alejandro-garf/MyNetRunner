import axios, { AxiosError } from 'axios';
import type { AuthCredentials, RegisterCredentials, AuthResponse } from '../types';
import type { Message } from '../types';

// Create axios instance with credentials and privacy headers
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  withCredentials: true, // Enable sending cookies with requests
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
});

// Named export for use in websocket.ts
export { api };

// User session management (non-sensitive data only)
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

export const clearUserSession = (): void => {
  localStorage.removeItem('username');
  localStorage.removeItem('userId');
};

// Auth API calls
export const authAPI = {
  // Register new user - tokens set via httpOnly cookies
  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    try {
      const { confirmPassword, ...registerData } = credentials;
      const response = await api.post('/api/auth/register', registerData);

      const data = response.data;
      return {
        token: '', // No longer returned - using httpOnly cookies
        username: data.username,
        userId: data.userId || 0,
        message: data.message,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Registration failed');
      }
      throw new Error('An unexpected error occurred');
    }
  },

  // Login user - tokens set via httpOnly cookies
  login: async (credentials: AuthCredentials): Promise<AuthResponse> => {
    try {
      const response = await api.post('/api/auth/login', credentials);
      const data = response.data;

      return {
        token: '', // No longer returned - using httpOnly cookies
        username: data.username,
        userId: data.userId || 0,
        message: data.message,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.error || 'Login failed');
      }
      throw new Error('An unexpected error occurred');
    }
  },

  // Refresh access token - handled automatically via cookies
  refreshToken: async (): Promise<boolean> => {
    try {
      await api.post('/api/auth/refresh');
      return true;
    } catch (error) {
      return false;
    }
  },

  // Logout user - clears server-side session and cookies
  logout: async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      // Ignore errors - clear local data anyway
    } finally {
      // Clear local user session
      clearUserSession();
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
      return null;
    }
  },
};

export default api;

// Friends API calls
export const friendsAPI = {
  // Send friend request
  sendRequest: async (username: string): Promise<{ message: string }> => {
    const response = await api.post(`/api/friends/request/${username}`);
    return response.data;
  },

  // Accept friend request
  acceptRequest: async (friendshipId: number): Promise<{ message: string }> => {
    const response = await api.post(`/api/friends/accept/${friendshipId}`);
    return response.data;
  },

  // Reject friend request
  rejectRequest: async (friendshipId: number): Promise<{ message: string }> => {
    const response = await api.post(`/api/friends/reject/${friendshipId}`);
    return response.data;
  },

  // Remove friend
  removeFriend: async (friendshipId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/api/friends/${friendshipId}`);
    return response.data;
  },

  // Get all friends
  getFriends: async (): Promise<{ friends: Array<{ id: number; username: string }> }> => {
    const response = await api.get('/api/friends');
    return response.data;
  },

  // Get pending requests
  getPendingRequests: async (): Promise<{ requests: Array<{ friendshipId: number; userId: number; username: string; createdAt: string }> }> => {
    const response = await api.get('/api/friends/requests');
    return response.data;
  },

  // Check if friends with someone
  checkFriendship: async (username: string): Promise<{ areFriends: boolean }> => {
    const response = await api.get(`/api/friends/check/${username}`);
    return response.data;
  },
};

// Groups API calls
export const groupsAPI = {
  // Create a new group
  create: async (name: string): Promise<{ message: string; groupId: number; name: string }> => {
    const response = await api.post('/api/groups', { name });
    return response.data;
  },

  // Get my groups
  getMyGroups: async (): Promise<{ groups: Array<{ id: number; name: string; createdBy: number; memberCount: number; myRole: 'OWNER' | 'ADMIN' | 'MEMBER' }> }> => {
    const response = await api.get('/api/groups');
    return response.data as { groups: Array<{ id: number; name: string; createdBy: number; memberCount: number; myRole: 'OWNER' | 'ADMIN' | 'MEMBER' }> };
  },

  // Get group details
  getGroup: async (groupId: number): Promise<{ id: number; name: string; createdBy: number; members: Array<{ id: number; username: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' }> }> => {
    const response = await api.get(`/api/groups/${groupId}`);
    return response.data as { id: number; name: string; createdBy: number; members: Array<{ id: number; username: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' }> };
  },

  // Get group members
  getMembers: async (groupId: number): Promise<{ members: Array<{ id: number; username: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' }> }> => {
    const response = await api.get(`/api/groups/${groupId}/members`);
    return response.data as { members: Array<{ id: number; username: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' }> };
  },

  // Add member to group
  addMember: async (groupId: number, username: string): Promise<{ message: string }> => {
    const response = await api.post(`/api/groups/${groupId}/members`, { username });
    return response.data;
  },

  // Remove member from group
  removeMember: async (groupId: number, memberId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/api/groups/${groupId}/members/${memberId}`);
    return response.data;
  },

  // Leave group
  leave: async (groupId: number): Promise<{ message: string }> => {
    const response = await api.post(`/api/groups/${groupId}/leave`);
    return response.data;
  },

  // Delete group
  delete: async (groupId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/api/groups/${groupId}`);
    return response.data;
  },
};

// Messages API
export const messagesAPI = {
  // Get pending messages (for offline delivery)
  getPending: async (): Promise<{ messages: Message[] }> => {
    const response = await api.get('/api/messages/pending');
    return response.data;
  },
};
