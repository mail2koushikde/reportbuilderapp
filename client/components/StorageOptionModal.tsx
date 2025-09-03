import React, { useState } from 'react';
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Database, HardDrive, Shield, Zap, X, AlertTriangle, FileText, Calendar } from "lucide-react";

export interface StorageOption {
  type: 'local' | 'server';
  title: string;
  description: string;
  features: string[];
  recommended?: boolean;
  icon: React.ReactNode;
}

interface ConflictData {
  conflict: boolean;
  existing_versions: Array<{
    version: number;
    upload_timestamp: string;
    table_name: string;
  }>;
  next_version: number;
  user_name: string;
  original_filename: string;
}

interface StorageOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (option: 'local' | 'server') => void;
  onOverwrite?: (option: 'local' | 'server') => void;
  onNewVersion?: (option: 'local' | 'server') => void;
  fileName: string;
  fileSize: number;
  rowCount: number;
  conflictData?: ConflictData;
  selectedStorage?: 'local' | 'server';
}

const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat().format(num);
};

export function StorageOptionModal({
  isOpen,
  onClose,
  onSelect,
  onOverwrite,
  onNewVersion,
  fileName,
  fileSize,
  rowCount,
  conflictData,
  selectedStorage
}: StorageOptionModalProps) {
  const [showingConflict, setShowingConflict] = useState(false);
  const [overwriteLoading, setOverwriteLoading] = useState(false);
  const [newVersionLoading, setNewVersionLoading] = useState(false);

  // Debug logging to track state changes
  React.useEffect(() => {
    console.log('StorageOptionModal state:', {
      isOpen,
      conflictData: !!conflictData,
      selectedStorage,
      hasConflict: conflictData?.conflict,
      existingVersionsCount: conflictData?.existing_versions?.length || 0
    });
  }, [isOpen, conflictData, selectedStorage]);
  // Determine recommendations based on file characteristics
  const isLargeFile = rowCount > 1000000; // > 1M rows
  const isSensitiveData = fileName.toLowerCase().includes('personal') || 
                          fileName.toLowerCase().includes('private') || 
                          fileName.toLowerCase().includes('confidential');
  
  const localOption: StorageOption = {
    type: 'local',
    title: 'Save Locally',
    description: '',
    features: [
      'Perfect for sensitive information',
      'Smaller data < 1M rows'
    ],
    recommended: !isLargeFile || isSensitiveData,
    icon: <HardDrive className="w-6 h-6" />
  };

  const serverOption: StorageOption = {
    type: 'server',
    title: 'Save to Snowflake',
    description: '',
    features: [
      'Permanent storage',
      'Handle large datasets (>1M rows)',
      'Cross-device access'
    ],
    recommended: isLargeFile && !isSensitiveData,
    icon: <Database className="w-6 h-6" />
  };

  const handleSelect = (type: 'local' | 'server') => {
    console.log('StorageOptionModal: handleSelect called with type:', type);
    onSelect(type);
    // Don't close automatically - let the parent component handle the modal state
    // The modal will either close if no conflict, or stay open to show conflict resolution
  };

  const handleOverwrite = async (type: 'local' | 'server') => {
    if (!onOverwrite) return;
    setOverwriteLoading(true);
    try {
      await onOverwrite(type);
      onClose();
    } catch (error) {
      console.error('Error overwriting file:', error);
    } finally {
      setOverwriteLoading(false);
    }
  };

  const handleNewVersion = async (type: 'local' | 'server') => {
    if (!onNewVersion) return;
    setNewVersionLoading(true);
    try {
      await onNewVersion(type);
      onClose();
    } catch (error) {
      console.error('Error creating new version:', error);
    } finally {
      setNewVersionLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 right-0 left-0 bottom-0 z-50 p-4 bg-black/80 backdrop-blur-sm">
      <div className="success-dialog-card rounded-2xl p-6 max-w-3xl mx-auto mt-16 relative text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 text-white/70 hover:text-white"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            {conflictData && selectedStorage ? (
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            ) : (
              <Zap className="w-5 h-5 text-blue-400" />
            )}
            <h2 className="text-xl font-semibold text-white">
              {conflictData && selectedStorage ? 'File Version Conflict' : 'Choose Storage Option'}
            </h2>
          </div>
          <p className="text-white/70">
            {conflictData && selectedStorage ? (
              <>A file named "{fileName}" already exists in {selectedStorage === 'local' ? 'local storage' : 'Snowflake'}. Choose how to proceed.</>
            ) : (
              'Select where to store your data based on your needs and data characteristics.'
            )}
          </p>
        </div>

        {/* File Information */}
        <div className="glass-card rounded-lg p-4 border border-white/10 mb-6">
          <h3 className="text-sm font-medium text-white mb-2">File Information</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-white/60">Name:</span>
              <p className="text-white truncate">{fileName}</p>
            </div>
            <div>
              <span className="text-white/60">Size:</span>
              <p className="text-white">{formatFileSize(fileSize)}</p>
            </div>
            <div>
              <span className="text-white/60">Rows:</span>
              <p className="text-white">{formatNumber(rowCount)}</p>
            </div>
          </div>
        </div>

        {/* Show conflict resolution if there's a conflict and storage is selected */}
        {conflictData && selectedStorage && conflictData.conflict ? (
          <div className="space-y-6">
            {/* Existing Versions */}
            <div className="glass-card rounded-lg p-4 border border-yellow-400/20">
              <h3 className="text-sm font-medium text-yellow-300 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Existing Versions in {selectedStorage === 'local' ? 'Local Storage' : 'Snowflake'}
              </h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {conflictData.existing_versions.map((version) => (
                  <div key={version.version} className="text-xs text-white/70 flex justify-between items-center">
                    <span>Version {version.version}</span>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>{formatTimestamp(version.upload_timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Conflict Resolution Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Overwrite Latest Version */}
              <div className="glass-card rounded-lg p-4 border border-red-400/30 bg-red-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h3 className="text-lg font-semibold text-white">Overwrite Latest</h3>
                </div>
                <p className="text-sm text-white/70 mb-4">
                  Replace the latest version (v{Math.max(...conflictData.existing_versions.map(v => v.version))}) with this file.
                  Previous data will be lost.
                </p>
                <Button
                  onClick={() => handleOverwrite(selectedStorage)}
                  disabled={overwriteLoading || newVersionLoading}
                  className="w-full bg-red-500/80 hover:bg-red-500 text-white border border-red-400/30"
                >
                  {overwriteLoading ? 'Overwriting...' : 'Overwrite Latest Version'}
                </Button>
              </div>

              {/* Create New Version */}
              <div className="glass-card rounded-lg p-4 border border-green-400/30 bg-green-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-green-400" />
                  <h3 className="text-lg font-semibold text-white">Save as New Version</h3>
                </div>
                <p className="text-sm text-white/70 mb-4">
                  Create version {conflictData.next_version} while keeping all existing versions.
                  Recommended for preserving history.
                </p>
                <Button
                  onClick={() => handleNewVersion(selectedStorage)}
                  disabled={overwriteLoading || newVersionLoading}
                  className="w-full bg-green-500/80 hover:bg-green-500 text-white border border-green-400/30"
                >
                  {newVersionLoading ? 'Creating...' : `Create Version ${conflictData.next_version}`}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Storage Options */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[localOption, serverOption].map((option) => (
              <div
                key={option.type}
                className={`relative p-6 glass-card rounded-lg border transition-all duration-200 cursor-pointer hover:border-blue-400/50 hover:bg-white/10 ${
                  option.recommended
                    ? 'border-green-400/50 bg-green-500/10'
                    : 'border-white/20'
                }`}
                onClick={() => handleSelect(option.type)}
              >
                {/* Recommended Badge */}
                {option.recommended && (
                  <Badge className="absolute -top-2 -right-2 bg-green-500 text-white">
                    Recommended
                  </Badge>
                )}

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${
                    option.type === 'local' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                  }`}>
                    {option.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{option.title}</h3>
                    <p className="text-sm text-white/60">{option.description}</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {option.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-white/80">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        option.type === 'local' ? 'bg-purple-400' : 'bg-blue-400'
                      }`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Action Button */}
                <Button
                  className={`w-full transition-all duration-200 ${
                    option.type === 'local'
                      ? 'bg-purple-500/80 hover:bg-purple-500 text-white border border-purple-400/30'
                      : 'bg-blue-500/80 hover:bg-blue-500 text-white border border-blue-400/30'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(option.type);
                  }}
                >
                  Choose {option.title}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Best Practices - only show when not in conflict mode */}
        {!(conflictData && selectedStorage) && (
          <div className="mt-6 glass-card p-4 border border-blue-400/20 rounded-lg">
            <h4 className="text-sm font-medium text-blue-300 mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Best Practices
            </h4>
            <div className="text-xs text-white/70 space-y-1">
              <p>• Choose <strong className="text-purple-300">Local Storage</strong> for sensitive data or files under 1M rows</p>
              <p>• Choose <strong className="text-blue-300">Snowflake Storage</strong> for collaboration, large datasets, or permanent storage</p>
              <p>• Local storage is faster for immediate analysis but data stays only in this browser</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
