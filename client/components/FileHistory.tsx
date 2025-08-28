import React, { useState, useEffect, Fragment } from 'react';
import { format } from 'date-fns';
import { useUser } from '../contexts/UserContext';
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
  ChevronUp
} from 'lucide-react';

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
  const [sortBy, setSortBy] = useState<'upload_timestamp' | 'original_filename'>('upload_timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchUploads = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/database/uploads/user/${encodeURIComponent(userEmail)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch upload history');
      }

      const data = await response.json();

      if (data.success) {
        setUploads(data.uploads);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to fetch upload history');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching uploads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, [userEmail]);

  // Group files by filename and get latest version
  const groupFilesByName = (uploads: UploadMetadata[]): GroupedFile[] => {
    const fileGroups = new Map<string, UploadMetadata[]>();

    // Group uploads by filename
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

  // Filter and sort grouped files
  useEffect(() => {
    let filtered = uploads.filter(upload => {
      const matchesSearch = searchTerm === '' ||
        upload.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        upload.table_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || upload.upload_status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Group the filtered uploads
    const grouped = groupFilesByName(filtered);

    // Sort grouped files
    grouped.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'upload_timestamp':
          aValue = new Date(a.latestVersion.upload_timestamp).getTime();
          bValue = new Date(b.latestVersion.upload_timestamp).getTime();
          break;
        case 'original_filename':
          aValue = a.filename.toLowerCase();
          bValue = b.filename.toLowerCase();
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
  }, [uploads, searchTerm, statusFilter, sortBy, sortOrder]);

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
          <button
            onClick={fetchUploads}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="glass-card p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm text-white/70">Failed</p>
                <p className="text-xl font-semibold text-white">
                  {groupedFiles.filter(f => f.latestVersion.upload_status === 'failed').length}
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="processing">Processing</option>
            </select>
            
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as any);
                setSortOrder(order as any);
              }}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="upload_timestamp-desc">Latest First</option>
              <option value="upload_timestamp-asc">Oldest First</option>
              <option value="original_filename-asc">File Name A-Z</option>
              <option value="original_filename-desc">File Name Z-A</option>
            </select>
          </div>
        </div>
      </div>

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
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">File Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">Version</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">Upload Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">Rows</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">Columns</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">Size</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-white/70">Table Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {groupedFiles.map((file) => {
                    const isExpanded = expandedFiles.has(file.filename);
                    return (
                      <React.Fragment key={file.filename}>
                        {/* Main row - Latest version */}
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
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(file.latestVersion.upload_status)}
                              <span className="text-sm text-white/70 capitalize">
                                {file.latestVersion.upload_status}
                              </span>
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
                        </tr>

                        {/* Expanded rows - All versions except latest */}
                        {isExpanded && file.allVersions.slice(1).map((version, index) => (
                          <tr key={`${file.filename}-v${version.version}`} className="bg-white/2 hover:bg-white/5 transition-colors">
                            <td className="px-4 py-2">
                              <div className="ml-6 w-4 h-4 flex items-center justify-center">
                                <div className="w-2 h-2 bg-white/30 rounded-full"></div>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(version.upload_status)}
                                <span className="text-sm text-white/60 capitalize">
                                  {version.upload_status}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2 ml-6">
                                <FileText className="w-3 h-3 text-blue-400/70" />
                                <span className="text-white/70 text-sm">
                                  {version.original_filename}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-1 bg-gray-600/30 text-gray-300 text-xs rounded-full">
                                v{version.version}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-green-400/70" />
                                <span className="text-white/60 text-sm">{formatTimestamp(version.upload_timestamp)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-white/60 text-sm">{version.row_count.toLocaleString()}</span>
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-white/60 text-sm">{version.column_count}</span>
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-white/60 text-sm">{formatFileSize(version.file_size_bytes)}</span>
                            </td>
                            <td className="px-4 py-2">
                              <code className="text-xs bg-gray-600/30 px-2 py-1 rounded text-gray-400">
                                {version.table_name}
                              </code>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileHistory;
