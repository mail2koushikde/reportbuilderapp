import React from 'react';
import { useSession } from '../contexts/SessionContext';

const SessionDebug: React.FC = () => {
  const { sessionState, hasActiveSession } = useSession();

  if (!hasActiveSession) {
    return (
      <div className="fixed bottom-4 right-4 bg-red-500/20 border border-red-400/30 rounded-lg p-3 text-xs text-white max-w-xs">
        <div className="font-semibold text-red-300">Session: Inactive</div>
        <div>No active session data</div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 text-xs text-white max-w-xs max-h-32 overflow-y-auto">
      <div className="font-semibold text-blue-300 mb-2">Session Debug</div>
      <div>Cards: {sessionState.cards.length}</div>
      <div>Data rows: {sessionState.importedData.length}</div>
      <div>Columns: {sessionState.columns.length}</div>
      <div>File: {sessionState.fileName || 'None'}</div>
      <div>Version: {sessionState.currentFileVersion || 'None'}</div>
      <div className="text-xs text-white/50 mt-1">
        Last saved: {sessionState.lastSaved.toLocaleTimeString()}
      </div>
    </div>
  );
};

export default SessionDebug;
