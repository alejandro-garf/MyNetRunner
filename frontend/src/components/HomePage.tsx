import React, { useEffect, useState } from 'react';
import { Shield, Lock, Zap, EyeOff, X, Terminal, Key, Server, Trash2, Clock, Database, FileQuestion } from 'lucide-react';
import type { PageType } from '../types';

interface HomePageProps {
  onNavigate: (page: PageType) => void;
}

interface FeatureInfo {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'purple' | 'pink' | 'cyan' | 'green';
  details: {
    headline: string;
    explanation: string;
    points: Array<{ icon: React.ReactNode; title: string; description: string }>;
  };
}

const FEATURES: FeatureInfo[] = [
  {
    id: 'encryption',
    icon: <Lock className="w-6 h-6" />,
    title: 'E2E Encryption',
    description: 'AES-256-GCM encryption',
    color: 'purple',
    details: {
      headline: 'Military-Grade End-to-End Encryption',
      explanation: 'Every message is encrypted on your device before transmission. Only the intended recipient can decrypt it — not even our servers can read your messages.',
      points: [
        {
          icon: <Key className="w-5 h-5" />,
          title: 'X3DH Key Exchange',
          description: 'Extended Triple Diffie-Hellman protocol establishes secure sessions without ever exposing private keys.',
        },
        {
          icon: <Lock className="w-5 h-5" />,
          title: 'AES-256-GCM',
          description: 'The same encryption standard used by governments and military organizations worldwide.',
        },
        {
          icon: <Shield className="w-5 h-5" />,
          title: 'Perfect Forward Secrecy',
          description: 'Each session uses unique keys. Compromising one session doesn\'t affect past or future communications.',
        },
      ],
    },
  },
  {
    id: 'zero-knowledge',
    icon: <EyeOff className="w-6 h-6" />,
    title: 'Zero Knowledge',
    description: "We can't read your messages",
    color: 'pink',
    details: {
      headline: 'True Zero-Knowledge Architecture',
      explanation: 'Our servers are designed to know as little as possible about you. We can\'t read your messages, see your contacts, or access your encryption keys.',
      points: [
        {
          icon: <Server className="w-5 h-5" />,
          title: 'Server-Side Blindness',
          description: 'Messages arrive encrypted and leave encrypted. The server only sees ciphertext — random-looking data.',
        },
        {
          icon: <Key className="w-5 h-5" />,
          title: 'Client-Side Keys',
          description: 'All encryption keys are generated and stored on your device, never uploaded to our servers.',
        },
        {
          icon: <FileQuestion className="w-5 h-5" />,
          title: 'No Subpoena Risk',
          description: 'Even if legally compelled, we cannot provide message contents we don\'t have access to.',
        },
      ],
    },
  },
  {
    id: 'auto-delete',
    icon: <Zap className="w-6 h-6" />,
    title: 'Auto-Delete',
    description: 'Messages vanish after delivery',
    color: 'cyan',
    details: {
      headline: 'Ephemeral Messaging by Default',
      explanation: 'Messages are automatically deleted from our servers immediately after delivery. Undelivered messages expire based on your chosen time-to-live (TTL).',
      points: [
        {
          icon: <Trash2 className="w-5 h-5" />,
          title: 'Instant Deletion',
          description: 'Once a message is delivered to the recipient, it\'s immediately purged from our servers.',
        },
        {
          icon: <Clock className="w-5 h-5" />,
          title: 'Configurable TTL',
          description: 'Choose how long undelivered messages persist: 1 minute to 24 hours. After that, they\'re gone forever.',
        },
        {
          icon: <Database className="w-5 h-5" />,
          title: 'No Message History',
          description: 'We don\'t store chat logs or message history. Your conversation exists only on your device.',
        },
      ],
    },
  },
   {
    id: 'no-logs',
    icon: <Shield className="w-6 h-6" />,
    title: 'No Logs',
    description: 'No metadata stored',
    color: 'green',
    details: {
      headline: 'Privacy Beyond Messages',
      explanation: 'MyNetRunner does not log your IP address or connection metadata. However, your browser, ISP, and network may still track your activity. For complete anonymity, we strongly recommend additional precautions.',
      points: [
        {
          icon: <Server className="w-5 h-5" />,
          title: 'Server-Side: No IP Logging',
          description: 'We\'ve disabled all IP and access logging on our servers. Your connection details are never stored by us.',
        },
        {
          icon: <EyeOff className="w-5 h-5" />,
          title: 'Use a Trusted VPN',
          description: 'Your ISP and network can still see you\'re connecting to our servers. A VPN hides this from everyone except the VPN provider.',
        },
        {
          icon: <Database className="w-5 h-5" />,
          title: 'Use a Privacy-Focused Browser',
          description: 'Browsers like Firefox, Brave, or Tor Browser minimize tracking. Avoid Chrome if privacy is your priority.',
        },
      ],
    },
},
];

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [glitchText, setGlitchText] = useState('MyNetRunner');
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);
  const [expandedFeature, setExpandedFeature] = useState<FeatureInfo | null>(null);

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

  const getColorClasses = (color: 'purple' | 'pink' | 'cyan' | 'green') => {
    const colorMap = {
      purple: {
        gradient: 'from-purple-500/20 to-purple-500/0',
        border: 'border-purple-500/30',
        text: 'text-purple-400',
        bg: 'bg-purple-500/10',
        glow: 'shadow-purple-500/20',
      },
      pink: {
        gradient: 'from-pink-500/20 to-pink-500/0',
        border: 'border-pink-500/30',
        text: 'text-pink-400',
        bg: 'bg-pink-500/10',
        glow: 'shadow-pink-500/20',
      },
      cyan: {
        gradient: 'from-cyan-500/20 to-cyan-500/0',
        border: 'border-cyan-500/0',
        text: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
        glow: 'shadow-cyan-500/20',
      },
      green: {
        gradient: 'from-green-500/20 to-green-500/0',
        border: 'border-green-500/30',
        text: 'text-green-400',
        bg: 'bg-green-500/10',
        glow: 'shadow-green-500/20',
      },
    };
    return colorMap[color];
  };

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

      {/* Feature Modal */}
      {expandedFeature && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setExpandedFeature(null)}
        >
          <div 
            className="bg-[#0f1419] border border-[#1e2a3a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`p-6 border-b border-[#1e2a3a] bg-gradient-to-r ${
              expandedFeature.color === 'purple' ? 'from-purple-900/50 to-transparent' :
              expandedFeature.color === 'pink' ? 'from-pink-900/50 to-transparent' :
              expandedFeature.color === 'cyan' ? 'from-cyan-900/50 to-transparent' :
              'from-green-900/50 to-transparent'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${getColorClasses(expandedFeature.color).bg} ${getColorClasses(expandedFeature.color).text}`}>
                    {expandedFeature.icon}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{expandedFeature.title}</h2>
                    <p className="text-gray-400 mt-1">{expandedFeature.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedFeature(null)}
                  className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              <div>
                <h3 className={`text-xl font-semibold ${getColorClasses(expandedFeature.color).text} mb-3`}>
                  {expandedFeature.details.headline}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {expandedFeature.details.explanation}
                </p>
              </div>

              <div className="space-y-4">
                {expandedFeature.details.points.map((point, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-xl bg-gradient-to-r ${getColorClasses(expandedFeature.color).gradient} border ${getColorClasses(expandedFeature.color).border}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${getColorClasses(expandedFeature.color).bg} ${getColorClasses(expandedFeature.color).text} flex-shrink-0`}>
                        {point.icon}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white mb-1">{point.title}</h4>
                        <p className="text-gray-400 text-sm leading-relaxed">{point.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Technical specs or additional info */}
              <div className="pt-4 border-t border-[#1e2a3a]">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Shield className="w-4 h-4" />
                  <span>MyNetRunner uses industry-standard cryptographic protocols</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[#1e2a3a] bg-[#0a0e14]">
              <button
                onClick={() => {
                  setExpandedFeature(null);
                  onNavigate('signup');
                }}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  expandedFeature.color === 'purple' ? 'bg-purple-600 hover:bg-purple-700' :
                  expandedFeature.color === 'pink' ? 'bg-pink-600 hover:bg-pink-700' :
                  expandedFeature.color === 'cyan' ? 'bg-cyan-600 hover:bg-cyan-700' :
                  'bg-green-600 hover:bg-green-700'
                } text-white`}
              >
                Get Started with Secure Messaging
              </button>
            </div>
          </div>
        </div>
      )}

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

            {/* Features - Now Clickable */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map((feature) => (
                <button
                  key={feature.id}
                  onClick={() => setExpandedFeature(feature)}
                  className={`p-4 rounded-xl bg-gradient-to-b ${getColorClasses(feature.color).gradient} border ${getColorClasses(feature.color).border} backdrop-blur-sm text-left transition-all hover:scale-105 hover:shadow-lg ${getColorClasses(feature.color).glow} group`}
                >
                  <div className={`mb-3 ${getColorClasses(feature.color).text} transition-transform group-hover:scale-110`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                  <p className="text-gray-500 text-sm">{feature.description}</p>
                  <div className={`mt-3 text-xs ${getColorClasses(feature.color).text} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}>
                    Learn more →
                  </div>
                </button>
              ))}
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

export default HomePage;