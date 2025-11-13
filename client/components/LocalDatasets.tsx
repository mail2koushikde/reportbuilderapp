import React, { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { HardDrive, Trash2, Database, FileText, Calendar, BarChart3, Eye } from "lucide-react";
import { duckdbService, LocalDataset } from '../services/duckdbService';

interface LocalDatasetsProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDataset: (dataset: LocalDataset, data: any[]) => void;
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

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export function LocalDatasets({ isOpen, onClose, onLoadDataset }: LocalDatasetsProps) {
  const [datasets, setDatasets] = useState<LocalDataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [storageInfo, setStorageInfo] = useState({
    datasetCount: 0,
    totalRows: 0,
    estimatedSizeMB: 0,
    loadedInMemory: 0
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Load datasets when modal opens
  useEffect(() => {
    if (isOpen) {
      loadDatasets();
      loadStorageInfo();
    }
  }, [isOpen]);

  const loadDatasets = async () => {
    setLoading(true);
    try {
      const datasetList = await duckdbService.listDatasets();
      setDatasets(datasetList);
    } catch (error) {
      console.error('Error loading datasets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStorageInfo = async () => {
    try {
      const info = await duckdbService.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Error loading storage info:', error);
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    setDeletingId(datasetId);
    try {
      await duckdbService.deleteDataset(datasetId);
      await loadDatasets();
      await loadStorageInfo();
    } catch (error) {
      console.error('Error deleting dataset:', error);
      alert('Failed to delete dataset');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoadDataset = async (dataset: LocalDataset) => {
    setLoadingId(dataset.id);
    try {
      console.log(`Loading dataset "${dataset.name}" from IndexedDB into DuckDB...`);
      
      // This demonstrates the flow: IndexedDB → DuckDB WASM → Query
      // First, we query the dataset to load it into DuckDB memory
      const sampleQuery = 'SELECT * FROM {table} LIMIT 1000000';
      const data = await duckdbService.queryDataset(dataset.id, sampleQuery);
      
      console.log(`Dataset loaded: ${data.length} rows retrieved via DuckDB query`);
      
      // Pass the data back to the main component
      onLoadDataset(dataset, data);
      onClose();
      
    } catch (error) {
      console.error('Error loading dataset:', error);
      alert('Failed to load dataset');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl glass-card border-white/20 max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-purple-400" />
            Local Datasets (IndexedDB Storage)
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Datasets stored locally in your browser. Flow: IndexedDB → DuckDB WASM → SQL Query → Chart
          </DialogDescription>
        </DialogHeader>

        {/* Storage Information */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-4">
          <h3 className="text-sm font-medium text-white mb-3">Storage Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-purple-400 font-semibold">{storageInfo.datasetCount}</div>
              <div className="text-gray-400">Datasets</div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 font-semibold">{formatNumber(storageInfo.totalRows)}</div>
              <div className="text-gray-400">Total Rows</div>
            </div>
            <div className="text-center">
              <div className="text-green-400 font-semibold">{storageInfo.estimatedSizeMB}MB</div>
              <div className="text-gray-400">Storage Used</div>
            </div>
            <div className="text-center">
              <div className="text-yellow-400 font-semibold">{storageInfo.loadedInMemory}</div>
              <div className="text-gray-400">In DuckDB Memory</div>
            </div>
          </div>
        </div>

        {/* Datasets List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-white/60">Loading datasets...</div>
            </div>
          ) : datasets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Database className="w-12 h-12 text-white/30 mb-3" />
              <h3 className="text-white/60 font-medium mb-1">No Local Datasets</h3>
              <p className="text-white/40 text-sm">Upload a CSV file and choose "Save Locally" to create your first dataset</p>
            </div>
          ) : (
            <div className="space-y-3">
              {datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <h3 className="text-white font-medium truncate">{dataset.name}</h3>
                        <Badge variant="outline" className="text-xs text-purple-300 border-purple-400/30">
                          Local
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-white/70 mb-3">
                        <div>
                          <span className="text-gray-400">Rows:</span> {formatNumber(dataset.rowCount)}
                        </div>
                        <div>
                          <span className="text-gray-400">Columns:</span> {dataset.columns.length}
                        </div>
                        <div>
                          <span className="text-gray-400">Size:</span> {formatFileSize(dataset.fileSize)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(new Date(dataset.createdAt))}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {dataset.columns.slice(0, 6).map((col) => (
                          <span
                            key={col}
                            className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded border border-blue-400/30"
                          >
                            {col}
                          </span>
                        ))}
                        {dataset.columns.length > 6 && (
                          <span className="px-2 py-1 bg-gray-500/20 text-gray-300 text-xs rounded">
                            +{dataset.columns.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => handleLoadDataset(dataset)}
                        disabled={loadingId === dataset.id}
                        className="bg-purple-500 hover:bg-purple-600 text-white flex items-center gap-1"
                      >
                        {loadingId === dataset.id ? (
                          <>
                            <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <BarChart3 className="w-3 h-3" />
                            Load & Query
                          </>
                        )}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteDataset(dataset.id)}
                        disabled={deletingId === dataset.id}
                        className="border-red-400/30 text-red-400 hover:bg-red-500/20"
                      >
                        {deletingId === dataset.id ? (
                          <div className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Flow Information */}
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-400/20 rounded-lg">
          <h4 className="text-sm font-medium text-blue-300 mb-2 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Data Flow Process
          </h4>
          <div className="text-xs text-blue-200 space-y-1">
            <p>1. <strong>Excel/CSV Upload</strong> → Stored in IndexedDB (browser disk)</p>
            <p>2. <strong>Query Request</strong> → Data loaded from IndexedDB into DuckDB WASM memory</p>
            <p>3. <strong>SQL Processing</strong> → DuckDB executes queries on in-memory data</p>
            <p>4. <strong>Chart Generation</strong> → Results displayed in visualizations</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
