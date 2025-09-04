import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Plus,
  Settings,
  X,
  BarChart3,
  PieChart as PieChartIcon,
  Table,
  BarChart2,
  LineChart,
  Hash,
  Move,
  Upload,
  Eye,
  Type,
  ArrowUpRight,
  MousePointer,
  Save,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Copy,
  Database,
  HardDrive,
  Trash,
  Files,
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
  LineChart as RechartsLineChart,
  Line,
} from "recharts";
import { storageService } from '../services/storageService';
import { cacheService, CachedData } from '../services/cacheService';
import { duckdbService, LocalDataset } from '../services/duckdbService';
import { StorageOptionModal } from './StorageOptionModal';
import { LocalDatasets } from './LocalDatasets';
import UserProfile from './UserProfile';
import { useBuildReportSession } from '../hooks/useBuildReportSession';
import SessionDebug from './SessionDebug';

interface TextBox {
  id: string;
  cardId: string;
  content: string;
  htmlContent?: string; // Rich HTML content for selective styling
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  fontSize: number;
  color?: string;
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
  chartType: 'none' | 'pie' | 'bar' | 'mixbar' | 'table' | 'scorecard' | 'line';
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
  measure2?: string;
  seriesColumn?: string;
  yAxisScale: 'linear' | 'percentage';
  yAxisFormat?: 'default' | 'K' | 'M' | 'B'; // Y-axis formatting for Line Charts
  sortBy: 'dimension' | 'measure';
  sortOrder: 'asc' | 'desc';
  mergedBars: { [key: string]: string[] }; // Maps merged bar name to original bar names
  customNames: { [key: string]: string }; // Maps original names to custom display names
  textBoxes: TextBox[];
  arrows: Arrow[];
  data?: any[];
}

interface DataRow {
  [key: string]: string | number;
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
  previewImage?: string;
  chartCount: number;
  chartTypes: string[];
}

const CHART_TYPES = [
  { id: 'pie', label: 'Pie Chart', icon: PieChartIcon },
  { id: 'bar', label: 'Column Chart', icon: BarChart3 },
  { id: 'mixbar', label: 'Stacked Column Chart', icon: BarChart2 },
  { id: 'table', label: 'Data Table', icon: Table },
  { id: 'scorecard', label: 'Scorecard', icon: Hash },
  { id: 'line', label: 'Line Chart', icon: LineChart },
] as const;

// Professional color palette - inspired by modern data visualization tools
const CHART_COLORS = [
  '#1f77b4', // Professional blue
  '#ff7f0e', // Professional orange
  '#2ca02c', // Professional green
  '#d62728', // Professional red
  '#9467bd', // Professional purple
  '#8c564b', // Professional brown
  '#e377c2', // Professional pink
  '#7f7f7f', // Professional gray
  '#bcbd22', // Professional olive
  '#17becf', // Professional cyan
  '#aec7e8', // Light blue
  '#ffbb78', // Light orange
  '#98df8a', // Light green
  '#ff9896', // Light red
  '#c5b0d5', // Light purple
];

// Sample data for demonstration
const SAMPLE_DATA = [
  { name: 'Marketing', value: 35000, budget: 40000 },
  { name: 'Sales', value: 28000, budget: 30000 },
  { name: 'Engineering', value: 45000, budget: 50000 },
  { name: 'Operations', value: 22000, budget: 25000 },
  { name: 'HR', value: 18000, budget: 20000 },
];

const GRID_SIZE = 25; // Grid cell size in pixels
const DEFAULT_GRID_COLS = 40; // Default grid columns
const DEFAULT_GRID_ROWS = 30; // Default grid rows

// Custom label renderer for pie chart
const renderCustomLabel = (props: any, pieRadius: number, showLabels: boolean, labelFontSize = 10) => {
  if (!showLabels) return null;

  const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props;

  // Only show labels for segments >= 8% (slightly lower threshold for better coverage)
  if (percent < 0.08) return null;

  const RADIAN = Math.PI / 180;
  // Position label in the center of the segment (middle between inner and outer radius)
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  const percentageText = `${(percent * 100).toFixed(0)}%`;

  // Intelligent font sizing based on segment size
  const percentValue = percent * 100;
  let fontSizeMultiplier;

  if (percentValue >= 30) {
    // Very large segments (30%+) - largest font
    fontSizeMultiplier = 1.4;
  } else if (percentValue >= 20) {
    // Large segments (20-30%) - large font
    fontSizeMultiplier = 1.2;
  } else if (percentValue >= 15) {
    // Medium-large segments (15-20%) - medium-large font
    fontSizeMultiplier = 1.1;
  } else if (percentValue >= 10) {
    // Medium segments (10-15%) - standard font
    fontSizeMultiplier = 1.0;
  } else {
    // Small segments (8-10%) - smaller font to fit
    fontSizeMultiplier = 0.85;
  }

  // Apply intelligent sizing with larger base size
  const intelligentFontSize = Math.round(labelFontSize * fontSizeMultiplier);
  const percentageFontSize = Math.round(intelligentFontSize * 0.9); // Slightly smaller for percentage

  // Dynamic line spacing based on font size
  const lineSpacing = Math.round(intelligentFontSize * 1.2);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={intelligentFontSize}
      fontWeight="600"
      style={{
        pointerEvents: 'none'
      }}
    >
      <tspan x={x} dy="0">{name}</tspan>
      <tspan x={x} dy={lineSpacing} fontSize={percentageFontSize}>{percentageText}</tspan>
    </text>
  );
};

// Enhanced tooltip content
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const name = data.name;
    const value = data.value;

    // Calculate total to get percentage
    const total = payload[0].payload.total || data.payload.value;
    const percentage = ((value / total) * 100).toFixed(1);

    return (
      <div
        className="bg-black/90 border border-white/20 rounded-md p-3 shadow-lg"
        style={{ fontSize: '11px' }}
      >
        <div className="text-white font-semibold mb-1">{name}</div>
        <div className="text-white/90">Value: {value.toLocaleString()}</div>
        <div className="text-white/90">Share: {percentage}%</div>
      </div>
    );
  }
  return null;
};

// Custom draggable bar component
const DraggableBar = (props: any) => {
  const { payload, x, y, width, height, fill, cardId, updateCard, currentCard } = props;
  const [isDragging, setIsDragging] = useState(false);
  const [draggedOver, setDraggedOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      barName: payload.name,
      barValue: payload.value,
      cardId: cardId
    }));
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedOver(true);
  };

  const handleDragLeave = () => {
    setDraggedOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedOver(false);

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (dragData.cardId === cardId && dragData.barName !== payload.name) {
        // Merge the bars
        const mergedName = `<<${dragData.barName} + ${payload.name}>>`;
        updateCard(cardId, {
          mergedBars: {
            ...currentCard.mergedBars,
            [mergedName]: [dragData.barName, payload.name]
          },
          customNames: {
            ...currentCard.customNames,
            [mergedName]: mergedName
          }
        });
      }
    } catch (error) {
      console.error('Error parsing drag data:', error);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      style={{
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        stroke: draggedOver ? '#60a5fa' : 'none',
        strokeWidth: draggedOver ? 2 : 0,
        filter: draggedOver ? 'brightness(1.2)' : 'none'
      }}
    />
  );
};

// Editable label component for all bar labels with tilted text support
const EditableLabel = ({ value, onChange, isEditing, onEdit, maxWidth = 120, useTiltedText = false, fontSize = 10 }: any) => {
  const [tempValue, setTempValue] = useState(value);

  const handleSubmit = () => {
    onChange(tempValue);
    onEdit(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setTempValue(value);
      onEdit(false);
    }
  };

  // Always use straight text with multi-line support (no tilting)
  const shouldTilt = false;

  // When tilting uniformly, show full text. When not tilting, truncate if needed
  const truncateText = (text: string, maxWidth: number) => {
    const avgCharWidth = 6; // Approximate character width in pixels
    const maxChars = Math.floor(maxWidth / avgCharWidth) - 2; // Reserve space for ellipsis

    if (text.length <= maxChars) {
      return text;
    }

    return text.substring(0, maxChars) + '..';
  };

  // Always show full text for multiline support (no truncation)
  const displayText = value;
  const isTextTruncated = false;

  if (isEditing) {
    return (
      <input
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyPress}
        className="bg-white/10 border border-blue-400 rounded px-1 text-white text-center"
        style={{
          width: `${maxWidth}px`,
          minWidth: '60px',
          fontSize: `${fontSize}px`,
          transform: 'none',
          transformOrigin: 'center'
        }}
        autoFocus
      />
    );
  }

  return (
    <span
      onClick={() => onEdit(true)}
      className={`cursor-pointer hover:bg-white/10 rounded text-white/90 block leading-tight transition-transform duration-200 ${
        shouldTilt ? 'transform-gpu' : 'text-left'
      }`}
      style={{
        maxWidth: `${maxWidth}px`,
        overflow: 'visible',
        wordBreak: 'break-word',
        lineHeight: '1.2',
        fontSize: `${fontSize}px`,
        transform: 'none',
        transformOrigin: 'center bottom',
        whiteSpace: 'normal',
        marginTop: '0px',
        marginBottom: '0px',
        textAlign: 'left'
      }}
      title={isTextTruncated ? `Click to edit: ${value}` : "Click to edit"}
    >
      {displayText}
    </span>
  );
};

// PDF-like TextBox Component with card-like behavior
const TextBoxComponent: React.FC<{
  textBox: TextBox;
  onUpdate: (updates: Partial<TextBox>) => void;
  onDelete: () => void;
  isSelected: boolean;
  onSelect: () => void;
  onMouseDown: (e: React.MouseEvent, action: 'drag' | 'resize') => void;
  draggedTextBox: string | null;
  resizingTextBox: string | null;
  hideControls: boolean;
}> = ({ textBox, onUpdate, onDelete, isSelected, onSelect, onMouseDown, draggedTextBox, resizingTextBox, hideControls }) => {
  const [isEditing, setIsEditing] = useState(textBox.isEditing);
  const [tempContent, setTempContent] = useState(textBox.content);
  const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [hasSelectedText, setHasSelectedText] = useState(false);
  const [savedSelection, setSavedSelection] = useState<Range | null>(null);
  const editableRef = React.useRef<HTMLDivElement>(null);

  const fontSizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64];
  const colors = ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080'];

  // Check for text selection and save it
  const checkTextSelection = () => {
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0;

    if (hasSelection && selection!.rangeCount > 0) {
      // Save the current selection
      const range = selection!.getRangeAt(0);
      // Check if the selection is within our editable element
      if (editableRef.current && editableRef.current.contains(range.commonAncestorContainer)) {
        setSavedSelection(range.cloneRange());
        setHasSelectedText(true);
        return;
      }
    }

    setHasSelectedText(false);
    setSavedSelection(null);
  };

  // Restore saved selection
  const restoreSelection = () => {
    if (savedSelection && editableRef.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedSelection);
    }
  };

  // Apply color to saved selection
  const applyColorToSelection = (color: string) => {
    if (savedSelection && editableRef.current) {
      // Restore the selection first
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedSelection);

      // Apply color using a more reliable method
      try {
        // Try using execCommand first
        if (document.execCommand('foreColor', false, color)) {
          // Success with execCommand
        } else {
          // Fallback to manual span wrapping
          const range = savedSelection;
          const span = document.createElement('span');
          span.style.color = color;

          try {
            range.surroundContents(span);
          } catch (e) {
            // If can't surround, extract and wrap
            span.appendChild(range.extractContents());
            range.insertNode(span);
          }
        }

        // Clear selection after applying color
        selection?.removeAllRanges();

        // Update the content
        const htmlContent = editableRef.current.innerHTML;
        onUpdate({
          htmlContent: htmlContent,
          content: editableRef.current.textContent || editableRef.current.innerText || ''
        });

        // Clear saved selection since it's been used
        setSavedSelection(null);
        setHasSelectedText(false);

      } catch (error) {
        console.error('Error applying color to selection:', error);
      }
    }
  };

  // Apply font size to saved selection
  const applyFontSizeToSelection = (fontSize: number) => {
    if (savedSelection && editableRef.current) {
      // Restore the selection first
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedSelection);

      try {
        const range = savedSelection;
        const span = document.createElement('span');
        span.style.fontSize = `${fontSize}px`;

        try {
          range.surroundContents(span);
        } catch (e) {
          // If can't surround, extract and wrap
          span.appendChild(range.extractContents());
          range.insertNode(span);
        }

        // Clear selection after applying font size
        selection?.removeAllRanges();

        // Update the content
        const htmlContent = editableRef.current.innerHTML;
        onUpdate({
          htmlContent: htmlContent,
          content: editableRef.current.textContent || editableRef.current.innerText || ''
        });

        // Clear saved selection since it's been used
        setSavedSelection(null);
        setHasSelectedText(false);

      } catch (error) {
        console.error('Error applying font size to selection:', error);
      }
    }
  };

  // Auto-focus and select text for new text boxes
  React.useEffect(() => {
    if (isEditing && editableRef.current && textBox.content === 'Type your text here...') {
      // Focus the editable div
      editableRef.current.focus();

      // Select all text for easy replacement
      setTimeout(() => {
        if (editableRef.current) {
          const range = document.createRange();
          range.selectNodeContents(editableRef.current);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }, 10);
    }
  }, [isEditing, textBox.content]);

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      setShowFontSizeDropdown(false);
      setShowColorPicker(false);
    };

    if (showFontSizeDropdown || showColorPicker) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showFontSizeDropdown, showColorPicker]);

  const handleSave = () => {
    if (editableRef.current) {
      const htmlContent = editableRef.current.innerHTML;
      const textContent = editableRef.current.textContent || editableRef.current.innerText || '';
      onUpdate({
        content: textContent,
        htmlContent: htmlContent,
        isEditing: false
      });
    } else {
      onUpdate({ content: tempContent, isEditing: false });
    }
    setIsEditing(false);
    setHasSelectedText(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setTempContent(textBox.content);
      setIsEditing(false);
      setHasSelectedText(false);
      onUpdate({ isEditing: false });
    }
  };

  const startEditing = () => {
    setIsEditing(true);
    onUpdate({ isEditing: true });
  };

  return (
    <div
      className={`absolute overflow-hidden ${
        hideControls ? 'border-0' : 'border rounded-lg'
      } ${
        hideControls ? '' : 'glass-card'
      } ${
        textBox.id === draggedTextBox
          ? 'z-50 shadow-2xl border-blue-400/50 scale-105 transition-none'
          : textBox.id === resizingTextBox
          ? 'z-40 border-green-400/50 transition-none'
          : isSelected && !hideControls
          ? 'z-40 border-blue-400/50 shadow-lg transition-all duration-200'
          : hideControls
          ? 'z-30 transition-all duration-200'
          : 'z-30 border-white/20 transition-all duration-200'
      }`}
      style={{
        ...(hideControls ? { backgroundColor: 'transparent' } : { backgroundColor: 'rgba(255, 255, 255, 0.05)' }),
        left: textBox.position.x,
        top: textBox.position.y,
        width: textBox.size.width,
        height: textBox.size.height,
        transform: textBox.id === draggedTextBox ? 'rotate(1deg)' : 'none',
        userSelect: 'none',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Header with drag handle, formatting controls, and delete button */}
      {!hideControls && isSelected && (
        <div className="flex items-center justify-between p-1 bg-white/5 border-b border-white/10">
          <div
            className={`cursor-move hover:bg-white/20 p-1 rounded transition-colors ${
              textBox.id === draggedTextBox ? 'bg-blue-500/20' : ''
            }`}
            onMouseDown={(e) => onMouseDown(e, 'drag')}
            title="Drag to move"
          >
            <Move className={`w-3 h-3 ${
              textBox.id === draggedTextBox ? 'text-blue-300' : 'text-white/70'
            }`} />
          </div>

          {/* Selection Status and Formatting Controls */}
          <div className="flex items-center gap-1">
            {isEditing && hasSelectedText && (
              <div className="px-1 py-0.5 bg-blue-500/20 rounded text-[10px] text-blue-300">
                Text Selected
              </div>
            )}
          </div>

          {/* Formatting Controls */}
          <div className="flex items-center gap-1">
            {/* Font Size Control */}
            <div className="relative">
              <button
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent focus loss
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowFontSizeDropdown(!showFontSizeDropdown);
                  setShowColorPicker(false);
                }}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title="Font Size"
              >
                <Type className="w-3 h-3 text-white/70" />
              </button>

              {/* Font Size Dropdown */}
              {showFontSizeDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-black/90 border border-white/20 rounded-md shadow-lg z-50 min-w-16">
                  <div className="py-1 max-h-40 overflow-y-auto">
                    {fontSizes.map(size => (
                      <button
                        key={size}
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent focus loss
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (isEditing && hasSelectedText) {
                            applyFontSizeToSelection(size);
                          } else {
                            onUpdate({ fontSize: size });
                          }
                          setShowFontSizeDropdown(false);
                        }}
                        className={`w-full px-2 py-1 text-xs text-left hover:bg-white/20 transition-colors ${
                          textBox.fontSize === size ? 'bg-blue-500/30 text-blue-300' : 'text-white/80'
                        }`}
                      >
                        {size}px
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Color Picker Control */}
            <div className="relative">
              <button
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent focus loss
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowColorPicker(!showColorPicker);
                  setShowFontSizeDropdown(false);
                }}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title="Text Color"
              >
                <div className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: textBox.color || '#ffffff' }}></div>
              </button>

              {/* Color Picker Dropdown */}
              {showColorPicker && (
                <div className="absolute top-full right-0 mt-1 bg-black/90 border border-white/20 rounded-md shadow-lg z-50">
                  <div className="p-2 grid grid-cols-5 gap-1">
                    {colors.map(color => (
                      <button
                        key={color}
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent focus loss
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (isEditing && hasSelectedText) {
                            applyColorToSelection(color);
                          } else {
                            onUpdate({ color: color });
                          }
                          setShowColorPicker(false);
                        }}
                        className={`w-5 h-5 rounded border-2 hover:scale-110 transition-transform ${
                          (textBox.color || '#ffffff') === color ? 'border-blue-400' : 'border-white/30'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 hover:bg-red-500/20 rounded transition-colors"
          >
            <X className="w-3 h-3 text-red-400" />
          </button>
        </div>
      )}

      {/* Content */}
      <div
        className="w-full h-full p-2"
        style={{
          height: !hideControls && isSelected && !isEditing ? 'calc(100% - 32px)' : '100%'
        }}
      >
        {isEditing ? (
          <div
            ref={editableRef}
            contentEditable
            onBlur={handleSave}
            onKeyDown={handleKeyPress}
            onMouseUp={checkTextSelection}
            onKeyUp={checkTextSelection}
            className="w-full h-full bg-transparent border-none outline-none overflow-auto"
            style={{
              fontSize: textBox.fontSize,
              color: textBox.color || '#ffffff'
            }}
            dangerouslySetInnerHTML={{
              __html: textBox.htmlContent || textBox.content || 'Type your text...'
            }}
            suppressContentEditableWarning
          />
        ) : (
          <div
            onClick={startEditing}
            className="w-full h-full cursor-text overflow-hidden"
            style={{
              fontSize: textBox.fontSize,
              color: textBox.color || '#ffffff',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
            dangerouslySetInnerHTML={{
              __html: textBox.htmlContent || textBox.content || 'Click to edit text'
            }}
          />
        )}
      </div>

      {/* Resize Handle */}
      {!hideControls && isSelected && !isEditing && (
        <div
          className={`absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-blue-500/30 hover:bg-blue-500/50 transition-all duration-200 rounded-tl-md flex items-center justify-center ${
            textBox.id === resizingTextBox ? 'bg-green-500/30 hover:bg-green-500/50' : ''
          }`}
          onMouseDown={(e) => onMouseDown(e, 'resize')}
          title="Drag to resize"
        >
          <div className={`w-2 h-2 border-r-2 border-b-2 ${
            textBox.id === resizingTextBox ? 'border-green-300' : 'border-white/70'
          }`}></div>
        </div>
      )}
    </div>
  );
};

// Professional Interactive Arrow Component
const ArrowComponent: React.FC<{
  arrow: Arrow;
  onDelete: () => void;
  onUpdate: (updates: Partial<Arrow>) => void;
  isSelected: boolean;
  onSelect: () => void;
  hideControls: boolean;
  draggedArrow: string | null;
  draggedHandle: 'start' | 'end' | 'whole' | null;
  onHandleDrag?: (e: React.MouseEvent, arrowId: string, handle: 'start' | 'end' | 'whole') => void;
}> = ({ arrow, onDelete, onUpdate, isSelected, onSelect, hideControls, draggedArrow, draggedHandle, onHandleDrag }) => {
  const length = Math.sqrt(
    Math.pow(arrow.endPosition.x - arrow.startPosition.x, 2) +
    Math.pow(arrow.endPosition.y - arrow.startPosition.y, 2)
  );

  const angle = Math.atan2(
    arrow.endPosition.y - arrow.startPosition.y,
    arrow.endPosition.x - arrow.startPosition.x
  ) * 180 / Math.PI;

  const isDragging = draggedArrow === arrow.id;
  const arrowHeadSize = Math.max(8, arrow.thickness * 3);

  const handleStartDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!hideControls) {
      onHandleDrag?.(e, arrow.id, 'start');
    }
  };

  const handleEndDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!hideControls) {
      onHandleDrag?.(e, arrow.id, 'end');
    }
  };

  const handleWholeDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!hideControls) {
      onHandleDrag?.(e, arrow.id, 'whole');
    }
  };

  return (
    <div className="absolute" style={{ left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {/* Arrow SVG - properly positioned */}
      <svg
        className="absolute pointer-events-none"
        style={{
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          zIndex: isSelected ? 40 : 30,
          overflow: 'visible'
        }}
      >
        {/* Enhanced Arrow Head Definition */}
        <defs>
          <marker
            id={`arrowhead-${arrow.id}`}
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points="0,0 0,6 9,3"
              fill={arrow.color}
            />
          </marker>
        </defs>

        {/* Arrow Line with whole-arrow drag functionality */}
        <line
          x1={arrow.startPosition.x}
          y1={arrow.startPosition.y}
          x2={arrow.endPosition.x}
          y2={arrow.endPosition.y}
          stroke={arrow.color}
          strokeWidth={arrow.thickness}
          strokeLinecap="round"
          className={`transition-all duration-200 ${
            isDragging ? 'opacity-75' : ''
          } ${
            draggedHandle === 'whole' ? 'opacity-80' : ''
          }`}
          style={{
            pointerEvents: 'stroke',
            cursor: draggedHandle === 'whole' ? 'grabbing' : 'grab'
          }}
          markerEnd={`url(#arrowhead-${arrow.id})`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onMouseDown={!hideControls ? handleWholeDrag : undefined}
        />
      </svg>

      {/* Interactive Handles (only when selected and controls visible) */}
      {!hideControls && isSelected && (
        <>
          {/* Start Handle */}
          <div
            className={`absolute w-3 h-3 rounded-full border-2 border-white bg-blue-500 cursor-move transition-all duration-200 ${
              draggedHandle === 'start' ? 'scale-125 bg-blue-400' : 'hover:scale-110'
            }`}
            style={{
              left: arrow.startPosition.x - 6,
              top: arrow.startPosition.y - 6,
              pointerEvents: 'auto',
              zIndex: 50,
            }}
            onMouseDown={handleStartDrag}
            title="Drag to move arrow start"
          />

          {/* End Handle */}
          <div
            className={`absolute w-3 h-3 rounded-full border-2 border-white bg-green-500 cursor-move transition-all duration-200 ${
              draggedHandle === 'end' ? 'scale-125 bg-green-400' : 'hover:scale-110'
            }`}
            style={{
              left: arrow.endPosition.x - 6,
              top: arrow.endPosition.y - 6,
              pointerEvents: 'auto',
              zIndex: 50,
            }}
            onMouseDown={handleEndDrag}
            title="Drag to move arrow end"
          />

          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs transition-all duration-200 hover:scale-110"
            style={{
              left: (arrow.startPosition.x + arrow.endPosition.x) / 2 - 10,
              top: (arrow.startPosition.y + arrow.endPosition.y) / 2 - 20,
              pointerEvents: 'auto',
              zIndex: 50,
            }}
            title="Delete arrow"
          >
            <X className="w-3 h-3" />
          </button>

          {/* Length indicator */}
          <div
            className="absolute px-2 py-1 bg-black/80 text-white text-xs rounded border border-white/20 pointer-events-none"
            style={{
              left: (arrow.startPosition.x + arrow.endPosition.x) / 2 - 20,
              top: (arrow.startPosition.y + arrow.endPosition.y) / 2 + 15,
              zIndex: 50,
            }}
          >
            {Math.round(length)}px
          </div>
        </>
      )}
    </div>
  );
};

interface BuildReportProps {
  loadedReportState?: {
    cards: DashboardCard[];
    hideControls: boolean;
    importedData: any[];
  };
  userEmail?: string;
}

const BuildReport: React.FC<BuildReportProps> = ({ loadedReportState, userEmail = 'mayank.jain@abc.com' }) => {
  // Session management
  const { syncCards, syncData, syncFile, hasActiveSession, getInitialStateFromSession } = useBuildReportSession();

  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingCard, setResizingCard] = useState<string | null>(null);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [importedData, setImportedData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [currentFileVersion, setCurrentFileVersion] = useState<number | null>(null);
  const [configuringCard, setConfiguringCard] = useState<string | null>(null);
  const [hideControls, setHideControls] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [draggedBar, setDraggedBar] = useState<string | null>(null);
  const [draggedOverBar, setDraggedOverBar] = useState<string | null>(null);
  const [dragData, setDragData] = useState<{ cardId: string; barName: string; startX: number; startY: number } | null>(null);
  const [expandedLegend, setExpandedLegend] = useState<string | null>(null);
  const [legendDialog, setLegendDialog] = useState<string | null>(null);

  // Mix bar chart state
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<{ barIndex: number, segment: string, data: any } | null>(null);
  const chartContainerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [containerDimensions, setContainerDimensions] = useState<Map<string, { width: number, height: number }>>(new Map());

  // PDF-like tool state
  const [currentTool, setCurrentTool] = useState<'select' | 'textbox' | 'arrow' | null>('select');
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  // TextBox drag and resize state
  const [draggedTextBox, setDraggedTextBox] = useState<string | null>(null);
  const [resizingTextBox, setResizingTextBox] = useState<string | null>(null);
  const [textBoxDragOffset, setTextBoxDragOffset] = useState({ x: 0, y: 0 });

  // Arrow drag state
  const [draggedArrow, setDraggedArrow] = useState<string | null>(null);
  const [draggedHandle, setDraggedHandle] = useState<'start' | 'end' | 'whole' | null>(null);
  const [arrowDragOffset, setArrowDragOffset] = useState({ x: 0, y: 0 });

  // History management for undo/redo functionality
  const [cardsHistory, setCardsHistory] = useState<DashboardCard[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const MAX_HISTORY_SIZE = 20;

  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveReportName, setSaveReportName] = useState('');
  const [saveReportDescription, setSaveReportDescription] = useState('');
  const [storageInfo, setStorageInfo] = useState({ viewsCount: 0, storageSize: 0, percentUsed: 0, isNearLimit: false });

  // File upload success popup state
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Clear All confirmation dialog state
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);

  // Storage conflict state
  const [storageConflictData, setStorageConflictData] = useState<any>(null);
  const [selectedStorageType, setSelectedStorageType] = useState<'local' | 'server' | null>(null);

  // Snowflake modal state
  const [showSnowflakeModal, setShowSnowflakeModal] = useState(false);
  const [snowflakeQuery, setSnowflakeQuery] = useState('');
  const [queryType, setQueryType] = useState<'table' | 'sql'>('table');
  const [testMode, setTestMode] = useState(true);

  // Cache-related states
  const [cacheEnabled, setCacheEnabled] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [cacheInfo, setCacheInfo] = useState({ count: 0, size: 0 });
  const [showCachingDialog, setShowCachingDialog] = useState(false);
  const [cachingStatus, setCachingStatus] = useState('');
  const [showClearingDialog, setShowClearingDialog] = useState(false);
  const [clearingStatus, setClearingStatus] = useState('');

  // Filter section states
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [leftSectionVisible, setLeftSectionVisible] = useState(true);
  const [selectedDimension, setSelectedDimension] = useState('');
  const [dimensionValues, setDimensionValues] = useState<string[]>([]);
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());
  const [dimensionSelections, setDimensionSelections] = useState<Record<string, string[]>>({}); // Preserve selections per dimension

  // Version management states
  const [availableVersions, setAvailableVersions] = useState<any[]>([]);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Responsive grid dimensions
  const [gridCols, setGridCols] = useState(DEFAULT_GRID_COLS);
  const [gridRows, setGridRows] = useState(DEFAULT_GRID_ROWS);
  const [containerWidth, setContainerWidth] = useState(1200);

  // Storage option modal state
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [pendingFileData, setPendingFileData] = useState<{
    file: File;
    headers: string[];
    data: DataRow[];
    rowCount: number;
  } | null>(null);
  const [localDatasets, setLocalDatasets] = useState<LocalDataset[]>([]);

  // Local datasets modal state
  const [showLocalDatasets, setShowLocalDatasets] = useState(false);

  // Existing files modal state
  const [showExistingFilesModal, setShowExistingFilesModal] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileVersion, setSelectedFileVersion] = useState<LocalDataset | null>(null);
  const [groupedLocalFiles, setGroupedLocalFiles] = useState<{[filename: string]: LocalDataset[]}>({});

  // Chart compatibility state
  const [chartCompatibilityIssues, setChartCompatibilityIssues] = useState<{[cardId: string]: string[]}>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionDropdownRef = useRef<HTMLDivElement>(null);

  // Load saved report state when provided
  useEffect(() => {
    if (loadedReportState) {
      setCards(loadedReportState.cards);
      setHideControls(loadedReportState.hideControls);
      setImportedData(loadedReportState.importedData);
      setColumns(loadedReportState.columns || []);
      setFileName(loadedReportState.fileName || '');
      setCurrentFileVersion(loadedReportState.currentFileVersion || null);
      // Clear any configuration state
      setConfiguringCard(null);
      setCurrentTool('select');
    }
  }, [loadedReportState]);

  // Sync cards to session whenever they change
  useEffect(() => {
    try {
      if (cards.length > 0) {
        syncCards(cards);
      }
    } catch (e) {
      console.warn('Failed to sync cards to session:', e.message);
    }
  }, [cards, syncCards]);

  // Sync imported data to session whenever it changes
  useEffect(() => {
    try {
      if (importedData.length > 0 && columns.length > 0) {
        syncData(importedData, columns);
      }
    } catch (e) {
      console.warn('Failed to sync data to session:', e.message);
    }
  }, [importedData, columns, syncData]);

  // Sync file information to session whenever it changes
  useEffect(() => {
    try {
      if (fileName) {
        syncFile(fileName, currentFileVersion);
      }
    } catch (e) {
      console.warn('Failed to sync file info to session:', e.message);
    }
  }, [fileName, currentFileVersion, syncFile]);

  // Guard to avoid multiple session restores
  const hasRestoredFromSessionRef = React.useRef(false);

  // Initialize from session if no loadedReportState is provided
  useEffect(() => {
    if (!loadedReportState && hasActiveSession && !hasRestoredFromSessionRef.current) {
      const sessionData = getInitialStateFromSession();
      if (sessionData) {
        console.log('Restoring work from session:', sessionData);

        // Always restore cards and file info if they exist
        if (sessionData.cards && sessionData.cards.length > 0) {
          console.log('Restoring cards:', sessionData.cards.length);
          setCards(sessionData.cards);
        }

        if (sessionData.fileName) {
          console.log('Restoring file info:', sessionData.fileName, 'version:', sessionData.currentFileVersion);
          setFileName(sessionData.fileName);
          setCurrentFileVersion(sessionData.currentFileVersion || null);
          setColumns(sessionData.columns || []);
        }

        // Only restore imported data if it exists and has content
        if (sessionData.importedData && sessionData.importedData.length > 0) {
          console.log('Restoring data:', sessionData.importedData.length, 'rows');
          setImportedData(sessionData.importedData);
        }

        if (sessionData.hideControls !== undefined) {
          setHideControls(sessionData.hideControls);
        }

        hasRestoredFromSessionRef.current = true;
      }
    }
  }, [loadedReportState, hasActiveSession, getInitialStateFromSession]);

  // Validate chart compatibility with current columns
  const validateChartCompatibility = useCallback(() => {
    const issues: {[cardId: string]: string[]} = {};

    cards.forEach(card => {
      const cardIssues: string[] = [];

      // Check if dimension column exists
      if (card.dimension && !columns.includes(card.dimension)) {
        cardIssues.push(`Dimension column "${card.dimension}" not found`);
      }

      // Check if measure column exists
      if (card.measure && !columns.includes(card.measure)) {
        cardIssues.push(`Measure column "${card.measure}" not found`);
      }

      // Check if second measure exists (for charts that support it)
      if (card.measure2 && !columns.includes(card.measure2)) {
        cardIssues.push(`Second measure column "${card.measure2}" not found`);
      }

      // Check if dimension2 exists (for mixbar charts)
      if (card.dimension2 && !columns.includes(card.dimension2)) {
        cardIssues.push(`Second dimension column "${card.dimension2}" not found`);
      }

      // Check if series column exists (for line charts)
      if (card.seriesColumn && !columns.includes(card.seriesColumn)) {
        cardIssues.push(`Series column "${card.seriesColumn}" not found`);
      }

      if (cardIssues.length > 0) {
        issues[card.id] = cardIssues;
      }
    });

    setChartCompatibilityIssues(issues);
    return Object.keys(issues).length === 0; // Return true if no issues
  }, [cards, columns]);

  // Fetch available versions for the current file from both local and server storage
  const fetchFileVersions = useCallback(async (userEmail: string, filename: string) => {
    if (!userEmail || !filename) {
      setAvailableVersions([]);
      return;
    }

    try {
      setLoadingVersions(true);
      console.log(`Fetching versions for file: ${filename}, user: ${userEmail}`);

      const allVersions: any[] = [];

      // 1. Fetch SERVER versions (Snowflake database)
      const filenameVariants = [
        filename,
        filename.endsWith('.csv') ? filename.slice(0, -4) : `${filename}.csv`
      ];

      // Helper function to retry fetch requests
      const fetchWithRetry = async (url: string, retries = 2): Promise<Response | null> => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            // Create timeout signal with fallback for older browsers
            let timeoutSignal;
            try {
              timeoutSignal = AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined;
            } catch {
              // Fallback for browsers that don't support AbortSignal.timeout
              const controller = new AbortController();
              setTimeout(() => controller.abort(), 10000);
              timeoutSignal = controller.signal;
            }

            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
              ...(timeoutSignal && { signal: timeoutSignal })
            });
            return response;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Fetch attempt ${attempt + 1} failed for ${url}:`, errorMessage);

            // If this is the last attempt, return null
            if (attempt === retries) {
              return null;
            }

            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
        }
        return null;
      };

      let foundServerVersions = false;
      for (const filenameVariant of filenameVariants) {
        try {
          const encodedFilename = encodeURIComponent(filenameVariant);
          const url = `/api/database/uploads/file/${encodeURIComponent(userEmail)}/${encodedFilename}/versions`;
          const response = await fetchWithRetry(url);

          if (!response) {
            console.warn(`Failed to fetch server versions for ${filenameVariant} after retries - continuing with local versions only`);
            continue;
          }

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.versions && result.versions.length > 0) {
              // Add server versions with source tag
              const serverVersions = result.versions.map((v: any) => ({
                ...v,
                source: 'server',
                sourceLabel: 'Snowflake',
                sourceColor: 'text-blue-400'
              }));
              allVersions.push(...serverVersions);
              foundServerVersions = true;
              console.log(`Found ${serverVersions.length} server versions for: ${filenameVariant}`);
              break;
            }
          } else if (response.status === 404) {
            // 404 is expected when file doesn't exist on server - not an error
            console.log(`No server versions found for: ${filenameVariant} (404)`);
          } else {
            console.warn(`Server version check failed for ${filenameVariant}: ${response.status}`);
          }
        } catch (serverError) {
          console.warn(`Unexpected error checking server versions for ${filenameVariant}:`, serverError.message);
        }
      }

      // 2. Fetch LOCAL versions (IndexedDB via DuckDB service)
      try {
        const localVersions = await duckdbService.getLocalFileVersions(userEmail, filename);
        if (localVersions && localVersions.length > 0) {
          // Add local versions with source tag
          const localVersionsWithSource = localVersions.map((dataset: LocalDataset) => ({
            version: dataset.version,
            upload_timestamp: dataset.createdAt.toISOString(),
            table_name: dataset.id, // Use dataset ID as table name for local versions
            file_size_bytes: dataset.fileSize,
            original_filename: dataset.originalFileName,
            source: 'local',
            sourceLabel: 'Local',
            sourceColor: 'text-purple-400',
            dataset_id: dataset.id // Store dataset ID for local loading
          }));
          allVersions.push(...localVersionsWithSource);
          console.log(`Found ${localVersionsWithSource.length} local versions for: ${filename}`);
        } else {
          console.log(`No local versions found for: ${filename}`);
        }
      } catch (localError) {
        console.error('Error fetching local versions:', localError);
      }

      // 3. Combine and sort all versions
      if (allVersions.length > 0) {
        // Sort by version number descending (newest first), then by source priority (server first)
        const sortedVersions = allVersions.sort((a, b) => {
          if (a.version !== b.version) {
            return b.version - a.version; // Higher version first
          }
          // If same version, prefer server over local
          if (a.source === 'server' && b.source === 'local') return -1;
          if (a.source === 'local' && b.source === 'server') return 1;
          return 0;
        });

        setAvailableVersions(sortedVersions);

        // Set current version to the highest version only if not already set
        const highestVersion = sortedVersions[0].version;
        if (!currentFileVersion) {
          console.log(`Setting current version to highest available: v${highestVersion} (${sortedVersions[0].sourceLabel})`);
          setCurrentFileVersion(highestVersion);
        }

        console.log(`Total versions found: ${sortedVersions.length} (${foundServerVersions ? 'server + ' : ''}local)`);
      } else {
        console.log(`No versions found for file: ${filename} (tried server + local)`);
        setAvailableVersions([]);
      }
    } catch (error) {
      console.error('Error fetching file versions:', error);
      setAvailableVersions([]);

      // Show user-friendly error message
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.warn('Network connectivity issue - working in offline mode with local data only');
      } else {
        console.error('Unexpected error during version fetching:', error.message);
      }
    } finally {
      setLoadingVersions(false);
    }
  }, [currentFileVersion]);

  // Load data for a specific version from either local or server storage
  const loadFileVersion = useCallback(async (userEmail: string, filename: string, version: number, isAutoReload: boolean = false, isVersionSwitch: boolean = false) => {
    try {
      let versionData = availableVersions.find(v => v.version === version);

      if (!versionData) {
        console.warn(`Requested version v${version} not found in availableVersions (${availableVersions.length}).`);

        if (availableVersions.length > 0) {
          const fallback = availableVersions[0];
          console.warn(`Falling back to latest available version v${fallback.version} from ${fallback.sourceLabel}.`);
          versionData = fallback;
          version = fallback.version;
        } else {
          // No versions in memory. Try reconstructing from local storage (DuckDB)
          try {
            const localVersions = await duckdbService.getLocalFileVersions(userEmail, filename);
            if (localVersions && localVersions.length > 0) {
              // Prefer exact version; otherwise highest
              const exact = localVersions.find((v: any) => v.version === version);
              const chosen = exact || localVersions.reduce((a: any, b: any) => (a.version > b.version ? a : b));
              const datasetId = chosen.id;
              const dataset = await duckdbService.getDatasetMetadata(datasetId);
              if (dataset) {
                const query = 'SELECT * FROM {table} LIMIT 10000';
                const data = await duckdbService.queryDataset(datasetId, query);
                setColumns(dataset.columns || []);
                setImportedData(data || []);
                setCurrentFileVersion(chosen.version);
                setShowVersionDropdown(false);
                setCacheEnabled(false);

                // Validate chart compatibility with new data
                setTimeout(() => validateChartCompatibility(), 100);
                if (!isAutoReload && !isVersionSwitch) {
                  setUploadedFileName(`${filename} (v${chosen.version}) - Local Storage`);
                  setShowUploadSuccess(true);
                  setTimeout(() => setShowUploadSuccess(false), 3000);
                }
                console.log(`Loaded local fallback version ${chosen.version} with ${data.length} rows`);
                return;
              }
            }
          } catch (e) {
            console.warn('Local version fallback failed:', e);
          }

          // Final fallback: load last cached dataset
          try {
            await cacheService.init();
            const cached = await cacheService.getCachedData();
            if (cached && cached.data && cached.data.length > 0) {
              setColumns(cached.columns || []);
              setImportedData(cached.data || []);
              setCurrentFileVersion(null);
              if (cached.fileName) setFileName(cached.fileName);
              setShowVersionDropdown(false);
              setCacheEnabled(false);

              // Validate chart compatibility with new data
              setTimeout(() => validateChartCompatibility(), 100);
              if (!isAutoReload && !isVersionSwitch) {
                setUploadedFileName(cached.fileName || 'Cached dataset');
                setShowUploadSuccess(true);
                setTimeout(() => setShowUploadSuccess(false), 3000);
              }
              console.log(`Loaded fallback from cache with ${cached.data.length} rows`);
              return;
            }
          } catch (e) {
            console.warn('Cache fallback failed:', e);
          }

          console.warn('Version data not found and no available versions to fallback to');
          // Instead of erroring, show a helpful message to the user
          setUploadedFileName(`${filename} - No versions available`);
          setImportedData([]);
          setColumns([]);
          return;
        }
      }

      console.log(`Loading version ${version} from ${versionData.sourceLabel}:`, versionData);

      if (versionData.source === 'local') {
        // Load from local storage (IndexedDB)
        try {
          const datasetId = versionData.dataset_id || versionData.table_name;
          const dataset = await duckdbService.getDatasetMetadata(datasetId);

          if (!dataset) {
            console.error('Local dataset not found:', datasetId);
            return;
          }

          // Load the dataset data from IndexedDB
          const query = 'SELECT * FROM {table} LIMIT 10000'; // Limit for performance
          const data = await duckdbService.queryDataset(datasetId, query);

          setColumns(dataset.columns || []);
          setImportedData(data || []);
          setCurrentFileVersion(version);
          setShowVersionDropdown(false);
          setCacheEnabled(false); // Local data doesn't use cache

          // Validate chart compatibility with new data
          setTimeout(() => validateChartCompatibility(), 100);

          // Show success notification (only if not auto-reload and not version switch)
          if (!isAutoReload && !isVersionSwitch) {
            setUploadedFileName(`${filename} (v${version}) - Local Storage`);
            setShowUploadSuccess(true);
            setTimeout(() => setShowUploadSuccess(false), 3000);
          }

          console.log(`Loaded local version ${version} with ${data.length} rows`);
        } catch (localError) {
          console.error('Error loading local version:', localError);
          alert('Failed to load local version. The data may have been removed from local storage.');
        }
      } else {
        // Load from server storage (Snowflake)
        try {
          const tableName = versionData.table_name;
          const response = await fetch(`/api/database/tables/${tableName}/data`);

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              setColumns(result.columns || []);
              setImportedData(result.data || []);
              setCurrentFileVersion(version);
              setShowVersionDropdown(false);
              setCacheEnabled(false); // Fresh data doesn't use cache

              // Validate chart compatibility with new data
              setTimeout(() => validateChartCompatibility(), 100);

              // Show success notification (only if not auto-reload and not version switch)
              if (!isAutoReload && !isVersionSwitch) {
                setUploadedFileName(`${filename} (v${version}) - Snowflake`);
                setShowUploadSuccess(true);
                setTimeout(() => setShowUploadSuccess(false), 3000);
              }

              console.log(`Loaded server version ${version} with ${result.data.length} rows`);
            } else {
              console.error('Failed to load version data:', result.error);
              alert(`Failed to load server version: ${result.error}`);
            }
          } else {
            console.error('Failed to fetch version data:', response.statusText);
            alert(`Failed to fetch server version: ${response.status} ${response.statusText}`);
          }
        } catch (serverError) {
          console.error('Error loading server version:', serverError);
          alert('Failed to load server version. Please check your connection.');
        }
      }
    } catch (error) {
      console.error('Error loading file version:', error);
      alert('Failed to load version data.');
    }
  }, [availableVersions]);

  // Initialize cache service and check for cached data
  useEffect(() => {
    const initCache = async () => {
      try {
        await cacheService.init();
        const cached = await cacheService.hasCachedData();
        setHasCachedData(cached);

        const info = await cacheService.getStorageInfo();
        setCacheInfo(info);

        // Load cached data if available and no imported data
        if (cached && importedData.length === 0) {
          const cachedData = await cacheService.getCachedData();
          if (cachedData) {
            setImportedData(cachedData.data);
            setColumns(cachedData.columns);
            if (cachedData.fileName) {
              setFileName(cachedData.fileName);
            }
            // Clear version for cached data since it doesn't track database versions
            setCurrentFileVersion(null);
          }
        }
      } catch (error) {
        console.error('Error initializing cache:', error);
      }
    };

    initCache();
  }, []);

  // Fetch versions when fileName and currentFileVersion are available
  useEffect(() => {
    const fetchVersionsForCurrentFile = async () => {
      if (fileName && currentFileVersion && currentFileVersion > 0) {
        // Using userEmail prop from component
        console.log('Fetching versions for existing file:', fileName, 'version:', currentFileVersion);

        // Try to determine the original filename with extension for database lookup
        // If fileName doesn't end with .csv, add it since database stores original filename
        const searchFilename = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
        await fetchFileVersions(userEmail, searchFilename);
      }
    };

    fetchVersionsForCurrentFile();
  }, [fileName, fetchFileVersions]);

  // Debug logging for current version changes
  useEffect(() => {
    console.log('Current file version changed to:', currentFileVersion, 'for file:', fileName);
  }, [currentFileVersion, fileName]);

  // Guard to ensure we auto-reload only once per session restore
  const hasAutoReloadedRef = React.useRef(false);
  const hasFetchedVersionsForRestoreRef = React.useRef(false);

  // Auto-reload data when session is restored with file info but no data
  useEffect(() => {
    const shouldAutoReload =
      fileName &&
      currentFileVersion &&
      currentFileVersion > 0 &&
      importedData.length === 0 &&
      !loadedReportState &&
      !hasAutoReloadedRef.current && // Only auto-reload once
      hasRestoredFromSessionRef.current; // Only after session is restored

    if (!shouldAutoReload) return;

    const doReload = async () => {
      try {
        hasAutoReloadedRef.current = true;
        console.log('Auto-reloading data for session restore:', fileName, 'v' + currentFileVersion);

        // Try to get the versions first, but don't wait too long
        if (!availableVersions || availableVersions.length === 0) {
          if (!hasFetchedVersionsForRestoreRef.current) {
            hasFetchedVersionsForRestoreRef.current = true;
            const searchFilename = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;

            // Set a reasonable timeout for version fetching
            const fetchPromise = fetchFileVersions(userEmail, searchFilename);
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Version fetch timeout')), 3000)
            );

            try {
              await Promise.race([fetchPromise, timeoutPromise]);
              // Small delay to let versions populate
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
              console.warn('Version fetch timed out or failed, proceeding with direct load:', e.message);
            }
          }
        }

        // Attempt to load the version (mark as auto-reload to suppress success popup)
        await loadFileVersion(userEmail, fileName, currentFileVersion, true);
      } catch (e) {
        console.warn('Auto-reload encountered an error (proceeding without data):', e.message);
      }
    };

    // Delay to ensure session restoration is complete
    const timer = setTimeout(doReload, 500);
    return () => clearTimeout(timer);
  }, [fileName, currentFileVersion, importedData.length, loadedReportState, loadFileVersion, userEmail, availableVersions, fetchFileVersions]);

  // Update cache status when data changes
  useEffect(() => {
    const updateCacheStatus = async () => {
      try {
        const cached = await cacheService.hasCachedData();
        setHasCachedData(cached);
        const info = await cacheService.getStorageInfo();
        setCacheInfo(info);
      } catch (error) {
        console.error('Error updating cache status:', error);
      }
    };

    if (importedData.length > 0) {
      updateCacheStatus();
    }
  }, [importedData]);

  // Responsive grid dimensions based on screen size
  useEffect(() => {
    const calculateDimensions = () => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      // Calculate available width (accounting for navigation and padding)
      const navigationWidth = screenWidth >= 1024 ? 320 : 0; // lg:w-80 = 320px
      const padding = screenWidth >= 1024 ? 64 : screenWidth >= 640 ? 32 : 16; // lg:p-4, sm:p-2, p-1
      const availableWidth = screenWidth - navigationWidth - padding;

      // Calculate grid dimensions
      const cols = Math.max(Math.floor(availableWidth / GRID_SIZE), 20); // Minimum 20 columns
      const rows = Math.max(Math.floor((screenHeight - 200) / GRID_SIZE), 20); // Minimum 20 rows, account for header

      setGridCols(cols);
      setGridRows(rows);
      setContainerWidth(Math.max(cols * GRID_SIZE, 800)); // Minimum 800px width
    };

    calculateDimensions();

    const handleResize = () => {
      calculateDimensions();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close version dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
        setShowVersionDropdown(false);
      }
    };

    if (showVersionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showVersionDropdown]);

  // File upload functionality
  const handleFileImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

        // Optimize parsing for large files
        const dataLines = lines.slice(1).filter(line => line.trim());
        const data: DataRow[] = new Array(dataLines.length);

        // Pre-allocate and process in more efficient way
        for (let i = 0; i < dataLines.length; i++) {
          const values = dataLines[i].split(',');
          const row: DataRow = {};

          for (let j = 0; j < headers.length; j++) {
            const value = (values[j] || '').trim().replace(/"/g, '');
            if (value === '') {
              row[headers[j]] = '';
            } else {
              const numValue = parseFloat(value);
              row[headers[j]] = isNaN(numValue) ? value : numValue;
            }
          }

          data[i] = row;
        }

        if (data.length === 0) {
          console.error('No data found in CSV file');
          setColumns(headers);
          setImportedData([]);

          // Update filename without version for no data case
          const fileNameWithoutExt = file.name.replace(/\.csv$/i, '');
          setFileName(fileNameWithoutExt);
          setCurrentFileVersion(null); // No version for empty files

          setUploadedFileName(`${file.name} (No data)`);
          setShowUploadSuccess(true);
          return;
        }

        // Show storage options modal instead of direct upload
        // Clear any previous state to ensure clean modal state for new file upload
        setStorageConflictData(null);
        setSelectedStorageType(null);

        setPendingFileData({
          file,
          headers,
          data,
          rowCount: data.length
        });
        setShowStorageModal(true);
      };
      reader.readAsText(file);
    }

    // Reset file input to allow uploading the same file again
    if (event.target) {
      event.target.value = '';
    }
  }, []);

  // Upload file to database with specific version
  const uploadFileToDatabase = useCallback(async (file: File, headers: string[], data: DataRow[], version: number, overwrite = false) => {
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9]/g, '_').replace(/\.csv$/i, '');
    const tableName = `user_uploads_${timestamp}_${sanitizedFileName}_v${version}`;

    try {
      const response = await fetch(`/api/database/tables/${tableName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: data,
          overwrite: overwrite,
          metadata: {
            user_name: userEmail,
            original_filename: file.name,
            version: version,
            file_size_bytes: file.size
          }
        }),
      });

      // Read response body once as text first to avoid stream issues
      let responseText;
      try {
        responseText = await response.text();
      } catch (textError) {
        console.error('Failed to read response body:', textError);
        throw new Error(`Failed to read server response. Status: ${response.status}`);
      }

      // Handle response based on status
      if (!response.ok) {
        // For non-ok responses, try to parse JSON for error details
        let errorDetails = `HTTP ${response.status}`;
        try {
          const errorResult = JSON.parse(responseText);
          if (errorResult.error) {
            errorDetails = errorResult.error;
          }

          // Handle specific error types
          if (response.status === 409 && errorResult.constraint_violation) {
            console.error('Constraint violation - file version already exists:', errorDetails);
            // Note: Conflicts are now handled before this function is called
            console.error('Failed to save to database:', errorDetails);
          } else {
            console.error('Failed to save to database:', errorDetails);
          }
        } catch (jsonError) {
          console.error('Server returned non-JSON error response:', responseText);
          console.error('Error parsing JSON:', jsonError);
        }

        // Fallback: still load data into state for immediate use
        setColumns(headers);
        setImportedData(data);
        setCacheEnabled(false);

        // Update filename and version in header even for fallback
        const fileNameWithoutExt = file.name.replace(/\.csv$/i, '');
        setFileName(fileNameWithoutExt);
        setCurrentFileVersion(version);

        throw new Error(`Database save failed: ${errorDetails}`);
      }

      // Response is ok, now parse JSON safely
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('Failed to parse success response as JSON:', jsonError);
        console.error('Response text was:', responseText);
        // Even if JSON parsing fails, we can still load the data
        setColumns(headers);
        setImportedData(data);
        setCacheEnabled(false);

        const fileNameWithoutExt = file.name.replace(/\.csv$/i, '');
        setFileName(fileNameWithoutExt);
        setCurrentFileVersion(version);

        throw new Error(`Server response was not valid JSON. Status: ${response.status}`);
      }

      if (result.success) {
        // Success: load data into state for immediate visualization
        setColumns(headers);
        setImportedData(data);
        setCacheEnabled(false);

        // Update filename and version in header
        const fileNameWithoutExt = file.name.replace(/\.csv$/i, '');
        setFileName(fileNameWithoutExt);
        setCurrentFileVersion(version);

        // Fetch available versions for this file using the original filename as stored in metadata
        // Using userEmail prop from component
        fetchFileVersions(userEmail, file.name); // Use original filename with extension for database query

        // Show success popup with versioned display name
        const displayName = result.metadata?.display_name || `${file.name} (v${version})`;
        setUploadedFileName(displayName);
        setShowUploadSuccess(true);

        console.log(`File uploaded successfully to Snowflake table: ${tableName}`, {
          rowCount: result.rowCount,
          columns: result.columns,
          version: version
        });
      } else {
        // Handle unexpected response format
        console.error('Unexpected response format:', result);
        throw new Error('Unexpected response format from server');
      }
    } catch (error) {
      console.error('Error saving to database:', error);

      // Fallback: still load data into state for immediate use
      setColumns(headers);
      setImportedData(data);
      setCacheEnabled(false);

      // Update filename and version in header even for fallback
      const fileNameWithoutExt = file.name.replace(/\.csv$/i, '');
      setFileName(fileNameWithoutExt);
      setCurrentFileVersion(version);

      setUploadedFileName(`${file.name} (v${version}) (DB save failed - using locally)`);
      setShowUploadSuccess(true);
    }
  }, []);

  // Handle overwrite choice from version dialog
  const handleStorageOverwrite = useCallback(async (storageType: 'local' | 'server') => {
    if (!pendingFileData || !storageConflictData) return;

    const { file, headers, data } = pendingFileData;
    const existingVersions = storageConflictData.existing_versions || [];

    if (existingVersions.length === 0) {
      console.error('No existing versions found for overwrite');
      return;
    }

    try {
      const latestVersion = Math.max(...existingVersions.map((v: any) => v.version));

      if (storageType === 'local') {
        // Handle local storage overwrite
        await duckdbService.overwriteLocalFile(data, file.name, headers, userEmail, latestVersion);

        // Load the data into the app for immediate use
        setColumns(headers);
        setImportedData(data);
        setCacheEnabled(false);

        const fileNameWithoutExt = file.name.replace(/\.csv$/i, '');
        setFileName(fileNameWithoutExt);
        setCurrentFileVersion(latestVersion);

        // Update local datasets list
        const datasets = await duckdbService.listDatasets();
        setLocalDatasets(datasets);

        setUploadedFileName(`${file.name} (v${latestVersion}) (Overwritten in Local storage - ${data.length.toLocaleString()} rows)`);
        setShowUploadSuccess(true);

        console.log(`Local storage file overwritten successfully: ${file.name} v${latestVersion}`);
      } else {
        // Handle server storage overwrite
        await uploadFileToDatabase(file, headers, data, latestVersion, true);
      }

      // Close modal and clean up
      setShowStorageModal(false);
      setPendingFileData(null);
      setStorageConflictData(null);
      setSelectedStorageType(null);

      console.log('Storage overwrite completed, modal closed');
    } catch (error) {
      console.error('Error during overwrite:', error);
      setUploadedFileName(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setShowUploadSuccess(true);
    }
  }, [pendingFileData, storageConflictData, uploadFileToDatabase, userEmail]);

  // Helper function to save to local storage with versioning
  const saveToLocalStorage = useCallback(async (
    file: File,
    headers: string[],
    data: any[],
    userEmail: string,
    version: number
  ) => {
    try {
      console.log(`Saving dataset to Local storage v${version}...`);
      console.log('SaveToLocalStorage params:', {
        fileName: file.name,
        userEmail,
        version,
        dataLength: data.length,
        columnsLength: headers.length
      });
      const dataset = await duckdbService.saveDataset(data, file.name, headers, userEmail, version);
      console.log('Dataset saved successfully:', dataset);

      // Load the data into the app for immediate use
      setColumns(headers);
      setImportedData(data);
      setCacheEnabled(false); // Disable regular cache when using local storage

      const fileNameWithoutExt = file.name.replace(/\.csv$/i, '');
      setFileName(fileNameWithoutExt);
      setCurrentFileVersion(version);

      // Update local datasets list
      const datasets = await duckdbService.listDatasets();
      setLocalDatasets(datasets);

      setUploadedFileName(`${file.name} (v${version}) (Saved to Local storage - ${data.length.toLocaleString()} rows)`);
      setShowUploadSuccess(true);

      console.log(`Local dataset saved successfully: ${dataset.name} v${version}`);
    } catch (error) {
      console.error('Error saving to local storage:', error);
      throw error;
    }
  }, []);

  // Handle new version choice from version dialog
  const handleStorageNewVersion = useCallback(async (storageType: 'local' | 'server') => {
    if (!pendingFileData || !storageConflictData) return;

    const { file, headers, data } = pendingFileData;
    const nextVersion = storageConflictData.next_version || 1;

    try {
      if (storageType === 'local') {
        // Handle local storage new version
        await saveToLocalStorage(file, headers, data, userEmail, nextVersion);
      } else {
        // Handle server storage new version
        await uploadFileToDatabase(file, headers, data, nextVersion, false);
      }

      // Close modal and clean up
      setShowStorageModal(false);
      setPendingFileData(null);
      setStorageConflictData(null);
      setSelectedStorageType(null);

      console.log('Storage new version completed, modal closed');
    } catch (error) {
      console.error('Error during new version upload:', error);
      setUploadedFileName(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setShowUploadSuccess(true);
    }
  }, [pendingFileData, storageConflictData, uploadFileToDatabase, saveToLocalStorage, userEmail]);

  // Handle storage modal close
  const handleStorageModalClose = useCallback(() => {
    setShowStorageModal(false);
    setPendingFileData(null);
    setStorageConflictData(null);
    setSelectedStorageType(null);
  }, []);

  // Snowflake data import functionality
  const handleSnowflakeImport = useCallback(async () => {
    if (!snowflakeQuery.trim()) return;

    try {
      // Prepare the request payload
      const requestData = {
        queryType: queryType,
        query: snowflakeQuery.trim(),
        limit: 1000
      };

      // Choose endpoint based on test mode
      let endpoint;

      if (testMode) {
        // Test mode: Use embedded Express.js server
        const isBuilderEnv = window.location.hostname.includes('.fly.dev');
        const apiBaseUrl = isBuilderEnv ? '' : 'http://localhost:3000';
        endpoint = `${apiBaseUrl}/api/snowflake/test-import`;
      } else {
        // Production mode: Use Python API server
        const pythonApiBaseUrl = 'http://localhost:5000';
        endpoint = `${pythonApiBaseUrl}/api/snowflake/import`;
      }

      // Call the API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      // Check if response is ok before parsing
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Parse JSON response with proper error handling
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error('Invalid response format from server');
      }

      if (result.success) {
        // Process the data similar to CSV import
        const data = result.data;
        const columns = result.columns;

        if (data && data.length > 0) {
          setColumns(columns);
          setImportedData(data);

          // Set both display filename and success popup filename
          const displayName = `Snowflake: ${queryType === 'table' ? snowflakeQuery : 'Custom Sql'}`;
          setFileName(displayName);
          setCurrentFileVersion(null); // Clear version for Snowflake imports
          setUploadedFileName(displayName);

          // Disable cache when new dataset is loaded - user must explicitly choose to cache
          setCacheEnabled(false);

          setShowUploadSuccess(true);

          // Close modal and reset form
          setShowSnowflakeModal(false);
          setSnowflakeQuery('');
          setQueryType('table');
          setTestMode(true);

          console.log(`Successfully imported ${data.length} rows from Snowflake`);
        } else {
          alert('No data returned from Snowflake query.');
        }
      } else {
        // Handle API errors
        const errorMessage = result.error || 'Unknown error occurred';
        alert(`Snowflake import failed:\n${errorMessage}`);
        console.error('Snowflake import error:', result);
      }

    } catch (error) {
      console.error('Snowflake import error:', error);

      // Check for specific error types
      if (error instanceof TypeError) {
        if (error.message.includes('fetch')) {
          alert('Unable to connect to Snowflake API server.\nPlease ensure the server is running and accessible.');
        } else {
          alert(`Network error: ${error.message}\nPlease try again or check the console for details.`);
        }
      } else if (error instanceof Error) {
        if (error.message.includes('HTTP error')) {
          alert(`Server error: ${error.message}\nPlease check your query and try again.`);
        } else if (error.message.includes('Invalid response format')) {
          alert('Server returned invalid data format.\nPlease try again or contact support.');
        } else {
          alert(`Error: ${error.message}\nSee console for details.`);
        }
      } else {
        alert('Error importing from Snowflake. Please check your query and try again.\nSee console for details.');
      }
    }
  }, [snowflakeQuery, queryType]);

  // Storage option handlers
  const handleStorageOptionSelect = useCallback(async (option: 'local' | 'server') => {
    if (!pendingFileData) return;

    const { file, headers, data, rowCount } = pendingFileData;

    console.log('handleStorageOptionSelect called with option:', option);
    console.log('Pending file data:', {fileName: file.name, userEmail});

    // Clear any previous conflict data before checking new storage option
    setStorageConflictData(null);
    setSelectedStorageType(option);

    try {
      if (option === 'local') {
        // Check for local file conflicts first
        console.log('Checking for local file conflicts for:', file.name, 'user:', userEmail);
        try {
          const conflictResult = await duckdbService.checkLocalFileConflict(userEmail, file.name);
          console.log('Conflict check result:', conflictResult);

          if (conflictResult.exists) {
            // File already exists locally, show conflict options in modal
            console.log('Local file conflict detected, showing conflict resolution');
            console.log('Conflict data:', conflictResult);
            const safeConflictResult = {
              conflict: true,
              existing_versions: conflictResult.versions.map(v => ({
                version: v.version,
                upload_timestamp: v.createdAt,
                table_name: v.id
              })),
              next_version: conflictResult.nextVersion,
              user_name: userEmail,
              original_filename: file.name
            };

            setStorageConflictData(safeConflictResult);
            console.log('Storage conflict data set:', safeConflictResult);
            console.log('Selected storage type:', option);
            // Modal will stay open and show conflict resolution UI
          } else {
            // No conflict, proceed with local save
            console.log('No conflict, proceeding with local save');
            await saveToLocalStorage(file, headers, data, userEmail, 1);
            setShowStorageModal(false);
            setPendingFileData(null);
          }
        } catch (error) {
          console.error('Error checking local file conflict:', error);
          // Show error to user instead of silent fallback
          alert('Error checking for file conflicts. Please try again.');
          return;
        }

      } else {
        // Store on server - check for conflicts first
        try {
          const conflictResponse = await fetch('/api/database/uploads/check-conflict', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_name: userEmail,
              original_filename: file.name
            }),
          });

          let conflictResult;
          try {
            const conflictText = await conflictResponse.text();
            conflictResult = JSON.parse(conflictText);
          } catch (jsonError) {
            console.error('Failed to parse conflict check response as JSON:', jsonError);
            // Show error to user instead of silent fallback
            alert('Error checking for file conflicts. Please try again.');
            return;
          }

          if (conflictResponse.ok && conflictResult.success) {
            if (conflictResult.conflict) {
              // File already exists on server, show conflict options in modal
              console.log('Server file conflict detected, showing conflict resolution');
              console.log('Server conflict data:', conflictResult);
              const safeConflictResult = {
                ...conflictResult,
                existing_versions: conflictResult.existing_versions || [],
                next_version: conflictResult.next_version || 1
              };

              setStorageConflictData(safeConflictResult);
              console.log('Storage conflict data set:', safeConflictResult);
              console.log('Selected storage type:', option);
              // Modal will stay open and show conflict resolution UI
            } else {
              // No conflict, proceed with upload
              await uploadFileToDatabase(file, headers, data, 1);
              setShowStorageModal(false);
              setPendingFileData(null);
            }
          } else {
            console.error('Failed to check conflict:', conflictResult.error);
            // Show error to user instead of silent fallback
            alert(`Error checking for file conflicts: ${conflictResult.error || 'Unknown error'}. Please try again.`);
            return;
          }
        } catch (error) {
          console.error('Error checking conflict:', error);
          // Show error to user instead of silent fallback
          alert('Network error while checking for file conflicts. Please check your connection and try again.');
          return;
        }
      }
    } catch (error) {
      console.error('Error with storage option:', error);
      alert(`Error storing data: ${error}`);
      // Close modal on error
      setShowStorageModal(false);
      setPendingFileData(null);
      setStorageConflictData(null);
      setSelectedStorageType(null);
    }
  }, [pendingFileData, userEmail, uploadFileToDatabase]);

  // Load local datasets on component mount
  useEffect(() => {
    const loadLocalDatasets = async () => {
      try {
        const datasets = await duckdbService.listDatasets();
        setLocalDatasets(datasets);
      } catch (error) {
        console.error('Error loading local datasets:', error);
      }
    };
    loadLocalDatasets();
  }, []);

  // Handler for loading a dataset from local storage
  const handleLoadLocalDataset = useCallback(async (dataset: LocalDataset, data: DataRow[]) => {
    try {
      console.log(`Loading local dataset: ${dataset.name} (Flow: Local storage �� DuckDB → App)`);

      // Load dataset data into the app
      setColumns(dataset.columns);
      setImportedData(data);
      setCacheEnabled(false); // Using local DuckDB storage

      setFileName(dataset.name);
      setCurrentFileVersion(null);

      setUploadedFileName(`${dataset.originalFileName} (Loaded from Local storage - ${data.length.toLocaleString()} rows via DuckDB query)`);
      setShowUploadSuccess(true);

    } catch (error) {
      console.error('Error loading local dataset into app:', error);
      alert('Failed to load dataset');
    }
  }, []);

  // Select an existing local file and load sample data via DuckDB, then inject into app
  const handleSelectExistingFile = useCallback(async (dataset: LocalDataset) => {
    try {
      const sampleQuery = 'SELECT * FROM {table} LIMIT 1000';
      const data = await duckdbService.queryDataset(dataset.id, sampleQuery);
      await handleLoadLocalDataset(dataset, data);
      setShowExistingFilesModal(false);
    } catch (error) {
      console.error('Error loading existing file:', error);
      alert('Failed to load file');
    }
  }, [handleLoadLocalDataset]);

  // Cache management functions
  const toggleCache = useCallback(async () => {
    const newCacheEnabled = !cacheEnabled;
    setCacheEnabled(newCacheEnabled);

    // If enabling cache and there's current data, cache it
    if (newCacheEnabled && importedData.length > 0 && columns.length > 0) {
      try {
        // Show caching dialog
        setShowCachingDialog(true);
        setCachingStatus('Initializing cache...');

        // Simulate progress steps for better UX
        setCachingStatus('Preparing data for caching...');
        await new Promise(resolve => setTimeout(resolve, 300));

        setCachingStatus('Storing data in Local storage...');
        const source = fileName.startsWith('Snowflake:') ? 'snowflake' : 'file';
        await cacheService.cacheData(
          importedData,
          columns,
          source,
          fileName,
          fileName.startsWith('Snowflake:') ? fileName.replace('Snowflake: ', '') : undefined,
          fileName.includes('Custom Sql') ? 'sql' : 'table'
        );

        setCachingStatus('Updating cache status...');
        setHasCachedData(true);
        const info = await cacheService.getStorageInfo();
        setCacheInfo(info);

        setCachingStatus('Caching completed successfully!');
        await new Promise(resolve => setTimeout(resolve, 800));

        // Auto-close dialog
        setShowCachingDialog(false);
      } catch (error) {
        console.error('Error caching current data:', error);
        setCachingStatus('Error occurred while caching data');
        await new Promise(resolve => setTimeout(resolve, 1500));
        setShowCachingDialog(false);
      }
    }
  }, [cacheEnabled, importedData, columns, fileName]);

  const clearCache = useCallback(async () => {
    try {
      // Show clearing dialog
      setShowClearingDialog(true);
      setClearingStatus('Initializing cache clearing...');

      // Simulate progress steps for better UX
      setClearingStatus('Removing cached data...');
      await new Promise(resolve => setTimeout(resolve, 300));

      setClearingStatus('Clearing Local storage...');
      await cacheService.clearCache();

      setClearingStatus('Updating application state...');
      setHasCachedData(false);
      setCacheInfo({ count: 0, size: 0 });
      // Disable caching when cache is cleared
      setCacheEnabled(false);

      // If current data is from cache, clear it
      if (hasCachedData && importedData.length > 0) {
        setClearingStatus('Clearing current data...');
        setImportedData([]);
        setColumns([]);
        setFileName('');
      }

      setClearingStatus('Cache cleared successfully!');
      await new Promise(resolve => setTimeout(resolve, 800));

      // Auto-close dialog
      setShowClearingDialog(false);
    } catch (error) {
      console.error('Error clearing cache:', error);
      setClearingStatus('Error occurred while clearing cache');
      await new Promise(resolve => setTimeout(resolve, 1500));
      setShowClearingDialog(false);
    }
  }, [hasCachedData, importedData.length]);

  // Check for overlaps
  const checkOverlap = useCallback((newCard: DashboardCard, excludeId?: string) => {
    const gapSize = 0.25; // Quarter grid gap between cards

    return cards.some(card => {
      if (card.id === excludeId) return false;

      const cardRight = card.gridPosition.x + card.gridPosition.width;
      const cardBottom = card.gridPosition.y + card.gridPosition.height;
      const newRight = newCard.gridPosition.x + newCard.gridPosition.width;
      const newBottom = newCard.gridPosition.y + newCard.gridPosition.height;

      // Check if cards are too close (within gap distance)
      return !(
        newCard.gridPosition.x >= cardRight + gapSize ||
        newRight + gapSize <= card.gridPosition.x ||
        newCard.gridPosition.y >= cardBottom + gapSize ||
        newBottom + gapSize <= card.gridPosition.y
      );
    });
  }, [cards]);

  // Helper function to get visible grid bounds based on current scroll position
  const getVisibleGridBounds = useCallback(() => {
    if (!containerRef.current) {
      return {
        minX: 0,
        maxX: gridCols,
        minY: 0,
        maxY: gridRows
      };
    }

    const container = containerRef.current;
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Convert pixel coordinates to grid coordinates
    const minX = Math.max(0, Math.floor(scrollLeft / GRID_SIZE) - 1); // Add buffer
    const maxX = Math.min(gridCols, Math.ceil((scrollLeft + containerWidth) / GRID_SIZE) + 1);
    const minY = Math.max(0, Math.floor(scrollTop / GRID_SIZE) - 1);
    const maxY = Math.min(gridRows, Math.ceil((scrollTop + containerHeight) / GRID_SIZE) + 1);

    return { minX, maxX, minY, maxY };
  }, [gridCols, gridRows]);

  const findAvailablePositionWithAdaptiveSize = useCallback((
    preferredWidth: number,
    preferredHeight: number,
    sourceCard?: DashboardCard
  ): { x: number; y: number; width: number; height: number } => {
    // Reserve edge space and define minimum card sizes
    const edgeGap = 0.5;
    const cardGap = 0.5;
    const minWidth = 4; // Minimum card width (4 grid units)
    const minHeight = 3; // Minimum card height (3 grid units)

    // Get the currently visible area
    const visibleBounds = getVisibleGridBounds();

    console.log('Finding adaptive position for card:', {
      preferredWidth,
      preferredHeight,
      visibleBounds,
      sourceCard: sourceCard?.id
    });

    // Helper function to test if a position with specific dimensions is available
    const isPositionAvailable = (x: number, y: number, w: number, h: number) => {
      const testCard: DashboardCard = {
        id: 'test',
        chartType: 'pie',
        title: '',
        gridPosition: { x, y, width: w, height: h },
        isConfiguring: false,
        dimension: '',
        measure: '',
        yAxisScale: 'linear',
        sortBy: 'dimension',
        sortOrder: 'asc',
        mergedBars: {},
        customNames: {},
        textBoxes: [],
        arrows: [],
      };

      return !checkOverlap(testCard);
    };

    // Helper function to calculate maximum available space at a position
    const getMaxAvailableSpace = (x: number, y: number) => {
      let maxWidth = Math.min(gridCols - edgeGap - x, visibleBounds.maxX - x);
      let maxHeight = Math.min(gridRows - edgeGap - y, visibleBounds.maxY - y);

      // Check constraints from existing cards
      for (const card of cards) {
        const cardRight = card.gridPosition.x + card.gridPosition.width;
        const cardBottom = card.gridPosition.y + card.gridPosition.height;

        // If card is to the right and on same or overlapping Y
        if (card.gridPosition.x > x &&
            card.gridPosition.y < y + maxHeight &&
            cardBottom > y) {
          maxWidth = Math.min(maxWidth, card.gridPosition.x - x - cardGap);
        }

        // If card is below and on same or overlapping X
        if (card.gridPosition.y > y &&
            card.gridPosition.x < x + maxWidth &&
            cardRight > x) {
          maxHeight = Math.min(maxHeight, card.gridPosition.y - y - cardGap);
        }
      }

      return {
        width: Math.max(minWidth, maxWidth),
        height: Math.max(minHeight, maxHeight)
      };
    };

    // Helper function to try placing a card with adaptive sizing
    const tryPlaceWithAdaptiveSize = (x: number, y: number, maxW?: number, maxH?: number) => {
      // Determine available space constraints
      const space = maxW && maxH ?
        { width: maxW, height: maxH } :
        getMaxAvailableSpace(x, y);

      // Try preferred size first
      if (preferredWidth <= space.width && preferredHeight <= space.height &&
          isPositionAvailable(x, y, preferredWidth, preferredHeight)) {
        return { x, y, width: preferredWidth, height: preferredHeight };
      }

      // Try different size combinations that fit the available space
      const sizesToTry = [
        // Preserve aspect ratio first
        {
          width: Math.min(preferredWidth, space.width),
          height: Math.min(preferredHeight, space.height)
        },
        // Try square proportions
        {
          width: Math.min(space.width, 6),
          height: Math.min(space.height, 6)
        },
        // Try compact sizes
        {
          width: Math.min(space.width, 5),
          height: Math.min(space.height, 4)
        },
        {
          width: Math.min(space.width, 4),
          height: Math.min(space.height, 3)
        },
      ];

      for (const size of sizesToTry) {
        if (size.width >= minWidth && size.height >= minHeight &&
            isPositionAvailable(x, y, size.width, size.height)) {
          console.log('Found adaptive size:', { x, y, ...size });
          return { x, y, width: size.width, height: size.height };
        }
      }

      return null;
    };

    // Strategy 1: If we have a source card (duplication), try to place nearby
    if (sourceCard) {
      const sourceX = sourceCard.gridPosition.x;
      const sourceY = sourceCard.gridPosition.y;
      const sourceWidth = sourceCard.gridPosition.width;
      const sourceHeight = sourceCard.gridPosition.height;

      console.log('Trying adaptive positions near source card:', { sourceX, sourceY, sourceWidth, sourceHeight });

      // Try to the right of the source card first
      const rightX = sourceX + sourceWidth + cardGap;
      const rightMaxWidth = Math.min(gridCols - edgeGap - rightX, visibleBounds.maxX - rightX);
      if (rightX + minWidth <= gridCols - edgeGap && rightMaxWidth >= minWidth) {
        const result = tryPlaceWithAdaptiveSize(rightX, sourceY, rightMaxWidth, sourceHeight);
        if (result) {
          console.log('Found adaptive position to the right:', result);
          return result;
        }
      }

      // Try below the source card
      const belowY = sourceY + sourceHeight + cardGap;
      const belowMaxHeight = Math.min(gridRows - edgeGap - belowY, visibleBounds.maxY - belowY);
      if (belowY + minHeight <= gridRows - edgeGap && belowMaxHeight >= minHeight) {
        const result = tryPlaceWithAdaptiveSize(sourceX, belowY, sourceWidth, belowMaxHeight);
        if (result) {
          console.log('Found adaptive position below:', result);
          return result;
        }
      }

      // Try to the left of the source card
      const leftX = sourceX - minWidth - cardGap;
      if (leftX >= edgeGap) {
        const leftMaxWidth = sourceX - edgeGap - cardGap;
        const result = tryPlaceWithAdaptiveSize(leftX, sourceY, leftMaxWidth, sourceHeight);
        if (result) {
          console.log('Found adaptive position to the left:', result);
          return result;
        }
      }

      // Try above the source card
      const aboveY = sourceY - minHeight - cardGap;
      if (aboveY >= edgeGap) {
        const aboveMaxHeight = sourceY - edgeGap - cardGap;
        const result = tryPlaceWithAdaptiveSize(sourceX, aboveY, sourceWidth, aboveMaxHeight);
        if (result) {
          console.log('Found adaptive position above:', result);
          return result;
        }
      }
    }

    // Strategy 2: Search systematically in the visible area with adaptive sizing
    console.log('Searching systematically with adaptive sizing');

    for (let currentY = Math.max(edgeGap, visibleBounds.minY);
         currentY + minHeight <= Math.min(gridRows - edgeGap, visibleBounds.maxY);
         currentY += cardGap) {

      for (let currentX = Math.max(edgeGap, visibleBounds.minX);
           currentX + minWidth <= Math.min(gridCols - edgeGap, visibleBounds.maxX);
           currentX += cardGap) {

        const result = tryPlaceWithAdaptiveSize(currentX, currentY);
        if (result) {
          console.log('Found systematic adaptive position:', result);
          return result;
        }
      }
    }

    // Strategy 3: Search the entire grid with adaptive sizing
    console.log('Searching entire grid with adaptive sizing');
    for (let currentY = edgeGap; currentY + minHeight <= gridRows - edgeGap; currentY += cardGap) {
      for (let currentX = edgeGap; currentX + minWidth <= gridCols - edgeGap; currentX += cardGap) {
        const result = tryPlaceWithAdaptiveSize(currentX, currentY);
        if (result) {
          console.log('Found global adaptive position:', result);
          return result;
        }
      }
    }

    // Fallback to minimum size at default position
    console.warn('No available adaptive position found, using minimum size fallback');
    return { x: edgeGap, y: edgeGap, width: minWidth, height: minHeight };
  }, [checkOverlap, getVisibleGridBounds, gridCols, gridRows, cards]);

  // Keep the old function for backward compatibility
  const findAvailablePosition = useCallback((width: number, height: number, sourceCard?: DashboardCard) => {
    const result = findAvailablePositionWithAdaptiveSize(width, height, sourceCard);
    return { x: result.x, y: result.y };
  }, [findAvailablePositionWithAdaptiveSize]);

  // Helper function to get default dimension and measure for new charts
  const getDefaultValues = useCallback(() => {
    if (columns.length === 0 || importedData.length === 0) {
      return { dimension: '', measure: '' };
    }

    // Find first string column for dimension (prefer non-numeric columns)
    const stringColumns = columns.filter(col => {
      const sampleValue = importedData[0]?.[col];
      return typeof sampleValue === 'string' && isNaN(parseFloat(String(sampleValue)));
    });
    const defaultDimension = stringColumns.length > 0 ? stringColumns[0] : columns[0];

    // Find first numeric column for measure
    const numericColumns = columns.filter(col => {
      const sampleValue = importedData[0]?.[col];
      return typeof sampleValue === 'number' || !isNaN(parseFloat(String(sampleValue)));
    });
    const defaultMeasure = numericColumns.length > 0 ? numericColumns[0] : '';

    return { dimension: defaultDimension, measure: defaultMeasure };
  }, [columns, importedData]);

  const addCard = useCallback(() => {
    if (cards.length >= 6) return;

    const defaultWidth = 8;
    const defaultHeight = 6;
    const position = findAvailablePosition(defaultWidth, defaultHeight);
    const { dimension, measure } = getDefaultValues();

    const newCard: DashboardCard = {
      id: `card-${Date.now()}`,
      chartType: 'none',
      title: `Chart ${cards.length + 1}`,
      gridPosition: {
        x: position.x,
        y: position.y,
        width: defaultWidth,
        height: defaultHeight,
      },
      isConfiguring: false,
      dimension: dimension,
      measure: measure,
      measure2: '',
      seriesColumn: '',
      yAxisScale: 'linear',
      yAxisFormat: 'default',
      sortBy: 'measure',
      sortOrder: 'desc',
      mergedBars: {},
      customNames: {},
      textBoxes: [],
      arrows: [],
      data: filteredData.length > 0 ? filteredData : SAMPLE_DATA,
    };

    setCards(prev => {
      const newCards = [...prev, newCard];
      setTimeout(() => saveToHistory(newCards), 0);
      return newCards;
    });
  }, [cards.length, findAvailablePosition, importedData, getDefaultValues]);

  const updateCard = useCallback((cardId: string, updates: Partial<DashboardCard>) => {
    setCards(prev => {
      const newCards = prev.map(card =>
        card.id === cardId ? { ...card, ...updates } : card
      );
      // Save to history after state update
      setTimeout(() => saveToHistory(newCards), 0);
      return newCards;
    });
  }, [historyIndex]);

  // Auto-resize all charts to fill screen optimally
  const autoResizeCharts = useCallback(() => {
    if (cards.length === 0) return;

    // Calculate optimal grid layout based on number of cards
    const numCards = cards.length;
    let cols = Math.ceil(Math.sqrt(numCards));
    let rows = Math.ceil(numCards / cols);

    // Adjust layout for better screen utilization
    if (numCards <= 2) {
      cols = numCards;
      rows = 1;
    } else if (numCards <= 4) {
      cols = 2;
      rows = 2;
    } else {
      // For more than 4 cards, keep 2 columns and add additional rows
      cols = 2;
      rows = Math.ceil(numCards / 2);
    }

    // Define gap between cards (in grid units) - consistent with addCard gap
    const cardGap = 0.25;

    // Calculate available space for content
    const minEdgeGap = 0.25;
    const totalInterCardGapCols = (cols - 1) * cardGap;
    const totalInterCardGapRows = (rows - 1) * cardGap;

    // Calculate optimal card size first
    const availableForCards = gridCols - totalInterCardGapCols - (2 * minEdgeGap);
    const availableForCardsRows = gridRows - totalInterCardGapRows - (2 * minEdgeGap);
    const cardWidth = Math.floor(availableForCards / cols);
    const cardHeight = Math.floor(availableForCardsRows / rows);

    // Ensure minimum size constraints
    const minCardWidth = Math.max(3, cardWidth);
    const minCardHeight = Math.max(3, cardHeight);

    // Calculate total content width and height (including gaps between cards)
    const totalContentWidth = (cols * minCardWidth) + totalInterCardGapCols;
    const totalContentHeight = (rows * minCardHeight) + totalInterCardGapRows;

    // Center the content by calculating balanced edge gaps
    const horizontalEdgeGap = Math.max(minEdgeGap, (gridCols - totalContentWidth) / 2);
    const verticalEdgeGap = Math.max(minEdgeGap, (gridRows - totalContentHeight) / 2);

    // Update all cards with new positions and sizes
    const updatedCards = cards.map((card, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      // Calculate position with centered layout
      const x = horizontalEdgeGap + (col * (minCardWidth + cardGap));
      const y = verticalEdgeGap + (row * (minCardHeight + cardGap));

      return {
        ...card,
        gridPosition: {
          x,
          y,
          width: minCardWidth,
          height: minCardHeight,
        },
      };
    });

    setCards(updatedCards);
    setTimeout(() => saveToHistory(updatedCards), 0);
  }, [cards]);

  // Helper function to get default values for specific chart types
  const getChartTypeDefaults = useCallback((chartType: DashboardCard['chartType']) => {
    if (columns.length === 0 || importedData.length === 0) {
      return { dimension: '', measure: '', dimension2: '', seriesColumn: '' };
    }

    // Find string columns for dimensions (prefer non-numeric columns)
    const stringColumns = columns.filter(col => {
      const sampleValue = importedData[0]?.[col];
      return typeof sampleValue === 'string' && isNaN(parseFloat(String(sampleValue)));
    });

    // Find numeric columns for measures
    const numericColumns = columns.filter(col => {
      const sampleValue = importedData[0]?.[col];
      return typeof sampleValue === 'number' || !isNaN(parseFloat(String(sampleValue)));
    });

    // Set defaults based on chart type
    const dimension = stringColumns.length > 0 ? stringColumns[0] : columns[0];
    const measure = numericColumns.length > 0 ? numericColumns[0] : '';

    switch (chartType) {
      case 'scorecard':
        // Scorecard only needs measure
        return { dimension: '', measure, dimension2: '', seriesColumn: '' };

      case 'mixbar':
        // Stacked column needs dimension, measure, and dimension2
        const dimension2 = stringColumns.length > 1 ? stringColumns[1] :
                          (columns.length > 1 && columns[1] !== dimension ? columns[1] : '');
        return { dimension, measure, dimension2, seriesColumn: '' };

      case 'line':
        // Line chart can use seriesColumn for multiple lines
        const seriesColumn = stringColumns.length > 1 ? stringColumns[1] : '';
        return { dimension, measure, dimension2: '', seriesColumn };

      case 'table':
        // Table can show all data, but set first dimension for grouping if needed
        return { dimension, measure: '', dimension2: '', seriesColumn: '' };

      case 'none':
        // Empty chart type - clear all selections
        return { dimension: '', measure: '', dimension2: '', seriesColumn: '' };

      default:
        // Pie, bar charts need dimension and measure
        return { dimension, measure, dimension2: '', seriesColumn: '' };
    }
  }, [columns, importedData]);

  // Helper function to set chart type with auto-selected values
  const setChartTypeWithDefaults = useCallback((cardId: string, chartType: DashboardCard['chartType']) => {
    const defaults = getChartTypeDefaults(chartType);
    updateCard(cardId, {
      chartType,
      dimension: defaults.dimension,
      measure: defaults.measure,
      dimension2: defaults.dimension2,
      seriesColumn: defaults.seriesColumn
    });
  }, [getChartTypeDefaults, updateCard]);

  const deleteCard = useCallback((cardId: string) => {
    setCards(prev => {
      const newCards = prev.filter(card => card.id !== cardId);
      setTimeout(() => saveToHistory(newCards), 0);
      return newCards;
    });
    if (configuringCard === cardId) {
      setConfiguringCard(null);
    }
  }, [configuringCard, historyIndex]);

  const duplicateCard = useCallback((cardId: string) => {
    if (cards.length >= 6) return; // Respect card limit

    const cardToDuplicate = cards.find(card => card.id === cardId);
    if (!cardToDuplicate) return;

    console.log('Duplicating card:', cardId, cardToDuplicate.gridPosition);

    // Find available position with adaptive sizing for the duplicate
    const adaptivePosition = findAvailablePositionWithAdaptiveSize(
      cardToDuplicate.gridPosition.width,
      cardToDuplicate.gridPosition.height,
      cardToDuplicate
    );

    console.log('New duplicate position with adaptive sizing:', adaptivePosition);

    // Check if the card was resized
    const wasResized = adaptivePosition.width !== cardToDuplicate.gridPosition.width ||
                      adaptivePosition.height !== cardToDuplicate.gridPosition.height;

    if (wasResized) {
      console.log(`Card resized from ${cardToDuplicate.gridPosition.width}x${cardToDuplicate.gridPosition.height} to ${adaptivePosition.width}x${adaptivePosition.height} to fit available space`);
    }

    // Create a new card with copied configuration and adaptive positioning/sizing
    const newCard: DashboardCard = {
      ...cardToDuplicate, // Copy all properties
      id: `card-${Date.now()}`, // New unique ID
      title: `${cardToDuplicate.title} (Copy)${wasResized ? ' (Resized)' : ''}`, // Add "(Copy)" and "(Resized)" if applicable
      gridPosition: {
        x: adaptivePosition.x,
        y: adaptivePosition.y,
        width: adaptivePosition.width,
        height: adaptivePosition.height,
      },
      textBoxes: [], // Reset text boxes (they're card-specific)
      arrows: [], // Reset arrows (they're card-specific)
    };

    setCards(prev => {
      const newCards = [...prev, newCard];
      setTimeout(() => saveToHistory(newCards), 0);
      return newCards;
    });
  }, [cards, findAvailablePositionWithAdaptiveSize]);

  // Save view functionality
  const saveCurrentView = useCallback(async () => {
    if (!saveReportName.trim()) return;

    const reportId = Date.now().toString();
    const chartTypes = [...new Set(cards.map(card => card.chartType))];

    // Optimize the dashboard state to reduce size
    const optimizedCards = cards.map(card => ({
      ...card,
      // Remove any large or unnecessary data
      data: undefined, // Don't save the actual chart data, just configuration
      textBoxes: card.textBoxes.map(tb => ({ ...tb, isEditing: false })),
      isConfiguring: false
    }));

    // Only save a subset of imported data (first 1000 rows) to prevent issues
    const optimizedImportedData = importedData.length > 1000
      ? importedData.slice(0, 1000)
      : importedData;

    const savedReport: SavedReport = {
      id: reportId,
      name: saveReportName.trim(),
      description: saveReportDescription.trim() || undefined,
      savedAt: new Date(),
      dashboardState: {
        cards: optimizedCards,
        hideControls: hideControls,
        importedData: optimizedImportedData,
        columns: columns,
        fileName: fileName,
        currentFileVersion: currentFileVersion,
        cacheInfo: hasCachedData ? {
          sessionId: cacheService.getSessionId(),
          fileName,
          hasCachedData
        } : undefined,
      },
      chartCount: cards.length,
      chartTypes: chartTypes,
    };

    try {
      await storageService.saveView(savedReport);

      // Reset form and close dialog
      setSaveReportName('');
      setSaveReportDescription('');
      setShowSaveDialog(false);

      // Show success feedback
      console.log('View saved successfully:', savedReport.name);
      alert('View saved successfully!');

    } catch (error) {
      console.error('Error saving view:', error);
      alert('Failed to save view. Please try again.');
    }
  }, [saveReportName, saveReportDescription, cards, hideControls, importedData]);

  // Storage utility function
  const getStorageInfo = useCallback(async () => {
    try {
      return await storageService.getStorageInfo();
    } catch {
      return { viewsCount: 0, storageSize: 0, percentUsed: 0, isNearLimit: false };
    }
  }, []);

  // Handle dimension selection for filtering
  const handleDimensionSelect = useCallback((dimension: string) => {
    // Save current selections before switching
    if (selectedDimension && selectedValues.size > 0) {
      setDimensionSelections(prev => ({
        ...prev,
        [selectedDimension]: Array.from(selectedValues)
      }));
    }

    setSelectedDimension(dimension);

    if (dimension && importedData.length > 0) {
      // Get distinct values for the selected dimension
      const distinctValues = [...new Set(
        importedData.map(row => String(row[dimension] || ''))
          .filter(value => value !== '')
      )].sort();
      setDimensionValues(distinctValues);

      // Restore previous selections for this dimension
      const previousSelections = dimensionSelections[dimension] || [];
      setSelectedValues(new Set(previousSelections));
    } else {
      setDimensionValues([]);
      setSelectedValues(new Set());
    }
  }, [importedData, selectedDimension, selectedValues, dimensionSelections]);

  // Handle value selection/deselection
  const handleValueToggle = useCallback((value: string) => {
    setSelectedValues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }

      // Update persistent storage
      if (selectedDimension) {
        setDimensionSelections(prevSelections => ({
          ...prevSelections,
          [selectedDimension]: Array.from(newSet)
        }));
      }

      return newSet;
    });
  }, [selectedDimension]);

  // Handle Select All functionality
  const handleSelectAll = useCallback(() => {
    if (dimensionValues.length === 0) return;

    const allSelected = dimensionValues.every(value => selectedValues.has(value));

    if (allSelected) {
      // Deselect all
      setSelectedValues(new Set());
      if (selectedDimension) {
        setDimensionSelections(prev => {
          const newSelections = { ...prev };
          delete newSelections[selectedDimension];
          return newSelections;
        });
      }
    } else {
      // Select all
      const allValues = new Set(dimensionValues);
      setSelectedValues(allValues);
      if (selectedDimension) {
        setDimensionSelections(prev => ({
          ...prev,
          [selectedDimension]: dimensionValues
        }));
      }
    }
  }, [dimensionValues, selectedValues, selectedDimension]);

  // Check if all values are selected
  const isAllSelected = useMemo(() => {
    return dimensionValues.length > 0 && dimensionValues.every(value => selectedValues.has(value));
  }, [dimensionValues, selectedValues]);

  // Check if some (but not all) values are selected
  const isSomeSelected = useMemo(() => {
    return selectedValues.size > 0 && !isAllSelected;
  }, [selectedValues.size, isAllSelected]);

  // Handle clicking on a filter item to edit it
  const handleFilterItemClick = useCallback((dimension: string) => {
    // Save current selections before switching (if needed)
    if (selectedDimension && selectedDimension !== dimension && selectedValues.size > 0) {
      setDimensionSelections(prev => ({
        ...prev,
        [selectedDimension]: Array.from(selectedValues)
      }));
    }

    // Switch to the clicked dimension
    setSelectedDimension(dimension);

    if (importedData.length > 0) {
      // Get distinct values for the clicked dimension
      const distinctValues = [...new Set(
        importedData.map(row => String(row[dimension] || ''))
          .filter(value => value !== '')
      )].sort();
      setDimensionValues(distinctValues);

      // Restore the selections for this dimension
      const existingSelections = dimensionSelections[dimension] || [];
      setSelectedValues(new Set(existingSelections));
    }
  }, [importedData, selectedDimension, selectedValues, dimensionSelections]);

  // Calculate optimal width for dimension dropdown
  const dimensionDropdownWidth = useMemo(() => {
    if (columns.length === 0) return 'auto';
    const maxLength = Math.max(...columns.map(col => col.length), 'Select a column...'.length);
    return `${Math.max(maxLength * 8 + 60, 180)}px`; // 8px per character + padding, minimum 180px
  }, [columns]);

  // Calculate optimal width for values dropdown
  const valuesDropdownWidth = useMemo(() => {
    if (dimensionValues.length === 0) return 'auto';
    const maxLength = Math.max(...dimensionValues.map(val => val.length), 'No values found'.length);
    return `${Math.max(maxLength * 8 + 60, 180)}px`; // 8px per character + padding, minimum 180px
  }, [dimensionValues]);

  // Filter imported data based on selected filters
  const filteredData = useMemo(() => {
    if (Object.keys(dimensionSelections).length === 0) {
      return importedData; // No filters applied, return original data
    }

    return importedData.filter(row => {
      // Check if row matches ALL dimension filters
      return Object.entries(dimensionSelections).every(([dimension, selectedValues]) => {
        if (selectedValues.length === 0) return true; // No values selected for this dimension

        const rowValue = String(row[dimension] || '');
        return selectedValues.includes(rowValue);
      });
    });
  }, [importedData, dimensionSelections]);

  // Calculate dynamic container height based on card positions
  const containerHeight = useMemo(() => {
    if (cards.length === 0) return 1200; // Default height when no cards

    const maxCardBottom = Math.max(...cards.map(card =>
      (card.gridPosition.y + card.gridPosition.height) * GRID_SIZE
    ));

    // Add extra padding below the lowest card
    return Math.max(1200, maxCardBottom + 300);
  }, [cards]);

  // Update all chart data when filters change
  useEffect(() => {
    if (cards.length > 0) {
      setCards(prevCards => {
        const updatedCards = prevCards.map(card => ({
          ...card,
          data: filteredData.length > 0 ? filteredData : SAMPLE_DATA
        }));
        return updatedCards;
      });
    }
  }, [filteredData]);

  // Validate chart compatibility when columns or cards change
  useEffect(() => {
    if (columns.length > 0 && cards.length > 0) {
      validateChartCompatibility();
    } else {
      setChartCompatibilityIssues({});
    }
  }, [columns, cards, validateChartCompatibility]);

  const openSaveDialog = useCallback(async () => {
    if (cards.length === 0) {
      console.log('No charts to save');
      return;
    }

    // Load current storage info
    try {
      const info = await getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Error loading storage info:', error);
    }

    // Generate default name based on current date and chart count
    const now = new Date();
    const defaultName = `Dashboard ${now.toLocaleDateString()} - ${cards.length} chart${cards.length !== 1 ? 's' : ''}`;
    setSaveReportName(defaultName);
    setShowSaveDialog(true);
  }, [cards.length, getStorageInfo]);

  // PDF-like tool functions - moved here to be available before handleMouseMove
  const updateTextBox = useCallback((cardId: string, textBoxId: string, updates: Partial<TextBox>) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const updatedTextBoxes = card.textBoxes.map(tb => {
      if (tb.id === textBoxId) {
        let finalUpdates = { ...updates };

        // Apply boundary constraints for scorecard text boxes
        if (textBoxId.startsWith('scorecard-') && updates.position) {
          const cardPixelWidth = card.gridPosition.width * GRID_SIZE;
          const cardPixelHeight = card.gridPosition.height * GRID_SIZE;
          const textBoxWidth = finalUpdates.size?.width || tb.size.width;
          const textBoxHeight = finalUpdates.size?.height || tb.size.height;

          // Constrain position within card boundaries
          const constrainedX = Math.max(0, Math.min(cardPixelWidth - textBoxWidth, updates.position.x));
          const constrainedY = Math.max(0, Math.min(cardPixelHeight - textBoxHeight, updates.position.y));

          finalUpdates.position = {
            x: constrainedX,
            y: constrainedY
          };
        }

        return { ...tb, ...finalUpdates };
      }
      return tb;
    });

    updateCard(cardId, { textBoxes: updatedTextBoxes });
  }, [cards, updateCard]);

  const deleteTextBox = useCallback((cardId: string, textBoxId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const updatedTextBoxes = card.textBoxes.filter(tb => tb.id !== textBoxId);
    updateCard(cardId, { textBoxes: updatedTextBoxes });

    if (selectedElement === textBoxId) {
      setSelectedElement(null);
    }
  }, [cards, updateCard, selectedElement]);

  const updateArrow = useCallback((cardId: string, arrowId: string, updates: Partial<Arrow>) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const updatedArrows = card.arrows.map(arr =>
      arr.id === arrowId ? { ...arr, ...updates } : arr
    );

    updateCard(cardId, { arrows: updatedArrows });
  }, [cards, updateCard]);

  const deleteArrow = useCallback((cardId: string, arrowId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const updatedArrows = card.arrows.filter(arr => arr.id !== arrowId);
    updateCard(cardId, { arrows: updatedArrows });

    if (selectedElement === arrowId) {
      setSelectedElement(null);
    }
  }, [cards, updateCard, selectedElement]);

  const handleArrowHandleMouseDown = (e: React.MouseEvent, arrowId: string, handle: 'start' | 'end' | 'whole') => {
    if (hideControls) return;

    e.preventDefault();
    e.stopPropagation();

    const arrow = cards.flatMap(c => c.arrows).find(arr => arr.id === arrowId);
    if (!arrow) return;

    setDraggedArrow(arrowId);
    setDraggedHandle(handle);

    if (handle === 'whole') {
      // Calculate offset for whole arrow dragging
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;
        setArrowDragOffset({
          x: mouseX - arrow.startPosition.x,
          y: mouseY - arrow.startPosition.y,
        });
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent, cardId: string, action: 'drag' | string) => {
    // Don't allow drag/resize when controls are hidden
    if (hideControls) return;

    e.preventDefault();
    e.stopPropagation();

    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    if (action === 'drag') {
      setDraggedCard(cardId);
      // Calculate offset from mouse to card's top-left corner
      const cardElement = (e.currentTarget as HTMLElement).closest('.absolute') as HTMLElement;
      if (cardElement) {
        const cardRect = cardElement.getBoundingClientRect();
        setDragOffset({
          x: e.clientX - cardRect.left,
          y: e.clientY - cardRect.top,
        });
      }
    } else if (action.startsWith('resize-')) {
      setResizingCard(cardId);
      const direction = action.split('-')[1];
      setResizeDirection(direction); // Extract direction (e.g., 'se', 'n', 'w', etc.)
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (draggedCard) {
      const card = cards.find(c => c.id === draggedCard);
      if (!card) return;

      // Calculate new position based on mouse position minus offset
      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;

      // Convert to grid coordinates
      const gridX = Math.round(newX / GRID_SIZE);
      const gridY = Math.round(newY / GRID_SIZE);

      // Apply minimal constraints - allow movement beyond grid but prevent negative positions
      const constrainedX = Math.max(0, gridX); // Don't restrict right boundary
      const constrainedY = Math.max(0, gridY); // Don't restrict bottom boundary

      // Create temporary card for overlap checking
      const tempCard = {
        ...card,
        gridPosition: {
          ...card.gridPosition,
          x: constrainedX,
          y: constrainedY,
        }
      };

      // Check for overlap, but be more permissive - allow some movement even with slight overlap
      const hasOverlap = checkOverlap(tempCard, card.id);

      // Allow movement if no overlap OR if the movement is away from overlapping cards
      if (!hasOverlap ||
          Math.abs(constrainedX - card.gridPosition.x) <= 1 ||
          Math.abs(constrainedY - card.gridPosition.y) <= 1) {
        updateCard(draggedCard, {
          gridPosition: tempCard.gridPosition
        });
      }
    } else if (resizingCard) {
      const card = cards.find(c => c.id === resizingCard);
      if (!card) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let newX = card.gridPosition.x;
      let newY = card.gridPosition.y;
      let newWidth = card.gridPosition.width;
      let newHeight = card.gridPosition.height;

      // Handle resize based on direction
      if (resizeDirection) {
        const direction = resizeDirection;

        // Handle horizontal resizing
        if (direction.includes('w')) { // West (left edge)
          const newLeft = Math.round(mouseX / GRID_SIZE);
          const rightEdge = card.gridPosition.x + card.gridPosition.width;
          newX = Math.max(0, newLeft);
          newWidth = Math.max(3, rightEdge - newX);
        } else if (direction.includes('e')) { // East (right edge)
          const cardLeft = card.gridPosition.x * GRID_SIZE;
          newWidth = Math.max(3, Math.round((mouseX - cardLeft) / GRID_SIZE));
        }

        // Handle vertical resizing
        if (direction.includes('n')) { // North (top edge)
          const newTop = Math.round(mouseY / GRID_SIZE);
          const bottomEdge = card.gridPosition.y + card.gridPosition.height;
          newY = Math.max(0, newTop);
          newHeight = Math.max(3, bottomEdge - newY);
        } else if (direction.includes('s')) { // South (bottom edge)
          const cardTop = card.gridPosition.y * GRID_SIZE;
          newHeight = Math.max(3, Math.round((mouseY - cardTop) / GRID_SIZE));
        }
      } else {
        // Fallback: assume southeast resize for backward compatibility
        const cardLeft = card.gridPosition.x * GRID_SIZE;
        const cardTop = card.gridPosition.y * GRID_SIZE;
        newWidth = Math.max(3, Math.round((mouseX - cardLeft) / GRID_SIZE));
        newHeight = Math.max(3, Math.round((mouseY - cardTop) / GRID_SIZE));
      }

      // Create temporary card for overlap checking
      const tempCard = {
        ...card,
        gridPosition: {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        }
      };

      // Only update if no overlap
      if (!checkOverlap(tempCard, card.id)) {
        updateCard(resizingCard, {
          gridPosition: tempCard.gridPosition
        });
      }
    } else if (draggedTextBox) {
      // Handle textbox dragging with dashboard-level positioning
      const textBox = cards.flatMap(c => c.textBoxes).find(tb => tb.id === draggedTextBox);
      if (!textBox) return;

      const newX = e.clientX - rect.left - textBoxDragOffset.x;
      const newY = e.clientY - rect.top - textBoxDragOffset.y;

      // Allow movement anywhere on the dashboard (minimal constraints)
      const constrainedX = Math.max(-50, newX); // Allow slight negative for edge cases
      const constrainedY = Math.max(-25, newY); // Allow slight negative for edge cases

      updateTextBox(textBox.cardId, draggedTextBox, {
        position: {
          x: constrainedX,
          y: constrainedY,
        }
      });
    } else if (resizingTextBox) {
      // Handle textbox resizing with dashboard-level positioning
      const textBox = cards.flatMap(c => c.textBoxes).find(tb => tb.id === resizingTextBox);
      if (!textBox) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newWidth = Math.max(50, mouseX - textBox.position.x);
      const newHeight = Math.max(30, mouseY - textBox.position.y);

      updateTextBox(textBox.cardId, resizingTextBox, {
        size: {
          width: newWidth,
          height: newHeight,
        }
      });
    } else if (draggedArrow && draggedHandle) {
      // Handle arrow dragging
      const arrow = cards.flatMap(c => c.arrows).find(arr => arr.id === draggedArrow);
      if (!arrow) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (draggedHandle === 'start') {
        updateArrow(arrow.cardId, draggedArrow, {
          startPosition: { x: mouseX, y: mouseY }
        });
      } else if (draggedHandle === 'end') {
        updateArrow(arrow.cardId, draggedArrow, {
          endPosition: { x: mouseX, y: mouseY }
        });
      } else if (draggedHandle === 'whole') {
        // Move the entire arrow
        const newStartX = mouseX - arrowDragOffset.x;
        const newStartY = mouseY - arrowDragOffset.y;
        const deltaX = newStartX - arrow.startPosition.x;
        const deltaY = newStartY - arrow.startPosition.y;

        updateArrow(arrow.cardId, draggedArrow, {
          startPosition: { x: newStartX, y: newStartY },
          endPosition: {
            x: arrow.endPosition.x + deltaX,
            y: arrow.endPosition.y + deltaY
          }
        });
      }
    }
  }, [draggedCard, resizingCard, dragOffset, draggedTextBox, resizingTextBox, textBoxDragOffset, draggedArrow, draggedHandle, arrowDragOffset, cards, updateCard, checkOverlap, updateTextBox, updateArrow]);

  const handleMouseUp = useCallback(() => {
    setDraggedCard(null);
    setResizingCard(null);
    setResizeDirection(null);
    setDraggedTextBox(null);
    setResizingTextBox(null);
    setDraggedArrow(null);
    setDraggedHandle(null);
    setArrowDragOffset({ x: 0, y: 0 });
  }, []);

  const handleTextBoxMouseDown = (e: React.MouseEvent, textBoxId: string, action: 'drag' | 'resize') => {
    // Don't allow drag/resize when controls are hidden (same as cards)
    if (hideControls) return;

    e.preventDefault();
    e.stopPropagation();

    const textBox = cards.flatMap(c => c.textBoxes).find(tb => tb.id === textBoxId);
    if (!textBox) return;

    if (action === 'drag') {
      setDraggedTextBox(textBoxId);
      // Calculate offset from mouse to textbox's top-left corner for dashboard positioning
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;
        setTextBoxDragOffset({
          x: mouseX - textBox.position.x,
          y: mouseY - textBox.position.y,
        });
      }
    } else {
      setResizingTextBox(textBoxId);
    }
  };

  useEffect(() => {
    if (draggedCard || resizingCard || draggedTextBox || resizingTextBox || draggedArrow) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedCard, resizingCard, draggedTextBox, resizingTextBox, draggedArrow, handleMouseMove, handleMouseUp]);

  // History state calculations
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < cardsHistory.length - 1;

  // Initialize history when first card is added
  useEffect(() => {
    if (cards.length > 0 && cardsHistory.length === 0) {
      setCardsHistory([JSON.parse(JSON.stringify(cards))]);
      setHistoryIndex(0);
    }
  }, [cards.length, cardsHistory.length]);

  // Keyboard shortcuts for undo/redo and escape to preview chart
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape key to preview chart during configuration
      if (event.key === 'Escape' && configuringCard) {
        event.preventDefault();
        showChart(configuringCard);
        return;
      }

      // Undo/Redo shortcuts
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, configuringCard]);

  // Mix bar chart container dimensions tracking
  const updateDimensions = useCallback((cardId: string) => {
    const containerElement = chartContainerRefs.current.get(cardId);
    if (containerElement) {
      const rect = containerElement.getBoundingClientRect();
      const newDimensions = {
        width: Math.max(300, rect.width - 16), // Account for padding
        height: Math.max(200, rect.height - 16) // Account for padding
      };

      setContainerDimensions(prev => {
        const currentDimensions = prev.get(cardId);
        // Only update if dimensions actually changed to prevent unnecessary re-renders
        if (!currentDimensions || currentDimensions.width !== newDimensions.width || currentDimensions.height !== newDimensions.height) {
          const newMap = new Map(prev);
          newMap.set(cardId, newDimensions);
          return newMap;
        }
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    const updateAllDimensions = () => {
      chartContainerRefs.current.forEach((_, cardId) => {
        updateDimensions(cardId);
      });
    };

    updateAllDimensions();
    window.addEventListener('resize', updateAllDimensions);

    // Use ResizeObserver for more accurate container size tracking with debounce
    let resizeTimeout: NodeJS.Timeout;
    const resizeObserver = new ResizeObserver((entries) => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        entries.forEach((entry) => {
          // Find the card ID associated with this element
          chartContainerRefs.current.forEach((element, cardId) => {
            if (element === entry.target) {
              updateDimensions(cardId);
            }
          });
        });
      }, 50); // 50ms debounce
    });

    // Observe all existing containers
    chartContainerRefs.current.forEach((element) => {
      resizeObserver.observe(element);
    });

    // Trigger update after a brief delay to ensure container is fully rendered
    const timer = setTimeout(updateAllDimensions, 100);

    return () => {
      window.removeEventListener('resize', updateAllDimensions);
      resizeObserver.disconnect();
      clearTimeout(timer);
      clearTimeout(resizeTimeout);
    };
  }, [updateDimensions]); // Only re-run when updateDimensions function changes

  // Stacked chart data processing for Mix Bar Charts
  const getStackedChartData = (card: DashboardCard) => {
    const chartData = card.data || [];

    if (!card.dimension || !card.dimension2 || !card.measure) {
      return { chartData: [], allSegments: [] };
    }

    const dataMap = new Map<string, Map<string, number>>();
    const allSegments = new Set<string>();

    // Process data to create stacked structure
    chartData.forEach(row => {
      const primaryDim = String(row[card.dimension] || 'Unknown');
      const secondaryDim = String(row[card.dimension2!] || 'Unknown');
      const measureValue = parseFloat(String(row[card.measure])) || 0;

      allSegments.add(secondaryDim);

      if (!dataMap.has(primaryDim)) {
        dataMap.set(primaryDim, new Map());
      }

      const secondaryMap = dataMap.get(primaryDim)!;
      const currentValue = secondaryMap.get(secondaryDim) || 0;
      secondaryMap.set(secondaryDim, currentValue + measureValue);
    });

    // Convert to chart format
    const processedData = Array.from(dataMap.entries())
      .map(([primaryDim, secondaryMap]) => {
        const item: any = { name: primaryDim };
        let total = 0;

        allSegments.forEach(segment => {
          const value = secondaryMap.get(segment) || 0;
          item[segment] = value;
          item[`${segment}_raw`] = value;
          total += value;
        });

        item.total = total;

        // Calculate percentages if needed
        if (card.yAxisScale === 'percentage' && total > 0) {
          allSegments.forEach(segment => {
            item[`${segment}_percentage`] = ((item[segment] || 0) / total) * 100;
          });
        }

        return item;
      })
      .filter(item => item.total > 0); // Filter out empty bars

    // Apply sorting by total values (descending by default for better visualization)
    processedData.sort((a, b) => b.total - a.total);

    return {
      chartData: processedData,
      allSegments: Array.from(allSegments)
    };
  };

  // Y-axis formatting function
  const formatYAxisValue = (value: number, format: string = 'default', showDecimals: boolean = true): string => {
    if (format === 'K') {
      const scaledValue = value / 1000;
      return showDecimals
        ? scaledValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'K'
        : Math.round(scaledValue).toLocaleString('en-US') + 'K';
    } else if (format === 'M') {
      const scaledValue = value / 1000000;
      return showDecimals
        ? scaledValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'M'
        : Math.round(scaledValue).toLocaleString('en-US') + 'M';
    } else if (format === 'B') {
      const scaledValue = value / 1000000000;
      return showDecimals
        ? scaledValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'B'
        : Math.round(scaledValue).toLocaleString('en-US') + 'B';
    }
    return showDecimals
      ? value.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      : Math.round(value).toLocaleString('en-US');
  };

  // Beautiful custom tooltip component for line charts
  const CustomLineTooltip = ({ active, payload, label, card }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 shadow-xl">
          <div className="text-white font-medium mb-2" style={{ fontSize: '10px' }}>
            {label}
          </div>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-2 h-[2px] rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-white/90" style={{ fontSize: '10px' }}>
                  {entry.name}:
                </span>
                <span className="text-white font-medium" style={{ fontSize: '10px' }}>
                  {typeof entry.value === 'number' ? formatYAxisValue(entry.value, card?.yAxisFormat) : entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderChart = (card: DashboardCard, hideControlsState: boolean = false) => {
    const chartData = card.data || [];

    if (chartData.length === 0) {
      return <div className="text-white/60 text-center">No data available</div>;
    }

    // Validation: scorecard only needs measure, others need both dimension and measure
    if (card.chartType === 'scorecard') {
      if (!card.measure) {
        return (
          <div className="text-white/60 text-center">
            <div className="mb-2">Configure measure to display scorecard</div>
            <button
              onClick={() => setConfiguringCard(card.id)}
              className="text-blue-400 hover:text-blue-300 text-sm underline"
            >
              Open Configuration
            </button>
          </div>
        );
      }
    } else {
      if (!card.dimension || !card.measure) {
        return (
          <div className="text-white/60 text-center">
            <div className="mb-2">Configure chart to display data</div>
            <button
              onClick={() => setConfiguringCard(card.id)}
              className="text-blue-400 hover:text-blue-300 text-sm underline"
            >
              Open Configuration
            </button>
          </div>
        );
      }
    }

    // Check for column compatibility issues
    const cardIssues = chartCompatibilityIssues[card.id];
    if (cardIssues && cardIssues.length > 0) {
      return (
        <div className="text-white/60 text-center p-4">
          <div className="mb-3">
            <div className="text-red-400 font-medium mb-2">⚠️ Chart Configuration Error</div>
            <div className="text-sm mb-2">This chart cannot be rendered with the current dataset version:</div>
            <ul className="text-xs text-left space-y-1 mb-3">
              {cardIssues.map((issue, index) => (
                <li key={index} className="text-red-300">• {issue}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => setConfiguringCard(card.id)}
              className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-1.5 rounded text-sm border border-blue-400/30 mr-2"
            >
              Reconfigure Chart
            </button>
            <button
              onClick={() => setShowVersionDropdown(true)}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1.5 rounded text-sm border border-amber-400/30"
            >
              Switch Version
            </button>
          </div>
        </div>
      );
    }

    // Special validation for mixbar
    if (card.chartType === 'mixbar' && !card.dimension2) {
      return (
        <div className="text-white/60 text-center">
          <div className="mb-2">Mix Bar Chart requires both dimensions</div>
          <button
            onClick={() => setConfiguringCard(card.id)}
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            Configure Second Dimension
          </button>
        </div>
      );
    }

    // Process data based on dimension and measure(s)
    let processedData = chartData.reduce((acc: any[], row) => {
      const dimensionValue = row[card.dimension];
      const measureValue = parseFloat(String(row[card.measure])) || 0;
      const measure2Value = card.measure2 ? (parseFloat(String(row[card.measure2])) || 0) : 0;

      const existing = acc.find(item => item.name === dimensionValue);
      if (existing) {
        existing.value += measureValue;
        if (card.measure2) {
          existing.value2 = (existing.value2 || 0) + measure2Value;
        }
      } else {
        const item: any = { name: dimensionValue, value: measureValue };
        if (card.measure2) {
          item.value2 = measure2Value;
        }
        acc.push(item);
      }

      return acc;
    }, []);

    // Handle merged bars
    if (Object.keys(card.mergedBars || {}).length > 0) {
      const mergedData: any[] = [];
      const processedNames = new Set();

      // Add merged bars
      Object.entries(card.mergedBars || {}).forEach(([mergedName, originalNames]) => {
        const mergedValue = originalNames.reduce((sum, name) => {
          const item = processedData.find(item => item.name === name);
          if (item) {
            processedNames.add(name);
            return sum + item.value;
          }
          return sum;
        }, 0);

        // Calculate merged value for second measure if it exists
        const mergedValue2 = card.measure2 ? originalNames.reduce((sum, name) => {
          const item = processedData.find(item => item.name === name);
          if (item) {
            return sum + (item.value2 || 0);
          }
          return sum;
        }, 0) : 0;

        if (mergedValue > 0) {
          const mergedItem: any = {
            name: card.customNames?.[mergedName] || mergedName,
            value: mergedValue,
            originalName: mergedName,
            isMerged: true
          };

          // Add second measure if it exists
          if (card.measure2) {
            mergedItem.value2 = mergedValue2;
          }

          mergedData.push(mergedItem);
        }
      });

      // Add non-merged bars with custom names if they exist
      processedData.forEach(item => {
        if (!processedNames.has(item.name)) {
          const displayName = card.customNames?.[item.name] || item.name;
          mergedData.push({
            ...item,
            name: displayName,
            originalName: item.name,
            isMerged: false
          });
        }
      });

      processedData = mergedData;
    } else {
      // Apply custom names even when no bars are merged
      processedData = processedData.map(item => ({
        ...item,
        name: card.customNames?.[item.name] || item.name,
        originalName: item.name,
        isMerged: false
      }));
    }

    // Apply sorting for bar charts
    if (card.chartType === 'bar' || card.chartType === 'mixbar') {
      processedData = processedData.sort((a, b) => {
        if (card.sortBy === 'measure') {
          // Sort by measure values
          const comparison = a.value - b.value;
          return card.sortOrder === 'asc' ? comparison : -comparison;
        } else {
          // Sort by dimension (X-axis labels)
          const comparison = String(a.name).localeCompare(String(b.name));
          return card.sortOrder === 'asc' ? comparison : -comparison;
        }
      });
    }

    // Calculate total for percentage calculation
    const totalValue = processedData.reduce((sum, item) => sum + item.value, 0);
    processedData.forEach(item => {
      item.total = totalValue;
    });

    // Process data for line charts with optional series support
    const getLineChartData = (card: DashboardCard) => {
      const chartData = card.data || [];

      if (!card.dimension || !card.measure) {
        return { chartData: [], allSeries: [] };
      }

      if (!card.seriesColumn) {
        // Single series line chart (existing behavior)
        const dataMap = new Map<string, number>();

        chartData.forEach(row => {
          const dimensionValue = String(row[card.dimension] || 'Unknown');
          const measureValue = parseFloat(String(row[card.measure])) || 0;

          const currentValue = dataMap.get(dimensionValue) || 0;
          dataMap.set(dimensionValue, currentValue + measureValue);
        });

        const processedData = Array.from(dataMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => String(a.name).localeCompare(String(b.name)));

        return { chartData: processedData, allSeries: ['value'] };
      } else {
        // Multi-series line chart
        const dataMap = new Map<string, Map<string, number>>();
        const allSeries = new Set<string>();

        chartData.forEach(row => {
          const dimensionValue = String(row[card.dimension] || 'Unknown');
          const seriesValue = String(row[card.seriesColumn!] || 'Unknown');
          const measureValue = parseFloat(String(row[card.measure])) || 0;

          allSeries.add(seriesValue);

          if (!dataMap.has(dimensionValue)) {
            dataMap.set(dimensionValue, new Map());
          }

          const seriesMap = dataMap.get(dimensionValue)!;
          const currentValue = seriesMap.get(seriesValue) || 0;
          seriesMap.set(seriesValue, currentValue + measureValue);
        });

        // Convert to chart format
        const processedData = Array.from(dataMap.entries())
          .map(([dimensionValue, seriesMap]) => {
            const item: any = { name: dimensionValue };

            allSeries.forEach(series => {
              item[series] = seriesMap.get(series) || 0;
            });

            return item;
          })
          .sort((a, b) => String(a.name).localeCompare(String(b.name)));

        return {
          chartData: processedData,
          allSeries: Array.from(allSeries).sort()
        };
      }
    };

    switch (card.chartType) {
      case 'pie':
        // Calculate card dimensions
        const cardWidth = card.gridPosition.width * GRID_SIZE;
        const cardHeight = card.gridPosition.height * GRID_SIZE;
        const availableWidth = cardWidth - 16; // Account for padding
        const availableHeight = cardHeight - 40; // Account for header

        // Safety check for processedData
        if (!processedData || processedData.length === 0) {
          return (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-white/60 text-center">
                <div className="mb-2">No data to display</div>
                <div style={{ fontSize: '10px' }}>Configure chart to show data</div>
              </div>
            </div>
          );
        }

        // Intelligent elastic scaling based on card dimensions
        const dataCount = processedData.length;
        const cardArea = availableWidth * availableHeight;
        const cardDiagonal = Math.sqrt(availableWidth * availableWidth + availableHeight * availableHeight);

        // Elastic sizing thresholds
        const isVerySmallCard = cardArea < 25000; // < 158x158
        const isSmallCard = cardArea < 50000; // < 224x224
        const isMediumCard = cardArea < 100000; // < 316x316
        const isLargeCard = cardArea >= 150000; // >= 387x387

        // Determine if we should show legend at all - more intelligent based on area
        const shouldShowLegend = !isVerySmallCard && dataCount <= 500;

        // Elastic font size calculation based on card diagonal
        const baseFontSize = Math.max(8, Math.min(16, cardDiagonal * 0.02));
        const legendFontSize = Math.round(baseFontSize);
        const labelFontSize = Math.round(baseFontSize * 1.3);

        // Elastic spacing and sizing ratios (moved before legend calculations)
        const legendItemSpacing = Math.max(1, legendFontSize * 0.1); // Reduced from 0.2 to 0.1
        const legendItemPadding = Math.max(2, legendFontSize * 0.3);
        const colorDotSize = Math.max(6, legendFontSize * 0.6);

        // Elastic legend sizing
        let legendWidth = 0;

        if (shouldShowLegend) {
          // Elastic side legend width - scales with font size and card width
          const minLegendWidth = Math.max(60, legendFontSize * 6);
          const maxLegendWidth = Math.min(150, availableWidth * 0.35);
          legendWidth = Math.max(minLegendWidth, Math.min(maxLegendWidth, availableWidth * 0.25));
        }

        // Elastic pie dimensions
        const pieAreaWidth = availableWidth - legendWidth;
        const pieAreaHeight = availableHeight;
        const padding = Math.max(10, Math.min(30, cardDiagonal * 0.04));
        const pieSize = Math.min(pieAreaWidth, pieAreaHeight) - padding;

        // Elastic pie radius with better scaling
        const minRadius = Math.max(20, cardDiagonal * 0.08);
        const maxRadius = Math.min(pieSize / 2, cardDiagonal * 0.25);
        const pieRadius = Math.max(minRadius, maxRadius);

        // Elastic label visibility
        const shouldShowLabels = pieRadius >= (cardDiagonal * 0.12) && !isVerySmallCard;

        return (
          <div className="w-full h-full flex" style={{ fontSize: `${legendFontSize}px` }}>
            {false ? (
              // Bottom legend layout - REMOVED (functionality disabled)
              <div className="flex flex-col w-full h-full">
                <div className="flex-1 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={processedData}
                        cx="50%"
                        cy="50%"
                        outerRadius={pieRadius}
                        innerRadius={pieRadius * 0.3}
                        dataKey="value"
                        animationDuration={600}
                        animationBegin={0}
                        stroke="none"
                        labelLine={false}
                        label={(props) => renderCustomLabel(props, pieRadius, shouldShowLabels, labelFontSize)}
                      >
                        {(processedData || []).map((entry, index) => {
                          const isDragging = draggedBar === `${card.id}-${entry?.name}`;
                          const isDropTarget = draggedOverBar === `${card.id}-${entry?.name}` && draggedBar && draggedBar !== `${card.id}-${entry?.name}`;
                          const segmentColor = CHART_COLORS[index % CHART_COLORS.length];
                          const finalColor = isDropTarget ?
                            `color-mix(in srgb, ${segmentColor} 70%, white 30%)` : segmentColor;

                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={finalColor}
                              style={{
                                opacity: isDragging ? 0.5 : 1,
                                cursor: 'grab',
                                transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                                transformOrigin: 'center'
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const startDrag = () => {
                                  setDraggedBar(`${card.id}-${entry?.name}`);

                                  // Create visual drag preview
                                  const dragPreview = document.createElement('div');
                                  dragPreview.style.cssText = `
                                    position: fixed;
                                    top: -1000px;
                                    left: -1000px;
                                    width: 40px;
                                    height: 40px;
                                    background: ${segmentColor};
                                    border-radius: 50%;
                                    border: 2px solid white;
                                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                                    z-index: 10000;
                                    pointer-events: none;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: white;
                                    font-size: 10px;
                                    font-weight: bold;
                                    transition: all 0.2s ease;
                                  `;
                                  dragPreview.innerHTML = `
                                    <div style="text-align: center; line-height: 1;">
                                      <div>${(entry?.name || '').substring(0, 3)}</div>
                                      <div style="font-size: 8px;">${(entry?.value || 0).toLocaleString()}</div>
                                    </div>
                                  `;
                                  document.body.appendChild(dragPreview);

                                  const handleMouseMove = (moveEvent: MouseEvent) => {
                                    // Update drag preview position to follow cursor
                                    dragPreview.style.left = `${moveEvent.clientX - 20}px`;
                                    dragPreview.style.top = `${moveEvent.clientY - 20}px`;

                                    // Check for drop targets
                                    const hoveredElement = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
                                    const hoveredCell = hoveredElement?.closest('.recharts-pie-sector');

                                    if (hoveredCell) {
                                      const hoveredIndex = Array.from(hoveredCell.parentElement?.children || []).indexOf(hoveredCell);
                                      if (hoveredIndex >= 0 && hoveredIndex < processedData.length) {
                                        const hoveredEntry = processedData[hoveredIndex];
                                        if (hoveredEntry && hoveredEntry.name !== entry?.name) {
                                          setDraggedOverBar(`${card.id}-${hoveredEntry.name}`);
                                          // Enhance drag preview when over valid target
                                          dragPreview.style.transform = 'scale(1.2)';
                                          dragPreview.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
                                          dragPreview.style.border = '2px solid #3B82F6';
                                        } else {
                                          setDraggedOverBar(null);
                                          dragPreview.style.transform = 'scale(1)';
                                          dragPreview.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                                          dragPreview.style.border = '2px solid white';
                                        }
                                      }
                                    } else {
                                      setDraggedOverBar(null);
                                      dragPreview.style.transform = 'scale(1)';
                                      dragPreview.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                                      dragPreview.style.border = '2px solid white';
                                    }
                                  };

                                  const handleMouseUp = (upEvent: MouseEvent) => {
                                    // Remove drag preview
                                    if (document.body.contains(dragPreview)) {
                                      document.body.removeChild(dragPreview);
                                    }

                                    const hoveredElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
                                    const hoveredCell = hoveredElement?.closest('.recharts-pie-sector');

                                    if (hoveredCell) {
                                      const hoveredIndex = Array.from(hoveredCell.parentElement?.children || []).indexOf(hoveredCell);
                                      if (hoveredIndex >= 0 && hoveredIndex < processedData.length) {
                                        const droppedEntry = processedData[hoveredIndex];

                                        if (droppedEntry && droppedEntry.name !== entry?.name) {
                                          const sourceBar = processedData.find(d => d.name === entry?.name);
                                          const targetBar = processedData.find(d => d.name === droppedEntry.name);

                                          let allOriginalNames: string[] = [];

                                          if (sourceBar?.isMerged && sourceBar.originalName) {
                                            const sourceOriginals = card.mergedBars?.[sourceBar.originalName] || [entry?.name];
                                            allOriginalNames.push(...sourceOriginals);
                                          } else {
                                            allOriginalNames.push(entry?.name);
                                          }

                                          if (targetBar?.isMerged && targetBar.originalName) {
                                            const targetOriginals = card.mergedBars?.[targetBar.originalName] || [droppedEntry.name];
                                            allOriginalNames.push(...targetOriginals);
                                          } else {
                                            allOriginalNames.push(droppedEntry.name);
                                          }

                                          allOriginalNames = [...new Set(allOriginalNames)];
                                          const mergedName = `<<${allOriginalNames.join(' + ')}>>`

                                          const newMergedBars = { ...card.mergedBars };
                                          const newCustomNames = { ...card.customNames };

                                          if (sourceBar?.isMerged && sourceBar.originalName) {
                                            delete newMergedBars[sourceBar.originalName];
                                            delete newCustomNames[sourceBar.originalName];
                                          }
                                          if (targetBar?.isMerged && targetBar.originalName) {
                                            delete newMergedBars[targetBar.originalName];
                                            delete newCustomNames[targetBar.originalName];
                                          }

                                          newMergedBars[mergedName] = allOriginalNames;
                                          newCustomNames[mergedName] = mergedName;

                                          updateCard(card.id, {
                                            mergedBars: newMergedBars,
                                            customNames: newCustomNames
                                          });
                                        }
                                      }
                                    }

                                    setDraggedBar(null);
                                    setDraggedOverBar(null);
                                    document.removeEventListener('mousemove', handleMouseMove);
                                    document.removeEventListener('mouseup', handleMouseUp);
                                  };

                                  document.addEventListener('mousemove', handleMouseMove);
                                  document.addEventListener('mouseup', handleMouseUp);
                                };

                                startDrag();
                              }}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div
                  className="flex justify-center items-center flex-wrap px-1"
                  style={{
                    height: `${legendHeight}px`,
                    gap: `${legendItemSpacing}px`
                  }}
                >
                  {processedData.map((entry, index) => {
                    const isDragging = draggedBar === `${card.id}-${entry?.name}`;
                    const isDropTarget = draggedOverBar === `${card.id}-${entry?.name}` && draggedBar && draggedBar !== `${card.id}-${entry?.name}`;

                    return (
                      <div
                        key={entry?.name || `item-${index}`}
                        className={`flex items-center cursor-grab transition-all duration-200 rounded ${
                          isDragging ? 'opacity-50 scale-105' : ''
                        } ${
                          isDropTarget ? 'bg-white/20 brightness-125' : ''
                        }`}
                        style={{
                          gap: `${legendItemSpacing}px`,
                          padding: `${legendItemPadding}px`
                        }}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', JSON.stringify({
                            barName: entry?.name,
                            barValue: entry?.value,
                            cardId: card.id
                          }));
                          setDraggedBar(`${card.id}-${entry?.name}`);
                        }}
                        onDragEnd={() => {
                          setDraggedBar(null);
                          setDraggedOverBar(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDraggedOverBar(`${card.id}-${entry?.name}`);
                        }}
                        onDragLeave={() => {
                          setDraggedOverBar(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDraggedOverBar(null);

                          try {
                            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                            if (dragData.cardId === card.id && dragData.barName !== entry?.name) {
                              const sourceBar = processedData.find(d => d.name === dragData.barName);
                              const targetBar = processedData.find(d => d.name === entry?.name);

                              let allOriginalNames: string[] = [];

                              if (sourceBar?.isMerged && sourceBar.originalName) {
                                const sourceOriginals = card.mergedBars?.[sourceBar.originalName] || [dragData.barName];
                                allOriginalNames.push(...sourceOriginals);
                              } else {
                                allOriginalNames.push(dragData.barName);
                              }

                              if (targetBar?.isMerged && targetBar.originalName) {
                                const targetOriginals = card.mergedBars?.[targetBar.originalName] || [entry?.name];
                                allOriginalNames.push(...targetOriginals);
                              } else {
                                allOriginalNames.push(entry?.name);
                              }

                              allOriginalNames = [...new Set(allOriginalNames)];
                              const mergedName = `<<${allOriginalNames.join(' + ')}>>`

                              const newMergedBars = { ...card.mergedBars };
                              const newCustomNames = { ...card.customNames };

                              if (sourceBar?.isMerged && sourceBar.originalName) {
                                delete newMergedBars[sourceBar.originalName];
                                delete newCustomNames[sourceBar.originalName];
                              }
                              if (targetBar?.isMerged && targetBar.originalName) {
                                delete newMergedBars[targetBar.originalName];
                                delete newCustomNames[targetBar.originalName];
                              }

                              newMergedBars[mergedName] = allOriginalNames;
                              newCustomNames[mergedName] = mergedName;

                              updateCard(card.id, {
                                mergedBars: newMergedBars,
                                customNames: newCustomNames
                              });
                            }
                          } catch (error) {
                            console.error('Error handling drop:', error);
                          }
                        }}
                      >
                        <div
                          className="rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                            width: `${colorDotSize}px`,
                            height: `${colorDotSize}px`
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <EditableLabel
                            value={entry?.name || 'Unknown'}
                            isEditing={editingLabel === `pie-${card.id}-${entry?.name}`}
                            onEdit={(editing: boolean) => {
                              setEditingLabel(editing ? `pie-${card.id}-${entry?.name}` : null);
                            }}
                            onChange={(newValue: string) => {
                              // Find original name for this item
                              const originalName = entry?.originalName || entry?.name;

                              if (originalName) {
                                updateCard(card.id, {
                                  customNames: {
                                    ...card.customNames,
                                    [originalName]: newValue
                                  }
                                });
                              }
                            }}
                            maxWidth={legendFontSize * 6}
                            fontSize={legendFontSize}
                            useTiltedText={false}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : shouldShowLegend ? (
              // Side legend layout (names only) with expandable functionality
              (() => {
                const isExpanded = expandedLegend === card.id;
                // Sort processedData by value in descending order for legend display
                const sortedData = [...processedData].sort((a, b) => (b.value || 0) - (a.value || 0));

                // Calculate how many items can fit in available height - more conservative
                const itemHeight = legendFontSize * 1.4 + legendItemPadding * 2 + legendItemSpacing * 2; // More realistic spacing
                const containerPadding = 20; // Account for container padding and potential button space
                const availableLegendHeight = availableHeight - containerPadding;
                const maxVisibleItems = Math.max(1, Math.floor(availableLegendHeight / itemHeight) - 1); // Reserve space for button

                const visibleItemCount = isExpanded ? sortedData.length : Math.min(sortedData.length, maxVisibleItems);
                const remainingCount = sortedData.length - visibleItemCount;

                return (
                  <div className="flex w-full h-full">
                    {/* Pie Chart Container */}
                    <div className={`flex items-center justify-center transition-all duration-300 ${
                      isExpanded ? 'w-2/5 min-w-0' : 'flex-1'
                    }`}>
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={processedData}
                              cx="50%"
                              cy="50%"
                              outerRadius={pieRadius}
                              innerRadius={pieRadius * 0.4}
                              dataKey="value"
                              animationDuration={600}
                              animationBegin={0}
                              stroke="none"
                              labelLine={false}
                              label={(props) => renderCustomLabel(props, pieRadius, shouldShowLabels, labelFontSize)}
                            >
                              {(processedData || []).map((entry, index) => {
                                const isDragging = draggedBar === `${card.id}-${entry?.name}`;
                                const isDropTarget = draggedOverBar === `${card.id}-${entry?.name}` && draggedBar && draggedBar !== `${card.id}-${entry?.name}`;
                                const segmentColor = CHART_COLORS[index % CHART_COLORS.length];
                                const finalColor = isDropTarget ?
                                  `color-mix(in srgb, ${segmentColor} 70%, white 30%)` : segmentColor;

                                return (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={finalColor}
                                    style={{
                                      opacity: isDragging ? 0.5 : 1,
                                      cursor: 'grab',
                                      transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                                      transformOrigin: 'center'
                                    }}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      const startDrag = () => {
                                        setDraggedBar(`${card.id}-${entry?.name}`);

                                        // Create visual drag preview
                                        const dragPreview = document.createElement('div');
                                        dragPreview.style.cssText = `
                                          position: fixed;
                                          top: -1000px;
                                          left: -1000px;
                                          width: 40px;
                                          height: 40px;
                                          background: ${segmentColor};
                                          border-radius: 50%;
                                          border: 2px solid white;
                                          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                                          z-index: 10000;
                                          pointer-events: none;
                                          display: flex;
                                          align-items: center;
                                          justify-content: center;
                                          color: white;
                                          font-size: 10px;
                                          font-weight: bold;
                                          transition: all 0.2s ease;
                                        `;
                                        dragPreview.innerHTML = `
                                          <div style="text-align: center; line-height: 1;">
                                            <div>${(entry?.name || '').substring(0, 3)}</div>
                                            <div style="font-size: 8px;">${(entry?.value || 0).toLocaleString()}</div>
                                          </div>
                                        `;
                                        document.body.appendChild(dragPreview);

                                        const handleMouseMove = (moveEvent: MouseEvent) => {
                                          dragPreview.style.left = `${moveEvent.clientX - 20}px`;
                                          dragPreview.style.top = `${moveEvent.clientY - 20}px`;

                                          const hoveredElement = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
                                          const hoveredCell = hoveredElement?.closest('.recharts-pie-sector');

                                          if (hoveredCell) {
                                            const hoveredIndex = Array.from(hoveredCell.parentElement?.children || []).indexOf(hoveredCell);
                                            if (hoveredIndex >= 0 && hoveredIndex < processedData.length) {
                                              const hoveredEntry = processedData[hoveredIndex];
                                              if (hoveredEntry && hoveredEntry.name !== entry?.name) {
                                                setDraggedOverBar(`${card.id}-${hoveredEntry.name}`);
                                                dragPreview.style.transform = 'scale(1.2)';
                                                dragPreview.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
                                                dragPreview.style.border = '2px solid #3B82F6';
                                              } else {
                                                setDraggedOverBar(null);
                                                dragPreview.style.transform = 'scale(1)';
                                                dragPreview.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                                                dragPreview.style.border = '2px solid white';
                                              }
                                            }
                                          } else {
                                            setDraggedOverBar(null);
                                            dragPreview.style.transform = 'scale(1)';
                                            dragPreview.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                                            dragPreview.style.border = '2px solid white';
                                          }
                                        };

                                        const handleMouseUp = (upEvent: MouseEvent) => {
                                          if (document.body.contains(dragPreview)) {
                                            document.body.removeChild(dragPreview);
                                          }

                                          const hoveredElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
                                          const hoveredCell = hoveredElement?.closest('.recharts-pie-sector');

                                          if (hoveredCell) {
                                            const hoveredIndex = Array.from(hoveredCell.parentElement?.children || []).indexOf(hoveredCell);
                                            if (hoveredIndex >= 0 && hoveredIndex < processedData.length) {
                                              const droppedEntry = processedData[hoveredIndex];

                                              if (droppedEntry && droppedEntry.name !== entry?.name) {
                                                const sourceBar = processedData.find(d => d.name === entry?.name);
                                                const targetBar = processedData.find(d => d.name === droppedEntry.name);

                                                let allOriginalNames: string[] = [];

                                                if (sourceBar?.isMerged && sourceBar.originalName) {
                                                  const sourceOriginals = card.mergedBars?.[sourceBar.originalName] || [entry?.name];
                                                  allOriginalNames.push(...sourceOriginals);
                                                } else {
                                                  allOriginalNames.push(entry?.name);
                                                }

                                                if (targetBar?.isMerged && targetBar.originalName) {
                                                  const targetOriginals = card.mergedBars?.[targetBar.originalName] || [droppedEntry.name];
                                                  allOriginalNames.push(...targetOriginals);
                                                } else {
                                                  allOriginalNames.push(droppedEntry.name);
                                                }

                                                allOriginalNames = [...new Set(allOriginalNames)];
                                                const mergedName = `<<${allOriginalNames.join(' + ')}>>`

                                                const newMergedBars = { ...card.mergedBars };
                                                const newCustomNames = { ...card.customNames };

                                                if (sourceBar?.isMerged && sourceBar.originalName) {
                                                  delete newMergedBars[sourceBar.originalName];
                                                  delete newCustomNames[sourceBar.originalName];
                                                }
                                                if (targetBar?.isMerged && targetBar.originalName) {
                                                  delete newMergedBars[targetBar.originalName];
                                                  delete newCustomNames[targetBar.originalName];
                                                }

                                                newMergedBars[mergedName] = allOriginalNames;
                                                newCustomNames[mergedName] = mergedName;

                                                updateCard(card.id, {
                                                  mergedBars: newMergedBars,
                                                  customNames: newCustomNames
                                                });
                                              }
                                            }
                                          }

                                          setDraggedBar(null);
                                          setDraggedOverBar(null);
                                          document.removeEventListener('mousemove', handleMouseMove);
                                          document.removeEventListener('mouseup', handleMouseUp);
                                        };

                                        document.addEventListener('mousemove', handleMouseMove);
                                        document.addEventListener('mouseup', handleMouseUp);
                                      };

                                      startDrag();
                                    }}
                                  />
                                );
                              })}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend Container */}
                    <div
                      className={`flex flex-col transition-all duration-300 ${
                        isExpanded ? 'w-3/5 h-full border-l border-white/10' : ''
                      }`}
                      style={{
                        width: isExpanded ? '60%' : `${legendWidth}px`,
                        height: isExpanded ? '100%' : 'auto'
                      }}
                    >
                      {/* Header with close button when expanded */}
                      {isExpanded && (
                        <div className="flex justify-between items-center p-2 border-b border-white/10">
                          <span
                            className="text-white/90 font-medium"
                            style={{ fontSize: `${legendFontSize}px` }}
                          >
                            All Items ({sortedData.length}) - Sorted by Value
                          </span>
                          <button
                            onClick={() => setExpandedLegend(null)}
                            className="text-white/60 hover:text-white/90 transition-colors p-1"
                            style={{ fontSize: `${legendFontSize * 1.2}px` }}
                          >
                            ����
                          </button>
                        </div>
                      )}

                      {/* Scrollable items container */}
                      <div
                        className={`flex flex-col px-1 py-1 ${
                          isExpanded ? 'flex-1 overflow-y-auto' : 'justify-start overflow-hidden'
                        }`}
                        style={{
                          gap: `${legendItemSpacing}px`,
                          maxHeight: isExpanded ? 'none' : 'auto',
                          paddingTop: isExpanded ? '0px' : `${Math.max(0, (availableHeight - (visibleItemCount * itemHeight)) / 2)}px`
                        }}
                      >
                        {sortedData.slice(0, visibleItemCount).map((entry, index) => {
                          const isDragging = draggedBar === `${card.id}-${entry?.name}`;
                          const isDropTarget = draggedOverBar === `${card.id}-${entry?.name}` && draggedBar && draggedBar !== `${card.id}-${entry?.name}`;

                          return (
                            <div
                              key={entry?.name || `item-${index}`}
                              className={`flex items-center min-w-0 cursor-grab transition-all duration-200 rounded ${
                                isDragging ? 'opacity-50 scale-105' : ''
                              } ${
                                isDropTarget ? 'bg-white/20 brightness-125' : ''
                              }`}
                              style={{
                                gap: `${legendItemSpacing}px`,
                                padding: `${legendItemPadding}px`
                              }}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', JSON.stringify({
                                  barName: entry?.name,
                                  barValue: entry?.value,
                                  cardId: card.id
                                }));
                                setDraggedBar(`${card.id}-${entry?.name}`);
                              }}
                              onDragEnd={() => {
                                setDraggedBar(null);
                                setDraggedOverBar(null);
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDraggedOverBar(`${card.id}-${entry?.name}`);
                              }}
                              onDragLeave={() => {
                                setDraggedOverBar(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDraggedOverBar(null);

                                try {
                                  const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                                  if (dragData.cardId === card.id && dragData.barName !== entry?.name) {
                                    const sourceBar = processedData.find(d => d.name === dragData.barName);
                                    const targetBar = processedData.find(d => d.name === entry?.name);

                                    let allOriginalNames: string[] = [];

                                    if (sourceBar?.isMerged && sourceBar.originalName) {
                                      const sourceOriginals = card.mergedBars?.[sourceBar.originalName] || [dragData.barName];
                                      allOriginalNames.push(...sourceOriginals);
                                    } else {
                                      allOriginalNames.push(dragData.barName);
                                    }

                                    if (targetBar?.isMerged && targetBar.originalName) {
                                      const targetOriginals = card.mergedBars?.[targetBar.originalName] || [entry?.name];
                                      allOriginalNames.push(...targetOriginals);
                                    } else {
                                      allOriginalNames.push(entry?.name);
                                    }

                                    allOriginalNames = [...new Set(allOriginalNames)];
                                    const mergedName = `<<${allOriginalNames.join(' + ')}>>`

                                    const newMergedBars = { ...card.mergedBars };
                                    const newCustomNames = { ...card.customNames };

                                    if (sourceBar?.isMerged && sourceBar.originalName) {
                                      delete newMergedBars[sourceBar.originalName];
                                      delete newCustomNames[sourceBar.originalName];
                                    }
                                    if (targetBar?.isMerged && targetBar.originalName) {
                                      delete newMergedBars[targetBar.originalName];
                                      delete newCustomNames[targetBar.originalName];
                                    }

                                    newMergedBars[mergedName] = allOriginalNames;
                                    newCustomNames[mergedName] = mergedName;

                                    updateCard(card.id, {
                                      mergedBars: newMergedBars,
                                      customNames: newCustomNames
                                    });
                                  }
                                } catch (error) {
                                  console.error('Error handling drop:', error);
                                }
                              }}
                            >
                              <div
                                className="rounded-sm flex-shrink-0"
                                style={{
                                  backgroundColor: CHART_COLORS[processedData.findIndex(item => item.name === entry.name) % CHART_COLORS.length],
                                  width: `${colorDotSize}px`,
                                  height: `${colorDotSize}px`
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <EditableLabel
                                  value={entry?.name || 'Unknown'}
                                  isEditing={editingLabel === `pie-${card.id}-${entry?.name}`}
                                  onEdit={(editing: boolean) => {
                                    setEditingLabel(editing ? `pie-${card.id}-${entry?.name}` : null);
                                  }}
                                  onChange={(newValue: string) => {
                                    // Find original name for this item
                                    const originalName = entry?.originalName || entry?.name;

                                    if (originalName) {
                                      updateCard(card.id, {
                                        customNames: {
                                          ...card.customNames,
                                          [originalName]: newValue
                                        }
                                      });
                                    }
                                  }}
                                  maxWidth={isExpanded ? 200 : legendWidth - 30}
                                  fontSize={legendFontSize}
                                  useTiltedText={false}
                                />
                              </div>
                              {isExpanded && (
                                <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                                  <span
                                    className="text-white/60"
                                    style={{
                                      fontSize: `${Math.max(8, legendFontSize * 0.8)}px`
                                    }}
                                  >
                                    {(entry?.value || 0).toLocaleString()}
                                  </span>
                                  <span
                                    className="text-white/40"
                                    style={{
                                      fontSize: `${Math.max(7, legendFontSize * 0.7)}px`
                                    }}
                                  >
                                    {((entry?.value || 0) / processedData.reduce((sum, item) => sum + (item.value || 0), 0) * 100).toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Show more button when not expanded and many items remaining */}
                        {!isExpanded && remainingCount > 3 && (
                          <button
                            onClick={() => setExpandedLegend(card.id)}
                            className="text-white/60 hover:text-white/90 text-center transition-colors duration-200 p-1 rounded"
                            style={{
                              fontSize: `${Math.max(8, legendFontSize * 0.8)}px`,
                              marginTop: `${legendItemSpacing}px`
                            }}
                          >
                            +{remainingCount} more
                          </button>
                        )}

                        {/* Expand button - always available to access detailed view */}
                        {!isExpanded && remainingCount <= 3 && (
                          <button
                            onClick={() => setExpandedLegend(card.id)}
                            className="text-white/60 hover:text-white/90 transition-colors duration-200 text-center"
                            style={{
                              fontSize: `${Math.max(10, legendFontSize * 0.7)}px`,
                              marginTop: `${legendItemSpacing}px`,
                              border: 'none',
                              background: 'none',
                              padding: '2px 4px',
                              width: 'auto',
                              height: 'auto'
                            }}
                            title="Expand legend"
                          >
                            &gt;
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              // No legend - pie only for small cards
              <div className="w-full h-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={processedData}
                      cx="50%"
                      cy="50%"
                      outerRadius={pieRadius}
                      innerRadius={pieRadius * 0.3}
                      dataKey="value"
                      animationDuration={600}
                      animationBegin={0}
                      stroke="none"
                      labelLine={false}
                      label={(props) => renderCustomLabel(props, pieRadius, shouldShowLabels, labelFontSize)}
                    >
                      {(processedData || []).map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      case 'bar':
        // Column Chart with optional second measure support
        const hasSecondMeasure = card.measure2 && card.measure2.trim() !== '';
        const computedMax = hasSecondMeasure
          ? Math.max(...processedData.flatMap(d => [d.value, d.value2 || 0]))
          : Math.max(...processedData.map(d => d.value));
        const maxValue = Number.isFinite(computedMax) && computedMax > 0 ? computedMax : 1;
        const chartWidth = card.gridPosition.width * GRID_SIZE - 32; // Account for padding
        const chartHeight = card.gridPosition.height * GRID_SIZE - 100; // Extra space for tilted labels
        const count = processedData.length;
        const barWidth = Math.max(20, count > 0 ? (chartWidth - 40) / count - 10 : 20);
        const barSpacing = count > 1 ? (chartWidth - 40 - (barWidth * count)) / (count - 1) : 0;

        // Responsive legend sizing (similar to mixbar chart)
        const isColumnVeryCompact = card.gridPosition.width <= 2 || card.gridPosition.height <= 2;
        const isColumnCompact = card.gridPosition.width <= 3 || card.gridPosition.height <= 3;
        const columnLegendFontSize = isColumnVeryCompact ? 10 : (isColumnCompact ? 11 : 12);

        // For 2-measure charts, adjust bar widths and spacing
        const singleBarWidth = hasSecondMeasure ? Math.max(8, barWidth * 0.4) : barWidth;
        const columnGap = hasSecondMeasure ? 2 : 0;

        // Check if ANY label exceeds bar width - if so, tilt ALL labels uniformly
        const avgCharWidth = 6;
        // Always use straight labels with multi-line support
        const shouldTiltAllLabels = false;

        return (
          <div className="w-full h-full relative">
            {/* Custom Bar Chart with Drag & Drop */}
            <div className="flex flex-col h-full">
              <div className="flex-1 relative" style={{ height: '80%' }}>
                <div className="flex items-end justify-center h-full px-4 pt-4 relative">
                  {/* X-axis line positioned at true baseline (Y=0) */}
                  <div
                    className="absolute bottom-10 left-4 right-4 border-b border-white/30"
                    style={{ height: '1px' }}
                  />

                  {processedData.map((item, index) => {
                    const barHeight = Math.max(10, (item.value / maxValue) * (chartHeight - 40));
                    const isDragging = draggedBar === `${card.id}-${item.name}`;
                    const isDropTarget = draggedOverBar === `${card.id}-${item.name}`;

                    return (
                      <div
                        key={item.name}
                        className="flex flex-col items-center relative"
                        style={{
                          width: Math.max(0, barWidth + barSpacing),
                          marginRight: index < processedData.length - 1 ? 0 : 0,
                          marginBottom: '40px' // Space for labels below X-axis
                        }}
                      >
                        {/* Axis tick mark at baseline */}
                        <div
                          className="absolute bottom-0 border-l border-white/30"
                          style={{
                            height: '6px',
                            left: `${Math.max(0, (barWidth + barSpacing) / 2)}px`,
                            transform: 'translateX(-50%)'
                          }}
                        />
                        {/* Bars Container */}
                        <div className="flex items-end" style={{ gap: `${columnGap}px` }}>
                          {/* First Measure Bar */}
                          <div
                            className="relative bg-blue-500 rounded-t transition-all duration-200"
                            style={{
                              width: singleBarWidth,
                              height: barHeight,
                              marginBottom: 0
                            }}
                            title={`${item.name} (${card.measure}): ${formatYAxisValue(item.value, card.yAxisFormat, false)}`}
                          >
                            {/* Value Label on Bar */}
                            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-white font-medium" style={{ fontSize: '10px' }}>
                              {formatYAxisValue(item.value, card.yAxisFormat, false)}
                            </div>
                          </div>

                          {/* Second Measure Bar (only if measure2 is configured) */}
                          {hasSecondMeasure && (
                            <div
                              className={`relative bg-orange-500 rounded-t cursor-grab transition-all duration-200 ${
                                isDragging ? 'opacity-50 scale-105' : ''
                              } ${
                                isDropTarget ? 'ring-2 ring-orange-400 brightness-125' : ''
                              }`}
                              style={{
                                width: singleBarWidth,
                                height: Math.max(10, ((item.value2 || 0) / maxValue) * (chartHeight - 40)),
                                marginBottom: 0
                              }}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', JSON.stringify({
                                  barName: item.name,
                                  barValue: item.value2,
                                  cardId: card.id
                                }));
                                setDraggedBar(`${card.id}-${item.name}`);
                              }}
                              onDragEnd={() => {
                                setDraggedBar(null);
                                setDraggedOverBar(null);
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDraggedOverBar(`${card.id}-${item.name}`);
                              }}
                              onDragLeave={() => {
                                setDraggedOverBar(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDraggedOverBar(null);

                                try {
                                  const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                                  if (dragData.cardId === card.id && dragData.barName !== item.name) {
                                    // Handle merging logic for second measure (same as first)
                                    const sourceBar = processedData.find(d => d.name === dragData.barName);
                                    const targetBar = processedData.find(d => d.name === item.name);

                                    let allOriginalNames: string[] = [];

                                    if (sourceBar?.isMerged && sourceBar.originalName) {
                                      const sourceOriginals = card.mergedBars?.[sourceBar.originalName] || [dragData.barName];
                                      allOriginalNames.push(...sourceOriginals);
                                    } else {
                                      allOriginalNames.push(dragData.barName);
                                    }

                                    if (targetBar?.isMerged && targetBar.originalName) {
                                      const targetOriginals = card.mergedBars?.[targetBar.originalName] || [item.name];
                                      allOriginalNames.push(...targetOriginals);
                                    } else {
                                      allOriginalNames.push(item.name);
                                    }

                                    allOriginalNames = [...new Set(allOriginalNames)];
                                    const mergedName = `<<${allOriginalNames.join(' + ')}>>`;

                                    const newMergedBars = { ...card.mergedBars };
                                    const newCustomNames = { ...card.customNames };

                                    if (sourceBar?.isMerged && sourceBar.originalName) {
                                      delete newMergedBars[sourceBar.originalName];
                                      delete newCustomNames[sourceBar.originalName];
                                    }
                                    if (targetBar?.isMerged && targetBar.originalName) {
                                      delete newMergedBars[targetBar.originalName];
                                      delete newCustomNames[targetBar.originalName];
                                    }

                                    newMergedBars[mergedName] = allOriginalNames;
                                    newCustomNames[mergedName] = mergedName;

                                    updateCard(card.id, {
                                      mergedBars: newMergedBars,
                                      customNames: newCustomNames
                                    });
                                  }
                                } catch (error) {
                                  console.error('Error parsing drag data:', error);
                                }
                              }}
                              title={`${item.name} (${card.measure2}): ${(item.value2 || 0).toLocaleString()}`}
                            >
                              {/* Value Label on Second Bar */}
                              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-white font-medium" style={{ fontSize: '10px' }}>
                                {formatYAxisValue(item.value2 || 0, card.yAxisFormat, false)}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* X-axis Label positioned below the baseline - Now Draggable */}
                        <div
                          className={`absolute flex items-start justify-center cursor-grab transition-all duration-200 ${
                            draggedBar === `${card.id}-${item.name}` ? 'opacity-50 scale-105' : ''
                          } ${
                            draggedOverBar === `${card.id}-${item.name}` ? 'bg-blue-500/20 rounded' : ''
                          }`}
                          style={{
                            left: hasSecondMeasure ? `${singleBarWidth + columnGap / 2}px` : `${(barWidth + barSpacing) / 2}px`,
                            transform: 'translateX(-50%)',
                            width: `${barWidth}px`,
                            height: '40px',
                            bottom: '-40px', // Position below the X-axis
                            paddingTop: '8px'
                          }}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              barName: item.name,
                              originalName: item.originalName || item.name,
                              isMerged: item.isMerged,
                              cardId: card.id
                            }));
                            setDraggedBar(`${card.id}-${item.name}`);

                            // Create custom drag preview
                            const dragImage = document.createElement('div');
                            dragImage.style.cssText = `
                              position: absolute;
                              top: -1000px;
                              left: -1000px;
                              background: rgba(59, 130, 246, 0.9);
                              color: white;
                              padding: 6px 12px;
                              border-radius: 8px;
                              font-size: 12px;
                              font-weight: 500;
                              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                              border: 1px solid rgba(255,255,255,0.2);
                              white-space: nowrap;
                            `;
                            dragImage.textContent = item.name;
                            document.body.appendChild(dragImage);
                            e.dataTransfer.setDragImage(dragImage, 0, 0);

                            setTimeout(() => {
                              if (document.body.contains(dragImage)) {
                                document.body.removeChild(dragImage);
                              }
                            }, 100);
                          }}
                          onDragEnd={() => {
                            setDraggedBar(null);
                            setDraggedOverBar(null);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (draggedBar && draggedBar !== `${card.id}-${item.name}`) {
                              setDraggedOverBar(`${card.id}-${item.name}`);
                            }
                          }}
                          onDragLeave={(e) => {
                            // Only clear if actually leaving the element
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX;
                            const y = e.clientY;
                            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                              setDraggedOverBar(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDraggedOverBar(null);

                            try {
                              const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                              if (dragData.cardId === card.id && dragData.barName !== item.name) {
                                // Find source and target bars
                                const sourceBar = processedData.find(d => d.name === dragData.barName);
                                const targetBar = processedData.find(d => d.name === item.name);

                                if (sourceBar && targetBar) {
                                  // Collect all original bar names
                                  let allOriginalNames: string[] = [];

                                  // Get source original names
                                  if (sourceBar.isMerged && sourceBar.originalName) {
                                    const sourceOriginals = card.mergedBars?.[sourceBar.originalName] || [dragData.originalName];
                                    allOriginalNames.push(...sourceOriginals);
                                  } else {
                                    allOriginalNames.push(dragData.originalName || dragData.barName);
                                  }

                                  // Get target original names
                                  if (targetBar.isMerged && targetBar.originalName) {
                                    const targetOriginals = card.mergedBars?.[targetBar.originalName] || [item.originalName || item.name];
                                    allOriginalNames.push(...targetOriginals);
                                  } else {
                                    allOriginalNames.push(item.originalName || item.name);
                                  }

                                  // Remove duplicates and create merged name
                                  allOriginalNames = [...new Set(allOriginalNames)];
                                  const mergedName = `<<${allOriginalNames.join(' + ')}>>`;

                                  // Update merged bars
                                  const newMergedBars = { ...card.mergedBars };
                                  const newCustomNames = { ...card.customNames };

                                  // Remove old merge entries
                                  if (sourceBar.isMerged && sourceBar.originalName) {
                                    delete newMergedBars[sourceBar.originalName];
                                    delete newCustomNames[sourceBar.originalName];
                                  }
                                  if (targetBar.isMerged && targetBar.originalName) {
                                    delete newMergedBars[targetBar.originalName];
                                    delete newCustomNames[targetBar.originalName];
                                  }

                                  // Add new merged entry
                                  newMergedBars[mergedName] = allOriginalNames;
                                  newCustomNames[mergedName] = mergedName;

                                  updateCard(card.id, {
                                    mergedBars: newMergedBars,
                                    customNames: newCustomNames
                                  });
                                }
                              }
                            } catch (error) {
                              console.error('Error handling drop:', error);
                            }
                          }}
                          onDoubleClick={() => {
                            setEditingLabel(item.name);
                          }}
                        >
                          {editingLabel === item.name ? (
                            <input
                              type="text"
                              defaultValue={item.name}
                              className="w-full bg-white/10 border border-blue-400 rounded px-1 text-white text-center text-xs"
                              style={{ fontSize: '10px' }}
                              autoFocus
                              onBlur={(e) => {
                                const newValue = e.target.value;
                                if (item?.isMerged && item.originalName) {
                                  updateCard(card.id, {
                                    customNames: {
                                      ...card.customNames,
                                      [item.originalName]: newValue
                                    }
                                  });
                                } else {
                                  updateCard(card.id, {
                                    customNames: {
                                      ...card.customNames,
                                      [item.name]: newValue
                                    }
                                  });
                                }
                                setEditingLabel(null);
                              }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                          ) : (
                            <div className="break-words text-center text-white" style={{ fontSize: '10px', lineHeight: '1.2' }}>
                              {item.name}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Comprehensive Legend positioned below X-axis labels (matching Stacked Column Chart) */}
              <div
                className="absolute flex items-center justify-center flex-wrap"
                style={{
                  fontSize: `${Math.max(8, columnLegendFontSize * 0.85)}px`, // Smaller font size
                  bottom: `${isColumnVeryCompact ? -8 : -6}px`, // Position lower, outside container if needed
                  left: '50%',
                  transform: 'translateX(-50%)', // Center horizontally
                  gap: isColumnVeryCompact ? '6px' : '8px', // Comfortable spacing for readability
                  width: `${chartWidth - 32}px`, // Use chart width minus padding
                  maxHeight: `${(columnLegendFontSize + 8) * 2}px`, // Allow for 2 lines max
                  overflow: 'visible',
                  zIndex: 10 // Ensure legend appears above other elements
                }}
              >
                {/* First measure legend item */}
                <div className="flex items-center" style={{ gap: '3px' }}>
                  <div
                    style={{
                      width: `${isColumnVeryCompact ? 8 : (isColumnCompact ? 10 : 11)}px`,
                      height: `${isColumnVeryCompact ? 6 : (isColumnCompact ? 8 : 9)}px`,
                      backgroundColor: '#3B82F6', // blue-500
                      flexShrink: 0,
                      borderRadius: '2px'
                    }}
                  />
                  <span
                    className="whitespace-nowrap"
                    style={{
                      fontSize: `${Math.max(8, columnLegendFontSize * 0.75)}px`, // Smaller readable size
                      fontWeight: '400',
                      color: 'rgba(255,255,255,0.7)'
                    }}
                  >
                    {card.measure}
                  </span>
                </div>

                {/* Second measure legend item (if exists) */}
                {hasSecondMeasure && (
                  <div className="flex items-center" style={{ gap: '3px' }}>
                    <div
                      style={{
                        width: `${isColumnVeryCompact ? 8 : (isColumnCompact ? 10 : 11)}px`,
                        height: `${isColumnVeryCompact ? 6 : (isColumnCompact ? 8 : 9)}px`,
                        backgroundColor: '#F97316', // orange-500
                        flexShrink: 0,
                        borderRadius: '2px'
                      }}
                    />
                    <span
                      className="whitespace-nowrap"
                      style={{
                        fontSize: `${Math.max(8, columnLegendFontSize * 0.75)}px`, // Smaller readable size
                        fontWeight: '400',
                        color: 'rgba(255,255,255,0.7)'
                      }}
                    >
                      {card.measure2}
                    </span>
                  </div>
                )}
              </div>

              {/* Y-axis and Grid Lines - Hidden */}
              <div className="absolute left-0 top-4 bottom-20 w-8 flex flex-col justify-between text-white/70 opacity-0 pointer-events-none" style={{ fontSize: '10px' }}>
                <span>{maxValue.toLocaleString()}</span>
                <span>{(maxValue * 0.5).toLocaleString()}</span>
                <span>0</span>
              </div>
            </div>
          </div>
        );
      case 'mixbar':
        // Mix Bar Chart with stacked segments using Recharts
        let { chartData: stackedData, allSegments } = getStackedChartData(card);

        if (stackedData.length === 0) {
          return (
            <div className="text-white/60 text-center">
              <div className="mb-2">No data available for Mix Bar Chart</div>
              <div style={{ fontSize: '10px' }}>Check your dimension and measure selections</div>
            </div>
          );
        }

        // Handle merged bars for mix chart
        if (Object.keys(card.mergedBars || {}).length > 0) {
          const mergedData: any[] = [];
          const processedNames = new Set();

          // Add merged bars
          Object.entries(card.mergedBars || {}).forEach(([mergedName, originalNames]) => {
            const mergedItem: any = {
              name: card.customNames?.[mergedName] || mergedName,
              originalName: mergedName,
              isMerged: true,
              total: 0
            };

            // Initialize all segments to 0
            allSegments.forEach(segment => {
              mergedItem[segment] = 0;
              mergedItem[`${segment}_percentage`] = 0;
            });

            // Sum up values from original bars
            originalNames.forEach(originalName => {
              const originalItem = stackedData.find(item => item.name === originalName);
              if (originalItem) {
                mergedItem.total += originalItem.total;
                allSegments.forEach(segment => {
                  mergedItem[segment] += originalItem[segment] || 0;
                });
                processedNames.add(originalName);
              }
            });

            // Recalculate percentages for merged item
            if (mergedItem.total > 0) {
              allSegments.forEach(segment => {
                mergedItem[`${segment}_percentage`] = (mergedItem[segment] / mergedItem.total) * 100;
              });
            }

            if (mergedItem.total > 0) {
              mergedData.push(mergedItem);
            }
          });

          // Add non-merged bars
          stackedData.forEach(item => {
            if (!processedNames.has(item.name)) {
              const displayName = card.customNames?.[item.name] || item.name;
              mergedData.push({
                ...item,
                name: displayName,
                originalName: item.name,
                isMerged: false
              });
            }
          });

          // Sort merged data by total values (descending) to maintain consistent order
          stackedData = mergedData.sort((a, b) => b.total - a.total);
        } else {
          // Apply custom names even when no bars are merged and maintain sort order
          stackedData = stackedData.map(item => ({
            ...item,
            name: card.customNames?.[item.name] || item.name,
            originalName: item.name,
            isMerged: false
          })).sort((a, b) => b.total - a.total);
        }

        // Add display field for totals
        stackedData = stackedData.map(item => ({
          ...item,
          __totalDisplay: item.total
        }));

        const maxStackedValue = card.yAxisScale === 'percentage'
          ? 100
          : Math.max(...stackedData.map(d => d.total));

        // Custom SVG Mix Bar Chart Implementation - Intelligent Responsive
        const cardDimensions = containerDimensions.get(card.id) || { width: 800, height: 500 };
        const svgWidth = cardDimensions.width;
        const svgHeight = cardDimensions.height;

        // Intelligent spacing based on available space
        const availableSpace = svgHeight;
        const isCompact = availableSpace < 400;
        const isVeryCompact = availableSpace < 250;

        // Dynamic margins that shrink intelligently
        const marginTop = isVeryCompact ? 15 : (isCompact ? 18 : 20);
        const marginBottom = isVeryCompact ? 75 : (isCompact ? 85 : 95); // Space for X-axis labels + legend
        const marginLeft = Math.max(10, svgWidth * 0.02);
        const marginRight = Math.max(10, svgWidth * 0.02);

        // Dynamic font sizes based on available space - increased for better readability
        const totalLabelFontSize = isVeryCompact ? 10 : (isCompact ? 12 : 14);
        const xAxisFontSize = isVeryCompact ? 9 : (isCompact ? 11 : 12);
        const mixBarLegendFontSize = isVeryCompact ? 10 : (isCompact ? 11 : 12);

        // Adjust bottom margin based on rotated text needs
        const rotatedTextHeight = xAxisFontSize * 2; // Approximate height needed for rotated text
        const adjustedMarginBottom = Math.max(marginBottom, rotatedTextHeight + 25);

        const plotWidth = svgWidth - marginLeft - marginRight;
        const plotHeight = svgHeight - marginTop - adjustedMarginBottom;

        const maxChartValue = card.yAxisScale === 'percentage'
          ? 100
          : Math.max(...stackedData.map(d => d.total));

        const barCount = stackedData.length;
        const barGap = Math.max(8, Math.min(16, plotWidth * 0.015)); // Increased gap: 1.5% of width, min 8px, max 16px
        const totalGaps = (barCount - 1) * barGap;
        const svgBarWidth = Math.max(20, (plotWidth - totalGaps) / barCount); // Minimum 20px bar width

        return (
          <div
            ref={(el) => {
              if (el) {
                chartContainerRefs.current.set(card.id, el);
                updateDimensions(card.id);
              }
            }}
            className="w-full h-full"
            style={{ padding: '4px', margin: '0px' }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="overflow-hidden"
              preserveAspectRatio="xMidYMid meet"
              style={{ display: 'block' }}
              key={`chart-${card.id}-${cardDimensions.width}-${cardDimensions.height}`}
            >
              {/* Chart bars */}
              {stackedData.map((item, barIndex) => {
                const barX = marginLeft + barIndex * (svgBarWidth + barGap);
                let cumulativeHeight = 0;
                const isDragging = draggedBar === `${card.id}-${item.name}`;
                const isDropTarget = draggedOverBar === `${card.id}-${item.name}` && draggedBar && draggedBar !== `${card.id}-${item.name}`;

                return (
                  <g key={item.name} style={{ opacity: isDragging ? 0.5 : 1 }}>
                    {/* Stacked segments */}
                    {allSegments.map((segment, segmentIndex) => {
                      const segmentValue = card.yAxisScale === 'percentage'
                        ? item[`${segment}_percentage`] || 0
                        : item[segment] || 0;

                      const segmentHeight = Math.max(0, (segmentValue / maxChartValue) * plotHeight);

                      // Ensure we don't exceed the available plot height
                      const remainingHeight = Math.max(0, plotHeight - cumulativeHeight);
                      const actualSegmentHeight = Math.min(segmentHeight, remainingHeight);

                      const segmentY = Math.max(marginTop, marginTop + plotHeight - cumulativeHeight - actualSegmentHeight);

                      cumulativeHeight += actualSegmentHeight;

                      if (segmentValue <= 0 || actualSegmentHeight <= 0) return null;

                      const segmentColor = CHART_COLORS[segmentIndex % CHART_COLORS.length];
                      const brightenedColor = isDropTarget ?
                        `color-mix(in srgb, ${segmentColor} 70%, white 30%)` : segmentColor;

                      // Calculate if segment is large enough for a label using actual height
                      const labelFontSize = Math.max(8, Math.min(12, actualSegmentHeight / 4));
                      const shouldShowLabel = actualSegmentHeight >= 20 && svgBarWidth >= 30; // Only show if segment is big enough

                      return (
                        <g key={segment}>
                          <rect
                            x={barX}
                            y={segmentY}
                            width={svgBarWidth}
                            height={actualSegmentHeight}
                            fill={brightenedColor}
                            onMouseEnter={(e) => {
                              setHoveredBar(barIndex);
                              setHoveredSegment({
                                barIndex,
                                segment,
                                data: {
                                  name: segment,
                                  value: segmentValue,
                                  actualValue: item[segment] || 0,
                                  percentage: item[`${segment}_percentage`] || 0
                                }
                              });
                            }}
                            onMouseLeave={() => {
                              setHoveredBar(null);
                              setHoveredSegment(null);
                            }}
                            style={{ cursor: 'pointer' }}
                          />

                          {/* Data label inside segment */}
                          {shouldShowLabel && (
                            <text
                              x={barX + svgBarWidth / 2}
                              y={segmentY + actualSegmentHeight / 2}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="rgba(255,255,255,0.8)"
                              fontSize={Math.max(7, labelFontSize * 0.85)}
                              fontWeight="400"
                              style={{
                                fontFamily: 'inherit',
                                pointerEvents: 'none'
                              }}
                            >
                              {card.yAxisScale === 'percentage'
                                ? `${Math.round(segmentValue)}%`
                                : formatYAxisValue(item[segment] || 0, card.yAxisFormat, false)
                              }
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Total value label on top - Keep as SVG for positioning */}
                    <text
                      x={barX + svgBarWidth / 2}
                      y={marginTop + plotHeight - cumulativeHeight - (isVeryCompact ? 2 : 5)}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.6)"
                      fontSize={Math.max(8, totalLabelFontSize * 0.8)}
                      style={{ fontFamily: 'inherit' }}
                    >
                      {formatYAxisValue(item.total, card.yAxisFormat, false)}
                    </text>

                    {/* Draggable X-axis label for column merging */}
                    <foreignObject
                      x={barX - (barIndex > 0 ? barGap * 0.8 : 0)}
                      y={marginTop + plotHeight + (isVeryCompact ? 8 : 12)}
                      width={svgBarWidth + (barIndex > 0 ? barGap * 0.8 : 0) + (barIndex < stackedData.length - 1 ? barGap * 0.8 : 0)}
                      height="40"
                    >
                      <div
                        className={`cursor-grab transition-all duration-200 rounded px-1 py-1 ${
                          draggedBar === `${card.id}-${item.name}` ? 'opacity-50 scale-105' : ''
                        } ${
                          draggedOverBar === `${card.id}-${item.name}` && draggedBar && draggedBar !== `${card.id}-${item.name}`
                            ? 'bg-blue-500/20 border border-blue-400/50' : ''
                        }`}
                        style={{
                          fontSize: xAxisFontSize,
                          color: 'rgba(255, 255, 255, 0.9)',
                          textAlign: 'center',
                          lineHeight: '1.1',
                          wordBreak: 'keep-all',
                          overflowWrap: 'anywhere',
                          whiteSpace: 'pre-wrap',
                          width: '100%',
                          maxHeight: '32px',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 2px'
                        }}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', JSON.stringify({
                            barName: item.name,
                            originalName: item.originalName || item.name,
                            isMerged: item.isMerged,
                            cardId: card.id
                          }));
                          setDraggedBar(`${card.id}-${item.name}`);

                          // Create custom drag preview
                          const dragImage = document.createElement('div');
                          dragImage.style.cssText = `
                            position: absolute;
                            top: -1000px;
                            left: -1000px;
                            background: rgba(59, 130, 246, 0.9);
                            color: white;
                            padding: 6px 12px;
                            border-radius: 8px;
                            font-size: 12px;
                            font-weight: 500;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                            border: 1px solid rgba(255,255,255,0.2);
                            white-space: nowrap;
                          `;
                          dragImage.textContent = item.name;
                          document.body.appendChild(dragImage);
                          e.dataTransfer.setDragImage(dragImage, 0, 0);

                          setTimeout(() => {
                            if (document.body.contains(dragImage)) {
                              document.body.removeChild(dragImage);
                            }
                          }, 100);
                        }}
                        onDragEnd={() => {
                          setDraggedBar(null);
                          setDraggedOverBar(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (draggedBar && draggedBar !== `${card.id}-${item.name}`) {
                            setDraggedOverBar(`${card.id}-${item.name}`);
                          }
                        }}
                        onDragLeave={(e) => {
                          // Only clear if actually leaving the element
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX;
                          const y = e.clientY;
                          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                            setDraggedOverBar(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDraggedOverBar(null);

                          try {
                            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                            if (dragData.cardId === card.id && dragData.barName !== item.name) {
                              // Find source and target bars
                              const sourceBar = stackedData.find(d => d.name === dragData.barName);
                              const targetBar = stackedData.find(d => d.name === item.name);

                              if (sourceBar && targetBar) {
                                // Collect all original bar names
                                let allOriginalNames: string[] = [];

                                // Get source original names
                                if (sourceBar.isMerged && sourceBar.originalName) {
                                  const sourceOriginals = card.mergedBars?.[sourceBar.originalName] || [dragData.originalName];
                                  allOriginalNames.push(...sourceOriginals);
                                } else {
                                  allOriginalNames.push(dragData.originalName || dragData.barName);
                                }

                                // Get target original names
                                if (targetBar.isMerged && targetBar.originalName) {
                                  const targetOriginals = card.mergedBars?.[targetBar.originalName] || [item.originalName || item.name];
                                  allOriginalNames.push(...targetOriginals);
                                } else {
                                  allOriginalNames.push(item.originalName || item.name);
                                }

                                // Remove duplicates and create merged name
                                allOriginalNames = [...new Set(allOriginalNames)];
                                const mergedName = `<<${allOriginalNames.join(' + ')}>>`;

                                // Update merged bars
                                const newMergedBars = { ...card.mergedBars };
                                const newCustomNames = { ...card.customNames };

                                // Remove old merge entries
                                if (sourceBar.isMerged && sourceBar.originalName) {
                                  delete newMergedBars[sourceBar.originalName];
                                  delete newCustomNames[sourceBar.originalName];
                                }
                                if (targetBar.isMerged && targetBar.originalName) {
                                  delete newMergedBars[targetBar.originalName];
                                  delete newCustomNames[targetBar.originalName];
                                }

                                // Add new merged entry
                                newMergedBars[mergedName] = allOriginalNames;
                                newCustomNames[mergedName] = mergedName;

                                updateCard(card.id, {
                                  mergedBars: newMergedBars,
                                  customNames: newCustomNames
                                });
                              }
                            }
                          } catch (error) {
                            console.error('Error handling drop:', error);
                          }
                        }}
                        onDoubleClick={() => {
                          setEditingLabel(item.name);
                        }}
                      >
                        {editingLabel === item.name ? (
                          <input
                            type="text"
                            defaultValue={item.name}
                            className="w-full bg-white/10 border border-blue-400 rounded px-1 text-white text-center text-xs"
                            style={{ fontSize: xAxisFontSize }}
                            autoFocus
                            onBlur={(e) => {
                              const newValue = e.target.value;
                              if (item?.isMerged && item.originalName) {
                                updateCard(card.id, {
                                  customNames: {
                                    ...card.customNames,
                                    [item.originalName]: newValue
                                  }
                                });
                              } else {
                                updateCard(card.id, {
                                  customNames: {
                                    ...card.customNames,
                                    [item.name]: newValue
                                  }
                                });
                              }
                              setEditingLabel(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              } else if (e.key === 'Escape') {
                                setEditingLabel(null);
                              }
                            }}
                          />
                        ) : (
                          <div style={{
                            textAlign: 'center',
                            wordSpacing: '-0.1em',
                            letterSpacing: '-0.02em'
                          }}>
                            {(() => {
                              // Smart text rendering logic
                              const text = item.name;
                              const estimatedCharWidth = xAxisFontSize * 0.6; // Rough character width
                              const availableWidth = svgBarWidth + (barIndex > 0 ? barGap * 0.8 : 0) + (barIndex < stackedData.length - 1 ? barGap * 0.8 : 0) - 8; // Account for padding
                              const maxCharsPerLine = Math.floor(availableWidth / estimatedCharWidth);

                              // If text fits in one line, use it as is
                              if (text.length <= maxCharsPerLine) {
                                return text;
                              }

                              // Try to break at spaces for better readability
                              const words = text.split(' ');
                              if (words.length === 1) {
                                // Single word that's too long - use as is but let CSS handle overflow
                                return text;
                              }

                              // Try to fit first word on first line, rest on second line
                              const firstWord = words[0];
                              const restWords = words.slice(1).join(' ');

                              if (firstWord.length <= maxCharsPerLine && restWords.length <= maxCharsPerLine) {
                                return `${firstWord}\n${restWords}`;
                              }

                              // Fallback: try to split roughly in half at word boundaries
                              let firstLine = '';
                              let secondLine = '';
                              for (let i = 0; i < words.length; i++) {
                                if (firstLine.length === 0) {
                                  firstLine = words[i];
                                } else if ((firstLine + ' ' + words[i]).length <= maxCharsPerLine) {
                                  firstLine += ' ' + words[i];
                                } else {
                                  secondLine = words.slice(i).join(' ');
                                  break;
                                }
                              }

                              return secondLine ? `${firstLine}\n${secondLine}` : firstLine;
                            })()}
                          </div>
                        )}
                      </div>
                    </foreignObject>




                    {/* X-axis tick mark centered under bar */}
                    <line
                      x1={barX + svgBarWidth / 2}
                      y1={marginTop + plotHeight}
                      x2={barX + svgBarWidth / 2}
                      y2={marginTop + plotHeight + (isVeryCompact ? 4 : 6)}
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="1"
                    />
                  </g>
                );
              })}

              {/* X-axis line */}
              <line
                x1={marginLeft}
                y1={marginTop + plotHeight}
                x2={marginLeft + plotWidth}
                y2={marginTop + plotHeight}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
              />

              {/* Empty space for legend - legend will be HTML overlay */}
            </svg>

            {/* HTML Legend Overlay - positioned below X-axis labels */}
            <div
              className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center flex-wrap"
              style={{
                fontSize: `${mixBarLegendFontSize}px`,
                top: `${marginTop + plotHeight + (isVeryCompact ? 8 : 12) + 40 + (isVeryCompact ? 4 : 8) + (hideControlsState ? 40 : 0)}px`, // Position below X-axis labels, adjust for hidden controls
                gap: isVeryCompact ? '6px' : '8px', // Comfortable spacing for readability
                width: `${plotWidth}px`, // Use exact plot width
                left: `${marginLeft}px`, // Align with chart content
                transform: 'none', // Remove centering transform
                maxHeight: `${(mixBarLegendFontSize + 8) * 2}px`, // Allow for 2 lines max
                overflow: 'visible'
              }}
            >
              {allSegments.map((segment, index) => {
                const rectSize = isVeryCompact ? 8 : (isCompact ? 10 : 11);
                const rectHeight = isVeryCompact ? 6 : (isCompact ? 8 : 9);

                return (
                  <div key={segment} className="flex items-center" style={{ gap: '3px' }}>
                    <div
                      style={{
                        width: `${rectSize}px`,
                        height: `${rectHeight}px`,
                        backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                        flexShrink: 0,
                        borderRadius: '2px'
                      }}
                    />
                    <span
                      className="whitespace-nowrap"
                      style={{
                        fontSize: `${Math.max(9, mixBarLegendFontSize * 0.9)}px`, // Readable minimum size
                        fontWeight: '400',
                        color: 'rgba(255,255,255,0.7)'
                      }}
                    >
                      {segment}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Enhanced Custom tooltip */}
            {hoveredSegment && (
              <div
                style={{
                  position: 'absolute',
                  backgroundColor: 'rgba(0,0,0,0.95)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '12px',
                  padding: isVeryCompact ? '8px 10px' : '12px 16px',
                  fontSize: isVeryCompact ? '9px' : '10px',
                  color: 'white',
                  pointerEvents: 'none',
                  zIndex: 1000,
                  left: `${marginLeft + hoveredSegment.barIndex * (svgBarWidth + barGap) + svgBarWidth / 2}px`,
                  top: isVeryCompact ? '10px' : '20px',
                  transform: 'translateX(-50%)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  minWidth: '120px'
                }}
              >
                <div style={{
                  marginBottom: '6px',
                  fontSize: isVeryCompact ? '10px' : '11px',
                  color: '#60a5fa'
                }}>
                  {hoveredSegment.data.name}
                </div>
                <div style={{ marginBottom: '3px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.8 }}>Value:</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {formatYAxisValue(hoveredSegment.data.actualValue, card.yAxisFormat, true)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.8 }}>Share:</span>
                  <span style={{ color: '#34d399' }}>
                    {Math.round(hoveredSegment.data.percentage)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      case 'table':
        return (
          <div className="overflow-auto h-full">
            <table className="w-full text-white" style={{ fontSize: '10px' }}>
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left p-2">{card.dimension}</th>
                  <th className="text-left p-2">{card.measure}</th>
                </tr>
              </thead>
              <tbody>
                {processedData.map((row, idx) => (
                  <tr key={idx} className="border-b border-white/10">
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">{row.value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'scorecard':
        // Scorecard - shows sum of measure without dimension
        const scoreValue = chartData.reduce((sum, row) => {
          const measureValue = parseFloat(String(row[card.measure])) || 0;
          return sum + measureValue;
        }, 0);
        const formattedScoreValue = formatYAxisValue(scoreValue, card.yAxisFormat, false);

        // Dynamic font sizing based on card dimensions
        const scorecardWidth = card.gridPosition.width * GRID_SIZE;
        const scorecardHeight = card.gridPosition.height * GRID_SIZE;
        const scorecardDiagonal = Math.sqrt(scorecardWidth * scorecardWidth + scorecardHeight * scorecardHeight);

        // Calculate font size based on card diagonal and text length
        const textLength = formattedScoreValue.length;
        const scorecardBaseFontSize = Math.max(24, Math.min(120, scorecardDiagonal * 0.08)); // Scale with card size
        const lengthAdjustedFontSize = Math.max(20, scorecardBaseFontSize - (textLength > 8 ? (textLength - 8) * 3 : 0)); // Reduce for longer numbers
        const finalFontSize = Math.round(lengthAdjustedFontSize);

        // Get or create scorecard text box
        const scorecardTextBoxId = `scorecard-${card.id}`;
        let scorecardTextBox = card.textBoxes?.find(tb => tb.id === scorecardTextBoxId);

        // Create scorecard text box if it doesn't exist
        if (!scorecardTextBox) {
          const cardPixelWidth = card.gridPosition.width * GRID_SIZE;
          const cardPixelHeight = card.gridPosition.height * GRID_SIZE;

          scorecardTextBox = {
            id: scorecardTextBoxId,
            cardId: card.id,
            content: formattedScoreValue,
            position: {
              x: cardPixelWidth / 2 - 100, // Center horizontally (approximate)
              y: cardPixelHeight / 2 - 25  // Center vertically (approximate)
            },
            size: {
              width: 200,
              height: 50
            },
            fontSize: finalFontSize,
            color: '#ffffff',
            isEditing: false
          };

          // Add the scorecard text box to the card
          updateCard(card.id, {
            textBoxes: [...(card.textBoxes || []), scorecardTextBox]
          });
        } else {
          // Update existing scorecard text box with current value and font size
          if (scorecardTextBox.content !== formattedScoreValue || scorecardTextBox.fontSize !== finalFontSize) {
            updateTextBox(card.id, scorecardTextBoxId, {
              content: formattedScoreValue,
              fontSize: finalFontSize
            });
          }
        }

        return (
          <div className="relative w-full h-full">
            {/* Scorecard number is now handled by the draggable text box */}

            {/* Render scorecard text box within the card */}
            {scorecardTextBox && (
              <TextBoxComponent
                key={scorecardTextBox.id}
                textBox={scorecardTextBox}
                onUpdate={(updates) => updateTextBox(scorecardTextBox.cardId, scorecardTextBox.id, updates)}
                onDelete={() => deleteTextBox(scorecardTextBox.cardId, scorecardTextBox.id)}
                isSelected={selectedElement === scorecardTextBox.id}
                onSelect={() => setSelectedElement(scorecardTextBox.id)}
                onMouseDown={(e, action) => handleTextBoxMouseDown(e, scorecardTextBox.id, action)}
                draggedTextBox={draggedTextBox}
                resizingTextBox={resizingTextBox}
                hideControls={hideControls}
              />
            )}
          </div>
        );
      case 'line':
        // Line Chart using Recharts with multi-series support
        const { chartData: lineChartData, allSeries } = getLineChartData(card);

        if (lineChartData.length === 0) {
          return (
            <div className="text-white/60 text-center">
              <div className="mb-2">No data available for Line Chart</div>
              <div style={{ fontSize: '10px' }}>Check your dimension and measure selections</div>
            </div>
          );
        }

        return (
          <div className="h-full w-full p-4">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="name"
                  stroke="rgba(255,255,255,0.7)"
                  fontSize={10}
                  tick={{ fill: 'rgba(255,255,255,0.7)' }}
                  axisLine={true}
                  tickLine={true}
                  orientation="bottom"
                  type="category"
                />
                <YAxis
                  stroke="rgba(255,255,255,0.7)"
                  fontSize={10}
                  tick={{ fill: 'rgba(255,255,255,0.7)' }}
                  axisLine={true}
                  tickLine={true}
                  orientation="left"
                  type="number"
                  tickFormatter={(value) => {
                    return typeof value === 'number' ? formatYAxisValue(value, card.yAxisFormat, false) : value;
                  }}
                />
                <Tooltip content={(props) => <CustomLineTooltip {...props} card={card} />} />
                {/* Custom Legend - we'll add this outside the chart */}
                {allSeries.map((series, index) => (
                  <Line
                    key={`line-${series}`}
                    type="monotone"
                    dataKey={series}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS[index % CHART_COLORS.length], strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: CHART_COLORS[index % CHART_COLORS.length], strokeWidth: 2 }}
                    name={card.seriesColumn ? series : card.measure}
                  />
                ))}
              </RechartsLineChart>
            </ResponsiveContainer>

            {/* Custom Legend - styled similar to Stacked Column Chart */}
            {allSeries.length > 1 && (() => {
              // Responsive sizing logic (similar to mixbar chart)
              const cardWidth = card.gridPosition.width * GRID_SIZE;
              const cardHeight = card.gridPosition.height * GRID_SIZE;
              const isVeryCompact = cardWidth <= 400 || cardHeight <= 300;
              const isCompact = cardWidth <= 600 || cardHeight <= 400;
              const lineChartLegendFontSize = isVeryCompact ? 10 : (isCompact ? 11 : 12);
              const rectSize = isVeryCompact ? 8 : (isCompact ? 10 : 11);
              const rectHeight = isVeryCompact ? 6 : (isCompact ? 8 : 9);

              return (
                <div
                  className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center flex-wrap"
                  style={{
                    fontSize: `${lineChartLegendFontSize}px`,
                    bottom: `${isVeryCompact ? 12 : 16}px`, // Position above bottom border with proper spacing
                    gap: isVeryCompact ? '6px' : '8px', // Comfortable spacing for readability
                    width: `${cardWidth - 40}px`, // Use card width minus padding
                    maxHeight: `${(lineChartLegendFontSize + 8) * 2}px`, // Allow for 2 lines max
                    overflow: 'visible'
                  }}
                >
                  {allSeries.map((series, index) => (
                    <div key={`legend-${series}`} className="flex items-center" style={{ gap: '3px' }}>
                      <div
                        style={{
                          width: `${rectSize}px`,
                          height: `${rectHeight}px`,
                          backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                          flexShrink: 0,
                          borderRadius: '2px'
                        }}
                      />
                      <span
                        className="whitespace-nowrap"
                        style={{
                          fontSize: `${Math.max(9, lineChartLegendFontSize * 0.9)}px`, // Readable minimum size
                          fontWeight: '400',
                          color: 'rgba(255,255,255,0.7)'
                        }}
                      >
                        {card.seriesColumn ? series : card.measure}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        );
      case 'none':
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-white/60 text-center">
              <div className="mb-3">📊</div>
              <div className="text-sm mb-2">No Chart Selected</div>
              <div className="text-xs opacity-70">Click the settings icon to configure this chart</div>
            </div>
          </div>
        );
      default:
        return <div className="text-white/60 text-center">Select a chart type</div>;
    }
  };

  const showChart = (cardId: string) => {
    setConfiguringCard(null);
    updateCard(cardId, { isConfiguring: false });
  };

  // History management functions
  const saveToHistory = (newCards: DashboardCard[]) => {
    setCardsHistory((prev) => {
      // Remove any future history if we're not at the end
      const trimmedHistory = prev.slice(0, historyIndex + 1);

      // Add new state
      const newHistory = [
        ...trimmedHistory,
        JSON.parse(JSON.stringify(newCards)),
      ];

      // Limit history size
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
        return newHistory;
      }

      return newHistory;
    });

    setHistoryIndex((prev) => {
      const newIndex = Math.min(prev + 1, MAX_HISTORY_SIZE - 1);
      return newIndex;
    });
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setCards(JSON.parse(JSON.stringify(cardsHistory[prevIndex])));
    }
  };

  const redo = () => {
    if (historyIndex < cardsHistory.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setCards(JSON.parse(JSON.stringify(cardsHistory[nextIndex])));
    }
  };

  // Clear all cards and components from viewport
  const clearAll = useCallback(() => {
    console.log('Clearing all cards and components from viewport');

    // Clear all cards (which also clears their associated text boxes and arrows)
    setCards([]);

    // Clear any selected elements
    setSelectedElement(null);
    setConfiguringCard(null);

    // Reset any dragging states
    setDraggedCard(null);
    setResizingCard(null);
    setDraggedTextBox(null);
    setResizingTextBox(null);
    setDraggedArrow(null);
    setDraggedHandle(null);

    // Save to history
    setTimeout(() => saveToHistory([]), 0);

    // Close the confirmation dialog
    setShowClearAllDialog(false);

    console.log('Viewport cleared successfully');
  }, [saveToHistory]);

  // PDF-like tool functions
  const createTextBox = useCallback((cardId: string, x: number, y: number) => {
    const newTextBox: TextBox = {
      id: `textbox-${Date.now()}`,
      cardId,
      content: 'Type your text here...',
      position: { x, y },
      size: { width: 200, height: 60 },
      fontSize: 14,
      color: '#ffffff',
      isEditing: true,
    };

    updateCard(cardId, {
      textBoxes: [...(cards.find(c => c.id === cardId)?.textBoxes || []), newTextBox]
    });

    setSelectedElement(newTextBox.id);
    setCurrentTool('select'); // Switch back to select mode after creating text box
  }, [cards, updateCard]);

  const createArrow = useCallback((cardId: string, startX: number, startY: number, endX?: number, endY?: number) => {
    // If end coordinates not provided, create a default sized arrow pointing right
    const defaultLength = 120;
    const finalEndX = endX !== undefined ? endX : startX + defaultLength;
    const finalEndY = endY !== undefined ? endY : startY;

    const newArrow: Arrow = {
      id: `arrow-${Date.now()}`,
      cardId,
      startPosition: { x: startX, y: startY },
      endPosition: { x: finalEndX, y: finalEndY },
      color: '#3b82f6',
      thickness: 4,
    };

    updateCard(cardId, {
      arrows: [...(cards.find(c => c.id === cardId)?.arrows || []), newArrow]
    });

    setSelectedElement(newArrow.id);
  }, [cards, updateCard]);

  const handleChartClick = useCallback((e: React.MouseEvent, cardId: string) => {
    const cardRect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (!containerRect) return;

    // Calculate coordinates relative to the dashboard container, not the card
    const dashboardX = e.clientX - containerRect.left;
    const dashboardY = e.clientY - containerRect.top;

    if (currentTool === 'textbox') {
      createTextBox(cardId, dashboardX, dashboardY);
      e.stopPropagation();
    } else if (currentTool === 'arrow') {
      // Create a default size arrow on single click, which can then be adjusted using handles
      createArrow(cardId, dashboardX, dashboardY);
      e.stopPropagation();
    }
  }, [currentTool, createTextBox, createArrow]);

  return (
    <div className="flex flex-col h-full w-full min-w-0 max-w-full overflow-hidden">
      {/* Header */}
      <header className="px-2 sm:px-4 lg:px-6 py-2 border-b border-white/10 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3 ml-2 sm:ml-4 lg:ml-8">
            <svg
              className="w-6 h-6 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-normal tracking-wider">
              Generate Report
              {fileName && (
                <span className="text-xs sm:text-sm text-blue-300 font-light ml-1 sm:ml-2 flex items-center gap-1">
                  | {fileName}
                  {/* Version Dropdown - show for any versioned file */}
                  {currentFileVersion && currentFileVersion > 0 && (
                    <div className="relative" ref={versionDropdownRef}>
                      <button
                        onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors px-1 py-0.5 rounded hover:bg-blue-500/10"
                        title={availableVersions.length > 1 ? `Switch version (currently v${currentFileVersion})` : `Version ${currentFileVersion} (click to check for other versions)`}
                        disabled={loadingVersions}
                      >
                        <span className="text-blue-400">
                          (v{currentFileVersion}
                          {(() => {
                            const currentVersion = availableVersions.find(v => v.version === currentFileVersion);
                            return currentVersion ? ` • ${currentVersion.sourceLabel}` : '';
                          })()})
                        </span>
                        {loadingVersions ? (
                          <div className="w-3 h-3 border border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                        ) : (
                          <ChevronDown className={`w-3 h-3 transition-transform ${showVersionDropdown ? 'rotate-180' : ''}`} />
                        )}
                      </button>

                      {/* Version Dropdown Menu */}
                      {showVersionDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-black/90 border border-white/20 rounded-md shadow-lg z-50 min-w-64">
                          <div className="py-1 max-h-40 overflow-y-auto">
                            <div className="px-2 py-1 text-xs text-white/50 border-b border-white/10">
                              Available Versions:
                            </div>
                            {availableVersions.length === 0 ? (
                              <div className="px-3 py-2 text-xs">
                                {loadingVersions ? (
                                  <span className="text-white/50">Loading versions...</span>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="text-white/50">
                                      {currentFileVersion ?
                                        'No other versions found in database or local storage' :
                                        'File loaded locally only'
                                      }
                                    </div>
                                    {!currentFileVersion && (
                                      <div className="text-white/40 text-xs">
                                        Tip: Re-upload this file to save versions to storage
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              availableVersions.map((version) => (
                                <button
                                  key={`${version.version}-${version.source}`}
                                  onClick={() => {
                                    // Using userEmail prop from component (user-initiated action, version switch)
                                    loadFileVersion(userEmail, fileName, version.version, false, true);
                                  }}
                                  className={`w-full px-3 py-2 text-left hover:bg-white/10 transition-colors ${
                                    version.version === currentFileVersion
                                      ? 'bg-blue-500/20 text-blue-300'
                                      : 'text-white/80'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium">
                                        Version {version.version}
                                      </span>
                                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                        version.source === 'local'
                                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                      }`}>
                                        {version.sourceLabel}
                                      </span>
                                    </div>
                                    <span className="text-xs text-white/50">
                                      {new Date(version.upload_timestamp).toLocaleDateString()}
                                    </span>
                                  </div>
                                  {version.file_size_bytes && (
                                    <div className="text-xs text-white/40 mt-0.5">
                                      {(() => {
                                        const bytes = version.file_size_bytes;
                                        if (bytes >= 1024 * 1024 * 1024) {
                                          return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
                                        } else if (bytes >= 1024 * 1024) {
                                          return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                                        } else if (bytes >= 1024) {
                                          return `${(bytes / 1024).toFixed(1)} KB`;
                                        } else {
                                          return `${bytes} bytes`;
                                        }
                                      })()}
                                    </div>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Data info */}
                  {importedData.length > 0 && columns.length > 0 && (
                    <span className="text-white/50">
                      • {importedData.length} rows • {columns.length} cols
                    </span>
                  )}
                </span>
              )}
              {hasCachedData && (
                <span className="text-xs text-green-400 font-light ml-2 flex items-center gap-1" title={`Cached data available (${cacheInfo.count} items)`}>
                  <HardDrive className="w-3 h-3" />
                  Cached
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowExistingFilesModal(true)}
                className="p-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg transition-colors border border-orange-400/30"
                title="Select from Existing Files"
              >
                <Files className="w-3 h-3" />
              </button>
              <button
                onClick={handleFileImport}
                className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors border border-green-400/30"
                title="Upload Data"
              >
                <Upload className="w-3 h-3" />
              </button>
              <button
                onClick={() => setShowSnowflakeModal(true)}
                className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors border border-blue-400/30"
                title="Connect to Snowflake Dataset"
              >
                <Database className="w-3 h-3" />
              </button>
              <button
                onClick={() => setShowLocalDatasets(true)}
                className="p-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors border border-purple-400/30"
                title={`View Local Datasets (${localDatasets.length} stored)`}
              >
                <HardDrive className="w-3 h-3" />
              </button>

              {/* Cache Toggle Button */}
              <button
                onClick={toggleCache}
                disabled={showCachingDialog}
                className={`p-1.5 rounded-lg transition-colors border ${
                  showCachingDialog
                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30 cursor-not-allowed'
                    : cacheEnabled
                    ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-400/30'
                    : 'bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 border-gray-400/30'
                }`}
                title={
                  showCachingDialog
                    ? 'Caching in progress...'
                    : `${cacheEnabled ? 'Disable' : 'Enable'} data caching (Local storage)${
                        !cacheEnabled && importedData.length > 0 ? ' - Click to cache current dataset' : ''
                      }`
                }
              >
                <HardDrive className="w-3 h-3" />
              </button>

              {/* Clear Cache Button */}
              {hasCachedData && (
                <button
                  onClick={clearCache}
                  disabled={showClearingDialog}
                  className={`p-1.5 rounded-lg transition-colors border ${
                    showClearingDialog
                      ? 'bg-orange-500/20 text-orange-300 border-orange-400/30 cursor-not-allowed'
                      : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-400/30'
                  }`}
                  title={
                    showClearingDialog
                      ? 'Clearing cache in progress...'
                      : `Clear cache (${cacheInfo.count} items, ${(cacheInfo.size / 1024).toFixed(1)}KB)`
                  }
                >
                  <Trash className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Undo/Redo Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 hover:text-gray-200 font-medium text-sm rounded-lg p-1.5 transition-colors duration-300 border border-gray-400/30 hover:border-gray-400/50 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Undo last change (Ctrl+Z)"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 hover:text-gray-200 font-medium text-sm rounded-lg p-1.5 transition-colors duration-300 border border-gray-400/30 hover:border-gray-400/50 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Redo last change (Ctrl+Y)"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" />
                </svg>
              </button>
            </div>

            {/* PDF Tools */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentTool('select')}
                  className={`p-1.5 rounded-lg transition-colors duration-200 ${
                    currentTool === 'select' ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30' : 'bg-white/10 text-white/70 border border-white/20'
                  }`}
                  title="Select tool"
                >
                  <MousePointer className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setCurrentTool('textbox')}
                  className={`p-1.5 rounded-lg transition-colors duration-200 ${
                    currentTool === 'textbox' ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30' : 'bg-white/10 text-white/70 border border-white/20'
                  }`}
                  title="Annotate"
                >
                  <Type className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setCurrentTool('arrow')}
                  className={`p-1.5 rounded-lg transition-colors duration-200 ${
                    currentTool === 'arrow' ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30' : 'bg-white/10 text-white/70 border border-white/20'
                  }`}
                  title="Arrow"
                >
                  <ArrowUpRight className="w-3 h-3" />
                </button>
                <button
                  onClick={autoResizeCharts}
                  disabled={cards.length === 0}
                  className="p-1.5 rounded-lg transition-colors duration-200 bg-white/10 text-white/70 border border-white/20 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Auto-resize charts to fill screen"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Hide Controls Toggle Switch */}
            <div className="flex items-center gap-1.5">
              <span className="text-white/80 text-xs">Hide Controls</span>
              <button
                onClick={() => setHideControls(!hideControls)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  hideControls ? 'bg-purple-600' : 'bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                    hideControls ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <button
              onClick={openSaveDialog}
              disabled={cards.length === 0}
              className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors border border-green-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save Report"
            >
              <Save className="w-3 h-3" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={addCard}
                disabled={cards.length >= 6}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-medium text-xs rounded-lg transition-colors border border-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" />
                Add Card ({cards.length}/6)
              </button>

              <button
                onClick={() => setShowClearAllDialog(true)}
                disabled={cards.length === 0}
                className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors border border-red-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Clear all cards"
              >
                <Trash className="w-3 h-3" />
              </button>

              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="p-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded-lg transition-colors border border-gray-400/30"
                title={filtersOpen ? "Collapse Filters" : "Expand Filters"}
              >
                {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* User Profile */}
            <UserProfile />
          </div>
        </div>
      </header>

      {/* Filter Section */}
      {filtersOpen && (
        <div className="px-4 pb-4 transition-all duration-300 ease-out">
          <section
            className="p-4 rounded-2xl border border-white/10"
            style={{ background: "rgba(255, 255, 255, 0.05)" }}
          >
            <div className="grid gap-6" style={{ gridTemplateColumns: leftSectionVisible ? '1fr 4fr' : '1fr', alignItems: 'stretch' }}>
              {/* Left Column: Dimension & Values Selection */}
              {leftSectionVisible && (
                <div className="flex flex-col">
                {/* Dimension Selection */}
                <div className="relative mb-3">
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Select Dimension & Values
                  </label>
                  <div className="glass-select rounded-lg border border-white/20 bg-white/5">
                    <select
                      value={selectedDimension}
                      onChange={(e) => handleDimensionSelect(e.target.value)}
                      className="w-full p-2 bg-transparent text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400/50 rounded-lg text-xs"
                    >
                      <option value="" className="bg-slate-800 text-xs">Select a column...</option>
                      {columns.map((column) => (
                        <option key={`filter-${column}`} value={column} className="bg-slate-800 text-xs">
                          {column}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Values Selection - No label, directly below dimension */}
                <div className="relative flex-1">
                  <div className="glass-select rounded-lg border border-white/20 bg-white/5 p-3 h-full">
                    {!selectedDimension ? (
                      <div className="text-white/50 text-sm">
                        Please select a dimension first
                      </div>
                    ) : dimensionValues.length === 0 ? (
                      <div className="text-white/50 text-sm">
                        No values found for selected dimension
                      </div>
                    ) : (
                      <div className="max-h-32 overflow-y-auto space-y-2">
                        {/* Select All option */}
                        <label className="flex items-center gap-2 text-xs text-blue-300 hover:text-blue-200 cursor-pointer border-b border-white/10 pb-2 mb-2">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            ref={(input) => {
                              if (input) input.indeterminate = isSomeSelected;
                            }}
                            onChange={handleSelectAll}
                            className="rounded border-gray-400 text-blue-500 focus:ring-blue-400 focus:ring-offset-0"
                          />
                          <span className="font-semibold">Select All</span>
                        </label>

                        {/* Individual values */}
                        {dimensionValues.map((value) => (
                          <label
                            key={value}
                            className="flex items-center gap-2 text-xs text-white/80 hover:text-white cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedValues.has(value)}
                              onChange={() => handleValueToggle(value)}
                              className="rounded border-gray-400 text-blue-500 focus:ring-blue-400 focus:ring-offset-0"
                            />
                            <span className="truncate">{value}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                </div>
              )}

              {/* Right Column: Selected Filters (Enlarged) */}
              <div className="flex flex-col">
                <div className="flex items-center mb-2">
                  <button
                    onClick={() => setLeftSectionVisible(!leftSectionVisible)}
                    className="mr-2 p-1 text-white/60 hover:text-white/80 transition-colors"
                    title={leftSectionVisible ? "Hide dimension selection" : "Show dimension selection"}
                  >
                    {leftSectionVisible ? (
                      <ChevronLeft className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                  <label className="block text-sm font-medium text-white/80">
                    Selected Filters
                  </label>
                </div>
                <div className="glass-select rounded-lg border border-white/20 bg-white/5 p-3 flex-1">
                  {Object.keys(dimensionSelections).length === 0 ? (
                    <div className="text-white/50 text-sm">
                      No filters selected
                    </div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto space-y-3">
                      {Object.entries(dimensionSelections).map(([dimension, values]) => (
                        <div
                          key={dimension}
                          className={`flex items-start justify-between text-xs text-white/80 px-3 py-2 rounded border transition-all cursor-pointer ${
                            selectedDimension === dimension
                              ? 'bg-blue-500/20 border-blue-400/40 shadow-md'
                              : 'bg-blue-500/10 border-blue-400/20 hover:bg-blue-500/15 hover:border-blue-400/30'
                          }`}
                        >
                          <div
                            className="flex-1 mr-2 break-words"
                            onClick={() => handleFilterItemClick(dimension)}
                            title="Click to edit this filter"
                          >
                            <strong className="text-blue-300">{dimension}: </strong>
                            <span className="text-gray-400 font-normal">{values.join(', ')}</span>
                          </div>
                          <button
                            onClick={() => {
                              // Remove the entire dimension
                              setDimensionSelections(prev => {
                                const newSelections = { ...prev };
                                delete newSelections[dimension];
                                return newSelections;
                              });

                              // If this is the currently selected dimension, clear the selectedValues state too
                              if (dimension === selectedDimension) {
                                setSelectedValues(new Set());
                              }
                            }}
                            className="text-red-400 hover:text-red-300 ml-2"
                            title="Remove all filters for this dimension"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </section>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Tool Instructions */}
      {currentTool !== 'select' && (
        <div className="absolute top-20 left-4 z-40 glass-card border border-blue-400/30 rounded-lg p-3">
          <div className="text-sm text-blue-300 font-medium mb-1">
            {currentTool === 'textbox' && 'Text Box Tool'}
            {currentTool === 'arrow' && 'Arrow Tool'}
          </div>
          <div className="text-xs text-white/70">
            {currentTool === 'textbox' && 'Click anywhere on a chart to add a text box'}
            {currentTool === 'arrow' && 'Click anywhere to create an arrow, then drag handles to adjust'}
          </div>
        </div>
      )}

      {/* Dashboard Grid - Now scrollable in both directions */}
      <div
        className="flex-1 relative overflow-auto"
        ref={containerRef}
        onClick={() => {
          if (selectedElement) {
            setSelectedElement(null);
          }
        }}
      >
        <div
          className="relative"
          style={{
            width: containerWidth,
            height: containerHeight, // Dynamic height based on card positions
            minWidth: '100%',
            minHeight: '100vh' // Use viewport height as minimum
          }}
        >
          {/* Grid Lines */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
                `,
                backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                width: gridCols * GRID_SIZE,
                height: gridRows * GRID_SIZE
              }}
            />
          )}

          {/* Dashboard Cards */}
          {cards.map((card) => (
            <div
              key={card.id}
              className={`absolute glass-card border rounded-lg overflow-hidden ${
                draggedCard === card.id
                  ? 'z-50 shadow-2xl border-blue-400/50 scale-105 transition-none'
                  : resizingCard === card.id
                  ? 'z-40 border-green-400/50 transition-none'
                  : 'z-10 border-white/20 transition-all duration-200'
              }`}
              style={{
                left: card.gridPosition.x * GRID_SIZE,
                top: card.gridPosition.y * GRID_SIZE,
                width: card.gridPosition.width * GRID_SIZE,
                height: card.gridPosition.height * GRID_SIZE,
                transform: 'none',
                userSelect: 'none',
              }}
            >
              {/* Card Header */}
              {!hideControls && (
                <div className="flex items-center justify-between p-2 bg-white/5 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div
                      className="cursor-move hover:bg-white/20 p-1 rounded relative z-50"
                      onMouseDown={(e) => handleMouseDown(e, card.id, 'drag')}
                    >
                      <Move className="w-4 h-4 text-white/70" />
                    </div>
                    <EditableLabel
                      value={card.title}
                      isEditing={editingLabel === `title-${card.id}`}
                      onEdit={(editing: boolean) => {
                        setEditingLabel(editing ? `title-${card.id}` : null);
                      }}
                      onChange={(newValue: string) => {
                        updateCard(card.id, { title: newValue });
                      }}
                      maxWidth={200}
                      fontSize={14}
                      useTiltedText={false}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setConfiguringCard(card.id)}
                      className="p-1 hover:bg-white/20 rounded transition-colors"
                      title="Configure chart"
                    >
                      <Settings className="w-4 h-4 text-white/70" />
                    </button>
                    <button
                      onClick={() => duplicateCard(card.id)}
                      disabled={cards.length >= 6}
                      className="p-1 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={cards.length >= 6 ? "Maximum cards reached (6/6)" : "Duplicate card"}
                    >
                      <Copy className="w-4 h-4 text-blue-400" />
                    </button>
                    <button
                      onClick={() => deleteCard(card.id)}
                      className="p-1 hover:bg-red-500/20 rounded transition-colors"
                      title="Delete card"
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              )}

              {/* Card Content */}
              <div
                className="flex-1 p-2 relative"
                onClick={(e) => handleChartClick(e, card.id)}
                style={{
                  height: hideControls ? '100%' : 'calc(100% - 40px)',
                  cursor: currentTool === 'textbox' ? 'crosshair' : currentTool === 'arrow' ? 'crosshair' : 'default'
                }}
              >
                {hideControls && (
                  <div className="mb-2 px-1">
                    <div className="text-center">
                      <EditableLabel
                        value={card.title}
                        isEditing={editingLabel === `title-${card.id}`}
                        onEdit={(editing: boolean) => {
                          setEditingLabel(editing ? `title-${card.id}` : null);
                        }}
                        onChange={(newValue: string) => {
                          updateCard(card.id, { title: newValue });
                        }}
                        maxWidth={200}
                        fontSize={14}
                        useTiltedText={false}
                      />
                    </div>
                  </div>
                )}
                <div className={hideControls ? "h-[calc(100%-28px)]" : "h-full"}>
                  {renderChart(card, hideControls)}
                </div>




              </div>

              {/* Resize Handles - 8 handles for all directions */}
              {!hideControls && (
                <>
                  {/* Corner Handles */}
                  <div
                    className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize opacity-0 hover:opacity-100 bg-white/20 border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-sm z-50"
                    onMouseDown={(e) => handleMouseDown(e, card.id, 'resize-nw')}
                    title="Resize from top-left corner"
                  />
                  <div
                    className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize opacity-0 hover:opacity-100 bg-white/20 border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-sm z-50"
                    onMouseDown={(e) => handleMouseDown(e, card.id, 'resize-ne')}
                    title="Resize from top-right corner"
                  />
                  <div
                    className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize opacity-0 hover:opacity-100 bg-white/20 border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-sm z-50"
                    onMouseDown={(e) => handleMouseDown(e, card.id, 'resize-sw')}
                    title="Resize from bottom-left corner"
                  />
                  <div
                    className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize opacity-0 hover:opacity-100 bg-white/20 border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-sm z-50"
                    onMouseDown={(e) => handleMouseDown(e, card.id, 'resize-se')}
                    title="Resize from bottom-right corner"
                  />

                  {/* Edge Handles */}
                  <div
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 w-6 h-2 cursor-n-resize opacity-0 hover:opacity-100 bg-white/20 border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-sm z-50"
                    onMouseDown={(e) => handleMouseDown(e, card.id, 'resize-n')}
                    title="Resize from top edge"
                  />
                  <div
                    className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-6 h-2 cursor-s-resize opacity-0 hover:opacity-100 bg-white/20 border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-sm z-50"
                    onMouseDown={(e) => handleMouseDown(e, card.id, 'resize-s')}
                    title="Resize from bottom edge"
                  />
                  <div
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 w-2 h-6 cursor-w-resize opacity-0 hover:opacity-100 bg-white/20 border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-sm z-50"
                    onMouseDown={(e) => handleMouseDown(e, card.id, 'resize-w')}
                    title="Resize from left edge"
                  />
                  <div
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-6 cursor-e-resize opacity-0 hover:opacity-100 bg-white/20 border border-white/30 backdrop-blur-sm transition-all duration-200 rounded-sm z-50"
                    onMouseDown={(e) => handleMouseDown(e, card.id, 'resize-e')}
                    title="Resize from right edge"
                  />
                </>
              )}
            </div>
          ))}

          {/* Render All TextBoxes at Dashboard Level (excluding scorecard text boxes) */}
          {cards.flatMap(card => card.textBoxes || []).filter(tb => !tb.id.startsWith('scorecard-')).map(textBox => (
            <TextBoxComponent
              key={textBox.id}
              textBox={textBox}
              onUpdate={(updates) => updateTextBox(textBox.cardId, textBox.id, updates)}
              onDelete={() => deleteTextBox(textBox.cardId, textBox.id)}
              isSelected={selectedElement === textBox.id}
              onSelect={() => setSelectedElement(textBox.id)}
              onMouseDown={(e, action) => handleTextBoxMouseDown(e, textBox.id, action)}
              draggedTextBox={draggedTextBox}
              resizingTextBox={resizingTextBox}
              hideControls={hideControls}
            />
          ))}

          {/* Render All Arrows at Dashboard Level */}
          {cards.flatMap(card => card.arrows || []).map(arrow => (
            <ArrowComponent
              key={arrow.id}
              arrow={arrow}
              onDelete={() => deleteArrow(arrow.cardId, arrow.id)}
              onUpdate={(updates) => updateArrow(arrow.cardId, arrow.id, updates)}
              isSelected={selectedElement === arrow.id}
              onSelect={() => setSelectedElement(arrow.id)}
              hideControls={hideControls}
              draggedArrow={draggedArrow}
              draggedHandle={draggedHandle}
              onHandleDrag={handleArrowHandleMouseDown}
            />
          ))}

          {/* Empty State */}
          {cards.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-white/50" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Create Your Dashboard</h3>
                <p className="text-white/70 mb-4">Add up to 6 cards and customize your reports</p>
                <button
                  onClick={addCard}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-medium text-sm rounded-lg transition-colors border border-blue-400/30 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Card
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Modal */}
      {configuringCard && (
        <div
          style={{
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="glass-card rounded-lg p-3 border border-white/20"
            style={{
              width: '100%',
              maxWidth: '28rem',
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: '0 auto'
            }}
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-white">Configure Chart</h3>
              <button
                onClick={() => setConfiguringCard(null)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>

            {(() => {
              const card = cards.find(c => c.id === configuringCard);
              if (!card) return null;

              return (
                <div className="space-y-2">
                  {/* Chart Type Selection */}
                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1">
                      Chart Type
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {CHART_TYPES.map((type) => {
                        const Icon = type.icon;
                        return (
                          <button
                            key={type.id}
                            onClick={() => setChartTypeWithDefaults(card.id, type.id as DashboardCard['chartType'])}
                            className={`p-1 rounded border transition-colors ${
                              card.chartType === type.id
                                ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                                : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                            }`}
                          >
                            <Icon className="w-3 h-3 mx-auto mb-0.5" />
                            <div className="text-[10px]">{type.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chart Title */}
                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1">
                      Chart Title
                    </label>
                    <input
                      type="text"
                      value={card.title}
                      onChange={(e) => updateCard(card.id, { title: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="Enter chart title..."
                    />
                  </div>

                  {/* Dimension Selection - Hide for scorecard */}
                  {card.chartType !== 'scorecard' && (
                    <div>
                      <label className="block text-xs font-medium text-white/80 mb-1">
                        Dimension (Categories)
                      </label>
                      <select
                        value={card.dimension}
                        onChange={(e) => updateCard(card.id, { dimension: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="">Select dimension...</option>
                        {columns.map((col) => (
                          <option key={`dimension-${col}`} value={col} className="bg-slate-800">{col}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* First Measure Selection */}
                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1">
                      First Measure (Values)
                    </label>
                    <select
                      value={card.measure}
                      onChange={(e) => updateCard(card.id, { measure: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      <option value="">Select measure...</option>
                      {columns.filter(col => {
                        // Filter to show likely numeric columns
                        const sampleValue = importedData[0]?.[col];
                        return typeof sampleValue === 'number' || !isNaN(parseFloat(String(sampleValue)));
                      }).map((col) => (
                        <option key={`measure1-${col}`} value={col} className="bg-slate-800">{col}</option>
                      ))}
                    </select>
                  </div>

                  {/* Second Measure Selection (only for Column Chart) */}
                  {card.chartType === 'bar' && (
                    <div>
                      <label className="block text-xs font-medium text-white/80 mb-1">
                        Second Measure (Optional)
                      </label>
                      <select
                        value={card.measure2 || ''}
                        onChange={(e) => updateCard(card.id, { measure2: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="">Select second measure (optional)...</option>
                        {columns.filter(col => {
                          // Filter to show likely numeric columns, exclude first measure
                          const sampleValue = importedData[0]?.[col];
                          const isNumeric = typeof sampleValue === 'number' || !isNaN(parseFloat(String(sampleValue)));
                          return isNumeric && col !== card.measure;
                        }).map((col) => (
                          <option key={`measure2-${col}`} value={col} className="bg-slate-800">{col}</option>
                        ))}
                      </select>
                      <div className="text-[10px] text-white/50 mt-0.5">
                        Creates a 2-D column chart comparing two measures
                      </div>
                    </div>
                  )}

                  {/* Series Column Selection (only for Line Chart) */}
                  {card.chartType === 'line' && (
                    <div>
                      <label className="block text-xs font-medium text-white/80 mb-1">
                        Series Column (Optional)
                      </label>
                      <select
                        value={card.seriesColumn || ''}
                        onChange={(e) => updateCard(card.id, { seriesColumn: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="">Select series column (optional)...</option>
                        {columns.filter(col => {
                          // Exclude dimension and measure columns
                          return col !== card.dimension && col !== card.measure;
                        }).map((col) => (
                          <option key={`series-${col}`} value={col} className="bg-slate-800">{col}</option>
                        ))}
                      </select>
                      <div className="text-[10px] text-white/50 mt-0.5">
                        Creates multiple lines for each distinct value in the series column
                      </div>
                    </div>
                  )}

                  {/* Y-Axis Formatting Selection (only for Line Charts) */}
                  {card.chartType === 'line' && (
                    <div>
                      <label className="block text-xs font-medium text-white/80 mb-1">
                        Y-Axis Value Format
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'default' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            (card.yAxisFormat || 'default') === 'default'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Default
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'K' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisFormat === 'K'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Thousands (K)
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'M' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisFormat === 'M'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Millions (M)
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'B' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisFormat === 'B'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Billions (B)
                        </button>
                      </div>
                      <div className="text-[10px] text-white/50 mt-0.5">
                        {(card.yAxisFormat || 'default') === 'default'
                          ? 'Shows values with full precision and commas'
                          : card.yAxisFormat === 'K'
                          ? 'Shows values in thousands (e.g., 1.50K for 1,500)'
                          : card.yAxisFormat === 'M'
                          ? 'Shows values in millions (e.g., 1.50M for 1,500,000)'
                          : 'Shows values in billions (e.g., 1.50B for 1,500,000,000)'
                        }
                      </div>
                    </div>
                  )}

                  {/* Second Dimension Selection (only for mix bar charts) */}
                  {card.chartType === 'mixbar' && (
                    <div>
                      <label className="block text-xs font-medium text-white/80 mb-1">
                        Second Dimension (Segments)
                      </label>
                      <select
                        value={card.dimension2 || ''}
                        onChange={(e) => updateCard(card.id, { dimension2: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="">Select second dimension...</option>
                        {columns.filter(col => col !== card.dimension).map((col) => (
                          <option key={`dimension2-${col}`} value={col} className="bg-slate-800">{col}</option>
                        ))}
                      </select>
                      <div className="text-[10px] text-white/50 mt-0.5">
                        This will create segments within each bar
                      </div>
                    </div>
                  )}

                  {/* Y-Axis Scale Selection (only for mix bar charts) */}
                  {card.chartType === 'mixbar' && (
                    <div>
                      <label className="block text-xs font-medium text-white/80 mb-1">
                        Y-Axis Scale
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => updateCard(card.id, { yAxisScale: 'linear' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisScale === 'linear'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Linear Scale
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { yAxisScale: 'percentage' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisScale === 'percentage'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Percentage Scale
                        </button>
                      </div>
                      <div className="text-[10px] text-white/50 mt-0.5">
                        {card.yAxisScale === 'percentage'
                          ? 'Shows relative proportions (0-100%)'
                          : 'Shows absolute values'
                        }
                      </div>
                    </div>
                  )}

                  {/* Y-Axis Formatting Selection (only for Scorecard) */}
                  {card.chartType === 'scorecard' && (
                    <div>
                      <label className="block text-xs font-medium text-white/80 mb-1">
                        Value Format
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'default' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            (card.yAxisFormat || 'default') === 'default'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Default
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'K' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisFormat === 'K'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Thousands (K)
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'M' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisFormat === 'M'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Millions (M)
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'B' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisFormat === 'B'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Billions (B)
                        </button>
                      </div>
                      <div className="text-[10px] text-white/50 mt-0.5">
                        {(card.yAxisFormat || 'default') === 'default'
                          ? 'Shows values with full precision and commas'
                          : card.yAxisFormat === 'K'
                          ? 'Shows values in thousands (e.g., 15K for 15,000)'
                          : card.yAxisFormat === 'M'
                          ? 'Shows values in millions (e.g., 2M for 2,000,000)'
                          : 'Shows values in billions (e.g., 1B for 1,000,000,000)'
                        }
                      </div>
                    </div>
                  )}

                  {/* Y-Axis Formatting Selection (only for Stacked Column Charts) */}
                  {card.chartType === 'mixbar' && (
                    <div>
                      <label className="block text-xs font-medium text-white/80 mb-1">
                        Y-Axis Value Format
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'default' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            (card.yAxisFormat || 'default') === 'default'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Default
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'K' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisFormat === 'K'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Thousands (K)
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'M' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisFormat === 'M'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Millions (M)
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'B' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisFormat === 'B'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Billions (B)
                        </button>
                      </div>
                      <div className="text-[10px] text-white/50 mt-0.5">
                        {(card.yAxisFormat || 'default') === 'default'
                          ? 'Shows values with full precision and commas'
                          : card.yAxisFormat === 'K'
                          ? 'Shows values in thousands (e.g., 15K for 15,000)'
                          : card.yAxisFormat === 'M'
                          ? 'Shows values in millions (e.g., 2M for 2,000,000)'
                          : 'Shows values in billions (e.g., 1B for 1,000,000,000)'
                        }
                      </div>
                    </div>
                  )}

                  {/* Y-Axis Formatting Selection (only for Column Charts) */}
                  {card.chartType === 'bar' && (
                    <div>
                      <label className="block text-xs font-medium text-white/80 mb-1">
                        Y-Axis Value Format
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'default' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            (card.yAxisFormat || 'default') === 'default'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Default
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'K' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisFormat === 'K'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Thousands (K)
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'M' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisFormat === 'M'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Millions (M)
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { yAxisFormat: 'B' })}
                          className={`p-1 rounded border transition-colors text-[10px] ${
                            card.yAxisFormat === 'B'
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          Billions (B)
                        </button>
                      </div>
                      <div className="text-[10px] text-white/50 mt-0.5">
                        {(card.yAxisFormat || 'default') === 'default'
                          ? 'Shows values with full precision and commas'
                          : card.yAxisFormat === 'K'
                          ? 'Shows values in thousands (e.g., 15K for 15,000)'
                          : card.yAxisFormat === 'M'
                          ? 'Shows values in millions (e.g., 2M for 2,000,000)'
                          : 'Shows values in billions (e.g., 1B for 1,000,000,000)'
                        }
                      </div>
                    </div>
                  )}

                  {/* Sorting Options (only for bar charts) */}
                  {(card.chartType === 'bar' || card.chartType === 'mixbar') && (
                    <div>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Sort By Section */}
                        <div>
                          <label className="block text-xs font-medium text-white/80 mb-1">
                            Sort By
                          </label>
                          <div className="grid grid-cols-1 gap-1">
                            <button
                              onClick={() => updateCard(card.id, { sortBy: 'dimension' })}
                              className={`p-1 rounded border transition-colors text-[9px] ${
                                card.sortBy === 'dimension'
                                  ? 'border-green-400 bg-green-500/20 text-green-300'
                                  : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                              }`}
                            >
                              X-Axis
                            </button>
                            <button
                              onClick={() => updateCard(card.id, { sortBy: 'measure' })}
                              className={`p-1 rounded border transition-colors text-[9px] ${
                                card.sortBy === 'measure'
                                  ? 'border-green-400 bg-green-500/20 text-green-300'
                                  : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                              }`}
                            >
                              Values
                            </button>
                          </div>
                        </div>

                        {/* Sort Order Section */}
                        <div>
                          <label className="block text-xs font-medium text-white/80 mb-1">
                            Sort Order
                          </label>
                          <div className="grid grid-cols-1 gap-1">
                            <button
                              onClick={() => updateCard(card.id, { sortOrder: 'asc' })}
                              className={`p-1 rounded border transition-colors text-[9px] ${
                                card.sortOrder === 'asc'
                                  ? 'border-green-400 bg-green-500/20 text-green-300'
                                  : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                              }`}
                            >
                              Ascending ↑
                            </button>
                            <button
                              onClick={() => updateCard(card.id, { sortOrder: 'desc' })}
                              className={`p-1 rounded border transition-colors text-[9px] ${
                                card.sortOrder === 'desc'
                                  ? 'border-green-400 bg-green-500/20 text-green-300'
                                  : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                              }`}
                            >
                              Descending ↓
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-white/50 mt-0.5">
                        {card.sortBy === 'dimension'
                          ? `Sort bars alphabetically by ${card.dimension || 'category'} names`
                          : `Sort bars by ${card.measure || 'value'} amounts`
                        }
                      </div>
                    </div>
                  )}

                  {/* Merge Instructions (only for bar, mixbar, and pie charts) */}
                  {(card.chartType === 'bar' || card.chartType === 'mixbar' || card.chartType === 'pie') && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                      <div className="text-[10px] text-blue-300 font-medium mb-0.5">
                        ���� Tip: Merge Columns
                      </div>
                      <div className="text-[10px] text-white/70">
                        {card.chartType === 'bar'
                          ? 'Drag and drop bars onto each other to merge columns and combine their values.'
                          : card.chartType === 'mixbar'
                          ? 'Click and drag from one bar to another to merge categories and combine their segments.'
                          : 'Drag and drop pie segments onto each other to merge categories and combine their values.'
                        }
                      </div>
                    </div>
                  )}

                  {/* Clear Merges Button (only show if there are merged segments) */}
                  {(card.chartType === 'bar' || card.chartType === 'mixbar' || card.chartType === 'pie') && Object.keys(card.mergedBars || {}).length > 0 && (
                    <div className="pt-2 border-t border-white/10">
                      <button
                        onClick={() => {
                          updateCard(card.id, {
                            mergedBars: {},
                            customNames: {}
                          });
                        }}
                        className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium text-[10px] rounded px-2 py-1 transition-colors flex items-center justify-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Clear All Merges ({Object.keys(card.mergedBars || {}).length})
                      </button>
                      <div className="text-[10px] text-white/50 mt-0.5 text-center">
                        This will split all merged columns back to individual bars
                      </div>
                    </div>
                  )}

                  {/* Show Chart Button */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => showChart(card.id)}
                      disabled={
                        // For scorecard: only measure required
                        (card.chartType === 'scorecard' && !card.measure) ||
                        // For mixbar: dimension, measure, and dimension2 required
                        (card.chartType === 'mixbar' && (!card.dimension || !card.measure || !card.dimension2)) ||
                        // For all other charts: dimension and measure required
                        (card.chartType !== 'scorecard' && card.chartType !== 'mixbar' && (!card.dimension || !card.measure))
                      }
                      className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-white/5 disabled:text-white/30 text-blue-300 font-medium text-xs rounded px-3 py-1.5 transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Show Chart
                    </button>
                    <button
                      onClick={() => setConfiguringCard(null)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Save Report Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <Save className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-semibold text-white">Save Dashboard Report</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Report Name *
                </label>
                <input
                  type="text"
                  value={saveReportName}
                  onChange={(e) => setSaveReportName(e.target.value)}
                  placeholder="Enter report name..."
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={saveReportDescription}
                  onChange={(e) => setSaveReportDescription(e.target.value)}
                  placeholder="Add a description for this report..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent resize-none"
                />
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-xs text-blue-300 mb-1">Report Summary:</p>
                <p className="text-xs text-white/70">
                  �� {cards.length} chart{cards.length !== 1 ? 's' : ''} configured
                  {importedData.length > 0 && ` ��� Using imported data (${importedData.length > 1000 ? '1000' : importedData.length} rows${importedData.length > 1000 ? ' - truncated' : ''})`}
                  {hideControls && ' • Controls hidden'}
                </p>
              </div>

              <div className={`rounded-lg p-3 border ${
                storageInfo.isNearLimit
                  ? 'bg-yellow-500/10 border-yellow-500/20'
                  : 'bg-gray-500/10 border-gray-500/20'
              }`}>
                <p className="text-xs text-white/70 mb-1">
                  Storage: {storageInfo.viewsCount} saved views ({storageInfo.percentUsed.toFixed(1)}% of limit)
                </p>
                {storageInfo.isNearLimit && (
                  <p className="text-xs text-yellow-300">
                    Warning: Storage nearly full. Old views may be automatically removed.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentView}
                disabled={!saveReportName.trim()}
                className="flex-1 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 disabled:bg-green-500/10 text-green-300 disabled:text-green-300/50 font-medium text-sm rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                Save View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snowflake Import Modal */}
      {showSnowflakeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Connect to Snowflake Dataset</h2>
            </div>

            <div className="space-y-4">
              {/* Test Mode Toggle */}
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-300">Test Mode</p>
                    <p className="text-xs text-white/70">Use sample data instead of real Snowflake connection</p>
                  </div>
                  <button
                    onClick={() => setTestMode(!testMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                      testMode ? 'bg-yellow-600' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                        testMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Query Type Selection */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Import Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setQueryType('table')}
                    className={`p-2 rounded-lg border transition-colors ${
                      queryType === 'table'
                        ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                        : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    Table Name
                  </button>
                  <button
                    onClick={() => setQueryType('sql')}
                    className={`p-2 rounded-lg border transition-colors ${
                      queryType === 'sql'
                        ? 'border-blue-400 bg-blue-500/20 text-blue-300'
                        : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    SQL Query
                  </button>
                </div>
              </div>

              {/* Query Input */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {queryType === 'table' ? 'Table Name' : 'SQL Query'}
                </label>
                {queryType === 'table' ? (
                  <input
                    type="text"
                    value={snowflakeQuery}
                    onChange={(e) => setSnowflakeQuery(e.target.value)}
                    placeholder={testMode
                      ? "Try: sales_data, customer_data, or any_table_name"
                      : "e.g., DATABASE.SCHEMA.TABLE_NAME"
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    autoFocus
                  />
                ) : (
                  <textarea
                    value={snowflakeQuery}
                    onChange={(e) => setSnowflakeQuery(e.target.value)}
                    placeholder={testMode
                      ? "Try: SELECT * FROM products WHERE category = 'Electronics'"
                      : "SELECT * FROM DATABASE.SCHEMA.TABLE_NAME WHERE condition LIMIT 1000"
                    }
                    rows={4}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
                  />
                )}
                <p className="text-xs text-white/50 mt-1">
                  {testMode ? (
                    queryType === 'table'
                      ? 'Test mode: Enter any table name to get sample data (try "sales_data" or "customer_data")'
                      : 'Test mode: Enter any SQL query to get sample aggregated data'
                  ) : (
                    queryType === 'table'
                      ? 'Enter the fully qualified table name (Database.Schema.Table)'
                      : 'Enter your SQL query. Results will be limited to 1000 rows for performance.'
                  )}
                </p>
              </div>

              <div className={`border rounded-lg p-3 ${
                testMode
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-blue-500/10 border-blue-500/20'
              }`}>
                <p className={`text-xs mb-1 ${
                  testMode ? 'text-green-300' : 'text-blue-300'
                }`}>
                  {testMode ? 'Test Mode Active:' : 'Production Mode:'}
                </p>
                <p className="text-xs text-white/70">
                  {testMode
                    ? 'Using sample data for testing. No Snowflake connection required.'
                    : 'This feature requires Snowflake connection configuration. Please ensure your credentials are properly set up.'
                  }
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSnowflakeModal(false);
                  setSnowflakeQuery('');
                  setQueryType('table');
                  setTestMode(true);
                }}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSnowflakeImport}
                disabled={!snowflakeQuery.trim()}
                className="flex-1 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-blue-500/10 text-blue-300 disabled:text-blue-300/50 font-medium text-sm rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                Import Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Storage Option Modal */}
      <StorageOptionModal
        isOpen={showStorageModal}
        onClose={handleStorageModalClose}
        onSelect={handleStorageOptionSelect}
        onOverwrite={handleStorageOverwrite}
        onNewVersion={handleStorageNewVersion}
        fileName={pendingFileData?.file.name || ''}
        fileSize={pendingFileData?.file.size || 0}
        rowCount={pendingFileData?.rowCount || 0}
        conflictData={storageConflictData}
        selectedStorage={selectedStorageType}
      />

      {/* Local Datasets Modal */}
      <LocalDatasets
        isOpen={showLocalDatasets}
        onClose={() => setShowLocalDatasets(false)}
        onLoadDataset={handleLoadLocalDataset}
      />

      {/* Existing Files Modal */}
      {showExistingFilesModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <Files className="w-5 h-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">Select from Existing Files</h2>
              <button
                onClick={() => setShowExistingFilesModal(false)}
                className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-white/70 text-sm">
                Choose from previously uploaded files to build charts and visualizations.
              </p>

              {/* File list container */}
              <div className="bg-white/5 rounded-lg p-4 min-h-[300px] max-h-[400px] overflow-y-auto">
                {localDatasets.length > 0 ? (
                  <div className="space-y-2">
                    {localDatasets.map((dataset) => (
                      <div
                        key={dataset.id}
                        className="flex items-center justify-between p-3 bg-white/10 hover:bg-white/15 rounded-lg border border-white/20 transition-colors cursor-pointer group"
                        onClick={() => handleSelectExistingFile(dataset)}
                      >
                        <div className="flex-1">
                          <h3 className="text-white font-medium text-sm">{dataset.name}</h3>
                          <p className="text-white/60 text-xs mt-1">
                            {dataset.rowCount.toLocaleString()} rows • {(dataset.columns?.length ?? 0)} columns
                          </p>
                          <p className="text-white/50 text-xs">
                            Created: {new Date(dataset.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-white/50">
                            {(dataset.fileSize / 1024).toFixed(1)} KB
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/70" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Files className="w-12 h-12 text-white/30 mb-4" />
                    <h3 className="text-white/70 font-medium mb-2">No Files Found</h3>
                    <p className="text-white/50 text-sm mb-4">
                      Upload some files first to see them here.
                    </p>
                    <button
                      onClick={() => {
                        setShowExistingFilesModal(false);
                        handleFileImport();
                      }}
                      className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 font-medium text-sm rounded-lg transition-colors border border-green-400/30"
                    >
                      Upload File
                    </button>
                  </div>
                )}
              </div>

              {localDatasets.length > 0 && (
                <div className="flex justify-between items-center text-xs text-white/50 pt-2 border-t border-white/10">
                  <span>{localDatasets.length} file{localDatasets.length !== 1 ? 's' : ''} available</span>
                  <span>Click to load and start building charts</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Caching Progress Dialog */}
      {showCachingDialog && (
        <div className="fixed top-0 right-0 left-0 z-50 p-4">
          <div className="glass-card rounded-2xl p-6 max-w-md mx-auto mt-16">
            <div className="text-center">
              {/* Caching Icon with Animation */}
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <HardDrive className="w-8 h-8 text-blue-400 animate-pulse" />
              </div>

              {/* Status Message */}
              <h3 className="text-lg font-semibold text-white mb-2">
                Caching Data
              </h3>
              <p className="text-white/70 text-sm mb-4">
                {cachingStatus}
              </p>

              {/* Progress Indicator */}
              <div className="w-full bg-white/10 rounded-full h-2 mb-4">
                <div className="bg-blue-400 h-2 rounded-full animate-pulse" style={{
                  width: cachingStatus.includes('Initializing') ? '20%' :
                         cachingStatus.includes('Preparing') ? '40%' :
                         cachingStatus.includes('Storing') ? '60%' :
                         cachingStatus.includes('Updating') ? '80%' :
                         cachingStatus.includes('completed') ? '100%' : '0%',
                  transition: 'width 0.3s ease-in-out'
                }}></div>
              </div>

              {/* Info Text */}
              <p className="text-xs text-white/50">
                Please wait while your data is being cached...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clear Cache Progress Dialog */}
      {showClearingDialog && (
        <div className="fixed top-0 right-0 left-0 z-50 p-4">
          <div className="glass-card rounded-2xl p-6 max-w-md mx-auto mt-16">
            <div className="text-center">
              {/* Clearing Icon with Animation */}
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash className="w-8 h-8 text-red-400 animate-pulse" />
              </div>

              {/* Status Message */}
              <h3 className="text-lg font-semibold text-white mb-2">
                Clearing Cache
              </h3>
              <p className="text-white/70 text-sm mb-4">
                {clearingStatus}
              </p>

              {/* Progress Indicator */}
              <div className="w-full bg-white/10 rounded-full h-2 mb-4">
                <div className="bg-red-400 h-2 rounded-full animate-pulse" style={{
                  width: clearingStatus.includes('Initializing') ? '20%' :
                         clearingStatus.includes('Removing') ? '40%' :
                         clearingStatus.includes('Clearing Local storage') ? '60%' :
                         clearingStatus.includes('Updating application') ? '80%' :
                         clearingStatus.includes('Clearing current') ? '90%' :
                         clearingStatus.includes('successfully') ? '100%' : '0%',
                  transition: 'width 0.3s ease-in-out'
                }}></div>
              </div>

              {/* Info Text */}
              <p className="text-xs text-white/50">
                Please wait while your cached data is being removed...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Dialog */}
      {showClearAllDialog && (
        <div className="fixed top-0 right-0 left-0 z-50 p-4">
          <div className="glass-card rounded-2xl p-6 max-w-md mx-auto mt-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <Trash className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Clear All Objects</h2>
            </div>

            <div className="space-y-4">
              <p className="text-white/80 text-sm">
                Are you sure you want to clear all cards and components from the current view? This action will remove:
              </p>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <ul className="text-xs text-yellow-300 space-y-1">
                  <li>• All {cards.length} dashboard card{cards.length !== 1 ? 's' : ''}</li>
                  <li>• All associated text boxes and annotations</li>
                  <li>• All arrows and visual elements</li>
                  <li>• Current chart configurations</li>
                </ul>
              </div>

              <p className="text-white/60 text-xs">
                ⚠️ This action cannot be undone, but you can use the Undo button to restore your work.
              </p>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowClearAllDialog(false)}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-sm rounded-lg transition-colors border border-white/20"
                >
                  Cancel
                </button>
                <button
                  onClick={clearAll}
                  className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium text-sm rounded-lg transition-colors border border-red-400/30"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session Debug Component (temporary for testing) */}
      <SessionDebug />

      {/* File Upload Success Popup */}
      {showUploadSuccess && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-16 p-4">
          <div className="glass-card rounded-xl p-6 w-full max-w-md">
            <div className="text-center">
              {/* Success Icon */}
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              {/* Success Message */}
              <h3 className="text-lg font-semibold text-white mb-2">
                {uploadedFileName.startsWith('Snowflake:') ? 'Data Imported Successfully!' : 'File Uploaded Successfully!'}
              </h3>
              <p className="text-white/70 text-sm mb-6">
                "{uploadedFileName}" has been imported and is ready to use.
                {importedData.length > 0 && columns.length > 0 && (
                  <span className="block text-white/50 text-xs mt-1">
                    • {importedData.length} rows �� {columns.length} columns
                  </span>
                )}
              </p>

              {/* OK Button */}
              <button
                onClick={() => setShowUploadSuccess(false)}
                className="w-full px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 font-medium text-sm rounded-lg transition-colors border border-green-400/30"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuildReport;
