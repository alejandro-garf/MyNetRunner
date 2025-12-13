import React, { useState, useEffect, useCallback } from 'react';
import HomePage from './components/HomePage';
import SignInPage from './components/SignInPage';
import SignUpPage from './components/SignUpPage';
import ChatPage from './components/ChatPage';
import { getToken } from './utils/api';
import type { PageType } from './types';

/**
 * Main App component
 * Handles routing between different pages with browser history support
 */
const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  // Get page from URL hash
  const getPageFromHash = (): PageType => {
    const hash = window.location.hash.slice(1);
    if (['home', 'signin', 'signup', 'chat'].includes(hash)) {
      return hash as PageType;
    }
    return 'home';
  };

  // Navigate and update browser history
  const navigate = useCallback((page: PageType) => {
    setCurrentPage(page);
    window.location.hash = page;
  }, []);

  // Check if user is already logged in on mount
  useEffect(() => {
    const token = getToken();
    const hashPage = getPageFromHash();

    if (token) {
      if (hashPage === 'signin' || hashPage === 'signup' || hashPage === 'home') {
        navigate('chat');
      } else {
        setCurrentPage(hashPage);
        window.location.hash = hashPage;
      }
    } else {
      if (hashPage === 'chat') {
        navigate('home');
      } else if (window.location.hash) {
        setCurrentPage(hashPage);
      } else {
        window.location.hash = 'home';
      }
    }
  }, [navigate]);

  // Listen for browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const page = getPageFromHash();
      const token = getToken();

      // If logged in and trying to go back to auth pages, show security modal instead
      if (token && (page === 'home' || page === 'signin' || page === 'signup')) {
        // Push back to chat
        window.history.pushState(null, '', '#chat');
        setCurrentPage('chat');
        setShowSecurityModal(true);
        return;
      }

      // Protect chat route
      if (page === 'chat' && !token) {
        navigate('home');
        return;
      }

      setCurrentPage(page);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [navigate]);

  // Render current page based on state
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={navigate} />;
      case 'signin':
        return <SignInPage onNavigate={navigate} />;
      case 'signup':
        return <SignUpPage onNavigate={navigate} />;
      case 'chat':
        return (
          <ChatPage 
            onNavigate={navigate} 
            triggerSecurityModal={showSecurityModal}
            onSecurityModalShown={() => setShowSecurityModal(false)}
          />
        );
      default:
        return <HomePage onNavigate={navigate} />;
    }
  };

  return <div className="min-h-screen">{renderPage()}</div>;
};

export default App;