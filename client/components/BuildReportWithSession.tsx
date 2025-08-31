import React, { useEffect, useRef } from 'react';
import { useSession } from '../contexts/SessionContext';
import BuildReport from './BuildReport';

interface BuildReportWithSessionProps {
  loadedReportState?: any;
  userEmail?: string;
}

/**
 * BuildReportWithSession
 * 
 * This component wraps the existing BuildReport component to provide session persistence.
 * It automatically saves and restores work state when navigating between pages.
 */
const BuildReportWithSession: React.FC<BuildReportWithSessionProps> = ({ 
  loadedReportState, 
  userEmail = 'mail2koushikde@gmail.com' 
}) => {
  const { 
    sessionState, 
    updateSessionState, 
    hasActiveSession,
    saveSession,
    restoreSession 
  } = useSession();
  
  const isInitialMount = useRef(true);
  const lastLoadedReportRef = useRef(loadedReportState);
  
  // Handle loaded report state from saved reports
  useEffect(() => {
    // If a new report is loaded from saved reports, update session state
    if (loadedReportState && loadedReportState !== lastLoadedReportRef.current) {
      console.log('Loading saved report into session');
      updateSessionState({
        cards: loadedReportState.cards || [],
        hideControls: loadedReportState.hideControls || false,
        importedData: loadedReportState.importedData || [],
        columns: loadedReportState.columns || [],
        fileName: loadedReportState.fileName || '',
        currentFileVersion: loadedReportState.currentFileVersion || null,
        isActive: true,
      });
      lastLoadedReportRef.current = loadedReportState;
    }
  }, [loadedReportState, updateSessionState]);
  
  // Create effective report state combining session and loaded report
  const effectiveReportState = React.useMemo(() => {
    // If we have a loaded report state (from saved reports), use it
    if (loadedReportState) {
      return loadedReportState;
    }
    
    // Otherwise, use session state if we have active session data
    if (hasActiveSession) {
      return {
        cards: sessionState.cards,
        hideControls: sessionState.hideControls,
        importedData: sessionState.importedData,
        columns: sessionState.columns,
        fileName: sessionState.fileName,
        currentFileVersion: sessionState.currentFileVersion,
      };
    }
    
    // No active session, return undefined to let BuildReport use its defaults
    return undefined;
  }, [loadedReportState, hasActiveSession, sessionState]);
  
  // Auto-save session when component unmounts or before page navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveSession();
    };
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveSession();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      // Save session when component unmounts (i.e., when navigating away)
      saveSession();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveSession]);
  
  // Mark initial mount as complete
  useEffect(() => {
    isInitialMount.current = false;
  }, []);
  
  return (
    <BuildReport
      loadedReportState={effectiveReportState}
      userEmail={userEmail}
    />
  );
};

export default BuildReportWithSession;
