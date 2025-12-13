import React, { useState } from 'react';
import { Terminal, Lock, User, ArrowRight, Shield, Check } from 'lucide-react';
import { authAPI } from '../utils/api';
import type { PageType } from '../types';

interface SignUpPageProps {
  onNavigate: (page: PageType) => void;
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleSubmit = async () => {
    if (!formData.username || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.username.length < 3 || formData.username.length > 20) {
      setError('Username must be between 3 and 20 characters');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authAPI.register(formData);
      console.log('Registration successful:', response);
      
      setSuccess(`Identity created! Welcome ${response.username}. Redirecting...`);
      setTimeout(() => {
        onNavigate('signin');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // Password strength indicators
  const passwordChecks = [
    { label: '8+ characters', valid: formData.password.length >= 8 },
    { label: 'Matches confirmation', valid: formData.password === formData.confirmPassword && formData.confirmPassword.length > 0 },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-cyan-600/20 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px]" />
      
      {/* Grid background */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)
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
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Terminal className="w-8 h-8 text-white" />
            </div>
          </div>
          
          {/* Header */}
          <h2 className="text-2xl font-bold text-white text-center mb-2">Create Identity</h2>
          <p className="text-gray-500 text-center mb-8">Generate your encrypted profile</p>
          
          {/* Success message */}
          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl text-sm flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 flex-shrink-0" />
              {error}
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
                  placeholder="Choose a username"
                  className="w-full pl-12 pr-4 py-3 bg-[#0a0e14] border border-[#1e2a3a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  disabled={isLoading || !!success}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">3-20 characters, alphanumeric and underscores</p>
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
                  placeholder="Create a password"
                  className="w-full pl-12 pr-4 py-3 bg-[#0a0e14] border border-[#1e2a3a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  disabled={isLoading || !!success}
                />
              </div>
            </div>
            
            {/* Confirm password field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-gray-400 text-sm font-medium mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Confirm your password"
                  className="w-full pl-12 pr-4 py-3 bg-[#0a0e14] border border-[#1e2a3a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  disabled={isLoading || !!success}
                />
              </div>
            </div>

            {/* Password strength */}
            <div className="flex gap-4">
              {passwordChecks.map((check, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${check.valid ? 'bg-green-500' : 'bg-gray-700'}`}>
                    {check.valid && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-xs ${check.valid ? 'text-green-400' : 'text-gray-600'}`}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={isLoading || !!success}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-purple-600 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating Keys...
                </>
              ) : success ? (
                <>
                  <Check className="w-5 h-5" />
                  Success!
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Create Identity
                </>
              )}
            </button>
          </div>
          
          {/* Sign in link */}
          <p className="text-center mt-8 text-gray-500">
            Already have an identity?{' '}
            <button 
              onClick={() => onNavigate('signin')}
              className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors"
            >
              Access terminal
            </button>
          </p>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 mt-6 text-gray-600 text-sm">
          <Shield className="w-4 h-4" />
          <span>Your identity is encrypted locally</span>
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

export default SignUpPage;