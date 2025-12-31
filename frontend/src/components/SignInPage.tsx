import React, { useState } from 'react';
import { Terminal, Lock, User, ArrowRight, Shield } from 'lucide-react';
import { authAPI, setUsername, setUserId } from '../utils/api';
import {
  checkKeyStatus,
  uploadPreKeyBundle,
  uploadOneTimePreKeys
} from '../crypto/KeyAPI';
import { generateRegistrationBundle, hasGeneratedKeys } from '../crypto/KeyGenerator';
import type { PageType } from '../types';

interface SignInPageProps {
  onNavigate: (page: PageType) => void;
}

const SignInPage: React.FC<SignInPageProps> = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const setupEncryptionKeys = async () => {
    try {
      setStatus('Checking encryption keys...');
      const serverStatus = await checkKeyStatus();
      
      if (serverStatus.hasKeys) {
        const hasLocalKeys = await hasGeneratedKeys();

        if (hasLocalKeys) {
          setStatus('');
          return;
        }
      }

      setStatus('Generating encryption keys...');
      const bundle = await generateRegistrationBundle();

      setStatus('Uploading encryption keys...');
      await uploadPreKeyBundle({
        identityKey: bundle.identityKey,
        signedPreKey: bundle.signedPreKey,
        signedPreKeyId: bundle.signedPreKeyId,
        signedPreKeySignature: bundle.signedPreKeySignature,
      });

      await uploadOneTimePreKeys(bundle.oneTimePreKeys);

      setStatus('');
    } catch (err) {
      setStatus('');
    }
  };

  const handleSubmit = async () => {
    if (!formData.username || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authAPI.login(formData);

      setUsername(response.username);
      setUserId(response.userId);

      await setupEncryptionKeys();

      onNavigate('chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-600/20 rounded-full blur-[128px]" />
      
      {/* Grid background */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Back to home */}
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          Back to home
        </button>

        <div className="bg-[#0f1419] border border-[#1e2a3a] rounded-2xl p-8 backdrop-blur-xl">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Terminal className="w-8 h-8 text-white" />
            </div>
          </div>
          
          {/* Header */}
          <h2 className="text-2xl font-bold text-white text-center mb-2">Access Terminal</h2>
          <p className="text-gray-500 text-center mb-8">Enter credentials to decrypt your session</p>
          
          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Status message */}
          {status && (
            <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-xl text-sm flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              {status}
            </div>
          )}
          
          {/* Form */}
          <div className="space-y-5">
            {/* Username field */}
            <div>
              <label htmlFor="username" className="block text-gray-400 text-sm font-medium mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your username"
                  className="w-full pl-12 pr-4 py-3 bg-[#0a0e14] border border-[#1e2a3a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            {/* Password field */}
            <div>
              <label htmlFor="password" className="block text-gray-400 text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your password"
                  className="w-full pl-12 pr-4 py-3 bg-[#0a0e14] border border-[#1e2a3a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">Minimum 8 characters</p>
            </div>
            
            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Decrypt Session
                </>
              )}
            </button>
          </div>
          
          {/* Sign up link */}
          <p className="text-center mt-8 text-gray-500">
            New operative?{' '}
            <button 
              onClick={() => onNavigate('signup')}
              className="text-purple-400 font-semibold hover:text-purple-300 transition-colors"
            >
              Create identity
            </button>
          </p>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 mt-6 text-gray-600 text-sm">
          <Shield className="w-4 h-4" />
          <span>256-bit encryption • Zero knowledge</span>
        </div>
      </div>

      {/* Scanline effect */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
        }}
      />
    </div>
  );
};

export default SignInPage;