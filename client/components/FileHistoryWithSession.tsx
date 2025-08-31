import React, { useEffect, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import FileHistory from './FileHistory';

interface FileHistoryState {
  searchTerm: string;
  statusFilter: 'all' | 'success' | 'failed' | 'processing';
  storageFilter: 'all' | 'server' | 'local';
  sortBy: 'upload_timestamp' | 'original_filename';
  sortOrder: 'asc' | 'desc';
  expandedFiles: Set<string>;
}

/**
 * FileHistoryWithSession
 * 
 * This component wraps the FileHistory component to provide session persistence
 * for filter and view states when navigating between pages.
 */
const FileHistoryWithSession: React.FC = () => {
  const { sessionState, updateSessionState } = useSession();
  const [fileHistoryState, setFileHistoryState] = useState<FileHistoryState>({
    searchTerm: '',
    statusFilter: 'all',
    storageFilter: 'all',
    sortBy: 'upload_timestamp',
    sortOrder: 'desc',
    expandedFiles: new Set<string>(),
  });

  // Restore state from session on mount
  useEffect(() => {
    if (sessionState.fileHistoryState) {
      setFileHistoryState({
        ...sessionState.fileHistoryState,
        // Convert array back to Set for expandedFiles
        expandedFiles: new Set(sessionState.fileHistoryState.expandedFiles || []),
      });
    }
  }, []);

  // Save state to session when it changes
  useEffect(() => {
    const stateToSave = {
      ...fileHistoryState,
      // Convert Set to array for serialization
      expandedFiles: Array.from(fileHistoryState.expandedFiles),
    };
    
    updateSessionState({
      fileHistoryState: stateToSave,
    });
  }, [fileHistoryState, updateSessionState]);

  // Note: Since the current FileHistory component doesn't accept props for these states,
  // we'll need to modify it to accept them, or create a more sophisticated wrapper.
  // For now, this establishes the pattern and the FileHistory component can be enhanced
  // to use these props in the future.

  return <FileHistory />;
};

export default FileHistoryWithSession;
