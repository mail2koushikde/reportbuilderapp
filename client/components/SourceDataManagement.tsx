import React, { useState, useMemo, useEffect } from 'react';
import { Database, ChevronDown, ChevronUp, RotateCcw, Eye } from 'lucide-react';

interface ActivityRecord {
  version: string;
  submittedBy: string;
  submittedDate: string;
  status: 'DRAFT' | 'CHECKED-IN' | 'APPROVED';
  actionBy?: string;
  actionDate?: string;
}

interface VersionRecord {
  version: string;
  submittedBy: string;
  submittedDate: string;
  status: 'APPROVED';
  actionBy: string;
  actionDate: string;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string;
  direction: SortDirection;
}

const SourceDataManagement: React.FC = () => {
  const [selectedFileType, setSelectedFileType] = useState('Cost Center Mapping');
  const [activitySort, setActivitySort] = useState<SortState>({ column: '', direction: null });
  const [versionSort, setVersionSort] = useState<SortState>({ column: '', direction: null });
  const [recentActivityData, setRecentActivityData] = useState<ActivityRecord[]>([]);
  const [versionHistoryData, setVersionHistoryData] = useState<VersionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fileTypes = [
    'Cost Center Mapping',
    'Organization Map',
    'Pillar Group Mapping'
  ];

  // Load data from JSON files
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load Recent Activity data
        const activityResponse = await fetch('/client/data/recent-activity.json');
        const activityData = await activityResponse.json();
        setRecentActivityData(activityData);

        // Load Version History data
        const versionResponse = await fetch('/client/data/version-history.json');
        const versionData = await versionResponse.json();
        setVersionHistoryData(versionData);

      } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to empty arrays if loading fails
        setRecentActivityData([]);
        setVersionHistoryData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Sorting functions
  const handleActivitySort = (column: string) => {
    setActivitySort(prev => ({
      column,
      direction: prev.column === column
        ? (prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc')
        : 'asc'
    }));
  };

  const handleVersionSort = (column: string) => {
    setVersionSort(prev => ({
      column,
      direction: prev.column === column
        ? (prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc')
        : 'asc'
    }));
  };

  const sortData = <T extends Record<string, any>>(data: T[], sortState: SortState): T[] => {
    if (!sortState.direction || !sortState.column) return data;

    return [...data].sort((a, b) => {
      let aVal = a[sortState.column];
      let bVal = b[sortState.column];

      // Handle null/undefined values - put them at the end for ascending, beginning for descending
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortState.direction === 'asc' ? 1 : -1;
      if (bVal == null) return sortState.direction === 'asc' ? -1 : 1;

      // Handle version numbers (convert to numbers for proper sorting)
      if (sortState.column === 'version') {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      }

      // Handle dates (convert to Date objects for proper sorting)
      if (sortState.column === 'submittedDate' || sortState.column === 'actionDate') {
        aVal = new Date(aVal?.replace('\n', ' ') || '');
        bVal = new Date(bVal?.replace('\n', ' ') || '');
      }

      // Handle status (custom order)
      if (sortState.column === 'status') {
        const statusOrder = { 'DRAFT': 1, 'CHECKED-IN': 2, 'APPROVED': 3 };
        aVal = statusOrder[aVal as keyof typeof statusOrder] || 0;
        bVal = statusOrder[bVal as keyof typeof statusOrder] || 0;
      }

      // Handle empty strings for actionBy and other text fields
      if (sortState.column === 'actionBy' || sortState.column === 'submittedBy') {
        aVal = aVal || '';
        bVal = bVal || '';
      }

      // String comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      let comparison = 0;
      if (aVal > bVal) comparison = 1;
      if (aVal < bVal) comparison = -1;

      return sortState.direction === 'desc' ? -comparison : comparison;
    });
  };

  // Memoized sorted data
  const sortedActivityData = useMemo(() =>
    sortData(recentActivityData, activitySort),
    [recentActivityData, activitySort]
  );

  const sortedVersionData = useMemo(() =>
    sortData(versionHistoryData, versionSort),
    [versionHistoryData, versionSort]
  );

  const getSortIcon = (column: string, sortState: SortState) => {
    if (sortState.column !== column || !sortState.direction) {
      return <ChevronDown className="w-3 h-3" />;
    }
    return sortState.direction === 'asc'
      ? <ChevronUp className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3" />;
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'DRAFT': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'CHECKED-IN': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'APPROVED': 'bg-green-500/20 text-green-300 border-green-500/30'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[status as keyof typeof statusColors]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-white/90">Source Data Management</h1>
            <p className="text-sm text-white/60">Manage and configure your data sources</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6">
        {/* File Type Selection */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-white/80">Select File Type</label>
          <div className="relative">
            <select
              value={selectedFileType}
              onChange={(e) => setSelectedFileType(e.target.value)}
              className="appearance-none bg-gray-800 border border-gray-600 rounded px-4 py-2 pr-8 text-white/90 text-sm focus:outline-none focus:border-blue-400 min-w-[300px]"
            >
              {fileTypes.map((type) => (
                <option key={type} value={type}>
                  {type.toUpperCase().replace(/ /g, '_')}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
          </div>
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
            <RotateCcw className="w-4 h-4" />
            RELOAD
          </button>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/5 rounded-lg border border-white/10">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white/90">Latest Activity</h3>
          </div>

          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(4 * 2.5rem + 2.5rem)' }}>
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-800/95 backdrop-blur-sm z-10 border-b border-white/10">
                <tr className="border-b border-white/10">
                  <th className="text-left p-2 text-xs font-medium text-white/70">
                    <button
                      onClick={() => handleActivitySort('version')}
                      className="flex items-center gap-1 hover:text-white/90 transition-colors"
                    >
                      Version {getSortIcon('version', activitySort)}
                    </button>
                  </th>
                  <th className="text-left p-2 text-xs font-medium text-white/70">
                    <button
                      onClick={() => handleActivitySort('submittedBy')}
                      className="flex items-center gap-1 hover:text-white/90 transition-colors"
                    >
                      Submitted By {getSortIcon('submittedBy', activitySort)}
                    </button>
                  </th>
                  <th className="text-left p-2 text-xs font-medium text-white/70">
                    <button
                      onClick={() => handleActivitySort('submittedDate')}
                      className="flex items-center gap-1 hover:text-white/90 transition-colors"
                    >
                      Submitted Date {getSortIcon('submittedDate', activitySort)}
                    </button>
                  </th>
                  <th className="text-left p-2 text-xs font-medium text-white/70">
                    <button
                      onClick={() => handleActivitySort('status')}
                      className="flex items-center gap-1 hover:text-white/90 transition-colors"
                    >
                      Status {getSortIcon('status', activitySort)}
                    </button>
                  </th>
                  <th className="text-left p-2 text-xs font-medium text-white/70">
                    <button
                      onClick={() => handleActivitySort('actionBy')}
                      className="flex items-center gap-1 hover:text-white/90 transition-colors"
                    >
                      Action By {getSortIcon('actionBy', activitySort)}
                    </button>
                  </th>
                  <th className="text-left p-2 text-xs font-medium text-white/70">
                    <button
                      onClick={() => handleActivitySort('actionDate')}
                      className="flex items-center gap-1 hover:text-white/90 transition-colors"
                    >
                      Action Date {getSortIcon('actionDate', activitySort)}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-white/60">
                      Loading...
                    </td>
                  </tr>
                ) : sortedActivityData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-white/60">
                      No activity data available
                    </td>
                  </tr>
                ) : sortedActivityData.map((record, index) => (
                  <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-2 text-xs text-white/80">{record.version}</td>
                    <td className="p-2 text-xs text-white/80">{record.submittedBy}</td>
                    <td className="p-2 text-xs text-white/80 whitespace-pre-line">{record.submittedDate}</td>
                    <td className="p-2">{getStatusBadge(record.status)}</td>
                    <td className="p-2 text-xs text-white/80">{record.actionBy || ''}</td>
                    <td className="p-2 text-xs text-white/80 whitespace-pre-line">{record.actionDate || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Version History */}
        <div className="bg-white/5 rounded-lg border border-white/10">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white/90">Version History</h3>
          </div>

          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(4 * 2.5rem + 2.5rem)' }}>
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-800/95 backdrop-blur-sm z-10 border-b border-white/10">
                <tr className="border-b border-white/10">
                  <th className="text-left p-2 text-xs font-medium text-white/70">
                    <button
                      onClick={() => handleVersionSort('version')}
                      className="flex items-center gap-1 hover:text-white/90 transition-colors"
                    >
                      Version {getSortIcon('version', versionSort)}
                    </button>
                  </th>
                  <th className="text-left p-2 text-xs font-medium text-white/70">
                    <button
                      onClick={() => handleVersionSort('submittedBy')}
                      className="flex items-center gap-1 hover:text-white/90 transition-colors"
                    >
                      Submitted By {getSortIcon('submittedBy', versionSort)}
                    </button>
                  </th>
                  <th className="text-left p-2 text-xs font-medium text-white/70">
                    <button
                      onClick={() => handleVersionSort('submittedDate')}
                      className="flex items-center gap-1 hover:text-white/90 transition-colors"
                    >
                      Submitted Date {getSortIcon('submittedDate', versionSort)}
                    </button>
                  </th>
                  <th className="text-left p-2 text-xs font-medium text-white/70">
                    <button
                      onClick={() => handleVersionSort('status')}
                      className="flex items-center gap-1 hover:text-white/90 transition-colors"
                    >
                      Status {getSortIcon('status', versionSort)}
                    </button>
                  </th>
                  <th className="text-left p-2 text-xs font-medium text-white/70">
                    <button
                      onClick={() => handleVersionSort('actionBy')}
                      className="flex items-center gap-1 hover:text-white/90 transition-colors"
                    >
                      Action By {getSortIcon('actionBy', versionSort)}
                    </button>
                  </th>
                  <th className="text-left p-2 text-xs font-medium text-white/70">
                    <button
                      onClick={() => handleVersionSort('actionDate')}
                      className="flex items-center gap-1 hover:text-white/90 transition-colors"
                    >
                      Action Date {getSortIcon('actionDate', versionSort)}
                    </button>
                  </th>
                  <th className="text-left p-2 text-xs font-medium text-white/70">
                    <div className="flex items-center gap-1">
                      Actions <ChevronDown className="w-3 h-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-white/60">
                      Loading...
                    </td>
                  </tr>
                ) : sortedVersionData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-white/60">
                      No version history data available
                    </td>
                  </tr>
                ) : sortedVersionData.map((record, index) => (
                  <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-2 text-xs text-white/80">{record.version}</td>
                    <td className="p-2 text-xs text-white/80">{record.submittedBy}</td>
                    <td className="p-2 text-xs text-white/80 whitespace-pre-line">{record.submittedDate}</td>
                    <td className="p-2">{getStatusBadge(record.status)}</td>
                    <td className="p-2 text-xs text-white/80">{record.actionBy}</td>
                    <td className="p-2 text-xs text-white/80 whitespace-pre-line">{record.actionDate}</td>
                    <td className="p-2">
                      <button className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors">
                        <Eye className="w-3 h-3" />
                        VIEW
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SourceDataManagement;
