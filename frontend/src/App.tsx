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

  // Push extra history entry when on chat page to catch back button
  useEffect(() => {
    if (currentPage === 'chat' && getToken()) {
      // Push a duplicate entry so back button has somewhere to go
      window.history.pushState({ page: 'chat' }, '', '#chat');
    }
  }, [currentPage]);

  // Listen for back button using popstate
  useEffect(() => {
    const handlePopState = (_event: PopStateEvent) => {
      const token = getToken();

      // If logged in and on chat, show security modal instead of navigating away
      if (token && currentPage === 'chat') {
        // Prevent navigation - push chat back
        window.history.pushState({ page: 'chat' }, '', '#chat');
        setShowSecurityModal(true);
        return;
      }

      // Otherwise handle normally
      const page = getPageFromHash();

      if (page === 'chat' && !token) {
        navigate('home');
        return;
      }

      setCurrentPage(page);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentPage, navigate]);

  // Also listen for hash changes (for manual navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const page = getPageFromHash();
      const token = getToken();

      if (token && currentPage === 'chat' && (page === 'home' || page === 'signin' || page === 'signup')) {
        window.history.pushState({ page: 'chat' }, '', '#chat');
        setShowSecurityModal(true);
        return;
      }

      if (page === 'chat' && !token) {
        navigate('home');
        return;
      }

      setCurrentPage(page);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentPage, navigate]);

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