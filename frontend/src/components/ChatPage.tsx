import React, { useState, useEffect, useRef } from 'react';
import { Send, LogOut, MessageSquare, Lock, Shield, Clock, Users, UserPlus, Check, X, ChevronDown, AlertTriangle, Info, Plus, Settings, Trash2 } from 'lucide-react';
import { initializeChatWebSocket, disconnectChatWebSocket, getChatWebSocket } from '../utils/websocket';
import { getUsername, getToken, getUserId, authAPI, userAPI, friendsAPI, groupsAPI } from '../utils/api';
import { startPreKeyReplenishment } from '../crypto/KeyReplenishment';
import type { PageType, Message, Group, GroupMember } from '../types';

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
  const [showSecurityModal, setShowSecurityModal] = useState(true);
  const [messageTTL, setMessageTTL] = useState(5);
  const [showTTLDropdown, setShowTTLDropdown] = useState(false);
  const [showTTLInfo, setShowTTLInfo] = useState(false);

  // Friends state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [addFriendUsername, setAddFriendUsername] = useState('');
  const [friendActionMessage, setFriendActionMessage] = useState('');

  // Groups state
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [addMemberUsername, setAddMemberUsername] = useState('');
  const [groupActionMessage, setGroupActionMessage] = useState('');

  // Chat mode: 'direct' or 'group'
  const [chatMode, setChatMode] = useState<'direct' | 'group'>('direct');

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
    loadGroups();

    const hasSeenModal = localStorage.getItem('mynetrunner_security_acknowledged');
    setShowSecurityModal(!hasSeenModal);
  }, [onNavigate]);

  const acknowledgeSecurityModal = () => {
    localStorage.setItem('mynetrunner_security_acknowledged', 'true');
    setShowSecurityModal(false);
  };

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
      console.error('Failed to load group members:', e);
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

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await groupsAPI.create(newGroupName.trim());
      setNewGroupName('');
      setShowCreateGroup(false);
      loadGroups();
    } catch (e: any) {
      setGroupActionMessage(e.response?.data?.error || 'Failed to create group');
      setTimeout(() => setGroupActionMessage(''), 3000);
    }
  };

  const handleSelectGroup = async (group: Group) => {
    setSelectedGroup(group);
    setChatMode('group');
    setRecipientUsername('');
    setRecipientId(null);
    setMessages([]);
    await loadGroupMembers(group.id);
  };

  const handleAddMember = async () => {
    if (!selectedGroup || !addMemberUsername.trim()) return;
    try {
      await groupsAPI.addMember(selectedGroup.id, addMemberUsername.trim());
      setAddMemberUsername('');
      setGroupActionMessage('Member added!');
      loadGroupMembers(selectedGroup.id);
      setTimeout(() => setGroupActionMessage(''), 3000);
    } catch (e: any) {
      setGroupActionMessage(e.response?.data?.error || 'Failed to add member');
      setTimeout(() => setGroupActionMessage(''), 3000);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!selectedGroup) return;
    try {
      await groupsAPI.removeMember(selectedGroup.id, memberId);
      loadGroupMembers(selectedGroup.id);
    } catch (e: any) {
      setGroupActionMessage(e.response?.data?.error || 'Failed to remove member');
      setTimeout(() => setGroupActionMessage(''), 3000);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;
    try {
      await groupsAPI.leave(selectedGroup.id);
      setSelectedGroup(null);
      setChatMode('direct');
      setShowGroupSettings(false);
      loadGroups();
    } catch (e: any) {
      setGroupActionMessage(e.response?.data?.error || 'Failed to leave group');
      setTimeout(() => setGroupActionMessage(''), 3000);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    if (!confirm('Are you sure you want to delete this group? This cannot be undone.')) return;
    try {
      await groupsAPI.delete(selectedGroup.id);
      setSelectedGroup(null);
      setChatMode('direct');
      setShowGroupSettings(false);
      loadGroups();
    } catch (e: any) {
      setGroupActionMessage(e.response?.data?.error || 'Failed to delete group');
      setTimeout(() => setGroupActionMessage(''), 3000);
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

    if (!trimmedMessage) {
      alert('Please enter a message');
      return;
    }

    if (trimmedMessage.length > 1000) {
      alert('Message too long (max 1000 characters)');
      return;
    }

    if (!currentUser) return;

    const chatWs = getChatWebSocket();
    if (!chatWs || !chatWs.isConnected()) {
      alert('WebSocket not connected. Please wait or refresh the page.');
      return;
    }

    if (chatMode === 'group' && selectedGroup) {
      // Send group message
      await chatWs.sendGroupMessage(
        currentUser.username,
        selectedGroup.id,
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
        groupId: selectedGroup.id,
        groupName: selectedGroup.name,
      };
      setMessages(prev => [...prev, localMessage]);
      setNewMessage('');
    } else if (chatMode === 'direct' && recipientId) {
      // Send direct message
      await chatWs.sendChatMessage(
        currentUser.username,
        recipientUsername.trim(),
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
      alert('Please select a recipient or group');
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
    setChatMode('direct');
    setSelectedGroup(null);
    setMessages([]);
    setShowFriendsPanel(false);
  };

  const switchToDirectChat = () => {
    setChatMode('direct');
    setSelectedGroup(null);
    setMessages([]);
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
      {/* Security Modal */}
      {showSecurityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-white text-center">
              <Shield className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Welcome to MyNetRunner</h2>
              <p className="text-indigo-100 mt-2">Privacy-First Secure Messaging</p>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-amber-800">VPN Strongly Recommended</h3>
                    <p className="text-sm text-amber-700 mt-1">
                      While your messages are end-to-end encrypted, your IP address is still visible to our servers.
                      For maximum privacy and anonymity, <strong>we strongly recommend using a trusted VPN</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-blue-800">Message Auto-Delete</h3>
                    <ul className="text-sm text-blue-700 mt-2 space-y-1">
                      <li><strong>Recipient online:</strong> Deleted from server immediately after delivery</li>
                      <li><strong>Recipient offline:</strong> Auto-deleted after your chosen time</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-green-800">End-to-End Encrypted</h3>
                    <p className="text-sm text-green-700 mt-1">
                      Direct messages are encrypted. The server <strong>cannot read your messages</strong>.
                      <br /><span className="text-amber-600">Note: Group messages are not yet E2E encrypted.</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={acknowledgeSecurityModal}
                className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-indigo-700 transition-colors"
              >
                I Understand — Continue to Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Settings Modal */}
      {showGroupSettings && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-indigo-600 px-6 py-4 text-white flex items-center justify-between">
              <h2 className="text-lg font-bold">{selectedGroup.name}</h2>
              <button onClick={() => setShowGroupSettings(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Add Member */}
              {(selectedGroup.myRole === 'OWNER' || selectedGroup.myRole === 'ADMIN') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Add Member</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={addMemberUsername}
                      onChange={(e) => setAddMemberUsername(e.target.value)}
                      placeholder="Username"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <button
                      onClick={handleAddMember}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {groupActionMessage && (
                <p className="text-sm text-indigo-600">{groupActionMessage}</p>
              )}

              {/* Members List */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Members ({groupMembers.length})
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {groupMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm">
                          {member.username[0].toUpperCase()}
                        </div>
                        <span className="text-sm">{member.username}</span>
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                          {member.role}
                        </span>
                      </div>
                      {selectedGroup.myRole === 'OWNER' && member.role !== 'OWNER' && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-200 space-y-2">
                {selectedGroup.myRole !== 'OWNER' && (
                  <button
                    onClick={handleLeaveGroup}
                    className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Leave Group
                  </button>
                )}
                {selectedGroup.myRole === 'OWNER' && (
                  <button
                    onClick={handleDeleteGroup}
                    className="w-full py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Group
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <MessageSquare className="w-8 h-8 text-indigo-600" strokeWidth={2.5} />
            <div>
              <span className="text-lg sm:text-xl font-semibold text-gray-900">MyNetRunner</span>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                {chatMode === 'direct' && (
                  <>
                    <Lock className="w-3 h-3 text-green-600 ml-1" />
                    <span className="text-green-600">E2E Encrypted</span>
                  </>
                )}
                {chatMode === 'group' && (
                  <span className="text-amber-600 ml-1">Group Chat</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSecurityModal(true)}
              className="bg-amber-100 text-amber-700 p-2 rounded-lg hover:bg-amber-200"
              title="Security Info"
            >
              <Shield className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowFriendsPanel(!showFriendsPanel)}
              className="relative bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 flex items-center gap-2"
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
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* VPN Banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span className="text-amber-800">
            <strong>Privacy Tip:</strong> Use a trusted VPN for maximum anonymity.
          </span>
        </div>
      </div>

      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Sidebar - Friends & Groups */}
        {showFriendsPanel && (
          <div className="w-72 bg-white border-r border-gray-200 p-4 overflow-y-auto">
            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => switchToDirectChat()}
                className={`flex-1 py-2 text-sm rounded-lg ${chatMode === 'direct' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Direct
              </button>
              <button
                onClick={() => setChatMode('group')}
                className={`flex-1 py-2 text-sm rounded-lg ${chatMode === 'group' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Groups
              </button>
            </div>

            {chatMode === 'direct' ? (
              <>
                {/* Add Friend */}
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={addFriendUsername}
                      onChange={(e) => setAddFriendUsername(e.target.value)}
                      placeholder="Add friend"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <button onClick={handleSendFriendRequest} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700">
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                  {friendActionMessage && <p className="text-xs mt-1 text-indigo-600">{friendActionMessage}</p>}
                </div>

                {/* Pending Requests */}
                {pendingRequests.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Pending</h4>
                    {pendingRequests.map((req) => (
                      <div key={req.friendshipId} className="flex items-center justify-between py-2">
                        <span className="text-sm">{req.username}</span>
                        <div className="flex gap-1">
                          <button onClick={() => handleAcceptRequest(req.friendshipId)} className="p-1 bg-green-100 text-green-600 rounded">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleRejectRequest(req.friendshipId)} className="p-1 bg-red-100 text-red-600 rounded">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Friends List */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Friends</h4>
                  {friends.length === 0 ? (
                    <p className="text-sm text-gray-400">No friends yet</p>
                  ) : (
                    friends.map((friend) => (
                      <button
                        key={friend.id}
                        onClick={() => selectFriend(friend.username)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-sm flex items-center gap-2"
                      >
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold">
                          {friend.username[0].toUpperCase()}
                        </div>
                        {friend.username}
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Create Group */}
                {showCreateGroup ? (
                  <div className="mb-4">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Group name"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleCreateGroup} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm hover:bg-indigo-700">
                        Create
                      </button>
                      <button onClick={() => setShowCreateGroup(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm">
                        Cancel
                      </button>
                    </div>
                    {groupActionMessage && <p className="text-xs mt-1 text-red-500">{groupActionMessage}</p>}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="w-full mb-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-500 hover:text-indigo-500 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Group
                  </button>
                )}

                {/* Groups List */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Your Groups</h4>
                  {groups.length === 0 ? (
                    <p className="text-sm text-gray-400">No groups yet</p>
                  ) : (
                    groups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => handleSelectGroup(group)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                          selectedGroup?.id === group.id ? 'bg-indigo-100' : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-semibold">
                            {group.name[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{group.name}</p>
                            <p className="text-xs text-gray-500">{group.memberCount} members</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col p-4">
          {/* Chat Header */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            {chatMode === 'direct' ? (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Send message to:</label>
                  <input
                    type="text"
                    value={recipientUsername}
                    onChange={(e) => setRecipientUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-600 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {isLookingUpUser ? 'Looking up...' : recipientId ? (
                      <span className="text-green-600">✓ User found - E2E encrypted</span>
                    ) : recipientUsername.trim() ? (
                      <span className="text-red-500">✗ User not found</span>
                    ) : 'Enter username or select from friends'}
                  </p>
                </div>

                <div className="sm:w-48">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Expires in:
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setShowTTLDropdown(!showTTLDropdown)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-white text-left flex items-center justify-between"
                    >
                      <span>{TTL_OPTIONS.find(o => o.value === messageTTL)?.label}</span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                    {showTTLDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                        {TTL_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => { setMessageTTL(option.value); setShowTTLDropdown(false); }}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${messageTTL === option.value ? 'bg-indigo-50 text-indigo-600' : ''}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : selectedGroup ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold">
                    {selectedGroup.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedGroup.name}</h3>
                    <p className="text-xs text-gray-500">{groupMembers.length} members</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGroupSettings(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <Settings className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            ) : (
              <p className="text-gray-500 text-center">Select a group from the sidebar</p>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 bg-white rounded-lg shadow-md p-4 mb-4 overflow-y-auto min-h-[300px]">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <Send className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No messages yet</p>
                  <p className="text-sm mt-1">
                    {chatMode === 'direct' ? 'Select a friend to start chatting' : 'Send a message to the group'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isSentByMe = message.senderUsername === currentUser.username;
                  return (
                    <div key={index} className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                        isSentByMe ? 'bg-indigo-600 text-white' : 'bg-white text-gray-900 shadow-sm border border-gray-200'
                      }`}>
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

          {/* Input */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-3">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  chatMode === 'group'
                    ? selectedGroup ? 'Type a message...' : 'Select a group first'
                    : recipientId ? 'Type an encrypted message...' : 'Select a recipient first'
                }
                className="flex-1 px-4 py-3 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                rows={1}
                disabled={chatMode === 'group' ? !selectedGroup : !recipientId}
                maxLength={1000}
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || (chatMode === 'group' ? !selectedGroup : !recipientId)}
                className="bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">{newMessage.length}/1000</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;