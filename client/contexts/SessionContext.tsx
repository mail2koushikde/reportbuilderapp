import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// Define interfaces for the session state
export interface DataRow {
  [key: string]: string | number;
}

export interface TextBox {
  id: string;
  cardId: string;
  content: string;
  htmlContent?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  fontSize: number;
  color?: string;
  isEditing: boolean;
}

export interface Arrow {
  id: string;
  cardId: string;
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  color: string;
  thickness: number;
}

export interface DashboardCard {
  id: string;
  chartType: 'none' | 'pie' | 'bar' | 'mixbar' | 'table' | 'scorecard' | 'line';
  title: string;
  gridPosition: { x: number; y: number; width: number; height: number };
  isConfiguring: boolean;
  dimension: string;
  dimension2?: string;
  measure: string;
  measure2?: string;
  seriesColumn?: string;
  sortBy?: 'dimension' | 'measure';
  sortOrder?: 'asc' | 'desc';
  mergedBars?: { [key: string]: string[] };
  customNames?: { [key: string]: string };
  textBoxes?: TextBox[];
  arrows?: Arrow[];
  filters?: { [key: string]: string[] };
  customization?: {
    showLegend?: boolean;
    showDataLabels?: boolean;
    showTooltips?: boolean;
    colorScheme?: string;
  };
}

export interface LocalDataset {
  id: string;
  originalFileName: string;
  version: number;
  createdAt: Date;
  fileSize: number;
  columns: string[];
  rowCount: number;
}

// Session state interface
export interface SessionState {
  // Core data state
  cards: DashboardCard[];
  importedData: DataRow[];
  columns: string[];
  fileName: string;
  currentFileVersion: number | null;
  
  // UI state
  currentTool: 'select' | 'textbox' | 'arrow' | null;
  selectedElement: string | null;
  hideControls: boolean;
  showGrid: boolean;
  
  // Filter state
  filtersOpen: boolean;
  leftSectionVisible: boolean;
  selectedDimension: string;
  dimensionValues: string[];
  selectedValues: Set<string>;
  dimensionSelections: Record<string, string[]>;
  
  // Cache state
  cacheEnabled: boolean;
  hasCachedData: boolean;
  cacheInfo: { count: number; size: number };
  
  // Local datasets
  localDatasets: LocalDataset[];
  
  // History state
  cardsHistory: DashboardCard[][];
  historyIndex: number;
  
  // Version management
  availableVersions: any[];
  
  // Grid configuration
  gridCols: number;
  gridRows: number;
  containerWidth: number;
  
  // Session metadata
  lastSaved: Date;
  isActive: boolean;

  // Page-specific states (optional)
  fileHistoryState?: any;
}

interface SessionContextType {
  // Current session state
  sessionState: SessionState;
  
  // State management functions
  updateSessionState: (updates: Partial<SessionState>) => void;
  clearSessionState: () => void;
  saveSession: () => void;
  restoreSession: () => void;
  
  // Specific state helpers
  updateCards: (cards: DashboardCard[]) => void;
  updateImportedData: (data: DataRow[], columns: string[]) => void;
  updateFileName: (fileName: string, version?: number | null) => void;
  updateFilters: (filterUpdates: Partial<Pick<SessionState, 'filtersOpen' | 'leftSectionVisible' | 'selectedDimension' | 'dimensionValues' | 'selectedValues' | 'dimensionSelections'>>) => void;
  updateTool: (tool: 'select' | 'textbox' | 'arrow' | null, selectedElement?: string | null) => void;
  
  // Session status
  hasActiveSession: boolean;
  isSessionDirty: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

// Default session state
const getDefaultSessionState = (): SessionState => ({
  cards: [],
  importedData: [],
  columns: [],
  fileName: '',
  currentFileVersion: null,
  currentTool: 'select',
  selectedElement: null,
  hideControls: false,
  showGrid: false,
  filtersOpen: false,
  leftSectionVisible: true,
  selectedDimension: '',
  dimensionValues: [],
  selectedValues: new Set(),
  dimensionSelections: {},
  cacheEnabled: false,
  hasCachedData: false,
  cacheInfo: { count: 0, size: 0 },
  localDatasets: [],
  cardsHistory: [],
  historyIndex: -1,
  availableVersions: [],
  gridCols: 24,
  gridRows: 20,
  containerWidth: 1200,
  lastSaved: new Date(),
  isActive: false,
});

interface SessionProviderProps {
  children: React.ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [sessionState, setSessionState] = useState<SessionState>(getDefaultSessionState);
  const [isSessionDirty, setIsSessionDirty] = useState(false);
  const initialStateRef = useRef<SessionState | null>(null);
  
  // Session storage key
  const SESSION_STORAGE_KEY = 'marcom_finance_session';
  
  // Initialize session on mount
  useEffect(() => {
    restoreSession();
  }, []);
  
  // Auto-save session when state changes
  useEffect(() => {
    if (sessionState.isActive && isSessionDirty) {
      const saveTimer = setTimeout(() => {
        saveSession();
      }, 1000); // Auto-save after 1 second of inactivity
      
      return () => clearTimeout(saveTimer);
    }
  }, [sessionState, isSessionDirty]);
  
  // Track if session has active work
  const hasActiveSession = sessionState.cards.length > 0 || 
                          sessionState.importedData.length > 0 || 
                          sessionState.fileName !== '';
  
  // Update session state with dirty tracking
  const updateSessionState = useCallback((updates: Partial<SessionState>) => {
    setSessionState(prev => {
      const newState = {
        ...prev,
        ...updates,
        lastSaved: new Date(),
        isActive: true
      };

      // Check if this is a meaningful change (not just UI state)
      const meaningfulChanges = [
        'cards', 'importedData', 'columns', 'fileName', 'currentFileVersion',
        'dimensionSelections', 'selectedValues'
      ];

      const hasMeaningfulChange = meaningfulChanges.some(key =>
        updates.hasOwnProperty(key) && updates[key as keyof SessionState] !== prev[key as keyof SessionState]
      );

      if (hasMeaningfulChange) {
        setIsSessionDirty(true);
      }

      return newState;
    });
  }, []);
  
  // Clear session state
  const clearSessionState = () => {
    setSessionState(getDefaultSessionState());
    setIsSessionDirty(false);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };
  
  // Save session to localStorage
  const saveSession = () => {
    try {
      const sessionData = {
        ...sessionState,
        // Convert Set to Array for JSON serialization
        selectedValues: Array.from(sessionState.selectedValues),
        lastSaved: new Date().toISOString(),
      };
      
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      setIsSessionDirty(false);
      console.log('Session saved successfully');
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };
  
  // Restore session from localStorage
  const restoreSession = () => {
    try {
      const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        
        // Convert Array back to Set
        if (sessionData.selectedValues && Array.isArray(sessionData.selectedValues)) {
          sessionData.selectedValues = new Set(sessionData.selectedValues);
        }
        
        // Parse dates
        if (sessionData.lastSaved) {
          sessionData.lastSaved = new Date(sessionData.lastSaved);
        }
        
        setSessionState({
          ...getDefaultSessionState(),
          ...sessionData,
          isActive: sessionData.cards?.length > 0 || sessionData.importedData?.length > 0,
        });
        
        console.log('Session restored successfully');
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      setSessionState(getDefaultSessionState());
    }
  };
  
  // Helper functions for specific state updates
  const updateCards = (cards: DashboardCard[]) => {
    updateSessionState({ cards });
  };
  
  const updateImportedData = (data: DataRow[], columns: string[]) => {
    updateSessionState({ importedData: data, columns });
  };
  
  const updateFileName = (fileName: string, version?: number | null) => {
    updateSessionState({ 
      fileName, 
      currentFileVersion: version !== undefined ? version : sessionState.currentFileVersion 
    });
  };
  
  const updateFilters = (filterUpdates: Partial<Pick<SessionState, 'filtersOpen' | 'leftSectionVisible' | 'selectedDimension' | 'dimensionValues' | 'selectedValues' | 'dimensionSelections'>>) => {
    updateSessionState(filterUpdates);
  };
  
  const updateTool = (tool: 'select' | 'textbox' | 'arrow' | null, selectedElement?: string | null) => {
    updateSessionState({ 
      currentTool: tool, 
      selectedElement: selectedElement !== undefined ? selectedElement : null 
    });
  };
  
  const value: SessionContextType = {
    sessionState,
    updateSessionState,
    clearSessionState,
    saveSession,
    restoreSession,
    updateCards,
    updateImportedData,
    updateFileName,
    updateFilters,
    updateTool,
    hasActiveSession,
    isSessionDirty,
  };
  
  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};
