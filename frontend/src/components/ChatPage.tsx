import React, { useState, useEffect, useRef } from 'react';
import { Send, LogOut, MessageSquare, Lock, Shield, Clock, Users, UserPlus, Check, X, ChevronDown } from 'lucide-react';
import { initializeChatWebSocket, disconnectChatWebSocket, getChatWebSocket } from '../utils/websocket';
import { getUsername, getToken, getUserId, authAPI, userAPI, friendsAPI } from '../utils/api';
import { startPreKeyReplenishment } from '../crypto/KeyReplenishment';
import type { PageType, Message } from '../types';

interface ChatPageProps {
  onNavigate: (page: PageType) => void;
}

interface Friend {
  id: number;
  username: string;
}

interface FriendRequest {
  friendshipId: number;
  userId: number;
  username: string;
  createdAt: string;
}

const TTL_OPTIONS = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 60, label: '1 hour' },
  { value: 1440, label: '24 hours' },
];

const ChatPage: React.FC<ChatPageProps> = ({ onNavigate }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string } | null>(null);
  const [recipientUsername, setRecipientUsername] = useState('');
  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLookingUpUser, setIsLookingUpUser] = useState(false);
  const [showSecurityBanner, setShowSecurityBanner] = useState(true);
  const [messageTTL, setMessageTTL] = useState(5);
  const [showTTLDropdown, setShowTTLDropdown] = useState(false);
  
  // Friends state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [addFriendUsername, setAddFriendUsername] = useState('');
  const [friendActionMessage, setFriendActionMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    const username = getUsername();
    const userId = getUserId();

    if (!token || !username || !userId) {
      onNavigate('home');
      return;
    }

    setCurrentUser({ id: userId, username });
    setIsLoading(false);
    loadFriends();
    loadPendingRequests();
  }, [onNavigate]);

  const loadFriends = async () => {
    try {
      const data = await friendsAPI.getFriends();
      setFriends(data.friends || []);
    } catch (e) {
      console.error('Failed to load friends:', e);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const data = await friendsAPI.getPendingRequests();
      setPendingRequests(data.requests || []);
    } catch (e) {
      console.error('Failed to load requests:', e);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!addFriendUsername.trim()) return;
    try {
      await friendsAPI.sendRequest(addFriendUsername.trim());
      setFriendActionMessage('Friend request sent!');
      setAddFriendUsername('');
      setTimeout(() => setFriendActionMessage(''), 3000);
    } catch (e: any) {
      setFriendActionMessage(e.response?.data?.error || 'Failed to send request');
      setTimeout(() => setFriendActionMessage(''), 3000);
    }
  };

  const handleAcceptRequest = async (friendshipId: number) => {
    try {
      await friendsAPI.acceptRequest(friendshipId);
      loadFriends();
      loadPendingRequests();
    } catch (e) {
      console.error('Failed to accept:', e);
    }
  };

  const handleRejectRequest = async (friendshipId: number) => {
    try {
      await friendsAPI.rejectRequest(friendshipId);
      loadPendingRequests();
    } catch (e) {
      console.error('Failed to reject:', e);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!currentUser) return;

    const wsUrl = 'http://localhost:8080/ws';
    const chatWs = initializeChatWebSocket(wsUrl);

    const handleMessage = (message: Message) => {
      if (!message.timestamp) {
        message.timestamp = new Date().toISOString();
      }
      setMessages(prevMessages => [...prevMessages, message]);
    };

    const handleError = (error: string) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    chatWs.connect(handleMessage, handleError);

    setTimeout(() => {
      const ws = getChatWebSocket();
      if (ws && ws.isConnected()) {
        setIsConnected(true);
      }
    }, 1000);

    return () => {
      disconnectChatWebSocket();
      setIsConnected(false);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const stopReplenishment = startPreKeyReplenishment(60000);
    return () => stopReplenishment();
  }, [currentUser]);

  useEffect(() => {
    let hiddenTime: number | null = null;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenTime = Date.now();
      } else if (hiddenTime && Date.now() - hiddenTime > 5 * 60 * 1000) {
        setMessages([]);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const lookupUser = async () => {
      const trimmedUsername = recipientUsername.trim();
      if (!trimmedUsername) {
        setRecipientId(null);
        return;
      }
      setIsLookingUpUser(true);
      const user = await userAPI.getByUsername(trimmedUsername);
      setRecipientId(user?.id || null);
      setIsLookingUpUser(false);
    };
    const debounceTimer = setTimeout(lookupUser, 500);
    return () => clearTimeout(debounceTimer);
  }, [recipientUsername]);

  const handleSendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    const trimmedRecipient = recipientUsername.trim();

    if (!trimmedMessage || !trimmedRecipient) {
      alert('Please enter both a recipient username and a message');
      return;
    }

    if (trimmedMessage.length > 1000) {
      alert('Message too long (max 1000 characters)');
      return;
    }

    if (!currentUser || !recipientId) return;

    const chatWs = getChatWebSocket();
    if (chatWs && chatWs.isConnected()) {
      await chatWs.sendChatMessage(
        currentUser.username,
        trimmedRecipient,
        recipientId,
        trimmedMessage,
        messageTTL
      );

      const localMessage: Message = {
        id: Date.now(),
        senderId: currentUser.id,
        senderUsername: currentUser.username,
        receiverId: recipientId,
        content: trimmedMessage,
        timestamp: new Date().toISOString(),
        delivered: true,
        isEncrypted: true,
      };
      setMessages(prev => [...prev, localMessage]);
      setNewMessage('');
    } else {
      alert('WebSocket not connected. Please wait or refresh the page.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleLogout = async () => {
    await authAPI.logout();
    disconnectChatWebSocket();
    onNavigate('home');
  };

  const selectFriend = (username: string) => {
    setRecipientUsername(username);
    setShowFriendsPanel(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-indigo-50 flex flex-col">
      {/* Security Banner */}
      {showSecurityBanner && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">Privacy-First Messaging</p>
                <ul className="mt-1 space-y-0.5 text-green-100 text-xs">
                  <li>• All messages are end-to-end encrypted</li>
                  <li>• Messages auto-delete after {messageTTL} minute{messageTTL !== 1 ? 's' : ''} if undelivered</li>
                  <li>• Server stores nothing after delivery</li>
                  <li>• We recommend using a trusted VPN for additional privacy</li>
                </ul>
              </div>
            </div>
            <button 
              onClick={() => setShowSecurityBanner(false)}
              className="text-green-200 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-lg flex items-center justify-center">
              <MessageSquare className="w-8 h-8 sm:w-9 sm:h-9 text-indigo-600" strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">MyNetRunner</span>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                <Lock className="w-3 h-3 text-green-600 ml-1" />
                <span className="text-green-600">E2E Encrypted</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowFriendsPanel(!showFriendsPanel)}
              className="relative bg-gray-100 text-gray-700 font-semibold px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Friends</span>
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <span className="text-sm text-gray-600 hidden sm:block">{currentUser.username}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm shadow-md flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Friends Panel */}
        {showFriendsPanel && (
          <div className="w-72 bg-white border-r border-gray-200 p-4 overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-3">Friends</h3>
            
            {/* Add Friend */}
            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addFriendUsername}
                  onChange={(e) => setAddFriendUsername(e.target.value)}
                  placeholder="Add by username"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSendFriendRequest}
                  className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
              {friendActionMessage && (
                <p className="text-xs mt-1 text-indigo-600">{friendActionMessage}</p>
              )}
            </div>

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Pending Requests</h4>
                {pendingRequests.map((req) => (
                  <div key={req.friendshipId} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">{req.username}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAcceptRequest(req.friendshipId)}
                        className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req.friendshipId)}
                        className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Friends List */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Your Friends</h4>
              {friends.length === 0 ? (
                <p className="text-sm text-gray-400">No friends yet</p>
              ) : (
                friends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => selectFriend(friend.username)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2"
                  >
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold">
                      {friend.username[0].toUpperCase()}
                    </div>
                    {friend.username}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col p-4">
          {/* Recipient input with TTL selector */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Send message to:</label>
                <input
                  type="text"
                  value={recipientUsername}
                  onChange={(e) => setRecipientUsername(e.target.value)}
                  placeholder="Enter recipient's username"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-600 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {isLookingUpUser ? (
                    'Looking up user...'
                  ) : recipientId ? (
                    <span className="text-green-600">✓ User found - messages will be encrypted</span>
                  ) : recipientUsername.trim() ? (
                    <span className="text-red-500">✗ User not found</span>
                  ) : (
                    'Enter username or select from friends'
                  )}
                </p>
              </div>
              
              {/* TTL Selector */}
              <div className="sm:w-48">
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <Clock className="w-4 h-4" /> Message expires in:
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowTTLDropdown(!showTTLDropdown)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-600 focus:outline-none bg-white text-left flex items-center justify-between"
                  >
                    <span>{TTL_OPTIONS.find(o => o.value === messageTTL)?.label}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                  {showTTLDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      {TTL_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setMessageTTL(option.value);
                            setShowTTLDropdown(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                            messageTTL === option.value ? 'bg-indigo-50 text-indigo-600' : ''
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Auto-delete if undelivered</p>
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 bg-white rounded-lg shadow-md p-4 mb-4 overflow-y-auto min-h-[300px]">
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <Send className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No messages yet</p>
                  <p className="text-sm mt-1">Enter a recipient username and start chatting!</p>
                  <p className="text-xs mt-2 text-green-600 flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3" /> All messages are end-to-end encrypted
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isSentByMe = message.senderUsername === currentUser.username;
                  return (
                    <div key={index} className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                          isSentByMe
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-900 shadow-sm border border-gray-200'
                        }`}
                      >
                        <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                          {isSentByMe ? 'You' : message.senderUsername}
                          {message.isEncrypted && (
                            <Lock className={`w-3 h-3 ${isSentByMe ? 'text-indigo-200' : 'text-green-600'}`} />
                          )}
                        </p>
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${isSentByMe ? 'text-indigo-100' : 'text-gray-500'}`}>
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Message input */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={recipientId ? "Type an encrypted message..." : "Enter a valid recipient first..."}
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                  rows={1}
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                  disabled={!isConnected || !recipientId}
                  maxLength={1000}
                />
                <p className="text-xs text-gray-500 mt-1">{newMessage.length}/1000 characters</p>
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || !recipientId || !isConnected}
                className="bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;