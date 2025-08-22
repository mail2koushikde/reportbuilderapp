import React, { useState, useRef, useCallback } from 'react';
import {
  Eye,
  Upload,
  Plus,
  X,
  BarChart3,
  PieChart as PieChartIcon,
  Table,
  BarChart2,
  Settings,
  ChevronDown,
  Filter as FilterIcon,
  Maximize2,
  Minimize2
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";

interface ChartCard {
  id: string;
  chartType: 'pie' | 'bar' | 'mixbar' | 'table';
  dimension: string;
  dimension2?: string; // Second dimension for mix bar charts
  measure: string;
  title: string;
  isConfiguring: boolean;
  size: 'half' | 'full';
  yAxisScale: 'linear' | 'percentage'; // Y-axis scale option
}

interface DataRow {
  [key: string]: string | number;
}

const CHART_TYPES = [
  { id: 'pie', label: 'Pie Chart', icon: PieChartIcon },
  { id: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { id: 'mixbar', label: 'Mix Bar Chart', icon: BarChart2 },
  { id: 'table', label: 'Data Table', icon: Table },
] as const;

const CHART_COLORS = [
  '#94a3b8', // Light slate
  '#6366f1', // Vibrant indigo
  '#10b981', // Emerald green
  '#ef4444', // Bright red
  '#8b5cf6', // Bright purple
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#84cc16', // Lime green
];

const ViewPublishedData: React.FC = () => {
  const [importedData, setImportedData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [cards, setCards] = useState<ChartCard[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = lines.slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const row: DataRow = {};
            headers.forEach((header, index) => {
              const value = values[index] || '';
              const numValue = parseFloat(value);
              row[header] = isNaN(numValue) ? value : numValue;
            });
            return row;
          });
        
        setColumns(headers);
        setImportedData(data);
      };
      reader.readAsText(file);
    }
  }, []);

  const addCard = useCallback(() => {
    if (cards.length >= 4) return;

    const newCard: ChartCard = {
      id: `card-${Date.now()}`,
      chartType: 'pie',
      dimension: '',
      dimension2: '',
      measure: '',
      title: `Chart ${cards.length + 1}`,
      isConfiguring: true,
      size: 'half',
      yAxisScale: 'linear',
    };

    setCards(prev => [...prev, newCard]);
  }, [cards.length]);

  const removeCard = useCallback((cardId: string) => {
    setCards(prev => prev.filter(card => card.id !== cardId));
  }, []);

  const updateCard = useCallback((cardId: string, updates: Partial<ChartCard>) => {
    setCards(prev => prev.map(card => 
      card.id === cardId ? { ...card, ...updates } : card
    ));
  }, []);

  const showChart = useCallback((cardId: string) => {
    setCards(prev => prev.map(card => 
      card.id === cardId ? { ...card, isConfiguring: false } : card
    ));
  }, []);

  const goBackToConfig = useCallback((cardId: string) => {
    setCards(prev => prev.map(card =>
      card.id === cardId ? { ...card, isConfiguring: true } : card
    ));
  }, []);

  const toggleCardSize = useCallback((cardId: string) => {
    setCards(prev => prev.map(card =>
      card.id === cardId ? {
        ...card,
        size: card.size === 'half' ? 'full' : 'half'
      } : card
    ));
  }, []);

  const getChartData = useCallback((card: ChartCard) => {
    if (!card.dimension || !card.measure || !importedData.length) return [];

    const aggregationMap = new Map();
    
    importedData.forEach((row) => {
      const dimensionValue = row[card.dimension] || 'Unknown';
      const measureValue = parseFloat(String(row[card.measure] || '0').replace(/[",]/g, '')) || 0;
      
      aggregationMap.set(
        dimensionValue,
        (aggregationMap.get(dimensionValue) || 0) + measureValue
      );
    });

    return Array.from(aggregationMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        formattedValue: value.toLocaleString(),
      }))
      .sort((a, b) => b.value - a.value);
  }, [importedData]);

  const getStackedChartData = useCallback((card: ChartCard) => {
    if (!card.dimension || !card.dimension2 || !card.measure || !importedData.length) return [];

    const dataMap = new Map<string, Map<string, number>>();
    const allSegments = new Set<string>();

    // First pass: collect all data and segments
    importedData.forEach((row) => {
      const primaryDim = String(row[card.dimension] || 'Unknown');
      const secondaryDim = String(row[card.dimension2!] || 'Unknown');
      const measureValue = parseFloat(String(row[card.measure] || '0').replace(/[",]/g, '')) || 0;

      if (!dataMap.has(primaryDim)) {
        dataMap.set(primaryDim, new Map());
      }

      const secondaryMap = dataMap.get(primaryDim)!;
      secondaryMap.set(secondaryDim, (secondaryMap.get(secondaryDim) || 0) + measureValue);
      allSegments.add(secondaryDim);
    });

    // Convert to chart data format
    const chartData = Array.from(dataMap.entries())
      .map(([primaryDim, secondaryMap]) => {
        const item: any = { name: primaryDim };
        let total = 0;

        allSegments.forEach(segment => {
          const value = secondaryMap.get(segment) || 0;
          item[segment] = value;
          item[`${segment}_raw`] = value; // Store raw values for tooltips
          total += value;
        });

        // Add percentage values if needed
        if (card.yAxisScale === 'percentage' && total > 0) {
          allSegments.forEach(segment => {
            const value = item[segment];
            item[`${segment}_percentage`] = (value / total) * 100;
          });
        } else if (card.yAxisScale === 'percentage') {
          allSegments.forEach(segment => {
            item[`${segment}_percentage`] = 0;
          });
        }

        item._total = total;
        return item;
      })
      .filter(item => item._total > 0); // Filter out empty bars where total is 0

    return {
      data: chartData,
      segments: Array.from(allSegments),
    };
  }, [importedData]);

  const renderChart = (card: ChartCard) => {
    const data = getChartData(card);
    
    if (!data.length) {
      return (
        <div className="flex-1 flex items-center justify-center text-white/60">
          No data available for selected attributes
        </div>
      );
    }

    switch (card.chartType) {
      case 'pie':
        return (
          <div className="flex-1 flex gap-4 min-h-0">
            <div className="flex-[3] flex flex-col">
              <div className={`relative w-full ${card.size === 'full' ? 'h-[300px]' : 'h-[200px]'}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={card.size === 'full' ? 60 : 40}
                      outerRadius={card.size === 'full' ? 120 : 80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [parseFloat(value).toLocaleString(), card.measure]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex-[2] flex flex-col">
              <div className="space-y-1 overflow-y-auto">
                {data.slice(0, 8).map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <div 
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-white/70 truncate">{entry.name}</span>
                    <span className="text-white/50 ml-auto">{entry.formattedValue}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'bar':
        return (
          <div className={`flex-1 relative ${card.size === 'full' ? 'h-[300px]' : 'h-[200px]'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis
                  dataKey="name"
                  stroke="white"
                  fontSize={11}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke="white" fontSize={11} />
                <Tooltip
                  formatter={(value: any) => [parseFloat(value).toLocaleString(), card.measure]}
                  labelStyle={{ color: '#000' }}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'mixbar':
        const stackedData = getStackedChartData(card);
        if (!stackedData.data.length) {
          return (
            <div className="flex-1 flex items-center justify-center text-white/60">
              Please select both dimensions for stacked bar chart
            </div>
          );
        }

        return (
          <div className={`flex-1 flex gap-3 min-h-0 ${card.size === 'full' ? 'h-[300px]' : 'h-[200px]'}`}>
            <div className="flex-[5] relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stackedData.data}
                  margin={{ top: 20, right: 10, left: 2, bottom: 45 }}
                  barCategoryGap="15%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis
                    dataKey="name"
                    stroke="white"
                    fontSize={11}
                    angle={-45}
                    textAnchor="end"
                    height={45}
                    axisLine={{ stroke: 'white', strokeWidth: 1 }}
                    tickLine={{ stroke: 'white', strokeWidth: 1 }}
                  />
                  <YAxis
                    stroke="transparent"
                    fontSize={11}
                    domain={card.yAxisScale === 'percentage' ? [0, 100] : undefined}
                    tickFormatter={card.yAxisScale === 'percentage' ? (value) => `${value}%` : undefined}
                    tick={{ fill: 'transparent' }}
                    axisLine={{ stroke: 'transparent' }}
                    tickLine={{ stroke: 'transparent' }}
                  />

                  <Tooltip
                    shared={false}
                    formatter={(value: any, name: string, props: any) => {
                      const segmentName = name.replace('_percentage', '');
                      const rawValue = props.payload[`${segmentName}_raw`] || props.payload[segmentName] || 0;
                      const percentage = props.payload._total > 0
                        ? ((rawValue / props.payload._total) * 100).toFixed(1)
                        : '0.0';

                      return [rawValue.toLocaleString(), `${segmentName} (${percentage}%)`];
                    }}
                    labelFormatter={(label, payload) => {
                      // Ensure we get the correct bar name from the payload
                      if (payload && payload.length > 0) {
                        return payload[0].payload.name || label;
                      }
                      return label;
                    }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                  />
                  {stackedData.segments.map((segment, index) => (
                    <Bar
                      key={segment}
                      dataKey={card.yAxisScale === 'percentage' ? `${segment}_percentage` : segment}
                      stackId="stack"
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth={1}
                      style={{
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* Add segment labels for each bar segment */}
                      <LabelList
                        dataKey={card.yAxisScale === 'percentage' ? `${segment}_percentage` : segment}
                        position="center"
                        content={(props: any) => {
                          // Check if all required props exist
                          if (!props || props.x === undefined || props.y === undefined ||
                              props.width === undefined || props.height === undefined ||
                              !props.payload) {
                            return null;
                          }

                          const { x, y, width, height, payload } = props;

                          // Check if payload has the required properties
                          if (!payload || typeof payload !== 'object') {
                            return null;
                          }

                          // Get the raw value and calculate percentage with safety checks
                          const rawValue = payload[`${segment}_raw`] || payload[segment] || 0;
                          const total = payload._total || 0;
                          const percentage = total > 0 ? ((rawValue / total) * 100) : 0;

                          // Only show label if percentage >= 10% and we have valid dimensions
                          if (percentage < 10 || width < 30 || height < 20) return null;

                          // Calculate center position
                          const centerX = x + width / 2;
                          const centerY = y + height / 2;

                          return (
                            <g>
                              <text
                                x={centerX}
                                y={centerY - 6}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="white"
                                fontSize="10"
                                fontWeight="bold"
                              >
                                {segment}
                              </text>
                              <text
                                x={centerX}
                                y={centerY + 6}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="white"
                                fontSize="9"
                                fontWeight="normal"
                              >
                                {percentage.toFixed(1)}%
                              </text>
                            </g>
                          );
                        }}
                      />

                      {/* Add total label only to the last segment */}
                      {index === stackedData.segments.length - 1 && (
                        <LabelList
                          dataKey="_total"
                          position="top"
                          formatter={(value: any) => parseFloat(value).toFixed(1)}
                          style={{
                            fill: 'white',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        />
                      )}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-[1] flex flex-col">
              <div className="space-y-1 overflow-y-auto">
                {stackedData.segments.map((segment, index) => (
                  <div key={segment} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-white/70 truncate">{segment}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'table':
        return (
          <div className="flex-1 flex flex-col">
            <div className={`overflow-x-auto overflow-y-auto border border-white/10 rounded-lg ${card.size === 'full' ? 'max-h-[300px]' : 'max-h-[200px]'}`}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900/95">
                  <tr>
                    <th className="p-2 text-left border-b border-white/10 text-white/80">{card.dimension}</th>
                    <th className="p-2 text-right border-b border-white/10 text-white/80">{card.measure}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => (
                    <tr key={index} className="hover:bg-white/5">
                      <td className="p-2 border-b border-white/5 text-white/70">{row.name}</td>
                      <td className="p-2 text-right border-b border-white/5 text-white/70">{row.formattedValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderCardContent = (card: ChartCard) => {
    if (card.isConfiguring) {
      return (
        <div className="p-4 space-y-4">
          {/* Chart Type Selection */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Chart Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CHART_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => updateCard(card.id, { chartType: type.id as ChartCard['chartType'] })}
                    className={`p-3 rounded-lg border transition-colors ${
                      card.chartType === type.id
                        ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-xs">{type.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dimension Selection */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Dimension (Categories)
            </label>
            <select
              value={card.dimension}
              onChange={(e) => updateCard(card.id, { dimension: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">Select dimension...</option>
              {columns.map((col) => (
                <option key={col} value={col} className="bg-slate-800">{col}</option>
              ))}
            </select>
          </div>

          {/* Second Dimension Selection (only for mix bar charts) */}
          {card.chartType === 'mixbar' && (
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Second Dimension (Segments)
              </label>
              <select
                value={card.dimension2 || ''}
                onChange={(e) => updateCard(card.id, { dimension2: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Select second dimension...</option>
                {columns.filter(col => col !== card.dimension).map((col) => (
                  <option key={col} value={col} className="bg-slate-800">{col}</option>
                ))}
              </select>
              <div className="text-xs text-white/50 mt-1">
                This will create segments within each bar
              </div>
            </div>
          )}

          {/* Y-Axis Scale Selection (only for mix bar charts) */}
          {card.chartType === 'mixbar' && (
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Y-Axis Scale
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateCard(card.id, { yAxisScale: 'linear' })}
                  className={`p-2 rounded-lg border transition-colors text-xs ${
                    card.yAxisScale === 'linear'
                      ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  Linear Scale
                </button>
                <button
                  onClick={() => updateCard(card.id, { yAxisScale: 'percentage' })}
                  className={`p-2 rounded-lg border transition-colors text-xs ${
                    card.yAxisScale === 'percentage'
                      ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  Percentage Scale
                </button>
              </div>
              <div className="text-xs text-white/50 mt-1">
                {card.yAxisScale === 'percentage'
                  ? 'Shows relative proportions (0-100%)'
                  : 'Shows absolute values'
                }
              </div>
            </div>
          )}

          {/* Measure Selection */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Measure (Values)
            </label>
            <select
              value={card.measure}
              onChange={(e) => updateCard(card.id, { measure: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">Select measure...</option>
              {columns.filter(col => {
                // Filter to show likely numeric columns
                const sampleValue = importedData[0]?.[col];
                return typeof sampleValue === 'number' || !isNaN(parseFloat(String(sampleValue)));
              }).map((col) => (
                <option key={col} value={col} className="bg-slate-800">{col}</option>
              ))}
            </select>
          </div>

          {/* Chart Title */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Chart Title
            </label>
            <input
              type="text"
              value={card.title}
              onChange={(e) => updateCard(card.id, { title: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="Enter chart title..."
            />
          </div>

          {/* Show Button */}
          <button
            onClick={() => showChart(card.id)}
            disabled={
              !card.dimension ||
              !card.measure ||
              (card.chartType === 'mixbar' && !card.dimension2)
            }
            className="w-full bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-white/5 disabled:text-white/30 text-blue-300 font-medium text-sm rounded-lg px-4 py-2 transition-colors disabled:cursor-not-allowed"
          >
            Show Chart
          </button>
        </div>
      );
    }

    return (
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{card.title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleCardSize(card.id)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title={card.size === 'half' ? 'Expand to full width' : 'Reduce to half width'}
            >
              {card.size === 'half' ? (
                <Maximize2 className="w-4 h-4 text-white/70" />
              ) : (
                <Minimize2 className="w-4 h-4 text-white/70" />
              )}
            </button>
            <button
              onClick={() => goBackToConfig(card.id)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title="Configure chart"
            >
              <Settings className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>
        {renderChart(card)}
      </div>
    );
  };

  if (!importedData.length) {
    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <header className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-green-400" />
            <div>
              <h1 className="text-xl font-bold text-white/90">View Published Data</h1>
              <p className="text-sm text-white/60">Create custom charts from your data</p>
            </div>
          </div>
        </header>

        {/* Import Section */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-600/20 mb-4">
                <Upload className="w-8 h-8 text-green-400" />
              </div>
            </div>
            
            <h2 className="text-xl font-semibold text-white/90 mb-3">
              Import Your Data
            </h2>
            
            <p className="text-white/60 mb-6">
              Upload a CSV file to start creating custom charts and visualizations
            </p>

            <button
              onClick={handleFileImport}
              className="bg-green-500/20 hover:bg-green-500/30 text-green-300 hover:text-green-200 font-medium text-sm rounded-lg px-6 py-3 transition-colors duration-300 border border-green-400/30 hover:border-green-400/50 flex items-center gap-2 mx-auto"
            >
              <Upload className="w-4 h-4" />
              Import CSV File
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="mt-6 p-4 rounded-lg bg-green-600/10 border border-green-400/30">
              <div className="text-sm text-green-300 font-medium">Chart Builder Features</div>
              <div className="text-xs text-green-200/60 mt-1">
                Create up to 4 custom charts with Pie, Bar, Mix Bar, and Table visualizations
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 max-w-full overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-green-400" />
            <div>
              <h1 className="text-xl font-bold text-white/90">View Published Data</h1>
              <p className="text-sm text-white/60">
                File: {fileName} • {importedData.length} rows • {columns.length} columns
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleFileImport}
              className="bg-white/10 hover:bg-white/20 text-white font-medium text-sm rounded-lg px-4 py-2 transition-colors"
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Import New File
            </button>
            
            <button
              onClick={addCard}
              disabled={cards.length >= 4}
              className="bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-white/5 disabled:text-white/30 text-blue-300 font-medium text-sm rounded-lg px-4 py-2 transition-colors disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Chart ({cards.length}/4)
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </header>

      {/* Charts Grid */}
      <div className="flex-1 p-6 overflow-auto">
        {cards.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-600/20 mb-4">
                <BarChart3 className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white/90 mb-2">Ready to Create Charts</h3>
              <p className="text-white/60 mb-4">Click "Add Chart" to start building your first visualization</p>
              <button
                onClick={addCard}
                className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-medium text-sm rounded-lg px-4 py-2 transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Add Chart
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-6 min-h-0">
            {cards.map((card) => (
              <div
                key={card.id}
                className={`rounded-2xl border border-white/10 bg-white/5 flex flex-col transition-all duration-300 ${
                  card.size === 'full'
                    ? 'w-full min-h-[500px]'
                    : 'w-full lg:w-[calc(50%-12px)] min-h-[400px]'
                }`}
                style={{ background: "rgba(255, 255, 255, 0.05)" }}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const chartType = CHART_TYPES.find(t => t.id === card.chartType);
                      const Icon = chartType?.icon || BarChart3;
                      return <Icon className="w-5 h-5 text-blue-400" />;
                    })()}
                    <span className="font-medium text-white/80">
                      {card.isConfiguring ? 'Configure Chart' : card.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCardSize(card.id)}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      title={card.size === 'half' ? 'Expand to full width' : 'Reduce to half width'}
                    >
                      {card.size === 'half' ? (
                        <Maximize2 className="w-4 h-4 text-white/60 hover:text-blue-400" />
                      ) : (
                        <Minimize2 className="w-4 h-4 text-white/60 hover:text-blue-400" />
                      )}
                    </button>
                    <button
                      onClick={() => removeCard(card.id)}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      title="Remove chart"
                    >
                      <X className="w-4 h-4 text-white/60 hover:text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Card Content */}
                <div className="flex-1 flex flex-col min-h-0">
                  {renderCardContent(card)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewPublishedData;
