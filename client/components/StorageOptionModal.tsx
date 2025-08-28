import React from 'react';
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Database, HardDrive, Shield, Clock, Users, Zap } from "lucide-react";

export interface StorageOption {
  type: 'local' | 'server';
  title: string;
  description: string;
  features: string[];
  recommended?: boolean;
  icon: React.ReactNode;
}

interface StorageOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (option: 'local' | 'server') => void;
  fileName: string;
  fileSize: number;
  rowCount: number;
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
  fileName,
  fileSize,
  rowCount
}: StorageOptionModalProps) {
  // Determine recommendations based on file characteristics
  const isLargeFile = rowCount > 1000000; // > 1M rows
  const isSensitiveData = fileName.toLowerCase().includes('personal') || 
                          fileName.toLowerCase().includes('private') || 
                          fileName.toLowerCase().includes('confidential');
  
  const localOption: StorageOption = {
    type: 'local',
    title: 'Save Locally',
    description: 'Store in IndexedDB, query with DuckDB WASM',
    features: [
      'Perfect for sensitive information',
      'Smaller data < 1M rows'
    ],
    recommended: !isLargeFile || isSensitiveData,
    icon: <HardDrive className="w-6 h-6" />
  };

  const serverOption: StorageOption = {
    type: 'server',
    title: 'Save to Server',
    description: 'Store in server database (SQLite/Snowflake)',
    features: [
      'Permanent storage',
      'Share with team members',
      'Handle large datasets (>1M rows)',
      'Cross-device access',
      'Version control'
    ],
    recommended: isLargeFile && !isSensitiveData,
    icon: <Database className="w-6 h-6" />
  };

  const handleSelect = (type: 'local' | 'server') => {
    onSelect(type);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl glass-card border-white/20">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            Choose Storage Option
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Select where to store your data based on your needs and data characteristics.
          </DialogDescription>
        </DialogHeader>

        {/* File Information */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-6">
          <h3 className="text-sm font-medium text-white mb-2">File Information</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Name:</span>
              <p className="text-white truncate">{fileName}</p>
            </div>
            <div>
              <span className="text-gray-400">Size:</span>
              <p className="text-white">{formatFileSize(fileSize)}</p>
            </div>
            <div>
              <span className="text-gray-400">Rows:</span>
              <p className="text-white">{formatNumber(rowCount)}</p>
            </div>
          </div>
        </div>

        {/* Storage Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[localOption, serverOption].map((option) => (
            <div
              key={option.type}
              className={`relative p-6 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:border-blue-400/50 ${
                option.recommended
                  ? 'border-green-400/50 bg-green-500/5'
                  : 'border-white/20 bg-white/5'
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
                  <p className="text-sm text-gray-400">{option.description}</p>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6">
                {option.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Action Button */}
              <Button
                className={`w-full ${
                  option.type === 'local'
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
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

        {/* Best Practices */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
          <h4 className="text-sm font-medium text-blue-300 mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Best Practices
          </h4>
          <div className="text-xs text-blue-200 space-y-1">
            <p>• Choose <strong>Local Storage</strong> for sensitive data, quick analysis, or files under 1M rows</p>
            <p>• Choose <strong>Server Storage</strong> for collaboration, large datasets, or permanent storage needs</p>
            <p>• Local storage is faster for immediate analysis but data is only available in this browser</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
