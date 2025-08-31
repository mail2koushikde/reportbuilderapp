import React, { useEffect, useRef } from 'react';
import { useSession } from '../contexts/SessionContext';
import FileHistory from './FileHistory';

/**
 * FileHistoryWithSession
 *
 * This component wraps the FileHistory component to provide session persistence.
 * For now, it's a simple wrapper that just ensures session saves when navigating away.
 * The FileHistory component manages its own state internally.
 */
const FileHistoryWithSession: React.FC = () => {
  const { saveSession } = useSession();
  const hasInitialized = useRef(false);

  // Auto-save session when component unmounts (navigating away)
  useEffect(() => {
    hasInitialized.current = true;

    return () => {
      // Save session when component unmounts (i.e., when navigating away)
      if (hasInitialized.current) {
        saveSession();
      }
    };
  }, [saveSession]);

  // Save session periodically while on this page
  useEffect(() => {
    const saveInterval = setInterval(() => {
      saveSession();
    }, 30000); // Save every 30 seconds

    return () => clearInterval(saveInterval);
  }, [saveSession]);

  return <FileHistory />;
};

export default FileHistoryWithSession;
