import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Calendar,
  Eye,
  Trash2,
  FileText,
  BarChart3,
  PieChart,
  BarChart2,
  Table,
  Search,
  Filter,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import { storageService } from '../services/storageService';

interface TextBox {
  id: string;
  cardId: string;
  content: string;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  fontSize: number;
  isEditing: boolean;
}

interface Arrow {
  id: string;
  cardId: string;
  startPosition: {
    x: number;
    y: number;
  };
  endPosition: {
    x: number;
    y: number;
  };
  color: string;
  thickness: number;
}

interface DashboardCard {
  id: string;
  chartType: 'pie' | 'bar' | 'mixbar' | 'table';
  title: string;
  gridPosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isConfiguring: boolean;
  dimension: string;
  dimension2?: string;
  measure: string;
  yAxisScale: 'linear' | 'percentage';
  sortBy: 'dimension' | 'measure';
  sortOrder: 'asc' | 'desc';
  mergedBars: { [key: string]: string[] };
  customNames: { [key: string]: string };
  textBoxes: TextBox[];
  arrows: Arrow[];
  data?: any[];
}

export interface SavedReport {
  id: string;
  name: string;
  description?: string;
  savedAt: Date;
  dashboardState: {
    cards: DashboardCard[];
    hideControls: boolean;
    importedData: any[];
  };
  previewImage?: string; // Base64 encoded screenshot or chart preview
  chartCount: number;
  chartTypes: string[];
}

interface ViewSavedReportsProps {
  onLoadReport?: (reportState: SavedReport['dashboardState']) => void;
}

const ViewSavedReports: React.FC<ViewSavedReportsProps> = ({ onLoadReport }) => {
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [storageInfo, setStorageInfo] = useState({ storageSize: '0', percentUsed: '0', isNearLimit: false });
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'charts'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState<'all' | 'pie' | 'bar' | 'mixbar' | 'table'>('all');

  // Load saved views from file storage on component mount
  useEffect(() => {
    const loadSavedViews = async () => {
      try {
        const views = await storageService.getAllViews();
        const reportsWithDates = views.map((report: any) => ({
          ...report,
          savedAt: new Date(report.savedAt)
        }));
        setSavedReports(reportsWithDates);

        // Load storage info
        const info = await getStorageInfo();
        setStorageInfo(info);
      } catch (error) {
        console.error('Error loading saved views:', error);
      }
    };

    loadSavedViews();
  }, []);

  // Filter and sort reports
  const filteredAndSortedReports = savedReports
    .filter(report => {
      const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (report.description && report.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFilter = filterType === 'all' || report.chartTypes.includes(filterType);
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = a.savedAt.getTime() - b.savedAt.getTime();
          break;
        case 'charts':
          comparison = a.chartCount - b.chartCount;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const deleteReport = async (reportId: string) => {
    try {
      await storageService.deleteView(reportId);
      const updatedReports = savedReports.filter(report => report.id !== reportId);
      setSavedReports(updatedReports);

      // Refresh storage info
      const info = await getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Error deleting view:', error);
      alert('Failed to delete view. Please try again.');
    }
  };

  const clearAllReports = async () => {
    if (confirm('Are you sure you want to delete ALL saved views? This action cannot be undone.')) {
      try {
        await storageService.clearAllViews();
        setSavedReports([]);

        // Refresh storage info
        const info = await getStorageInfo();
        setStorageInfo(info);
      } catch (error) {
        console.error('Error clearing views:', error);
        alert('Failed to clear views. Please try again.');
      }
    }
  };

  const getStorageInfo = async () => {
    try {
      const info = await storageService.getStorageInfo();
      return {
        storageSize: (info.storageSize / 1024).toFixed(1),
        percentUsed: info.percentUsed.toFixed(1),
        isNearLimit: info.isNearLimit
      };
    } catch {
      return { storageSize: '0', percentUsed: '0', isNearLimit: false };
    }
  };

  const loadReport = (report: SavedReport) => {
    if (onLoadReport) {
      onLoadReport(report.dashboardState);
    }
  };

  const getChartIcon = (chartType: string) => {
    switch (chartType) {
      case 'pie': return <PieChart className="w-4 h-4" />;
      case 'bar': return <BarChart3 className="w-4 h-4" />;
      case 'mixbar': return <BarChart2 className="w-4 h-4" />;
      case 'table': return <Table className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Bookmark className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-semibold text-white">Saved Views</h1>
          </div>
          {savedReports.length > 0 && (
            <button
              onClick={clearAllReports}
              className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1 rounded-lg transition-colors border border-red-500/20"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-white/70 text-sm">
            View and restore your saved dashboard configurations
          </p>
          {savedReports.length > 0 && (
            <p className={`text-xs ${storageInfo.isNearLimit ? 'text-yellow-300' : 'text-white/50'}`}>
              {savedReports.length} views • {storageInfo.storageSize}KB used ({storageInfo.percentUsed}%)
              {storageInfo.isNearLimit && ' • Near limit'}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            type="text"
            placeholder="Search views..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-white/70" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="all">All Types</option>
            <option value="pie">Pie Charts</option>
            <option value="bar">Bar Charts</option>
            <option value="mixbar">Mix Bar Charts</option>
            <option value="table">Tables</option>
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors"
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'asc' ? <SortAsc className="w-4 h-4 text-white/70" /> : <SortDesc className="w-4 h-4 text-white/70" />}
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="date">Date</option>
            <option value="name">Name</option>
            <option value="charts">Chart Count</option>
          </select>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="flex-1 overflow-y-auto">
        {filteredAndSortedReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Bookmark className="w-16 h-16 text-white/30 mb-4" />
            <h3 className="text-xl font-medium text-white/60 mb-2">
              {savedReports.length === 0 ? 'No Saved Views' : 'No Views Found'}
            </h3>
            <p className="text-white/40 text-sm max-w-md">
              {savedReports.length === 0
                ? 'Create and save your first dashboard view from the Build Report section.'
                : 'Try adjusting your search terms or filters to find the views you\'re looking for.'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedReports.map((report) => (
              <div
                key={report.id}
                className="glass-card rounded-lg p-4 hover:bg-white/10 transition-all duration-200 group"
              >
                {/* Report Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate mb-1">
                      {report.name}
                    </h3>
                    <p className="text-xs text-white/60 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(report.savedAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteReport(report.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                    title="Delete report"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>

                {/* Report Stats */}
                <div className="flex items-center gap-4 mb-3 text-xs text-white/70">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {report.chartCount} chart{report.chartCount !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-1">
                    {report.chartTypes.slice(0, 3).map((type, index) => (
                      <span key={index} className="text-white/50">
                        {getChartIcon(type)}
                      </span>
                    ))}
                    {report.chartTypes.length > 3 && (
                      <span className="text-white/50 text-xs">+{report.chartTypes.length - 3}</span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {report.description && (
                  <p className="text-xs text-white/60 mb-4 line-clamp-2">
                    {report.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => loadReport(report)}
                    className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-medium text-xs rounded-lg px-3 py-2 transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye className="w-3 h-3" />
                    Load Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewSavedReports;
