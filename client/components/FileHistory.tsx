import React, { useState, useEffect, Fragment, useRef, useLayoutEffect } from 'react';
import { format } from 'date-fns';
import { useUser } from '../contexts/UserContext';
import { duckdbService, LocalDataset } from '../services/duckdbService';
import {
  FileText,
  Calendar,
  Database,
  Download,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Expand,
  Minimize2,
  HardDrive,
  Trash2
} from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';

interface UploadMetadata {
  user_name: string;
  original_filename: string;
  version: number;
  table_name: string;
  upload_timestamp: string;
  row_count: number;
  column_count: number;
  column_names: string;
  file_size_bytes?: number;
  upload_status: 'success' | 'failed' | 'processing';
  notes?: string;
  created_at: string;
  updated_at: string;
  storage_type?: 'server' | 'local'; // Add field to distinguish storage type
  dataset_id?: string; // For local storage, this will be the dataset ID
}

interface GroupedFile {
  filename: string;
  latestVersion: UploadMetadata;
  allVersions: UploadMetadata[];
  totalVersions: number;
}

const FileHistory: React.FC = () => {
  const { userEmail } = useUser();
  const [uploads, setUploads] = useState<UploadMetadata[]>([]);
  const [filteredUploads, setFilteredUploads] = useState<UploadMetadata[]>([]);
  const [groupedFiles, setGroupedFiles] = useState<GroupedFile[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'processing'>('all');
  const [storageFilter, setStorageFilter] = useState<'all' | 'server' | 'local'>('all');
  const [sortBy, setSortBy] = useState<'upload_timestamp' | 'original_filename'>('upload_timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const theadRef = useRef<HTMLTableSectionElement | null>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);

  const fetchUploads = async () => {
    try {
      setLoading(true);

      // Fetch from both server and local storage
      const [serverUploads, localUploads] = await Promise.allSettled([
        fetchServerUploads(),
        fetchLocalUploads()
      ]);

      const serverData = serverUploads.status === 'fulfilled' ? serverUploads.value : [];
      const localData = localUploads.status === 'fulfilled' ? localUploads.value : [];

      // Merge server and local uploads
      const allUploads = [...serverData, ...localData];
      setUploads(allUploads);
      setError(null);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching uploads:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchServerUploads = async (): Promise<UploadMetadata[]> => {
    try {
      const response = await fetch(`/api/database/uploads/user/${encodeURIComponent(userEmail)}`);

      if (!response.ok) {
        console.warn('Failed to fetch server uploads:', response.status);
        return [];
      }

      const data = await response.json();

      if (data.success) {
        return data.uploads.map((upload: any) => ({
          ...upload,
          storage_type: 'server' as const
        }));
      } else {
        console.warn('Server uploads API returned error:', data.error);
        return [];
      }
    } catch (err) {
      console.warn('Error fetching server uploads:', err);
      return [];
    }
  };

  const fetchLocalUploads = async (): Promise<UploadMetadata[]> => {
    try {
      const localDatasets = await duckdbService.getLocalUserUploads(userEmail);

      // Convert LocalDataset to UploadMetadata format
      return localDatasets.map((dataset: LocalDataset) => ({
        user_name: dataset.userEmail,
        original_filename: dataset.originalFileName,
        version: dataset.version,
        table_name: dataset.id, // Use dataset ID as table name for local storage
        upload_timestamp: dataset.createdAt.toISOString(),
        row_count: dataset.rowCount,
        column_count: dataset.columns.length,
        column_names: dataset.columns.join(', '),
        file_size_bytes: dataset.fileSize,
        upload_status: 'success' as const, // Local datasets are always successful
        notes: '',
        created_at: dataset.createdAt.toISOString(),
        updated_at: dataset.updatedAt.toISOString(),
        storage_type: 'local' as const,
        dataset_id: dataset.id
      }));
    } catch (err) {
      console.warn('Error fetching local uploads:', err);
      return [];
    }
  };

  useEffect(() => {
    fetchUploads();
  }, [userEmail]);

  // Measure column widths to align expanded rows with table columns
  useLayoutEffect(() => {
    const measure = () => {
      if (!theadRef.current) return;
      const ths = Array.from(theadRef.current.querySelectorAll('th')) as HTMLElement[];
      if (!ths.length) return;
      const widths = ths.map((th) => th.offsetWidth);
      setColumnWidths(widths);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [groupedFiles, searchTerm, statusFilter, storageFilter, sortBy, sortOrder, expandedFiles]);

  // Clear all data from both local and server storage
  const clearAllData = async () => {
    try {
      setClearing(true);
      console.log('Starting clear all data operation...');

      // Clear server data
      const serverResponse = await fetch(`/api/database/uploads/user/${encodeURIComponent(userEmail)}`, {
        method: 'DELETE'
      });

      if (serverResponse.ok) {
        const serverResult = await serverResponse.json();
        console.log('Server data cleared:', serverResult);
      } else {
        console.warn('Failed to clear server data:', serverResponse.status);
      }

      // Clear local data
      try {
        await duckdbService.clearAllUserData(userEmail);
        console.log('Local data cleared');
      } catch (localError) {
        console.warn('Failed to clear some local data:', localError);
      }

      // Refresh the uploads list
      await fetchUploads();

      // Show success message
      alert('All data cleared successfully from both local and server storage!');

    } catch (error) {
      console.error('Error clearing all data:', error);
      alert(`Error clearing data: ${error}`);
    } finally {
      setClearing(false);
      setShowClearConfirm(false);
    }
  };

  // Group files by filename only (versioning independent of storage type)
  const groupFilesByName = (uploads: UploadMetadata[]): GroupedFile[] => {
    const fileGroups = new Map<string, UploadMetadata[]>();

    // Group uploads by filename only
    uploads.forEach(upload => {
      const filename = upload.original_filename;
      if (!fileGroups.has(filename)) {
        fileGroups.set(filename, []);
      }
      fileGroups.get(filename)!.push(upload);
    });

    // Convert to GroupedFile array with latest version
    const grouped: GroupedFile[] = [];
    fileGroups.forEach((versions, filename) => {
      // Sort versions by version number descending (latest first)
      const sortedVersions = versions.sort((a, b) => b.version - a.version);

      grouped.push({
        filename,
        latestVersion: sortedVersions[0],
        allVersions: sortedVersions,
        totalVersions: versions.length
      });
    });

    return grouped;
  };

  // Toggle expansion of a file's versions
  const toggleFileExpansion = (filename: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filename)) {
        newSet.delete(filename);
      } else {
        newSet.add(filename);
      }
      return newSet;
    });
  };

  // Expand or collapse all files
  const toggleAllFiles = () => {
    const allFilenames = groupedFiles.filter(f => f.totalVersions > 1).map(f => f.filename);
    if (expandedFiles.size === allFilenames.length) {
      // All are expanded, collapse all
      setExpandedFiles(new Set());
    } else {
      // Not all are expanded, expand all
      setExpandedFiles(new Set(allFilenames));
    }
  };

  // Handle column sorting
  const handleColumnSort = (column: string) => {
    if (sortBy === column) {
      // Same column, toggle order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to desc for most columns, asc for name
      setSortBy(column as any);
      setSortOrder(column === 'original_filename' ? 'asc' : 'desc');
    }
  };

  // Get sort icon for column
  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-4 h-4 text-white/30" />;
    }
    return sortOrder === 'asc' ?
      <ArrowUp className="w-4 h-4 text-blue-400" /> :
      <ArrowDown className="w-4 h-4 text-blue-400" />;
  };

  // Filter and sort grouped files
  useEffect(() => {
    let filtered = uploads.filter(upload => {
      const matchesSearch = searchTerm === '' ||
        upload.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        upload.table_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || upload.upload_status === statusFilter;
      const matchesStorage = storageFilter === 'all' || upload.storage_type === storageFilter;

      return matchesSearch && matchesStatus && matchesStorage;
    });

    // Group the filtered uploads
    const grouped = groupFilesByName(filtered);

    // Sort grouped files
    grouped.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'upload_status':
          aValue = a.latestVersion.upload_status;
          bValue = b.latestVersion.upload_status;
          break;
        case 'upload_timestamp':
          aValue = new Date(a.latestVersion.upload_timestamp).getTime();
          bValue = new Date(b.latestVersion.upload_timestamp).getTime();
          break;
        case 'original_filename':
          aValue = a.filename.toLowerCase();
          bValue = b.filename.toLowerCase();
          break;
        case 'version':
          aValue = a.latestVersion.version;
          bValue = b.latestVersion.version;
          break;
        case 'row_count':
          aValue = a.latestVersion.row_count;
          bValue = b.latestVersion.row_count;
          break;
        case 'column_count':
          aValue = a.latestVersion.column_count;
          bValue = b.latestVersion.column_count;
          break;
        case 'file_size_bytes':
          aValue = a.latestVersion.file_size_bytes || 0;
          bValue = b.latestVersion.file_size_bytes || 0;
          break;
        case 'table_name':
          aValue = a.latestVersion.table_name.toLowerCase();
          bValue = b.latestVersion.table_name.toLowerCase();
          break;
        default:
          aValue = new Date(a.latestVersion.upload_timestamp).getTime();
          bValue = new Date(b.latestVersion.upload_timestamp).getTime();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredUploads(filtered);
    setGroupedFiles(grouped);
  }, [uploads, searchTerm, statusFilter, storageFilter, sortBy, sortOrder]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'MMM dd, yyyy HH:mm');
    } catch {
      return timestamp;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };


  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-white/70">Loading file history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Error Loading File History</h3>
            <p className="text-white/70 mb-4">{error}</p>
            <button
              onClick={fetchUploads}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-blue-500" />
            <h1 className="text-2xl font-bold text-white">File Upload History</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={clearing || groupedFiles.length === 0}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {clearing ? 'Clearing...' : 'Clear All'}
            </button>
            <button
              onClick={fetchUploads}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-white/70">Unique Files</p>
                <p className="text-xl font-semibold text-white">{groupedFiles.length}</p>
                <p className="text-xs text-white/50">{uploads.length} total versions</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm text-white/70">Snowflake Storage</p>
                <p className="text-xl font-semibold text-white">
                  {groupedFiles.filter(f => f.latestVersion.storage_type === 'server').length}
                </p>
                <p className="text-xs text-white/50">files in Snowflake</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm text-white/70">Local Storage</p>
                <p className="text-xl font-semibold text-white">
                  {groupedFiles.filter(f => f.latestVersion.storage_type === 'local').length}
                </p>
                <p className="text-xs text-white/50">files locally</p>
              </div>
            </div>
          </div>
          <div className="glass-card p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-white/70">Successful</p>
                <p className="text-xl font-semibold text-white">
                  {groupedFiles.filter(f => f.latestVersion.upload_status === 'success').length}
                </p>
                <p className="text-xs text-white/50">latest versions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
            <input
              type="text"
              placeholder="Search files or tables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 text-white border-white/20">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
              </SelectContent>
            </Select>

            <Select value={storageFilter} onValueChange={(v) => setStorageFilter(v as any)}>
              <SelectTrigger className="px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white">
                <SelectValue placeholder="All Storage" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 text-white border-white/20">
                <SelectItem value="all">All Storage</SelectItem>
                <SelectItem value="server">Snowflake Only</SelectItem>
                <SelectItem value="local">Local Only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(v) => {
                const [field, order] = v.split('-');
                setSortBy(field as any);
                setSortOrder(order as any);
              }}>
              <SelectTrigger className="px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 text-white border-white/20">
                <SelectItem value="upload_timestamp-desc">Latest First</SelectItem>
                <SelectItem value="upload_timestamp-asc">Oldest First</SelectItem>
                <SelectItem value="original_filename-asc">File Name A-Z</SelectItem>
                <SelectItem value="original_filename-desc">File Name Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Expand/Collapse All Button */}
      {groupedFiles.some(f => f.totalVersions > 1) && (
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleAllFiles}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-sm transition-colors"
          >
            {expandedFiles.size === groupedFiles.filter(f => f.totalVersions > 1).length ? (
              <>
                <Minimize2 className="w-4 h-4" />
                Collapse All
              </>
            ) : (
              <>
                <Expand className="w-4 h-4" />
                Expand All
              </>
            )}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {groupedFiles.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <p className="text-white/70">
                {searchTerm || statusFilter !== 'all' ? 'No files match your search criteria' : 'No files have been uploaded yet'}
              </p>
            </div>
          </div>
        ) : (
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70 w-8"></th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">
                      <button
                        onClick={() => handleColumnSort('upload_status')}
                        className="flex items-center gap-2 hover:text-white transition-colors"
                      >
                        Status
                        {getSortIcon('upload_status')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">
                      <button
                        onClick={() => handleColumnSort('original_filename')}
                        className="flex items-center gap-2 hover:text-white transition-colors"
                      >
                        File Name
                        {getSortIcon('original_filename')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">
                      <button
                        onClick={() => handleColumnSort('version')}
                        className="flex items-center gap-2 hover:text-white transition-colors"
                      >
                        Version
                        {getSortIcon('version')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">
                      <button
                        onClick={() => handleColumnSort('upload_timestamp')}
                        className="flex items-center gap-2 hover:text-white transition-colors"
                      >
                        Upload Date
                        {getSortIcon('upload_timestamp')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">
                      <button
                        onClick={() => handleColumnSort('row_count')}
                        className="flex items-center gap-2 hover:text-white transition-colors"
                      >
                        Rows
                        {getSortIcon('row_count')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">
                      <button
                        onClick={() => handleColumnSort('column_count')}
                        className="flex items-center gap-2 hover:text-white transition-colors"
                      >
                        Columns
                        {getSortIcon('column_count')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">
                      <button
                        onClick={() => handleColumnSort('file_size_bytes')}
                        className="flex items-center gap-2 hover:text-white transition-colors"
                      >
                        Size
                        {getSortIcon('file_size_bytes')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">
                      <button
                        onClick={() => handleColumnSort('table_name')}
                        className="flex items-center gap-2 hover:text-white transition-colors"
                      >
                        Table Name
                        {getSortIcon('table_name')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {groupedFiles.map((file) => {
                    const isExpanded = expandedFiles.has(file.filename);
                    return (
                      <Fragment key={file.filename}>
                        {/* Main row - Shows latest version when collapsed, file summary when expanded */}
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleFileExpansion(file.filename)}
                              className="p-1 hover:bg-white/10 rounded transition-colors"
                              title={isExpanded ? 'Collapse versions' : `Show all ${file.totalVersions} versions`}
                            >
                              {file.totalVersions > 1 ? (
                                isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-white/70" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-white/70" />
                                )
                              ) : (
                                <div className="w-4 h-4"></div>
                              )}
                            </button>
                          </td>
                          {isExpanded ? (
                            // Expanded state - Show only empty row with proper height
                            <td className="px-4 py-3" colSpan={8}>
                              {/* Empty content - only expand/collapse button shows */}
                            </td>
                          ) : (
                            // Collapsed state - Show latest version details
                            <>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(file.latestVersion.upload_status)}
                                  <span className="text-sm text-white/70 capitalize">
                                    {file.latestVersion.upload_status}
                                  </span>
                                  {/* Storage type indicator */}
                                  <div className="flex items-center gap-1">
                                    {file.latestVersion.storage_type === 'local' ? (
                                      <HardDrive className="w-3 h-3 text-purple-400" title="Stored locally" />
                                    ) : (
                                      <Database className="w-3 h-3 text-blue-400" title="Stored in Snowflake" />
                                    )}
                                    <span className="text-xs text-white/50">
                                      {file.latestVersion.storage_type === 'local' ? 'Local' : 'Snowflake'}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-blue-500" />
                                  <div className="flex flex-col">
                                    <span className="text-white font-medium">
                                      {file.filename}
                                    </span>
                                    {file.totalVersions > 1 && (
                                      <span className="text-xs text-white/50">
                                        {file.totalVersions} versions
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <span className="px-2 py-1 bg-blue-600/30 text-blue-300 text-xs rounded-full">
                                    v{file.latestVersion.version}
                                  </span>
                                  {file.totalVersions > 1 && (
                                    <span className="text-xs text-green-400 font-medium">
                                      LATEST
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-green-500" />
                                  <span className="text-white/80">{formatTimestamp(file.latestVersion.upload_timestamp)}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-white/80">{file.latestVersion.row_count.toLocaleString()}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-white/80">{file.latestVersion.column_count}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-white/80">{formatFileSize(file.latestVersion.file_size_bytes)}</span>
                              </td>
                              <td className="px-4 py-3">
                                <code className="text-xs bg-gray-700/50 px-2 py-1 rounded text-gray-300">
                                  {file.latestVersion.table_name}
                                </code>
                              </td>
                            </>
                          )}
                        </tr>

                        {/* Expanded rows - All versions including latest */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="px-0 py-0">
                              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-l-4 border-blue-400/50 mx-4 my-1 rounded-r-lg">
                                <div className="px-0 py-1 bg-black/20 rounded-r-lg border border-white/10 border-l-0">
                                  <div className="space-y-1">
                                    {file.allVersions.map((version, index) => (
                                      <div key={`${file.filename}-v${version.version}-${version.storage_type}-${version.table_name}-${version.upload_timestamp}`} className="flex items-center py-3 bg-black/30 border-white/5 hover:bg-black/40 transition-colors">
                                        {/* Empty space to align with expand button column */}
                                        <div style={{ width: '32px' }} className="flex-shrink-0"></div>

                                        {/* Status column - match table header width */}
                                        <div className="px-4 py-0 flex items-center gap-2 w-[220px] shrink-0">
                                          {getStatusIcon(version.upload_status)}
                                          <span className="text-sm text-white capitalize">
                                            {version.upload_status}
                                          </span>
                                          {/* Storage type indicator for versions */}
                                          <div className="flex items-center gap-1">
                                            {version.storage_type === 'local' ? (
                                              <HardDrive className="w-3 h-3 text-purple-400" title="Stored locally" />
                                            ) : (
                                              <Database className="w-3 h-3 text-blue-400" title="Stored in Snowflake" />
                                            )}
                                            <span className="text-xs text-white/50">
                                              {version.storage_type === 'local' ? 'Local' : 'Snowflake'}
                                            </span>
                                          </div>
                                        </div>

                                        {/* File Name column - match table header width */}
                                        <div className="px-4 py-0 flex items-center gap-2 w-[260px] shrink-0">
                                          <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                          <span className="text-white text-sm truncate">
                                            {version.original_filename}
                                          </span>
                                        </div>

                                        {/* Version column - match table header width */}
                                        <div className="px-4 py-0 flex items-center gap-1 w-[100px] shrink-0">
                                          <span className={`px-2 py-1 text-xs rounded-full ${
                                            index === 0
                                              ? 'bg-green-600/40 text-green-200 border border-green-400/50'
                                              : 'bg-slate-600/40 text-slate-200'
                                          }`}>
                                            v{version.version}
                                          </span>
                                        </div>

                                        {/* Upload Date column - match table header width */}
                                        <div className="px-4 py-0 flex items-center gap-2 w-[180px] shrink-0">
                                          <Calendar className="w-4 h-4 text-green-500" />
                                          <span className="text-white text-sm">{formatTimestamp(version.upload_timestamp)}</span>
                                        </div>

                                        {/* Rows column - match table header width */}
                                        <div className="px-4 py-0 flex items-center w-[90px] shrink-0">
                                          <span className="text-white text-sm">{version.row_count.toLocaleString()}</span>
                                        </div>

                                        {/* Columns column - match table header width */}
                                        <div className="px-4 py-0 flex items-center w-[90px] shrink-0">
                                          <span className="text-white text-sm">{version.column_count}</span>
                                        </div>

                                        {/* Size column - match table header width */}
                                        <div className="px-4 py-0 flex items-center w-[100px] shrink-0">
                                          <span className="text-white text-sm">{formatFileSize(version.file_size_bytes)}</span>
                                        </div>

                                        {/* Table Name column - flex to fill remaining space */}
                                        <div className="px-4 py-0 flex items-center flex-1 min-w-0">
                                          <code className="text-xs bg-slate-700/50 text-slate-200 px-2 py-1 rounded truncate">
                                            {version.table_name}
                                          </code>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/20 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Clear All Data</h3>
                <p className="text-white/70 text-sm">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-white/80 mb-4">
                This will permanently delete <strong>all {groupedFiles.length} files</strong> and their versions from both:
              </p>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-400" />
                  <span>Snowflake database ({groupedFiles.filter(f => f.latestVersion.storage_type === 'server').length} files)</span>
                </li>
                <li className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-purple-400" />
                  <span>Local browser storage ({groupedFiles.filter(f => f.latestVersion.storage_type === 'local').length} files)</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={clearAllData}
                disabled={clearing}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                {clearing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Yes, Clear All
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileHistory;
