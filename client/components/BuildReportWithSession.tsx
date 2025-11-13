import React, { useEffect, useRef, useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useBuildReportSession } from '../hooks/useBuildReportSession';
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
    hasActiveSession,
    saveSession,
    getInitialStateFromSession,
    updateSessionState
  } = useBuildReportSession();

  const isInitialMount = useRef(true);
  const lastLoadedReportRef = useRef(loadedReportState);
  const [shouldShowSessionBanner, setShouldShowSessionBanner] = useState(false);

  // Check if we should show a session restoration banner
  useEffect(() => {
    if (isInitialMount.current && hasActiveSession && !loadedReportState) {
      const sessionHasWork = sessionState.cards.length > 0 ||
                            sessionState.importedData.length > 0 ||
                            sessionState.fileName !== '';
      setShouldShowSessionBanner(sessionHasWork);
    }
  }, [hasActiveSession, sessionState, loadedReportState]);

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
      setShouldShowSessionBanner(false); // Hide banner when loading new report
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
      const sessionInitialState = getInitialStateFromSession();
      if (sessionInitialState && (
        sessionInitialState.cards.length > 0 ||
        sessionInitialState.importedData.length > 0 ||
        sessionInitialState.fileName !== ''
      )) {
        return sessionInitialState;
      }
    }

    // No active session, return undefined to let BuildReport use its defaults
    return undefined;
  }, [loadedReportState, hasActiveSession, getInitialStateFromSession]);

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

    // Save session periodically
    const saveInterval = setInterval(() => {
      saveSession();
    }, 30000); // Save every 30 seconds

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Save session when component unmounts (i.e., when navigating away)
      saveSession();
      clearInterval(saveInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveSession]);

  // Mark initial mount as complete
  useEffect(() => {
    isInitialMount.current = false;
  }, []);

  const dismissSessionBanner = () => {
    setShouldShowSessionBanner(false);
  };

  return (
    <>
      {/* Session Restoration Banner */}
      {shouldShowSessionBanner && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md">
          <div className="glass-card rounded-lg p-4 border border-blue-400/30">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-300">
                  Previous work restored
                </p>
                <p className="text-xs text-white/70 mt-1">
                  Your dashboard and data from your last session have been automatically restored.
                </p>
              </div>
              <button
                onClick={dismissSessionBanner}
                className="text-white/50 hover:text-white/80 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <BuildReport
        loadedReportState={effectiveReportState}
        userEmail={userEmail}
      />
    </>
  );
};

export default BuildReportWithSession;
