import React, { useEffect, useState } from 'react';
import { Shield, Lock, Zap, Eye, EyeOff, Server, Wifi, Terminal } from 'lucide-react';
import type { PageType } from '../types';

interface HomePageProps {
  onNavigate: (page: PageType) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [glitchText, setGlitchText] = useState('MyNetRunner');
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  useEffect(() => {
    // Create floating particles
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
    }));
    setParticles(newParticles);

    // Glitch effect
    const glitchChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const originalText = 'MyNetRunner';
    
    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.95) {
        let glitched = '';
        for (let i = 0; i < originalText.length; i++) {
          if (Math.random() > 0.7) {
            glitched += glitchChars[Math.floor(Math.random() * glitchChars.length)];
          } else {
            glitched += originalText[i];
          }
        }
        setGlitchText(glitched);
        setTimeout(() => setGlitchText(originalText), 100);
      }
    }, 100);

    return () => clearInterval(glitchInterval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e14] overflow-hidden relative">
      {/* Animated grid background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite',
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute w-1 h-1 bg-purple-500 rounded-full opacity-50"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animation: `float ${3 + particle.delay}s ease-in-out infinite`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Gradient orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-600/30 rounded-full blur-[128px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-600/30 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-600/10 rounded-full blur-[200px]" />

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Terminal className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-wider">
              {glitchText}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('signin')}
              className="px-5 py-2 text-gray-300 hover:text-white transition-colors font-medium"
            >
              Sign In
            </button>
            <button
              onClick={() => onNavigate('signup')}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/25"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 px-6 pt-20 pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl">
            {/* Tagline */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full mb-8">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-purple-300 text-sm font-medium">End-to-End Encrypted • Zero Knowledge</span>
            </div>

            {/* Main heading */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white mb-6 leading-[0.9]">
              <span className="block">Secure.</span>
              <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Private.
              </span>
              <span className="block">Anonymous.</span>
            </h1>

            {/* Description */}
            <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl leading-relaxed">
              Communication shouldn't be surveilled. MyNetRunner uses military-grade encryption 
              and zero-knowledge architecture. Your messages, your privacy, your rules.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <button
                onClick={() => onNavigate('signup')}
                className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/25"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5" />
                  Start Encrypting
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button
                onClick={() => onNavigate('signin')}
                className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-xl font-bold text-lg hover:bg-white/10 hover:border-white/20 transition-all hover:scale-105"
              >
                Access Terminal
              </button>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FeatureCard
                icon={<Lock className="w-6 h-6" />}
                title="E2E Encryption"
                description="AES-256-GCM encryption"
                color="purple"
              />
              <FeatureCard
                icon={<EyeOff className="w-6 h-6" />}
                title="Zero Knowledge"
                description="We can't read your messages"
                color="pink"
              />
              <FeatureCard
                icon={<Zap className="w-6 h-6" />}
                title="Auto-Delete"
                description="Messages vanish after delivery"
                color="cyan"
              />
              <FeatureCard
                icon={<Shield className="w-6 h-6" />}
                title="No Logs"
                description="No metadata stored"
                color="green"
              />
            </div>
          </div>
        </div>
      </main>

      {/* Decorative elements */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
      
      {/* Scanline effect */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
        }}
      />

      {/* CSS animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.5; }
          50% { transform: translateY(-20px) translateX(10px); opacity: 1; }
        }
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
      `}</style>
    </div>
  );
};

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'purple' | 'pink' | 'cyan' | 'green';
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, color }) => {
  const colorClasses = {
    purple: 'from-purple-500/20 to-purple-500/0 border-purple-500/30 text-purple-400',
    pink: 'from-pink-500/20 to-pink-500/0 border-pink-500/30 text-pink-400',
    cyan: 'from-cyan-500/20 to-cyan-500/0 border-cyan-500/30 text-cyan-400',
    green: 'from-green-500/20 to-green-500/0 border-green-500/30 text-green-400',
  };

  return (
    <div className={`p-4 rounded-xl bg-gradient-to-b ${colorClasses[color]} border backdrop-blur-sm`}>
      <div className={`mb-3 ${colorClasses[color].split(' ').pop()}`}>
        {icon}
      </div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-gray-500 text-sm">{description}</p>
    </div>
  );
};

export default HomePage;