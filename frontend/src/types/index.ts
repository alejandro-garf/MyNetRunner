// User authentication types
export interface AuthCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials extends AuthCredentials {
  confirmPassword?: string;
}

export interface AuthResponse {
  token: string;
  username: string;
  userId: number;
  message?: string;
}

export interface User {
  id: number;
  username: string;
}

// Message types for chat functionality
export interface Message {
  id: number;
  senderId: number;
  senderUsername: string;
  receiverId: number;
  content: string;
  timestamp: string;
  delivered: boolean;
  isEncrypted?: boolean;
  groupId?: number;
  groupName?: string;
}

export interface Contact {
  id: number;
  username: string;
  lastMessage?: string;
  time?: string;
  unread?: number;
}

// Group types
export interface Group {
  id: number;
  name: string;
  createdBy: number;
  memberCount: number;
  myRole: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface GroupMember {
  id: number;
  username: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

// API error response
export interface ApiError {
  message: string;
  status?: number;
}

// Page types for navigation
export type PageType = 'home' | 'signin' | 'signup' | 'chat';