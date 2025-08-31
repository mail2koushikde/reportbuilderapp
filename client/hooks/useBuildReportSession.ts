import { useEffect, useCallback } from 'react';
import { useSession, DashboardCard, DataRow } from '../contexts/SessionContext';

interface BuildReportStateSync {
  // Core data
  cards?: DashboardCard[];
  importedData?: DataRow[];
  columns?: string[];
  fileName?: string;
  currentFileVersion?: number | null;
  
  // UI state
  currentTool?: 'select' | 'textbox' | 'arrow' | null;
  selectedElement?: string | null;
  hideControls?: boolean;
  showGrid?: boolean;
  
  // Filter state
  filtersOpen?: boolean;
  leftSectionVisible?: boolean;
  selectedDimension?: string;
  dimensionValues?: string[];
  selectedValues?: Set<string>;
  dimensionSelections?: Record<string, string[]>;
  
  // Cache state
  cacheEnabled?: boolean;
  hasCachedData?: boolean;
  
  // History state
  cardsHistory?: DashboardCard[][];
  historyIndex?: number;
  
  // Version management
  availableVersions?: any[];
  
  // Grid configuration
  gridCols?: number;
  gridRows?: number;
  containerWidth?: number;
}

/**
 * Custom hook for BuildReport components to sync their state with session context
 * This allows work to be preserved when navigating between pages
 */
export const useBuildReportSession = () => {
  const { 
    sessionState, 
    updateSessionState, 
    hasActiveSession,
    updateCards,
    updateImportedData,
    updateFileName,
    updateFilters,
    updateTool,
    saveSession,
    clearSessionState
  } = useSession();
  
  // Sync specific state changes to session
  const syncToSession = useCallback((stateUpdates: BuildReportStateSync) => {
    // Filter out undefined values and only sync meaningful changes
    const filteredUpdates: any = {};
    
    Object.entries(stateUpdates).forEach(([key, value]) => {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    });
    
    if (Object.keys(filteredUpdates).length > 0) {
      updateSessionState(filteredUpdates);
    }
  }, [updateSessionState]);
  
  // Quick methods for common state updates
  const syncCards = useCallback((cards: DashboardCard[]) => {
    updateCards(cards);
  }, [updateCards]);
  
  const syncData = useCallback((data: DataRow[], columns: string[]) => {
    updateImportedData(data, columns);
  }, [updateImportedData]);
  
  const syncFile = useCallback((fileName: string, version?: number | null) => {
    updateFileName(fileName, version);
  }, [updateFileName]);
  
  const syncFilters = useCallback((filterState: Partial<Pick<BuildReportStateSync, 'filtersOpen' | 'leftSectionVisible' | 'selectedDimension' | 'dimensionValues' | 'selectedValues' | 'dimensionSelections'>>) => {
    updateFilters(filterState as any);
  }, [updateFilters]);
  
  const syncTool = useCallback((tool: 'select' | 'textbox' | 'arrow' | null, selectedElement?: string | null) => {
    updateTool(tool, selectedElement);
  }, [updateTool]);
  
  // Method to get initial state from session (for component initialization)
  const getInitialStateFromSession = useCallback(() => {
    if (!hasActiveSession) {
      return null;
    }
    
    return {
      cards: sessionState.cards,
      importedData: sessionState.importedData,
      columns: sessionState.columns,
      fileName: sessionState.fileName,
      currentFileVersion: sessionState.currentFileVersion,
      currentTool: sessionState.currentTool,
      selectedElement: sessionState.selectedElement,
      hideControls: sessionState.hideControls,
      showGrid: sessionState.showGrid,
      filtersOpen: sessionState.filtersOpen,
      leftSectionVisible: sessionState.leftSectionVisible,
      selectedDimension: sessionState.selectedDimension,
      dimensionValues: sessionState.dimensionValues,
      selectedValues: sessionState.selectedValues,
      dimensionSelections: sessionState.dimensionSelections,
      cacheEnabled: sessionState.cacheEnabled,
      hasCachedData: sessionState.hasCachedData,
      cardsHistory: sessionState.cardsHistory,
      historyIndex: sessionState.historyIndex,
      availableVersions: sessionState.availableVersions,
      gridCols: sessionState.gridCols,
      gridRows: sessionState.gridRows,
      containerWidth: sessionState.containerWidth,
    };
  }, [hasActiveSession, sessionState]);
  
  // Method to check if session has meaningful work data
  const hasWorkInProgress = useCallback(() => {
    return sessionState.cards.length > 0 || 
           sessionState.importedData.length > 0 || 
           sessionState.fileName !== '';
  }, [sessionState]);
  
  return {
    // Session state access
    sessionState,
    hasActiveSession,
    hasWorkInProgress: hasWorkInProgress(),
    
    // State synchronization methods
    syncToSession,
    syncCards,
    syncData,
    syncFile,
    syncFilters,
    syncTool,
    
    // Session management
    getInitialStateFromSession,
    saveSession,
    clearSessionState,
    
    // Direct session update (for advanced usage)
    updateSessionState,
  };
};

export default useBuildReportSession;
