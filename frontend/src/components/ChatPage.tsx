import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, LogOut, Search, Settings, Users, UserPlus, Check, X, Plus, Shield, Clock, Lock, AlertTriangle } from 'lucide-react';
import { initializeChatWebSocket, disconnectChatWebSocket, getChatWebSocket } from '../utils/websocket';
import { getUsername, getToken, getUserId, authAPI, userAPI, friendsAPI, groupsAPI } from '../utils/api';
import { startPreKeyReplenishment } from '../crypto/KeyReplenishment';
import type { PageType, Message, Group, GroupMember } from '../types';

interface ChatPageProps {
  onNavigate: (page: PageType) => void;
  triggerSecurityModal?: boolean;
  onSecurityModalShown?: () => void;
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

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  recipientId?: number;
  groupId?: number;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

const TTL_OPTIONS = [
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 60, label: '1 hour' },
  { value: 1440, label: '24 hours' },
];

const ChatPage: React.FC<ChatPageProps> = ({ onNavigate, triggerSecurityModal, onSecurityModalShown }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string } | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [messageTTL, setMessageTTL] = useState(5);
  const [showTTLDropdown, setShowTTLDropdown] = useState(false);

  // Conversations
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Friends & Groups
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  // Modals
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addFriendUsername, setAddFriendUsername] = useState('');
  const [addMemberUsername, setAddMemberUsername] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize
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
    loadGroups();

    const hasSeenModal = localStorage.getItem('mynetrunner_security_acknowledged');
    if (!hasSeenModal) {
      setShowSecurityModal(true);
    }
  }, [onNavigate]);

  // Handle triggered security modal from App (back button)
  useEffect(() => {
    if (triggerSecurityModal) {
      setShowSecurityModal(true);
      onSecurityModalShown?.();
    }
  }, [triggerSecurityModal, onSecurityModalShown]);

  // Build conversations from friends and groups
  useEffect(() => {
    const convos: Conversation[] = [];

    friends.forEach(friend => {
      convos.push({
        id: `direct-${friend.id}`,
        type: 'direct',
        name: friend.username,
        recipientId: friend.id,
        unreadCount: 0,
      });
    });

    groups.forEach(group => {
      convos.push({
        id: `group-${group.id}`,
        type: 'group',
        name: group.name,
        groupId: group.id,
        unreadCount: 0,
      });
    });

    setConversations(convos);
  }, [friends, groups]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket connection
  useEffect(() => {
    if (!currentUser) return;

    const wsUrl = 'http://localhost:8080/ws';
    const chatWs = initializeChatWebSocket(wsUrl);

    const handleMessage = (message: Message) => {
      if (!message.timestamp) {
        message.timestamp = new Date().toISOString();
      }

      // Update conversation last message
      setConversations(prev => prev.map(conv => {
        if (conv.type === 'direct' && (conv.recipientId === message.senderId || conv.recipientId === message.receiverId)) {
          return {
            ...conv,
            lastMessage: message.content.substring(0, 50),
            lastMessageTime: message.timestamp,
            unreadCount: selectedConversation?.id === conv.id ? 0 : conv.unreadCount + 1,
          };
        }
        if (conv.type === 'group' && conv.groupId === message.groupId) {
          return {
            ...conv,
            lastMessage: `${message.senderUsername}: ${message.content.substring(0, 40)}`,
            lastMessageTime: message.timestamp,
            unreadCount: selectedConversation?.id === conv.id ? 0 : conv.unreadCount + 1,
          };
        }
        return conv;
      }));

      // Add to messages if in the right conversation
      if (selectedConversation) {
        const isDirectMatch = selectedConversation.type === 'direct' &&
          (message.senderId === selectedConversation.recipientId || message.receiverId === selectedConversation.recipientId);
        const isGroupMatch = selectedConversation.type === 'group' && message.groupId === selectedConversation.groupId;

        if (isDirectMatch || isGroupMatch) {
          setMessages(prev => [...prev, message]);
        }
      }
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
  }, [currentUser, selectedConversation]);

  // Key replenishment
  useEffect(() => {
    if (!currentUser) return;
    const stopReplenishment = startPreKeyReplenishment(60000);
    return () => stopReplenishment();
  }, [currentUser]);

  // Load functions
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

  const loadGroups = async () => {
    try {
      const data = await groupsAPI.getMyGroups();
      setGroups(data.groups || []);
    } catch (e) {
      console.error('Failed to load groups:', e);
    }
  };

  const loadGroupMembers = async (groupId: number) => {
    try {
      const data = await groupsAPI.getMembers(groupId);
      setGroupMembers(data.members || []);
    } catch (e) {
      console.error('Failed to load members:', e);
    }
  };

  // Action handlers
  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    setMessages([]);

    // Clear unread count
    setConversations(prev => prev.map(c =>
      c.id === conv.id ? { ...c, unreadCount: 0 } : c
    ));

    if (conv.type === 'group' && conv.groupId) {
      await loadGroupMembers(conv.groupId);
    }
  };

  const handleSendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !currentUser || !selectedConversation) return;

    if (trimmedMessage.length > 1000) {
      alert('Message too long (max 1000 characters)');
      return;
    }

    const chatWs = getChatWebSocket();
    if (!chatWs || !chatWs.isConnected()) {
      alert('Not connected. Please wait...');
      return;
    }

    if (selectedConversation.type === 'group' && selectedConversation.groupId) {
      await chatWs.sendGroupMessage(
        currentUser.username,
        selectedConversation.groupId,
        trimmedMessage,
        messageTTL
      );

      const localMessage: Message = {
        id: Date.now(),
        senderId: currentUser.id,
        senderUsername: currentUser.username,
        receiverId: 0,
        content: trimmedMessage,
        timestamp: new Date().toISOString(),
        delivered: true,
        isEncrypted: false,
        groupId: selectedConversation.groupId,
      };
      setMessages(prev => [...prev, localMessage]);
    } else if (selectedConversation.type === 'direct' && selectedConversation.recipientId) {
      await chatWs.sendChatMessage(
        currentUser.username,
        selectedConversation.name,
        selectedConversation.recipientId,
        trimmedMessage,
        messageTTL
      );

      const localMessage: Message = {
        id: Date.now(),
        senderId: currentUser.id,
        senderUsername: currentUser.username,
        receiverId: selectedConversation.recipientId,
        content: trimmedMessage,
        timestamp: new Date().toISOString(),
        delivered: true,
        isEncrypted: true,
      };
      setMessages(prev => [...prev, localMessage]);
    }

    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAddFriend = async () => {
    if (!addFriendUsername.trim()) return;
    try {
      await friendsAPI.sendRequest(addFriendUsername.trim());
      setActionMessage('Friend request sent!');
      setAddFriendUsername('');
      setTimeout(() => setActionMessage(''), 3000);
    } catch (e: any) {
      setActionMessage(e.response?.data?.error || 'Failed');
      setTimeout(() => setActionMessage(''), 3000);
    }
  };

  const handleAcceptRequest = async (friendshipId: number) => {
    try {
      await friendsAPI.acceptRequest(friendshipId);
      loadFriends();
      loadPendingRequests();
    } catch (e) {
      console.error('Failed:', e);
    }
  };

  const handleRejectRequest = async (friendshipId: number) => {
    try {
      await friendsAPI.rejectRequest(friendshipId);
      loadPendingRequests();
    } catch (e) {
      console.error('Failed:', e);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await groupsAPI.create(newGroupName.trim());
      setNewGroupName('');
      setShowNewChatModal(false);
      loadGroups();
    } catch (e: any) {
      setActionMessage(e.response?.data?.error || 'Failed');
      setTimeout(() => setActionMessage(''), 3000);
    }
  };

  const handleAddMember = async () => {
    if (!selectedConversation?.groupId || !addMemberUsername.trim()) return;
    try {
      await groupsAPI.addMember(selectedConversation.groupId, addMemberUsername.trim());
      setAddMemberUsername('');
      setActionMessage('Member added!');
      loadGroupMembers(selectedConversation.groupId);
      loadGroups();
      setTimeout(() => setActionMessage(''), 3000);
    } catch (e: any) {
      setActionMessage(e.response?.data?.error || 'Failed');
      setTimeout(() => setActionMessage(''), 3000);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedConversation?.groupId) return;
    try {
      await groupsAPI.leave(selectedConversation.groupId);
      setSelectedConversation(null);
      setShowGroupSettings(false);
      loadGroups();
    } catch (e: any) {
      setActionMessage(e.response?.data?.error || 'Failed');
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedConversation?.groupId) return;
    if (!confirm('Delete this group?')) return;
    try {
      await groupsAPI.delete(selectedConversation.groupId);
      setSelectedConversation(null);
      setShowGroupSettings(false);
      loadGroups();
    } catch (e: any) {
      setActionMessage(e.response?.data?.error || 'Failed');
    }
  };

  const handleLogout = async () => {
    await authAPI.logout();
    disconnectChatWebSocket();
    onNavigate('home');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
      'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
      'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
      'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const acknowledgeSecurityModal = () => {
    localStorage.setItem('mynetrunner_security_acknowledged', 'true');
    setShowSecurityModal(false);
  };

  const selectedGroup = selectedConversation?.type === 'group'
    ? groups.find(g => g.id === selectedConversation.groupId)
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#17212b] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="h-screen bg-[#17212b] flex overflow-hidden">
      {/* Security Modal */}
      {showSecurityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#232e3c] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-[#3a4a5b]">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-8 text-white text-center">
              <Shield className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Welcome to MyNetRunner</h2>
              <p className="text-purple-200 mt-2">Privacy-First Secure Messaging</p>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-amber-400">VPN Recommended</h3>
                    <p className="text-sm text-amber-200/80 mt-1">
                      Use a trusted VPN for maximum privacy and anonymity.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-blue-400">Auto-Delete Messages</h3>
                    <p className="text-sm text-blue-200/80 mt-1">
                      Messages are deleted immediately after delivery or after TTL expires.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-900/30 border border-green-700 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-green-400">End-to-End Encrypted</h3>
                    <p className="text-sm text-green-200/80 mt-1">
                      Direct messages are E2E encrypted. Server cannot read them.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#1c2836] border-t border-[#3a4a5b]">
              <button
                onClick={acknowledgeSecurityModal}
                className="w-full bg-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-purple-700 transition-colors"
              >
                I Understand — Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#232e3c] rounded-2xl w-full max-w-md shadow-2xl border border-[#3a4a5b]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a4a5b]">
              <h2 className="text-lg font-semibold text-white">New Chat</h2>
              <button onClick={() => setShowNewChatModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Add Friend */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Add Friend</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addFriendUsername}
                    onChange={(e) => setAddFriendUsername(e.target.value)}
                    placeholder="Username"
                    className="flex-1 bg-[#17212b] border border-[#3a4a5b] rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={handleAddFriend}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Pending Requests */}
              {pendingRequests.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Pending Requests ({pendingRequests.length})
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {pendingRequests.map((req) => (
                      <div key={req.friendshipId} className="flex items-center justify-between bg-[#17212b] rounded-lg px-3 py-2">
                        <span className="text-white">{req.username}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAcceptRequest(req.friendshipId)}
                            className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRejectRequest(req.friendshipId)}
                            className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-[#3a4a5b] pt-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Create Group</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Group name"
                    className="flex-1 bg-[#17212b] border border-[#3a4a5b] rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={handleCreateGroup}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                  >
                    Create
                  </button>
                </div>
              </div>

              {actionMessage && (
                <p className="text-sm text-purple-400 text-center">{actionMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Group Settings Modal */}
      {showGroupSettings && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#232e3c] rounded-2xl w-full max-w-md shadow-2xl border border-[#3a4a5b]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a4a5b]">
              <h2 className="text-lg font-semibold text-white">{selectedConversation?.name}</h2>
              <button onClick={() => setShowGroupSettings(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {(selectedGroup.myRole === 'OWNER' || selectedGroup.myRole === 'ADMIN') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Add Member</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={addMemberUsername}
                      onChange={(e) => setAddMemberUsername(e.target.value)}
                      placeholder="Username"
                      className="flex-1 bg-[#17212b] border border-[#3a4a5b] rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={handleAddMember}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Members ({groupMembers.length})
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {groupMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between bg-[#17212b] rounded-lg px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${getAvatarColor(member.username)} flex items-center justify-center text-white font-semibold text-sm`}>
                          {member.username[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="text-white">{member.username}</span>
                          <span className="text-xs text-gray-500 ml-2">{member.role}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {actionMessage && (
                <p className="text-sm text-purple-400">{actionMessage}</p>
              )}

              <div className="pt-4 border-t border-[#3a4a5b] space-y-2">
                {selectedGroup.myRole !== 'OWNER' && (
                  <button
                    onClick={handleLeaveGroup}
                    className="w-full py-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    Leave Group
                  </button>
                )}
                {selectedGroup.myRole === 'OWNER' && (
                  <button
                    onClick={handleDeleteGroup}
                    className="w-full py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
                  >
                    Delete Group
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar - Conversation List */}
      <div className="w-80 bg-[#17212b] border-r border-[#232e3c] flex flex-col">
        {/* Sidebar Header */}
        <div className="p-3 flex items-center justify-between border-b border-[#232e3c]">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#232e3c] rounded-lg"
          >
            <Settings className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-400">{currentUser.username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-[#232e3c] rounded-lg"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full bg-[#232e3c] border-none rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>No conversations yet</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-2 text-purple-400 hover:text-purple-300"
              >
                Start a new chat
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                  selectedConversation?.id === conv.id
                    ? 'bg-[#2b5278]'
                    : 'hover:bg-[#232e3c]'
                }`}
              >
                <div className={`w-12 h-12 rounded-full ${getAvatarColor(conv.name)} flex items-center justify-center text-white font-semibold text-lg flex-shrink-0`}>
                  {conv.type === 'group' ? (
                    <Users className="w-6 h-6" />
                  ) : (
                    conv.name[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white truncate">{conv.name}</span>
                    {conv.lastMessageTime && (
                      <span className="text-xs text-gray-500">{formatTime(conv.lastMessageTime)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 truncate">
                      {conv.lastMessage || (conv.type === 'group' ? 'Group chat' : 'Start chatting')}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="bg-purple-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* New Chat Button */}
        <div className="p-3 border-t border-[#232e3c]">
          <button
            onClick={() => setShowNewChatModal(true)}
            className="w-full bg-purple-600 text-white py-2.5 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Chat
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#0e1621]">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-14 px-4 flex items-center justify-between bg-[#17212b] border-b border-[#232e3c]">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${getAvatarColor(selectedConversation.name)} flex items-center justify-center text-white font-semibold`}>
                  {selectedConversation.type === 'group' ? (
                    <Users className="w-5 h-5" />
                  ) : (
                    selectedConversation.name[0].toUpperCase()
                  )}
                </div>
                <div>
                  <h2 className="font-semibold text-white">{selectedConversation.name}</h2>
                  <p className="text-xs text-gray-400">
                    {selectedConversation.type === 'group'
                      ? `${groupMembers.length} members`
                      : (
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3 text-green-500" />
                          End-to-end encrypted
                        </span>
                      )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedConversation.type === 'group' && (
                  <button
                    onClick={() => setShowGroupSettings(true)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-[#232e3c] rounded-lg"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setShowSecurityModal(true)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-[#232e3c] rounded-lg"
                >
                  <Shield className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-2"
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23232e3c" fill-opacity="0.4"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
              }}
            >
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-sm mt-1">Send a message to start the conversation</p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isSentByMe = message.senderUsername === currentUser.username;
                  return (
                    <div
                      key={index}
                      className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] px-3 py-2 rounded-xl ${
                          isSentByMe
                            ? 'bg-[#766ac8] text-white rounded-br-sm'
                            : 'bg-[#182533] text-white rounded-bl-sm'
                        }`}
                      >
                        {selectedConversation.type === 'group' && !isSentByMe && (
                          <p className="text-xs font-semibold text-purple-400 mb-1">
                            {message.senderUsername}
                          </p>
                        )}
                        <p className="text-sm break-words">{message.content}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1 ${isSentByMe ? 'text-purple-200' : 'text-gray-500'}`}>
                          <span className="text-xs">{formatTime(message.timestamp)}</span>
                          {isSentByMe && message.isEncrypted && (
                            <Lock className="w-3 h-3" />
                          )}
                          {isSentByMe && (
                            <Check className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-3 bg-[#17212b] border-t border-[#232e3c]">
              <div className="flex items-center gap-2">
                {/* TTL Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowTTLDropdown(!showTTLDropdown)}
                    className="p-2.5 text-gray-400 hover:text-white hover:bg-[#232e3c] rounded-lg flex items-center gap-1"
                    title="Message expiration"
                  >
                    <Clock className="w-5 h-5" />
                    <span className="text-xs">{TTL_OPTIONS.find(o => o.value === messageTTL)?.label}</span>
                  </button>
                  {showTTLDropdown && (
                    <div className="absolute bottom-full left-0 mb-2 bg-[#232e3c] border border-[#3a4a5b] rounded-lg shadow-lg overflow-hidden">
                      {TTL_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setMessageTTL(option.value);
                            setShowTTLDropdown(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-[#2b5278] ${
                            messageTTL === option.value ? 'bg-purple-600 text-white' : 'text-gray-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Write a message..."
                    className="w-full bg-[#232e3c] border-none rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    maxLength={1000}
                  />
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="p-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#0e1621]">
            <div className="text-center text-gray-500">
              <MessageSquareIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h2 className="text-xl font-medium text-gray-400">MyNetRunner</h2>
              <p className="mt-2">Select a chat to start messaging</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-4 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Start New Chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#232e3c] rounded-2xl w-full max-w-md shadow-2xl border border-[#3a4a5b]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a4a5b]">
              <h2 className="text-lg font-semibold text-white">Settings</h2>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full ${getAvatarColor(currentUser.username)} flex items-center justify-center text-white font-bold text-2xl`}>
                  {currentUser.username[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{currentUser.username}</h3>
                  <p className="text-sm text-gray-400">ID: {currentUser.id}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#3a4a5b]">
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setShowSecurityModal(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:bg-[#17212b] rounded-lg transition-colors"
                >
                  <Shield className="w-5 h-5 text-purple-400" />
                  Security & Privacy Info
                </button>
              </div>

              <div className="pt-4 border-t border-[#3a4a5b]">
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// MessageSquare icon component
const MessageSquareIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

export default ChatPage;