import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  ChevronDown,
  X,
  ChevronUp,
  Filter,
  Search,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
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
} from "recharts";

interface SelectionPill {
  id: string;
  year: string;
  quarter?: string;
  type: "year" | "quarter";
  label: string;
}

interface FiscalYearData {
  [key: string]: string[];
}

interface SnapshotOption {
  label: string;
  value: string;
}

// Suppress Recharts defaultProps warnings globally
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args[0];
  // Suppress specific Recharts warnings
  if (
    typeof message === 'string' && (
      message.includes('defaultProps will be removed') ||
      message.includes('XAxis') ||
      message.includes('YAxis') ||
      message.includes('Recharts') ||
      message.includes('validateDOMNesting')
    )
  ) {
    return; // Suppress Recharts-related warnings
  }
  // Allow other warnings through
  originalWarn.apply(console, args);
};

const AllocationPage: React.FC = () => {
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [allocationView, setAllocationView] = useState(false);

  // Cell editing state
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    column: string;
    value: string;
  } | null>(null);

  // Filter states
  const [allocation, setAllocation] = useState({ enabled: false });
  const [publishType, setPublishType] = useState({
    open: false,
    selected: "Forecast",
    options: ["Forecast", "Actuals", "Plan"],
  });

  const [fiscalYear, setFiscalYear] = useState({
    open: false,
    options: {
      "FY'21": ["Q1", "Q2", "Q3", "Q4"],
      "FY'22": ["Q1", "Q2", "Q3", "Q4"],
      "FY'23": ["Q1", "Q2", "Q3", "Q4"],
      "FY'24": ["Q1", "Q2", "Q3", "Q4"],
      "FY'25": ["Q1", "Q2", "Q3", "Q4"],
      "FY'26": ["Q1", "Q2", "Q3", "Q4"],
      "FY'27": ["Q1", "Q2", "Q3", "Q4"],
      "FY'28": ["Q1", "Q2", "Q3", "Q4"],
    } as FiscalYearData,
    selected: {
      "FY'21": [],
      "FY'22": [],
      "FY'23": [],
      "FY'24": ["Q1", "Q2", "Q3", "Q4"],
      "FY'25": [],
      "FY'26": [],
      "FY'27": [],
      "FY'28": [],
    } as FiscalYearData,
  });

  const [functionalGroup, setFunctionalGroup] = useState({
    open: false,
    options: ["Media", "Ad Production (Geo)", "Ad Production (WW)"],
    selected: ["Media", "Ad Production (Geo)"] as string[],
  });

  const [snapshotTitle, setSnapshotTitle] = useState({
    open: false,
    options: [
      { label: "Snapshot A", value: "A" },
      { label: "Snapshot B", value: "B" },
      { label: "Snapshot C", value: "C" },
    ] as SnapshotOption[],
    selected: { label: "Snapshot A", value: "A" },
  });

  const [pullType, setPullType] = useState({
    open: false,
    options: ["Snapshot", "Production Details"],
    selected: "Snapshot",
  });

  const [allocationReference, setAllocationReference] = useState({
    open: false,
    options: ["Snapshot X", "Snapshot Y", "Snapshot Z"],
    selected: "Snapshot X",
  });

  // Data table states
  const [fullData, setFullData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Sorting and filtering states
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [columnFilters, setColumnFilters] = useState<
    Record<
      string,
      {
        selectedValues: string[];
        searchTerm: string;
        isOpen: boolean;
        includeSelectAll: boolean;
        includeBlanks: boolean;
        dateFrom?: string;
        dateTo?: string;
      }
    >
  >({});

  // Hover state for pie chart and table interaction
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  // Hover state for executive view cards
  const [hoveredExecutiveItem, setHoveredExecutiveItem] = useState<{
    cardId: string;
    itemName: string;
  } | null>(null);

  // Animation state for pie chart
  const [pieAnimationActive, setPieAnimationActive] = useState(true);

  // Chart type state for pie/bar chart toggle
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");

  // Left container chart type state
  const [leftChartType, setLeftChartType] = useState<"pie" | "bar">("pie");

  // Main content collapse state
  const [mainContentCollapsed, setMainContentCollapsed] = useState(false);

  // Executive view cards management
  interface ExecutiveCard {
    id: string;
    dimension: string;
    measure: string;
    chartType: "pie" | "bar";
    expanded?: boolean;
    colspan?: number;
  }

  const [executiveCards, setExecutiveCards] = useState<ExecutiveCard[]>([]);
  const [showExecutiveFilters, setShowExecutiveFilters] = useState(true);

  // Drag and drop states
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const dragOverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Border expansion states
  const [hoveredBorder, setHoveredBorder] = useState<{
    cardId: string;
    side: "left" | "right";
  } | null>(null);
  const [isDraggingBorder, setIsDraggingBorder] = useState(false);

  // History management for undo/redo functionality
  const [cardHistory, setCardHistory] = useState<ExecutiveCard[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const MAX_HISTORY_SIZE = 20;

  // Initialize history when first card is added
  useEffect(() => {
    if (executiveCards.length > 0 && cardHistory.length === 0) {
      setCardHistory([JSON.parse(JSON.stringify(executiveCards))]);
      setHistoryIndex(0);
    }
  }, [executiveCards.length, cardHistory.length]);

  // Refs for pill overflow management
  const fyPillsContainerRef = useRef<HTMLDivElement>(null);
  const fyOverflowIndicatorRef = useRef<HTMLDivElement>(null);
  const fgPillsContainerRef = useRef<HTMLDivElement>(null);
  const fgOverflowIndicatorRef = useRef<HTMLDivElement>(null);

  // File input ref for CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock CSV data
  const mockCsvData = `FISCAL_YEAR,QUARTER,FYQTR,FISCAL_STATE,ADV_PROD_BUDGET_OWNER,FUNCTIONAL_GRP,BUDGET_TYPE,BUDGET_SUBTYPE,ADV_PILLAR,MARCOM_PILLAR,PILLAR_GROUP,GEO_LEVEL_4_NAME,COST_TYPE,MEDIA_NOTE,CARRIER_NAME_ORIG,ADV_MARKETING_REGION,MARCOM_REGION,CAMPAIGN_TYPE,CAMPAIGN_SUB_TYPE,OTHER_CAMPAIGN_SUB_TYPE,CAMPAIGN,CAMPAIGN_ID,CREATIVE_ORIGIN,CREATIVE_TYPE,FINANCE_NOTES,ADVERT_AMOUNT_INCL_AGENCY_FEE,AMOUNT
2024,4,202404,Forecast,,X,M,Z,A,,B,,D,,,,,,,,,,,,,70.814,70.814
2024,4,202404,Forecast,,X,M,Z,A,,B,India,D,,,,,,,,,,,,,71.814,71.814
2024,4,202404,Forecast,,X,M,Z,B,,B,,D,,,,,,,,,,,,,72.814,72.814
2024,4,202404,Forecast,,X,M,Z,B,,B,Australia,D,,,,,,,,,,,,,73.814,73.814
2024,4,202404,Forecast,,Y,M,Z,C,,B,Switzerland,D,XYZ,,EU/MERT,,,,,,,,,,74.814,74.814
2024,4,202404,Forecast,,Y,M,Z,C,,B,Switzerland,D,,,EU/MERT,,,,,,,,,,75.814,75.814
2024,4,202404,Forecast,,Y,M,Z,C,,B,China mainland,D,,,CN/HK,,,,,,,,,,76.814,76.814
2024,4,202404,Forecast,,Y,M,Z,D,,B,Mexico,D,,,LATAM,,,,,,,,,,77.814,77.814
2024,4,202404,Forecast,,Y,M,Z,D,,B,Colombia,D,ABC,,LATAM,,,,,,,,,,78.814,78.814
2024,4,202404,Forecast,,Y,M,Z,D,,B,Chile,D,DEF,,LATAM,,,,,,,,,,79.814,79.814
2024,4,202404,Forecast,,Y,M,Z,A,,B,US,D,,,US,,,,,,,,,,80.814,80.814
2024,4,202404,Forecast,,Y,M,Z,A,,B,US,D,,,US,,,,,,,,,,81.814,81.814
2024,4,202404,Forecast,,Y,M,Z,B,,B,US,D,MNO,,US,,,,,,,,,,82.814,82.814
2024,4,202404,Forecast,,Y,M,Z,B,,B,,D,,,,,,,,,,,,,83.814,83.814
2024,4,202404,Forecast,,Z,M,Z,C,,B,US,D,,,US,,,,,,,,,,84.814,84.814
2024,4,202404,Forecast,,Z,M,Z,C,,B,Brazil,D,,,BR,,,,,,,,,,85.814,85.814
2024,4,202404,Forecast,,Z,M,Z,C,,B,Switzerland,D,,,EU/MERT,,,,,,,,,,86.814,86.814
2024,4,202404,Forecast,,Z,M,Z,D,,B,Japan,D,,,JP,,,,,,,,,,87.814,87.814
2024,4,202404,Forecast,,Z,M,Z,D,,B,Singapore,D,,,SEA,,,,,,,,,,88.814,88.814
2024,4,202404,Forecast,,Z,M,Z,D,,B,Indonesia,D,,,SEA,,,,,,,,,,89.814,89.814
2024,4,202404,Forecast,,Z,M,Z,A,,B,Mexico,D,,,LATAM,,,,,,,,,,90.814,90.814
2024,4,202404,Forecast,,Z,M,Z,A,,B,Italy,D,,,EU/MERT,,,,,,,,,,91.814,91.814
2024,4,202404,Forecast,,Z,M,Z,B,,B,Australia,D,,,ANZ,,,,,,,,,,92.814,92.814
2024,4,202404,Forecast,,Z,M,Z,B,,B,Malaysia,D,,,SEA,,,,,,,,,,93.814,93.814
2024,4,202404,Forecast,,Z,M,Z,C,,B,Mexico,D,,,LATAM,,,,,,,,,,94.814,94.814
2024,4,202404,Forecast,,Z,M,Z,C,,B,Switzerland,D,,,EU/MERT,,,,,,,,,,95.814,95.814
2024,4,202404,Forecast,,Z,M,Z,C,,B,Taiwan,D,,,CN/HK,,,,,,,,,,96.814,96.814
2024,4,202404,Forecast,,Z,M,Z,D,,B,Italy,D,,,EU/MERT,,,,,,,,,,97.814,97.814
2024,4,202404,Forecast,,Z,M,Z,D,,B,Brazil,D,,,BR,,,,,,,,,,98.814,98.814
2024,4,202404,Forecast,,Z,M,Z,D,,B,Italy,D,,,EU/MERT,,,,,,,,,,99.814,99.814
2024,4,202404,Forecast,,Z,M,Z,A,,B,UAE,D,,,EU/MERT,,,,,,,,,,100.814,100.814
2024,4,202404,Forecast,,Z,M,Z,A,,B,Malaysia,D,,,SEA,,,,,,,,,,101.814,101.814
2024,4,202404,Forecast,,Z,M,Z,B,,B,France,D,,,EU/MERT,,,,,,,,,,102.814,102.814
2024,4,202404,Forecast,,X,M,Z,B,,B,Switzerland,D,,,,,,,,,,,,,103.814,103.814
2024,4,202404,Forecast,,X,M,Z,C,,B,Brazil,D,,,,,,,,,,,,,104.814,104.814
2024,4,202404,Forecast,,X,M,Z,C,,B,Japan,D,,,,,,,,,,,,,105.814,105.814
2024,4,202404,Forecast,,X,M,Z,C,,B,,D,,,,,,,,,,,,,106.814,106.814
2024,4,202404,Forecast,,X,M,Z,D,,B,Canada,D,,,,,,,,,,,,,107.814,107.814
2024,4,202404,Forecast,,X,M,Z,D,,B,Japan,D,,,,,,,,,,,,,108.814,108.814`;

  // Utility functions
  const parseCSV = (csvData: string) => {
    const lines = csvData.trim().split("\n");
    const headerRow = lines.shift();
    if (!headerRow) return [];

    const newHeaders = headerRow.split(",");
    setHeaders(newHeaders);

    const data = lines.map((line) => {
      const values = line.split(",");
      return newHeaders.reduce((obj: any, header, index) => {
        obj[header.trim()] = values[index]?.replace(/"/g, "").trim() || "";
        return obj;
      }, {});
    });

    return data;
  };

  const loadData = () => {
    const data = parseCSV(mockCsvData);
    setFullData(data);
    setCurrentPage(1);
    setColumnFilters({});
    setSortConfig(null);
    setRowsPerPage(50); // Set higher default to fill space
  };

  // File import handler
  const handleFileImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if file is CSV
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      if (csvContent) {
        try {
          const data = parseCSV(csvContent);
          if (data.length === 0) {
            alert('The CSV file appears to be empty or invalid.');
            return;
          }

          // Update all data across the application
          setFullData(data);
          setCurrentPage(1);
          setColumnFilters({});
          setSortConfig(null);
          setRowsPerPage(50);

          // Reset any executive cards as they depend on the new data structure
          setExecutiveCards([]);
          setCardHistory([]);
          setHistoryIndex(-1);

          console.log(`Successfully imported ${data.length} rows from ${file.name}`);
        } catch (error) {
          console.error('Error parsing CSV file:', error);
          alert('Error parsing the CSV file. Please check the file format.');
        }
      }
    };

    reader.onerror = () => {
      alert('Error reading the file. Please try again.');
    };

    reader.readAsText(file);

    // Reset the input value so the same file can be selected again
    event.target.value = '';
  };

  // Sorting functions
  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const sortData = (data: any[]) => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      // Handle numbers (including those with commas and quotes)
      const aNum = parseFloat(aVal.replace(/[",]/g, ""));
      const bNum = parseFloat(bVal.replace(/[",]/g, ""));

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      }

      // Handle dates
      const aDate = new Date(aVal);
      const bDate = new Date(bVal);
      if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
        return sortConfig.direction === "asc"
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }

      // Handle strings
      const comparison = aVal.toString().localeCompare(bVal.toString());
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  };

  // Get unique values for a column
  const getUniqueValues = (column: string) => {
    const values = fullData.map((row) => row[column] || "").filter(Boolean);
    const uniqueValues = Array.from(new Set(values)).sort();
    return uniqueValues;
  };

  // Get blank values count for a column
  const getBlankCount = (column: string) => {
    return fullData.filter(
      (row) => !row[column] || row[column].toString().trim() === "",
    ).length;
  };

  // Initialize filter for a column
  const initializeFilter = (column: string) => {
    if (!columnFilters[column]) {
      setColumnFilters((prev) => ({
        ...prev,
        [column]: {
          selectedValues: [],
          searchTerm: "",
          isOpen: false,
          includeSelectAll: false,
          includeBlanks: false,
          ...(isDateColumn(column) && { dateFrom: "", dateTo: "" }),
        },
      }));
    }
  };

  // Toggle filter dropdown
  const toggleFilterDropdown = (column: string) => {
    initializeFilter(column);
    setColumnFilters((prev) => ({
      ...prev,
      [column]: {
        ...prev[column],
        isOpen: !prev[column]?.isOpen,
      },
    }));
  };

  // Update filter search term
  const updateFilterSearch = (column: string, searchTerm: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [column]: {
        ...prev[column],
        searchTerm,
      },
    }));
  };

  // Toggle specific value in filter
  const toggleFilterValue = (column: string, value: string) => {
    setColumnFilters((prev) => {
      const currentFilter = prev[column] || {
        selectedValues: [],
        searchTerm: "",
        isOpen: true,
        includeSelectAll: false,
        includeBlanks: false,
      };
      const selectedValues = currentFilter.selectedValues.includes(value)
        ? currentFilter.selectedValues.filter((v) => v !== value)
        : [...currentFilter.selectedValues, value];

      return {
        ...prev,
        [column]: {
          ...currentFilter,
          selectedValues,
        },
      };
    });
    setCurrentPage(1);
  };

  // Toggle Select All
  const toggleSelectAll = (column: string) => {
    const uniqueValues = getUniqueValues(column);
    setColumnFilters((prev) => {
      const currentFilter = prev[column] || {
        selectedValues: [],
        searchTerm: "",
        isOpen: true,
        includeSelectAll: false,
        includeBlanks: false,
      };
      const isAllSelected = uniqueValues.every((val) =>
        currentFilter.selectedValues.includes(val),
      );

      return {
        ...prev,
        [column]: {
          ...currentFilter,
          selectedValues: isAllSelected ? [] : uniqueValues,
          includeSelectAll: !isAllSelected,
        },
      };
    });
    setCurrentPage(1);
  };

  // Toggle Blanks
  const toggleBlanks = (column: string) => {
    setColumnFilters((prev) => {
      const currentFilter = prev[column] || {
        selectedValues: [],
        searchTerm: "",
        isOpen: true,
        includeSelectAll: false,
        includeBlanks: false,
      };

      return {
        ...prev,
        [column]: {
          ...currentFilter,
          includeBlanks: !currentFilter.includeBlanks,
        },
      };
    });
    setCurrentPage(1);
  };

  // Clear specific filter
  const clearFilter = (column: string) => {
    setColumnFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[column];
      return newFilters;
    });
    setCurrentPage(1);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setColumnFilters({});
    setCurrentPage(1);
  };

  // Cell editing functions
  const handleCellClick = (
    rowIndex: number,
    column: string,
    currentValue: string,
  ) => {
    const globalRowIndex = (currentPage - 1) * rowsPerPage + rowIndex;
    setEditingCell({
      rowIndex: globalRowIndex,
      column,
      value: currentValue,
    });
  };

  const handleCellSave = () => {
    if (!editingCell) return;

    const newData = [...fullData];
    newData[editingCell.rowIndex][editingCell.column] = editingCell.value;
    setFullData(newData);
    setEditingCell(null);
  };

  const handleCellCancel = () => {
    setEditingCell(null);
  };

  const handleCellValueChange = (value: string) => {
    if (editingCell) {
      setEditingCell({
        ...editingCell,
        value,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCellSave();
    } else if (e.key === "Escape") {
      handleCellCancel();
    }
  };

  // Update date filter
  const updateDateFilter = (
    column: string,
    type: "from" | "to",
    value: string,
  ) => {
    setColumnFilters((prev) => {
      const currentFilter = prev[column] || {
        selectedValues: [],
        searchTerm: "",
        isOpen: true,
        includeSelectAll: false,
        includeBlanks: false,
        dateFrom: "",
        dateTo: "",
      };

      return {
        ...prev,
        [column]: {
          ...currentFilter,
          [type === "from" ? "dateFrom" : "dateTo"]: value,
        },
      };
    });
    setCurrentPage(1);
  };

  // Check if column contains date values
  const isDateColumn = (column: string) => {
    if (fullData.length === 0) return false;

    // Check first few non-empty values to determine if column contains dates
    const sampleValues = fullData
      .map((row) => row[column])
      .filter((val) => val && val.toString().trim() !== "")
      .slice(0, 5);

    if (sampleValues.length === 0) return false;

    // Check if values match date patterns and are valid dates
    return sampleValues.every((val) => {
      const dateStr = val.toString();
      // Common date patterns: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, etc.
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
        /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY or M/D/YYYY
        /^\d{1,2}-\d{1,2}-\d{4}$/, // MM-DD-YYYY or M-D-YYYY
      ];

      const matchesPattern = datePatterns.some((pattern) =>
        pattern.test(dateStr),
      );
      const isValidDate = !isNaN(new Date(dateStr).getTime());

      return matchesPattern && isValidDate;
    });
  };

  // Check if column has active filters
  const hasActiveFilter = (column: string) => {
    const filter = columnFilters[column];
    if (isDateColumn(column)) {
      return filter && (filter.dateFrom || filter.dateTo);
    }
    return filter && (filter.selectedValues.length > 0 || filter.includeBlanks);
  };

  // Filter data based on multi-select filters and date ranges
  const filterData = (data: any[]) => {
    return data.filter((row) => {
      return Object.entries(columnFilters).every(([column, filter]) => {
        if (!filter) {
          return true; // No filter applied
        }

        // Handle date column filtering
        if (isDateColumn(column)) {
          if (!filter.dateFrom && !filter.dateTo) {
            return true; // No date filter applied
          }

          const cellValue = row[column]?.toString() || "";
          if (!cellValue || cellValue.trim() === "") {
            return false; // Exclude blank dates when date filter is active
          }

          const cellDate = new Date(cellValue);
          if (isNaN(cellDate.getTime())) {
            return false; // Invalid date
          }

          // Check date range
          if (filter.dateFrom) {
            const fromDate = new Date(filter.dateFrom);
            if (cellDate < fromDate) {
              return false;
            }
          }

          if (filter.dateTo) {
            const toDate = new Date(filter.dateTo);
            if (cellDate > toDate) {
              return false;
            }
          }

          return true;
        }

        // Handle regular column filtering
        if (filter.selectedValues.length === 0 && !filter.includeBlanks) {
          return true; // No filter applied
        }

        const cellValue = row[column]?.toString() || "";
        const isBlank = !cellValue || cellValue.trim() === "";

        // Check if blank values should be included
        if (isBlank && filter.includeBlanks) {
          return true;
        }

        // Check if value matches selected values
        return filter.selectedValues.includes(cellValue);
      });
    });
  };

  // Get filtered unique values based on search term
  const getFilteredUniqueValues = (column: string) => {
    const filter = columnFilters[column];
    const searchTerm = filter?.searchTerm?.toLowerCase() || "";
    const uniqueValues = getUniqueValues(column);

    if (!searchTerm) return uniqueValues;

    return uniqueValues.filter((value) =>
      value.toLowerCase().includes(searchTerm),
    );
  };

  // Fiscal year selection functions
  const toggleFiscalYearSelection = (year: string, quarter: string) => {
    setFiscalYear((prev) => {
      const newSelected = { ...prev.selected };
      const index = newSelected[year].indexOf(quarter);

      if (index === -1) {
        newSelected[year] = [...newSelected[year], quarter];
      } else {
        newSelected[year] = newSelected[year].filter((q) => q !== quarter);
      }

      return { ...prev, selected: newSelected };
    });
  };

  const isFiscalYearSelected = (year: string, quarter: string) => {
    return fiscalYear.selected[year]?.includes(quarter) || false;
  };

  const getFiscalYearSelections = (): SelectionPill[] => {
    const pills: SelectionPill[] = [];

    for (const year in fiscalYear.selected) {
      if (fiscalYear.selected[year].length === 4) {
        pills.push({
          id: year,
          year,
          type: "year",
          label: `'${year.slice(-2)}`,
        });
      } else {
        fiscalYear.selected[year].forEach((quarter) => {
          const yearNumber = year.slice(-2);
          pills.push({
            id: `${year}-${quarter}`,
            year,
            quarter,
            type: "quarter",
            label: `${yearNumber}'${quarter}`,
          });
        });
      }
    }

    return pills.sort((a, b) => a.id.localeCompare(b.id));
  };

  const removeFiscalYearSelection = (selection: SelectionPill) => {
    setFiscalYear((prev) => {
      const newSelected = { ...prev.selected };

      if (selection.type === "year") {
        newSelected[selection.year] = [];
      } else if (selection.quarter) {
        newSelected[selection.year] = newSelected[selection.year].filter(
          (q) => q !== selection.quarter,
        );
      }

      return { ...prev, selected: newSelected };
    });
  };

  const getFiscalYearSelectedCount = () => {
    return Object.values(fiscalYear.selected).reduce(
      (acc, curr) => acc + curr.length,
      0,
    );
  };

  // Functional group functions
  const toggleFunctionalGroup = (option: string) => {
    setFunctionalGroup((prev) => ({
      ...prev,
      selected: prev.selected.includes(option)
        ? prev.selected.filter((item) => item !== option)
        : [...prev.selected, option],
    }));
  };

  // Memoized filtered and sorted data
  const processedData = useMemo(() => {
    let data = filterData(fullData);
    data = sortData(data);
    return data;
  }, [fullData, columnFilters, sortConfig]);

  // Budget aggregation by Marketing Region for allocation view
  const budgetAggregation = useMemo(() => {
    if (!processedData.length) return [];

    const statusMap = new Map();
    let totalBudget = 0;

    processedData.forEach((row) => {
      const status = row.ADV_MARKETING_REGION || "Unknown";
      const budgetStr = row.AMOUNT || "0";
      const budget = parseFloat(budgetStr.replace(/[",]/g, "")) || 0;

      totalBudget += budget;

      if (statusMap.has(status)) {
        statusMap.set(status, statusMap.get(status) + budget);
      } else {
        statusMap.set(status, budget);
      }
    });

    return Array.from(statusMap.entries())
      .map(([status, budget]) => ({
        status,
        budget,
        percentage:
          totalBudget > 0 ? ((budget / totalBudget) * 100).toFixed(1) : "0.0",
        formattedBudget: budget.toLocaleString(),
      }))
      .sort((a, b) => b.budget - a.budget);
  }, [processedData]);

  // Budget aggregation by ADV_PILLAR for right container
  const pillarAggregation = useMemo(() => {
    if (!processedData.length) return [];

    const statusMap = new Map();
    let totalBudget = 0;

    processedData.forEach((row) => {
      const status = row.ADV_PILLAR || "Unknown";
      const budgetStr = row.AMOUNT || "0";
      const budget = parseFloat(budgetStr.replace(/[",]/g, "")) || 0;

      totalBudget += budget;

      if (statusMap.has(status)) {
        statusMap.set(status, statusMap.get(status) + budget);
      } else {
        statusMap.set(status, budget);
      }
    });

    return Array.from(statusMap.entries())
      .map(([status, budget]) => ({
        status,
        budget,
        percentage:
          totalBudget > 0 ? ((budget / totalBudget) * 100).toFixed(1) : "0.0",
        formattedBudget: budget.toLocaleString(),
      }))
      .sort((a, b) => b.budget - a.budget);
  }, [processedData]);

  // Disable animation after initial load to prevent re-animation on hover
  useEffect(() => {
    const timer = setTimeout(() => {
      setPieAnimationActive(false);
    }, 2000); // 2 seconds animation duration
    return () => clearTimeout(timer);
  }, [budgetAggregation.length]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < cardHistory.length - 1;

  // Keyboard shortcuts for executive view
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "+" && mainContentCollapsed) {
        event.preventDefault();
        addExecutiveCard();
      }
      // Undo/Redo shortcuts (only when in executive view)
      if (mainContentCollapsed) {
        if (event.ctrlKey && !event.shiftKey && event.key === "z") {
          event.preventDefault();
          undo();
        }
        if (
          event.ctrlKey &&
          ((event.shiftKey && event.key === "Z") || event.key === "y")
        ) {
          event.preventDefault();
          redo();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mainContentCollapsed, executiveCards.length, canUndo, canRedo]);

  // Pagination functions
  const getPaginatedData = () => {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return processedData.slice(start, end);
  };

  const getTotalPages = () => Math.ceil(processedData.length / rowsPerPage);

  const getFilteredCount = () => processedData.length;

  // Executive view utility functions
  const getAvailableDimensions = () => {
    return headers.filter(
      (header) =>
        header !== "AMOUNT" && header !== "ADVERT_AMOUNT_INCL_AGENCY_FEE",
    );
  };

  const getAvailableMeasures = () => {
    return ["AMOUNT", "ADVERT_AMOUNT_INCL_AGENCY_FEE"].filter((header) =>
      headers.includes(header),
    );
  };

  const addExecutiveCard = () => {
    if (executiveCards.length >= 6) return;

    const availableDimensions = getAvailableDimensions();
    const availableMeasures = getAvailableMeasures();

    if (availableDimensions.length === 0 || availableMeasures.length === 0)
      return;

    const newCard: ExecutiveCard = {
      id: `card-${Date.now()}`,
      dimension: availableDimensions[0],
      measure: availableMeasures[0],
      chartType: "pie",
    };

    setExecutiveCards((prev) => {
      const newCards = [...prev, newCard];
      saveToHistory(newCards);
      return newCards;
    });
  };

  const removeExecutiveCard = (cardId: string) => {
    setExecutiveCards((prev) => {
      const newCards = prev.filter((card) => card.id !== cardId);
      saveToHistory(newCards);
      return newCards;
    });
  };

  const updateExecutiveCard = (
    cardId: string,
    updates: Partial<ExecutiveCard>,
  ) => {
    setExecutiveCards((prev) => {
      const newCards = prev.map((card) =>
        card.id === cardId ? { ...card, ...updates } : card,
      );
      saveToHistory(newCards);
      return newCards;
    });
  };

  // History management functions
  const saveToHistory = (newCards: ExecutiveCard[]) => {
    setCardHistory((prev) => {
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
      setExecutiveCards(JSON.parse(JSON.stringify(cardHistory[prevIndex])));
    }
  };

  const redo = () => {
    if (historyIndex < cardHistory.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setExecutiveCards(JSON.parse(JSON.stringify(cardHistory[nextIndex])));
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    setDraggedCardId(cardId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", cardId);
  };

  const handleDragOver = (e: React.DragEvent, cardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    // Clear any existing timeout
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current);
    }

    // Set drag over state immediately for responsive feedback
    setDragOverCardId(cardId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear any existing timeout
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current);
    }

    // Use a timeout to avoid rapid state changes during diagonal movements
    dragOverTimeoutRef.current = setTimeout(() => {
      setDragOverCardId(null);
    }, 100);
  };

  const handleDrop = (e: React.DragEvent, targetCardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedCardId || draggedCardId === targetCardId) return;

    setExecutiveCards((prev) => {
      const draggedIndex = prev.findIndex((card) => card.id === draggedCardId);
      const targetIndex = prev.findIndex((card) => card.id === targetCardId);

      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const newCards = [...prev];

      // Reset expansion states for all cards to ensure clean layout
      const resetCards = newCards.map((card) => ({
        ...card,
        expanded: false,
        colspan: undefined,
      }));

      // Simple position swap: directly swap the positions of dragged and target cards
      const draggedCard = resetCards[draggedIndex];
      const targetCard = resetCards[targetIndex];

      // Swap the cards directly at their positions
      resetCards[draggedIndex] = targetCard;
      resetCards[targetIndex] = draggedCard;

      saveToHistory(resetCards);
      return resetCards;
    });

    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  // Border Expansion Handlers
  const handleBorderMouseEnter = (cardId: string, side: "left" | "right") => {
    if (!isDraggingBorder) {
      setHoveredBorder({ cardId, side });
    }
  };

  const handleBorderMouseLeave = () => {
    if (!isDraggingBorder) {
      setHoveredBorder(null);
    }
  };

  const handleBorderDragStart = (
    e: React.DragEvent,
    cardId: string,
    side: "left" | "right",
  ) => {
    e.stopPropagation();
    setIsDraggingBorder(true);
    setHoveredBorder({ cardId, side });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("cardId", cardId);
    e.dataTransfer.setData("side", side);
  };

  const handleBorderDrop = (e: React.DragEvent, targetCardId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const sourceCardId = e.dataTransfer.getData("cardId");
    const side = e.dataTransfer.getData("side") as "left" | "right";

    if (sourceCardId && sourceCardId !== targetCardId) {
      // Expand source card and remove target card
      setExecutiveCards((prev) => {
        const sourceCard = prev.find((card) => card.id === sourceCardId);
        const targetCard = prev.find((card) => card.id === targetCardId);

        if (!sourceCard || !targetCard) return prev;

        const newCards = prev
          .filter((card) => card.id !== targetCardId)
          .map((card) =>
            card.id === sourceCardId
              ? { ...card, expanded: true, colspan: 2 }
              : card,
          );

        saveToHistory(newCards);
        return newCards;
      });
    }

    setIsDraggingBorder(false);
    setHoveredBorder(null);
  };

  const handleBorderDragEnd = () => {
    setIsDraggingBorder(false);
    setHoveredBorder(null);
  };

  // Handler for expanding single card in last row to full width
  const handleSingleCardExpand = (cardId: string) => {
    setExecutiveCards((prev) => {
      const newCards = prev.map((card) =>
        card.id === cardId ? { ...card, expanded: true, colspan: 2 } : card,
      );

      saveToHistory(newCards);
      return newCards;
    });
  };

  // Helper function to check if a card is alone in the last row
  const isCardAloneInLastRow = (cardIndex: number) => {
    if (executiveCards.length <= 2) return false; // For 1-2 cards, no last row scenario

    // For 3-6 cards in 2-column grid
    if (executiveCards.length === 3 || executiveCards.length === 5) {
      // Card at index 2 (3rd card) is alone in second row for 3 cards
      // Card at index 4 (5th card) is alone in third row for 5 cards
      return cardIndex === executiveCards.length - 1;
    }

    return false;
  };

  const getCardData = (dimension: string, measure: string) => {
    if (!processedData.length) return [];

    const aggregationMap = new Map();
    let totalValue = 0;

    processedData.forEach((row) => {
      const dimensionValue = row[dimension] || "Unknown";
      const measureStr = row[measure] || "0";
      const value = parseFloat(measureStr.replace(/[",]/g, "")) || 0;

      aggregationMap.set(
        dimensionValue,
        (aggregationMap.get(dimensionValue) || 0) + value,
      );
      totalValue += value;
    });

    return Array.from(aggregationMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        formattedValue: value.toLocaleString(),
        percentage:
          totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.value - a.value);
  };

  // Intelligent data table row limiting helper
  const getTableRowLimit = (executiveCardsCount: number, dataLength: number = 10) => {
    // Calculate available space and determine optimal visible rows
    let maxRows;
    if (executiveCardsCount === 1) {
      maxRows = 12; // Most space available
    } else if (executiveCardsCount === 2) {
      maxRows = 8;  // Good amount of space
    } else if (executiveCardsCount <= 4) {
      maxRows = 6;  // Medium space, 3-4 cards
    } else {
      // 5-6 cards (3 rows) - ensure minimum 5 rows if data is available
      maxRows = Math.max(5, Math.min(5, dataLength)); // At least 5 rows, up to available data
    }

    // For other cases, don't show more rows than available data
    if (executiveCardsCount < 5) {
      return Math.min(maxRows, dataLength);
    }

    // For 3-row layouts (5-6 cards), always show at least 5 rows if data exists
    return maxRows;
  };

  // Intelligent X-axis labeling helper
  const getXAxisProps = (data: any[], containerWidth: number = 400) => {
    const dataLength = data.length;
    const avgLabelWidth = 60; // Estimated average width per label
    const availableWidth = containerWidth - 60; // Account for margins
    const spacePerLabel = availableWidth / dataLength;

    // If we have enough space (at least 80px per label), show straight labels
    const shouldUseStraightLabels = spacePerLabel >= 80 && dataLength <= 8;

    return {
      angle: shouldUseStraightLabels ? 0 : -45,
      textAnchor: shouldUseStraightLabels ? "middle" : "end",
      height: shouldUseStraightLabels ? 40 : 80,
      interval: shouldUseStraightLabels ? 0 : 0, // Show all labels
    };
  };

  // PDF Download functionality
  const handleDownloadPDF = () => {
    const cardsContainer = document.querySelector('[data-cards-container]');
    if (!cardsContainer) return;

    // Force all cards to be visible and rendered before capture
    const allCards = cardsContainer.querySelectorAll('[data-card]');
    allCards.forEach((card: any) => {
      card.style.willChange = 'auto';
      card.style.transform = 'none';
    });

    // Use html2canvas to capture the cards container
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => {
      const jsPDFScript = document.createElement('script');
      jsPDFScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      jsPDFScript.onload = () => {
        // @ts-ignore
        html2canvas(cardsContainer, {
          backgroundColor: '#1e3a8a', // Dark blue background to match UI theme
          scale: 1.5, // Reduced scale for better compatibility
          useCORS: true,
          allowTaint: true,
          logging: true,
          width: cardsContainer.offsetWidth,
          height: cardsContainer.offsetHeight,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          windowWidth: cardsContainer.offsetWidth,
          windowHeight: cardsContainer.offsetHeight,
          foreignObjectRendering: false,
          imageTimeout: 15000,
          onclone: (clonedDoc: Document) => {
            // Ensure all content is visible in the cloned document
            const clonedContainer = clonedDoc.querySelector('[data-cards-container]');
            if (clonedContainer) {
              (clonedContainer as HTMLElement).style.transform = 'none';
              (clonedContainer as HTMLElement).style.overflow = 'visible';
            }
            const clonedCards = clonedDoc.querySelectorAll('[data-card]');
            clonedCards.forEach((card: any) => {
              card.style.transform = 'none';
              card.style.overflow = 'visible';
              card.style.position = 'relative';
            });
          }
        }).then((canvas: HTMLCanvasElement) => {
          const imgData = canvas.toDataURL('image/png');

          // @ts-ignore
          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
            unit: 'mm',
            format: 'a4'
          });

          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();

          // Set PDF background to match the dark theme
          pdf.setFillColor(30, 58, 138); // #1e3a8a in RGB
          pdf.rect(0, 0, pageWidth, pageHeight, 'F');

          const imgWidth = pageWidth - 20; // 10mm margin on each side
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          let heightLeft = imgHeight;
          let position = 10; // 10mm top margin

          // Add Apple logo and title
          pdf.setFontSize(16);
          pdf.setTextColor(255, 255, 255); // White text

          // Calculate positions for centered layout with logo + text
          const titleText = ' Advertising Allocation';
          const titleWidth = pdf.getTextWidth(titleText);
          const logoWidth = 8; // Approximate width for Apple logo
          const totalWidth = logoWidth + titleWidth;
          const startX = (pageWidth - totalWidth) / 2;

          // Add Apple logo using Unicode Apple symbol
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(18);
          pdf.text('\uF8FF', startX, position); // Apple logo Unicode

          // Add title text next to logo
          pdf.setFontSize(16);
          pdf.text(titleText, startX + logoWidth, position);
          position += 15;

          // Add current date with light gray text
          pdf.setFontSize(10);
          pdf.setTextColor(200, 200, 200); // Light gray text
          pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, position, { align: 'center' });
          position += 15;

          // Add the image
          if (heightLeft < pageHeight - position) {
            // Image fits on one page
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
          } else {
            // Image needs multiple pages
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= (pageHeight - position);

            while (heightLeft > 0) {
              pdf.addPage();
              position = 10;
              const imgY = heightLeft - imgHeight;
              pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight, undefined, 'FAST', imgY);
              heightLeft -= (pageHeight - 10);
            }
          }

          pdf.save(`MarFi-Dashboard-${new Date().toISOString().split('T')[0]}.pdf`);
        }).catch((error: any) => {
          console.error('Error generating PDF:', error);
          alert('Error generating PDF. Please try again.');
        });
      };
      document.head.appendChild(jsPDFScript);
    };
    document.head.appendChild(script);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < getTotalPages()) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Close dropdowns when clicking outside
  const handleClickOutside = useCallback((event: MouseEvent) => {
    const target = event.target as Element;

    if (!target.closest('[data-dropdown="publish-type"]')) {
      setPublishType((prev) => ({ ...prev, open: false }));
    }
    if (!target.closest('[data-dropdown="fiscal-year"]')) {
      setFiscalYear((prev) => ({ ...prev, open: false }));
    }
    if (!target.closest('[data-dropdown="functional-group"]')) {
      setFunctionalGroup((prev) => ({ ...prev, open: false }));
    }
    if (!target.closest('[data-dropdown="snapshot-title"]')) {
      setSnapshotTitle((prev) => ({ ...prev, open: false }));
    }
    if (!target.closest('[data-dropdown="pull-type"]')) {
      setPullType((prev) => ({ ...prev, open: false }));
    }
    if (!target.closest('[data-dropdown="allocation-reference"]')) {
      setAllocationReference((prev) => ({ ...prev, open: false }));
    }

    // Close column filter dropdowns
    if (!target.closest('[data-dropdown^="column-filter-"]')) {
      setColumnFilters((prev) => {
        const newFilters = { ...prev };
        Object.keys(newFilters).forEach((column) => {
          if (newFilters[column]) {
            newFilters[column] = { ...newFilters[column], isOpen: false };
          }
        });
        return newFilters;
      });
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleClickOutside]);

  // Pill overflow management
  const adjustPills = useCallback(
    (type: "fy" | "fg") => {
      const container =
        type === "fy"
          ? fyPillsContainerRef.current
          : fgPillsContainerRef.current;
      const overflowEl =
        type === "fy"
          ? fyOverflowIndicatorRef.current
          : fgOverflowIndicatorRef.current;

      if (!container || !overflowEl) return;

      const pills = Array.from(
        container.querySelectorAll(".pill-item"),
      ) as HTMLElement[];

      const totalPills =
        type === "fy"
          ? getFiscalYearSelections().length
          : functionalGroup.selected.length;

      // Reset all pills to visible and hide overflow indicator
      pills.forEach((p) => (p.style.display = "flex"));
      overflowEl.style.display = "none";

      // If only 1 or no pills, no overflow needed
      if (totalPills <= 1) return;

      // Same logic for both FY and FG: Show 1 pill + overflow if 2 or more total
      if (totalPills >= 2) {
        // Hide all pills except the first one
        for (let i = 1; i < pills.length; i++) {
          pills[i].style.display = "none";
        }

        // Show overflow indicator
        overflowEl.style.display = "flex";
        const hiddenCount = totalPills - 1; // -1 because we show 1 pill
        const span = overflowEl.querySelector("span");
        if (span) span.textContent = `+${hiddenCount} more`;
      }
    },
    [functionalGroup.selected, fiscalYear.selected],
  );

  useEffect(() => {
    adjustPills("fy");
  }, [fiscalYear.selected, adjustPills]);

  useEffect(() => {
    adjustPills("fg");
  }, [functionalGroup.selected, adjustPills]);

  // Resize observer for responsive pill adjustment
  useEffect(() => {
    const fyContainer = fyPillsContainerRef.current;
    const fgContainer = fgPillsContainerRef.current;

    if (!fyContainer || !fgContainer) return;

    const resizeObserver = new ResizeObserver(() => {
      adjustPills("fy");
      adjustPills("fg");
    });

    resizeObserver.observe(fyContainer);
    resizeObserver.observe(fgContainer);

    return () => {
      resizeObserver.disconnect();
    };
  }, [adjustPills]);

  return (
    <div className="flex flex-col h-full w-full min-w-0 max-w-full overflow-hidden">
        {/* Header */}
        <header className="px-4 py-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 ml-8">
              <svg
                className="w-6 h-6 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <h1 className="text-xl font-bold tracking-wider">MarFi</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-500/50 text-sm font-bold">
                KD
              </div>
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <ChevronDown
                  className={`w-5 h-5 transform transition-transform duration-300 ${!filtersOpen ? "rotate-180" : ""}`}
                />
              </button>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 items-end">
                {/* Publish Type Filter */}
                <div className="relative" data-dropdown="publish-type">
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Publish Type
                  </label>
                  <div
                    onClick={() =>
                      setPublishType((prev) => ({ ...prev, open: !prev.open }))
                    }
                    className="glass-select glass-select-wrapper flex items-center w-full rounded-lg px-3 h-[42px] cursor-pointer"
                  >
                    <div className="flex-grow flex flex-wrap items-center gap-1.5 h-full min-w-0 max-w-full">
                      <div className="pill text-xs font-medium flex items-center px-2 py-0.5 rounded-md">
                        <span>{publishType.selected}</span>
                      </div>
                    </div>
                  </div>
                  {publishType.open && (
                    <div className="absolute z-10 top-full mt-2 dropdown-panel rounded-xl shadow-lg w-full p-2">
                      <div className="space-y-1">
                        {publishType.options.map((option) => (
                          <div
                            key={option}
                            onClick={() => {
                              setPublishType((prev) => ({
                                ...prev,
                                selected: option,
                                open: false,
                              }));
                            }}
                            className={`dropdown-option text-left rounded-md px-2 py-1 cursor-pointer text-xs ${
                              publishType.selected === option ? "selected" : ""
                            }`}
                          >
                            <span>{option}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Fiscal Year & Quarter Filter */}
                <div className="relative" data-dropdown="fiscal-year">
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Fiscal Year & Quarter
                  </label>
                  <div
                    onClick={() =>
                      setFiscalYear((prev) => ({ ...prev, open: !prev.open }))
                    }
                    className="glass-select glass-select-wrapper flex items-center w-full rounded-lg px-3 h-[42px] cursor-pointer"
                  >
                    <div
                      ref={fyPillsContainerRef}
                      className="flex-grow flex items-center gap-1.5 overflow-hidden h-full min-w-0 max-w-full"
                    >
                      {getFiscalYearSelectedCount() === 0 ? (
                        <span className="text-white/50">Select...</span>
                      ) : (
                        <>
                          {getFiscalYearSelections().map((selection) => (
                            <div
                              key={selection.id}
                              className="pill-item pill text-xs font-medium flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md flex-shrink-0"
                            >
                              <span>{selection.label}</span>
                              <X
                                className="h-3.5 w-3.5 cursor-pointer hover:text-red-400"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFiscalYearSelection(selection);
                                }}
                              />
                            </div>
                          ))}
                          <div
                            ref={fyOverflowIndicatorRef}
                            className="pill text-xs font-medium flex items-center px-2 py-0.5 rounded-md"
                            style={{ display: "none" }}
                          >
                            <span></span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {fiscalYear.open && (
                    <div className="absolute z-10 top-full mt-2 dropdown-panel rounded-xl shadow-lg w-full">
                      <div className="overflow-x-auto p-4">
                        <div className="flex space-x-6">
                          {Object.entries(fiscalYear.options).map(
                            ([year, quarters]) => (
                              <div key={year}>
                                <h4 className="font-normal mb-3 text-white/90 text-center text-xs">
                                  {year}
                                </h4>
                                <div className="space-y-2">
                                  {quarters.map((quarter) => (
                                    <div
                                      key={quarter}
                                      onClick={() =>
                                        toggleFiscalYearSelection(year, quarter)
                                      }
                                      className={`quarter-cell text-center rounded-md px-2 py-1 cursor-pointer text-xs ${
                                        isFiscalYearSelected(year, quarter)
                                          ? "selected"
                                          : ""
                                      }`}
                                    >
                                      <span>{quarter}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Functional Group Filter */}
                <div className="relative" data-dropdown="functional-group">
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Functional Group
                  </label>
                  <div
                    onClick={() =>
                      setFunctionalGroup((prev) => ({
                        ...prev,
                        open: !prev.open,
                      }))
                    }
                    className="glass-select glass-select-wrapper flex items-center w-full rounded-lg px-3 h-[42px] cursor-pointer"
                  >
                    <div
                      ref={fgPillsContainerRef}
                      className="flex-grow flex items-center gap-1.5 overflow-hidden h-full min-w-0 max-w-full"
                    >
                      {functionalGroup.selected.length === 0 ? (
                        <span className="text-white/50">Select...</span>
                      ) : (
                        <>
                          {functionalGroup.selected.map((item) => (
                            <div
                              key={item}
                              className="pill-item pill text-xs font-medium flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-md flex-shrink-0"
                            >
                              <span>{item}</span>
                              <X
                                className="h-3.5 w-3.5 cursor-pointer hover:text-red-400"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFunctionalGroup(item);
                                }}
                              />
                            </div>
                          ))}
                          <div
                            ref={fgOverflowIndicatorRef}
                            className="pill text-xs font-medium flex items-center px-2 py-0.5 rounded-md"
                            style={{ display: "none" }}
                          >
                            <span></span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {functionalGroup.open && (
                    <div className="absolute z-10 top-full mt-2 dropdown-panel rounded-xl shadow-lg w-96 p-4">
                      <div className="space-y-2">
                        {functionalGroup.options.map((option) => (
                          <label
                            key={option}
                            className="flex items-center space-x-1.5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={functionalGroup.selected.includes(
                                option,
                              )}
                              onChange={() => toggleFunctionalGroup(option)}
                              className="h-3 w-3 rounded custom-checkbox bg-transparent border-white/30"
                            />
                            <span className="text-xs">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Ad Production (WW) Pull Type Filter */}
                {functionalGroup.selected.includes("Ad Production (WW)") && (
                  <div className="relative" data-dropdown="pull-type">
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Ad Production(WW) Pull Type
                    </label>
                    <div
                      onClick={() =>
                        setPullType((prev) => ({ ...prev, open: !prev.open }))
                      }
                      className="glass-select glass-select-wrapper flex items-center w-full rounded-lg px-3 h-[42px] cursor-pointer"
                    >
                      <div className="flex-grow flex flex-wrap items-center gap-1.5 h-full min-w-0 max-w-full">
                        <div className="pill text-xs font-medium flex items-center px-2 py-0.5 rounded-md">
                          <span>{pullType.selected}</span>
                        </div>
                      </div>
                    </div>
                    {pullType.open && (
                      <div className="absolute z-10 top-full mt-2 dropdown-panel rounded-xl shadow-lg w-full p-2">
                        <div className="space-y-1">
                          {pullType.options.map((option) => (
                            <div
                              key={option}
                              onClick={() => {
                                setPullType((prev) => ({
                                  ...prev,
                                  selected: option,
                                  open: false,
                                }));
                              }}
                              className={`dropdown-option text-left rounded-md px-2 py-1 cursor-pointer text-xs ${
                                pullType.selected === option ? "selected" : ""
                              }`}
                            >
                              <span>{option}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Snapshot Title Filter */}
                <div className="relative" data-dropdown="snapshot-title">
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Snapshot Title
                  </label>
                  <div
                    onClick={() =>
                      setSnapshotTitle((prev) => ({
                        ...prev,
                        open: !prev.open,
                      }))
                    }
                    className="glass-select glass-select-wrapper flex items-center w-full rounded-lg px-3 h-[42px] cursor-pointer"
                  >
                    <div className="flex-grow flex flex-wrap items-center gap-1.5 h-full min-w-0 max-w-full">
                      <div className="pill text-xs font-medium flex items-center px-2 py-0.5 rounded-md">
                        <span>{snapshotTitle.selected.label}</span>
                      </div>
                    </div>
                  </div>
                  {snapshotTitle.open && (
                    <div className="absolute z-10 top-full mt-2 dropdown-panel rounded-xl shadow-lg w-full p-2">
                      <div className="space-y-1">
                        {snapshotTitle.options.map((option) => (
                          <div
                            key={option.value}
                            onClick={() => {
                              setSnapshotTitle((prev) => ({
                                ...prev,
                                selected: option,
                                open: false,
                              }));
                            }}
                            className={`dropdown-option text-left rounded-md px-2 py-1 cursor-pointer text-xs ${
                              snapshotTitle.selected.value === option.value
                                ? "selected"
                                : ""
                            }`}
                          >
                            <span>{option.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Allocation Reference Filter */}
                {allocation.enabled && (
                  <div
                    className="relative"
                    data-dropdown="allocation-reference"
                  >
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Allocation Reference
                    </label>
                    <div
                      onClick={() =>
                        setAllocationReference((prev) => ({
                          ...prev,
                          open: !prev.open,
                        }))
                      }
                      className="glass-select glass-select-wrapper flex items-center w-full rounded-lg px-3 h-[42px] cursor-pointer"
                    >
                      <div className="flex-grow flex flex-wrap items-center gap-1.5 h-full min-w-0 max-w-full">
                        <div className="pill text-xs font-medium flex items-center px-2 py-0.5 rounded-md">
                          <span>{allocationReference.selected}</span>
                        </div>
                      </div>
                    </div>
                    {allocationReference.open && (
                      <div className="absolute z-10 top-full mt-2 dropdown-panel rounded-xl shadow-lg w-full p-2">
                        <div className="space-y-1">
                          {allocationReference.options.map((option) => (
                            <div
                              key={option}
                              onClick={() => {
                                setAllocationReference((prev) => ({
                                  ...prev,
                                  selected: option,
                                  open: false,
                                }));
                              }}
                              className={`dropdown-option text-left rounded-md px-2 py-1 cursor-pointer text-xs ${
                                allocationReference.selected === option
                                  ? "selected"
                                  : ""
                              }`}
                            >
                              <span>{option}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-between items-center">
                {/* Allocation Toggle */}
                <div className="flex items-center space-x-3">
                  <label className="block text-sm font-medium text-white/80">
                    Allocation
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setAllocation((prev) => ({ enabled: !prev.enabled }))
                    }
                    className={`relative inline-flex flex-shrink-0 h-6 w-12 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white ${
                      allocation.enabled ? "bg-blue-600/70" : "bg-gray-600/50"
                    }`}
                  >
                    <span className="sr-only">Use setting</span>
                    <span
                      aria-hidden="true"
                      className={`absolute inset-0 h-full w-full flex items-center justify-end pr-1.5 transition-opacity ${
                        allocation.enabled
                          ? "opacity-0 ease-out duration-100"
                          : "opacity-100 ease-in duration-200"
                      }`}
                    >
                      <span className="text-[10px] text-gray-200 font-semibold">
                        Off
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`absolute inset-0 h-full w-full flex items-center justify-start pl-1.5 transition-opacity ${
                        allocation.enabled
                          ? "opacity-100 ease-in duration-200"
                          : "opacity-0 ease-out duration-100"
                      }`}
                    >
                      <span className="text-[10px] text-white font-semibold">
                        On
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                        allocation.enabled ? "translate-x-6" : "translate-x-0"
                      }`}
                    ></span>
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleFileImport}
                    className="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-lg px-6 py-2 transition-colors duration-300"
                    title="Import CSV file"
                  >
                    Import
                  </button>
                  <button
                    onClick={loadData}
                    className="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-lg px-6 py-2 transition-colors duration-300"
                    title="Load sample data"
                  >
                    Run
                  </button>
                  {/* Hidden file input for CSV import */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Welcome Message when no data is loaded */}
        {fullData.length === 0 && (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="mb-6">
                <svg
                  className="w-20 h-20 mx-auto text-white/30"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v14a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Welcome to MarFi
              </h2>
              <p className="text-white/70 mb-8 max-w-md mx-auto">
                Load your data to start analyzing marketing finance metrics with
                interactive charts and advanced filtering capabilities.
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleFileImport}
                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 hover:text-blue-200 font-semibold text-sm rounded-lg px-8 py-3 transition-colors duration-300 border border-blue-400/30 hover:border-blue-400/50"
                  title="Import your own CSV file"
                >
                  Import Data
                </button>
                <button
                  onClick={loadData}
                  className="bg-green-500/20 hover:bg-green-500/30 text-green-300 hover:text-green-200 font-semibold text-sm rounded-lg px-8 py-3 transition-colors duration-300 border border-green-400/30 hover:border-green-400/50"
                  title="Load the built-in sample dataset"
                >
                  Load Sample Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Control Buttons Row */}
        {fullData.length > 0 && (
          <div className="px-4 pb-2 flex justify-between items-center">
            <button
              onClick={() => {
                setAllocationView(!allocationView);
                if (!allocationView) {
                  setFiltersOpen(false);
                  setRowsPerPage(20);
                  setCurrentPage(1);
                }
              }}
              className="text-white hover:text-blue-300 font-medium text-sm transition-colors duration-300 flex items-center gap-2"
            >
              Allocation Check
              <ChevronDown
                className={`w-4 h-4 transform transition-transform duration-300 ${
                  allocationView ? "rotate-180" : ""
                }`}
              />
            </button>

            <button
              onClick={() => {
                setMainContentCollapsed(!mainContentCollapsed);
                if (!mainContentCollapsed) {
                  // When expanding Analyzer, collapse filters and allocation view
                  setFiltersOpen(false);
                  setAllocationView(false);
                }
              }}
              className="text-white hover:text-green-300 font-medium text-sm transition-colors duration-300 flex items-center gap-2"
              title={
                mainContentCollapsed
                  ? "Expand Analyzer"
                  : "Collapse to Analyzer"
              }
            >
              Analyzer
              <ChevronDown
                className={`w-4 h-4 transform transition-transform duration-300 ${
                  mainContentCollapsed ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        )}

        {/* Data Table Section */}
        {!mainContentCollapsed && (
          <section
            className={`px-4 pb-2 flex flex-col min-h-0 min-w-0 max-w-full overflow-hidden transition-all duration-500 ${
              allocationView ? "flex-[1.2]" : "flex-1"
            }`}
          >
            <div
              className="flex-1 rounded-2xl border border-white/10 overflow-hidden flex flex-col min-w-0"
              style={{ background: "rgba(255, 255, 255, 0.05)" }}
            >
              {/* Table Controls */}
              {fullData.length > 0 &&
                Object.keys(columnFilters).some((col) =>
                  hasActiveFilter(col),
                ) && (
                  <div className="flex items-center justify-between p-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={clearAllFilters}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                      >
                        Clear All Filters
                      </button>
                    </div>
                    <div className="text-xs text-white/60">
                      Showing {getFilteredCount()} of {fullData.length} records
                      (filtered)
                    </div>
                  </div>
                )}

              <div className="overflow-x-auto overflow-y-auto max-w-full w-full">
                <table className="w-full text-sm text-left" style={{ minWidth: 'max-content' }}>
                  <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm">
                    {/* Column Headers */}
                    <tr>
                      {headers.map((header, index) => (
                        <th
                          key={header}
                          className={`relative group ${
                            index < headers.length - 1
                              ? "border-r border-white/10"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between p-2 px-4">
                            <button
                              onClick={() => handleSort(header)}
                              className="flex items-center gap-2 font-semibold text-left text-xs whitespace-nowrap hover:text-blue-300 transition-colors min-w-0"
                            >
                              <span>{header}</span>
                              <div className="flex flex-col">
                                <ChevronUp
                                  className={`w-3 h-3 -mb-1 transition-colors ${
                                    sortConfig?.key === header &&
                                    sortConfig.direction === "asc"
                                      ? "text-blue-400"
                                      : "text-white/30"
                                  }`}
                                />
                                <ChevronDown
                                  className={`w-3 h-3 transition-colors ${
                                    sortConfig?.key === header &&
                                    sortConfig.direction === "desc"
                                      ? "text-blue-400"
                                      : "text-white/30"
                                  }`}
                                />
                              </div>
                            </button>

                            {/* Filter Button */}
                            <div
                              className="relative"
                              data-dropdown={`column-filter-${header}`}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFilterDropdown(header);
                                }}
                                className={`p-1 rounded hover:bg-white/10 transition-colors ${
                                  hasActiveFilter(header)
                                    ? "text-blue-400"
                                    : "text-white/40 hover:text-white/70"
                                }`}
                                title={`Filter ${header}`}
                              >
                                <Filter className="w-3.5 h-3.5" />
                              </button>

                              {/* Filter Dropdown */}
                              {columnFilters[header]?.isOpen && (
                                <div
                                  className={`absolute z-50 top-full mt-1 w-64 max-h-80 dropdown-panel rounded-xl shadow-xl border border-white/20 overflow-hidden ${
                                    index === 0 ? "left-0" : "right-0"
                                  }`}
                                >
                                  {isDateColumn(header) ? (
                                    /* Date Filter */
                                    <div className="p-3">
                                      <div className="space-y-3">
                                        <div>
                                          <label className="block text-xs font-medium text-white/80 mb-1">
                                            From Date
                                          </label>
                                          <input
                                            type="date"
                                            value={
                                              columnFilters[header]?.dateFrom ||
                                              ""
                                            }
                                            onChange={(e) =>
                                              updateDateFilter(
                                                header,
                                                "from",
                                                e.target.value,
                                              )
                                            }
                                            className="w-full bg-blue-500/20 border border-blue-400/30 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-medium text-white/80 mb-1">
                                            To Date
                                          </label>
                                          <input
                                            type="date"
                                            value={
                                              columnFilters[header]?.dateTo ||
                                              ""
                                            }
                                            onChange={(e) =>
                                              updateDateFilter(
                                                header,
                                                "to",
                                                e.target.value,
                                              )
                                            }
                                            className="w-full bg-blue-500/20 border border-blue-400/30 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                                          />
                                        </div>
                                      </div>

                                      {/* Clear Filter Button */}
                                      {hasActiveFilter(header) && (
                                        <div className="mt-3 pt-3 border-t border-white/10">
                                          <button
                                            onClick={() => clearFilter(header)}
                                            className="w-full px-3 py-1.5 text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-md transition-colors"
                                          >
                                            Clear Filter
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    /* Regular Filter */
                                    <>
                                      {/* Search Box */}
                                      <div className="p-3 border-b border-white/10">
                                        <div className="relative">
                                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-white/50" />
                                          <input
                                            type="text"
                                            placeholder="Search..."
                                            value={
                                              columnFilters[header]
                                                ?.searchTerm || ""
                                            }
                                            onChange={(e) =>
                                              updateFilterSearch(
                                                header,
                                                e.target.value,
                                              )
                                            }
                                            className="w-full bg-blue-500/20 border border-blue-400/30 rounded-md pl-8 pr-3 py-2 text-xs text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                                          />
                                        </div>
                                      </div>

                                      {/* Filter Options */}
                                      <div className="max-h-48 overflow-y-auto">
                                        {/* Select All */}
                                        <label className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={getUniqueValues(
                                              header,
                                            ).every((val) =>
                                              columnFilters[
                                                header
                                              ]?.selectedValues.includes(val),
                                            )}
                                            onChange={() =>
                                              toggleSelectAll(header)
                                            }
                                            className="w-4 h-4 bg-blue-500 border-0 rounded focus:ring-blue-400"
                                          />
                                          <span className="text-xs font-medium text-white">
                                            (Select All)
                                          </span>
                                        </label>

                                        {/* Blanks */}
                                        {getBlankCount(header) > 0 && (
                                          <label className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={
                                                columnFilters[header]
                                                  ?.includeBlanks || false
                                              }
                                              onChange={() =>
                                                toggleBlanks(header)
                                              }
                                              className="w-4 h-4 bg-blue-500 border-0 rounded focus:ring-blue-400"
                                            />
                                            <span className="text-xs text-white">
                                              (Blanks) [{getBlankCount(header)}]
                                            </span>
                                          </label>
                                        )}

                                        {/* Individual Values */}
                                        {getFilteredUniqueValues(header).map(
                                          (value) => (
                                            <label
                                              key={value}
                                              className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={
                                                  columnFilters[
                                                    header
                                                  ]?.selectedValues.includes(
                                                    value,
                                                  ) || false
                                                }
                                                onChange={() =>
                                                  toggleFilterValue(
                                                    header,
                                                    value,
                                                  )
                                                }
                                                className="w-4 h-4 bg-blue-500 border-0 rounded focus:ring-blue-400"
                                              />
                                              <span className="text-xs text-white truncate">
                                                {value}
                                              </span>
                                            </label>
                                          ),
                                        )}
                                      </div>

                                      {/* Clear Filter Button */}
                                      {hasActiveFilter(header) && (
                                        <div className="p-3 border-t border-white/10">
                                          <button
                                            onClick={() => clearFilter(header)}
                                            className="w-full px-3 py-1.5 text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-md transition-colors"
                                          >
                                            Clear Filter
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>

                    {/* Filter Row */}
                    {false && (
                      <tr className="bg-slate-800/50">
                        {headers.map((header, index) => (
                          <th
                            key={`filter-${header}`}
                            className={`relative p-2 px-4 ${
                              index < headers.length - 1
                                ? "border-r border-white/10"
                                : ""
                            }`}
                            data-dropdown={`column-filter-${header}`}
                          >
                            <button
                              onClick={() => toggleFilterDropdown(header)}
                              className={`w-full flex items-center justify-between bg-white/10 border border-white/20 rounded-md px-2 py-1 text-xs text-white hover:bg-white/20 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors ${
                                hasActiveFilter(header)
                                  ? "bg-blue-500/20 border-blue-400/50"
                                  : ""
                              }`}
                            >
                              <span className="truncate">
                                {hasActiveFilter(header)
                                  ? `${columnFilters[header]?.selectedValues.length || 0}${columnFilters[header]?.includeBlanks ? "+B" : ""} selected`
                                  : `Filter ${header}...`}
                              </span>
                              <Filter className="w-3 h-3 ml-1 flex-shrink-0" />
                            </button>

                            {/* Filter Dropdown */}
                            {columnFilters[header]?.isOpen && (
                              <div className="absolute z-50 top-full left-0 mt-1 w-64 max-h-80 dropdown-panel rounded-xl shadow-xl border border-white/20 overflow-hidden">
                                {/* Search Box */}
                                <div className="p-3 border-b border-white/10">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-white/50" />
                                    <input
                                      type="text"
                                      placeholder="Search..."
                                      value={
                                        columnFilters[header]?.searchTerm || ""
                                      }
                                      onChange={(e) =>
                                        updateFilterSearch(
                                          header,
                                          e.target.value,
                                        )
                                      }
                                      className="w-full bg-blue-500/20 border border-blue-400/30 rounded-md pl-8 pr-3 py-2 text-xs text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                                    />
                                  </div>
                                </div>

                                {/* Filter Options */}
                                <div className="max-h-48 overflow-y-auto">
                                  {/* Select All */}
                                  <label className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={getUniqueValues(header).every(
                                        (val) =>
                                          columnFilters[
                                            header
                                          ]?.selectedValues.includes(val),
                                      )}
                                      onChange={() => toggleSelectAll(header)}
                                      className="w-4 h-4 bg-blue-500 border-0 rounded focus:ring-blue-400"
                                    />
                                    <span className="text-xs font-medium text-white">
                                      (Select All)
                                    </span>
                                  </label>

                                  {/* Blanks */}
                                  {getBlankCount(header) > 0 && (
                                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={
                                          columnFilters[header]
                                            ?.includeBlanks || false
                                        }
                                        onChange={() => toggleBlanks(header)}
                                        className="w-4 h-4 bg-blue-500 border-0 rounded focus:ring-blue-400"
                                      />
                                      <span className="text-xs text-white">
                                        (Blanks) [{getBlankCount(header)}]
                                      </span>
                                    </label>
                                  )}

                                  {/* Individual Values */}
                                  {getFilteredUniqueValues(header).map(
                                    (value) => (
                                      <label
                                        key={value}
                                        className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={
                                            columnFilters[
                                              header
                                            ]?.selectedValues.includes(value) ||
                                            false
                                          }
                                          onChange={() =>
                                            toggleFilterValue(header, value)
                                          }
                                          className="w-4 h-4 bg-blue-500 border-0 rounded focus:ring-blue-400"
                                        />
                                        <span className="text-xs text-white truncate">
                                          {value}
                                        </span>
                                      </label>
                                    ),
                                  )}
                                </div>

                                {/* Clear Filter Button */}
                                {hasActiveFilter(header) && (
                                  <div className="p-3 border-t border-white/10">
                                    <button
                                      onClick={() => clearFilter(header)}
                                      className="w-full px-3 py-1.5 text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-md transition-colors"
                                    >
                                      Clear Filter
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {fullData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={headers.length || 10}
                          className="text-center p-8 text-white/60"
                        >
                          Click Run or Import to load data.
                        </td>
                      </tr>
                    ) : processedData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={headers.length}
                          className="text-center p-8 text-white/60"
                        >
                          No data matches the current filters.
                        </td>
                      </tr>
                    ) : (
                      getPaginatedData().map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className={`hover:bg-white/10 transition-colors duration-200 ${
                            editingCell?.rowIndex ===
                            (currentPage - 1) * rowsPerPage + rowIndex
                              ? "bg-blue-500/10"
                              : ""
                          }`}
                        >
                          {headers.map((header, cellIndex) => {
                            const globalRowIndex =
                              (currentPage - 1) * rowsPerPage + rowIndex;
                            const isEditing =
                              editingCell?.rowIndex === globalRowIndex &&
                              editingCell?.column === header;
                            const cellValue = row[header] || "";

                            return (
                              <td
                                key={header}
                                className={`p-2 px-4 whitespace-nowrap text-xs cursor-pointer hover:bg-white/5 transition-colors min-w-0 ${
                                  cellIndex < headers.length - 1
                                    ? "border-r border-white/10"
                                    : ""
                                } ${isEditing ? "bg-blue-500/20" : ""}`}
                                onClick={() =>
                                  !isEditing &&
                                  handleCellClick(rowIndex, header, cellValue)
                                }
                              >
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editingCell.value}
                                    onChange={(e) =>
                                      handleCellValueChange(e.target.value)
                                    }
                                    onKeyDown={handleKeyDown}
                                    onBlur={handleCellSave}
                                    autoFocus
                                    className="w-full bg-blue-500/30 border border-blue-400/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  />
                                ) : (
                                  <span className="block w-full">
                                    {cellValue}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {processedData.length > 0 && (
                <div className="flex-shrink-0 p-3 flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-white/10">
                  {/* Left Section - Rows per page */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="rows-per-page"
                      className="text-[11px] text-white/60 whitespace-nowrap"
                    >
                      Rows per page:
                    </label>
                    <select
                      id="rows-per-page"
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setCurrentPage(1);
                      }}
                      className="glass-select text-xs rounded-md px-2 py-1"
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>

                  {/* Center Section - Page info and numbers */}
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-white/60 whitespace-nowrap">
                      Showing{" "}
                      {Math.min(
                        (currentPage - 1) * rowsPerPage + 1,
                        getFilteredCount(),
                      )}{" "}
                      to{" "}
                      {Math.min(currentPage * rowsPerPage, getFilteredCount())}{" "}
                      of {getFilteredCount()} entries
                      {Object.keys(columnFilters).some((col) =>
                        hasActiveFilter(col),
                      ) && (
                        <span className="text-blue-300">
                          {" "}
                          (filtered from {fullData.length})
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Right Section - Navigation */}
                  {getTotalPages() > 1 && (
                    <div className="flex items-center gap-2">
                      {/* First Page */}
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-md px-2 py-1 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="First page"
                      >
                        ««
                      </button>

                      {/* Previous Page */}
                      <button
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-md p-1 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Previous page"
                      >
                        <ChevronDown className="w-4 h-4 rotate-90" />
                      </button>

                      {/* Page Numbers */}
                      <div className="flex items-center gap-1">
                        {(() => {
                          const totalPages = getTotalPages();
                          const pages = [];
                          const showPages = 5; // Number of page buttons to show
                          let startPage = Math.max(
                            1,
                            currentPage - Math.floor(showPages / 2),
                          );
                          let endPage = Math.min(
                            totalPages,
                            startPage + showPages - 1,
                          );

                          // Adjust start if we're near the end
                          if (endPage - startPage + 1 < showPages) {
                            startPage = Math.max(1, endPage - showPages + 1);
                          }

                          // Show first page if we're not starting from 1
                          if (startPage > 1) {
                            pages.push(
                              <button
                                key={1}
                                onClick={() => setCurrentPage(1)}
                                className="bg-white/10 hover:bg-white/20 text-white text-xs rounded-md px-2 py-1 transition-colors"
                              >
                                1
                              </button>,
                            );
                            if (startPage > 2) {
                              pages.push(
                                <span
                                  key="ellipsis1"
                                  className="text-white/60 px-1"
                                >
                                  ...
                                </span>,
                              );
                            }
                          }

                          // Show page numbers in range
                          for (let i = startPage; i <= endPage; i++) {
                            pages.push(
                              <button
                                key={i}
                                onClick={() => setCurrentPage(i)}
                                className={`text-xs rounded-md px-2 py-1 transition-colors ${
                                  i === currentPage
                                    ? "bg-blue-500/70 text-white font-semibold"
                                    : "bg-white/10 hover:bg-white/20 text-white"
                                }`}
                              >
                                {i}
                              </button>,
                            );
                          }

                          // Show last page if we're not ending at the last page
                          if (endPage < totalPages) {
                            if (endPage < totalPages - 1) {
                              pages.push(
                                <span
                                  key="ellipsis2"
                                  className="text-white/60 px-1"
                                >
                                  ...
                                </span>,
                              );
                            }
                            pages.push(
                              <button
                                key={totalPages}
                                onClick={() => setCurrentPage(totalPages)}
                                className="bg-white/10 hover:bg-white/20 text-white text-xs rounded-md px-2 py-1 transition-colors"
                              >
                                {totalPages}
                              </button>,
                            );
                          }

                          return pages;
                        })()}
                      </div>

                      {/* Next Page */}
                      <button
                        onClick={goToNextPage}
                        disabled={currentPage === getTotalPages()}
                        className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-md p-1 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Next page"
                      >
                        <ChevronDown className="w-4 h-4 -rotate-90" />
                      </button>

                      {/* Last Page */}
                      <button
                        onClick={() => setCurrentPage(getTotalPages())}
                        disabled={currentPage === getTotalPages()}
                        className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-md px-2 py-1 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Last page"
                      >
                        »»
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Allocation Analysis Section */}
        {!mainContentCollapsed && allocationView && fullData.length > 0 && (
          <section className="flex-[1] px-4 pb-4 flex flex-col min-h-0 min-w-0 max-w-full overflow-hidden transition-all duration-500">
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 min-w-0 overflow-hidden">
              {/* Left Container - Pie Chart and Data Table */}
              <div
                className="rounded-2xl border border-white/10 p-4 flex flex-col min-w-0 min-h-0 overflow-hidden"
                style={{ background: "rgba(255, 255, 255, 0.05)" }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    Allocation by Region
                  </h3>
                  <button
                    onClick={() =>
                      setLeftChartType(leftChartType === "pie" ? "bar" : "pie")
                    }
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors duration-200 text-white/80 hover:text-white"
                    title={`Switch to ${leftChartType === "pie" ? "Bar" : "Pie"} Chart`}
                  >
                    {leftChartType === "pie" ? (
                      <BarChart3 className="w-4 h-4" />
                    ) : (
                      <PieChartIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {leftChartType === "pie" ? (
                  <div className="flex-1 flex gap-4 min-h-0 items-center">
                    {/* Pie Chart Section - Larger */}
                    <div className="flex-[4] flex flex-col">
                      <div className="relative h-[200px] sm:h-[220px] w-full flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            {/* Outer Ring */}
                            <Pie
                              data={budgetAggregation}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={90}
                              paddingAngle={3}
                              dataKey="budget"
                              isAnimationActive={pieAnimationActive}
                              animationBegin={200}
                              animationDuration={2000}
                              animationEasing="ease-in-out"
                              label={(props: any) => {
                                const {
                                  cx,
                                  cy,
                                  midAngle,
                                  innerRadius,
                                  outerRadius,
                                  startAngle,
                                  endAngle,
                                  index,
                                } = props;

                                // Get data from our budget aggregation
                                const item = budgetAggregation[index];
                                const dataPercentage = parseFloat(item?.percentage || "0");
                                const statusName = item?.status || "";
                                const roundedPercentage = Math.round(dataPercentage);

                                // Smart overlap detection - don't show labels for slices less than 2% or very thin slices
                                const sliceAngle = Math.abs(endAngle - startAngle);
                                if (dataPercentage < 2 || sliceAngle < 20) {
                                  return null;
                                }

                                const RADIAN = Math.PI / 180;
                                const radius =
                                  innerRadius +
                                  (outerRadius - innerRadius) * 0.5;
                                const x =
                                  cx + radius * Math.cos(-midAngle * RADIAN);
                                const y =
                                  cy + radius * Math.sin(-midAngle * RADIAN);

                                return (
                                  <g>
                                    <text
                                      x={x}
                                      y={y - 3}
                                      fill="white"
                                      textAnchor="middle"
                                      dominantBaseline="central"
                                      style={{
                                        fontSize: "13.5px",
                                        fontWeight: "300",
                                        opacity: pieAnimationActive ? 0 : 1,
                                        transition:
                                          "opacity 0.8s ease-in-out 1.2s",
                                      }}
                                    >
                                      {statusName}
                                    </text>
                                    <text
                                      x={x}
                                      y={y + 9}
                                      fill="white"
                                      textAnchor="middle"
                                      dominantBaseline="central"
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: "300",
                                        opacity: pieAnimationActive ? 0 : 1,
                                        transition:
                                          "opacity 0.8s ease-in-out 1.5s",
                                      }}
                                    >
                                      ({roundedPercentage}%)
                                    </text>
                                  </g>
                                );
                              }}
                              labelLine={false}
                            >
                              {budgetAggregation.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={
                                    hoveredStatus === entry.status
                                      ? [
                                          "#3b82f6", // US - Blue
                                          "#10b981", // EU/MERT - Green
                                          "#f59e0b", // LATAM - Orange
                                          "#8b5cf6", // CN/HK - Purple
                                          "#06b6d4", // SEA - Cyan
                                          "#84cc16", // ANZ - Lime
                                          "#f97316", // BR - Orange
                                          "#ec4899", // JP - Pink
                                        ][index % 8]
                                      : [
                                          "url(#gradient0)",
                                          "url(#gradient1)",
                                          "url(#gradient2)",
                                          "url(#gradient3)",
                                          "url(#gradient4)",
                                          "url(#gradient5)",
                                          "url(#gradient6)",
                                          "url(#gradient7)",
                                        ][index % 8]
                                  }
                                  stroke={
                                    hoveredStatus === entry.status
                                      ? "rgba(255, 255, 255, 0.4)"
                                      : "rgba(255, 255, 255, 0.1)"
                                  }
                                  strokeWidth={
                                    hoveredStatus === entry.status ? 3 : 2
                                  }
                                  onMouseEnter={() =>
                                    setHoveredStatus(entry.status)
                                  }
                                  onMouseLeave={() => setHoveredStatus(null)}
                                  style={{
                                    cursor: "pointer",
                                    filter:
                                      hoveredStatus === entry.status
                                        ? "brightness(1.1)"
                                        : "none",
                                    transition: "all 0.2s ease",
                                  }}
                                />
                              ))}
                            </Pie>

                            {/* Center Text - Total Amount */}
                            <text
                              x="50%"
                              y="48%"
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="fill-blue-300"
                              style={{
                                fontSize: "14px",
                                fontWeight: "700",
                                opacity: pieAnimationActive ? 0 : 1,
                                transition: "opacity 0.8s ease-in-out 1.8s",
                              }}
                            >
                              $
                              {budgetAggregation
                                .reduce((sum, item) => sum + item.budget, 0)
                                .toLocaleString()}
                            </text>

                            <Tooltip
                              contentStyle={{
                                background:
                                  "linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(51, 65, 85, 0.95))",
                                border: "1px solid rgba(96, 165, 250, 0.3)",
                                borderRadius: "12px",
                                color: "white",
                                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
                                backdropFilter: "blur(10px)",
                              }}
                              formatter={(value: any, name: string) => [
                                <span className="font-semibold text-blue-300">
                                  ${value.toLocaleString()}
                                </span>,
                                <span className="text-white/80">Amount</span>,
                              ]}
                              labelFormatter={(label) => (
                                <span className="font-medium text-white">
                                  {label} Region
                                </span>
                              )}
                            />
                            {/* Gradient Definitions */}
                            <defs>
                              <linearGradient
                                id="gradient0"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#60a5fa"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#3b82f6"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="gradient1"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#34d399"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#10b981"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="gradient2"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#fbbf24"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#f59e0b"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="gradient3"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#f87171"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#ef4444"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="gradient4"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#a78bfa"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#8b5cf6"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="gradient5"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#22d3ee"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#06b6d4"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="gradient6"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#a3e635"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#84cc16"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="gradient7"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#f472b6"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#ec4899"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                            </defs>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Data Table Section - Smaller */}
                    <div className="flex-[2.5] flex flex-col">
                      <div
                        className="backdrop-blur-sm rounded-lg border border-white/10 flex flex-col"
                        style={{
                          height: "fit-content",
                          maxHeight: allocationView ? "240px" : "280px", // Increased to show 10 rows with scrolling
                        }}
                      >
                        {/* Table Header */}
                        <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-t-lg border-b border-white/10 px-2 py-1">
                          <div
                            className="grid grid-cols-12 gap-2 text-blue-200"
                            style={{
                              fontSize: allocationView ? "11px" : "10px",
                            }}
                          >
                            <div className="col-span-5">Region</div>
                            <div className="col-span-4 text-right">Amount</div>
                            <div className="col-span-3 text-right">Share</div>
                          </div>
                        </div>

                        {/* Table Body */}
                        <div
                          className="overflow-y-auto"
                          style={{
                            height: `calc(${Math.min(
                              budgetAggregation.filter(
                                (item) =>
                                  item.status &&
                                  item.status.trim() !== "" &&
                                  item.budget > 0,
                              ).length,
                              10,
                            )} * ${allocationView ? "28px" : "24px"})`,
                            maxHeight: `calc(10 * ${allocationView ? "28px" : "24px"})`,
                          }}
                        >
                          {budgetAggregation
                            .filter(
                              (item) =>
                                item.status &&
                                item.status.trim() !== "" &&
                                item.budget > 0,
                            )
                            .map((item, index) => (
                              <div
                                key={item.status}
                                className={`grid grid-cols-12 gap-2 px-2 border-b border-white/5 transition-all duration-200 cursor-pointer hover:bg-white/5 ${
                                  hoveredStatus === item.status
                                    ? "bg-blue-500/20 border-blue-400/30"
                                    : ""
                                }`}
                                style={{
                                  height: allocationView ? "28px" : "24px",
                                  minHeight: allocationView ? "28px" : "24px",
                                }}
                                onMouseEnter={() =>
                                  setHoveredStatus(item.status)
                                }
                                onMouseLeave={() => setHoveredStatus(null)}
                              >
                                <div className="col-span-5 flex items-center">
                                  <span
                                    className="text-white/90 truncate"
                                    style={{
                                      fontSize: allocationView
                                        ? "13px"
                                        : "11px",
                                    }}
                                  >
                                    {item.status || "Unknown"}
                                  </span>
                                </div>
                                <div
                                  className="col-span-4 text-right font-mono text-white/80 flex items-center justify-end"
                                  style={{
                                    fontSize: allocationView ? "13px" : "11px",
                                  }}
                                >
                                  ${item.formattedBudget}
                                </div>
                                <div
                                  className="col-span-3 text-right text-white/90 flex items-center justify-end"
                                  style={{
                                    fontSize: allocationView ? "13px" : "11px",
                                  }}
                                >
                                  {item.percentage}%
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Bar Chart View - Full Width */
                  <div className="flex-1 relative h-[280px] sm:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={budgetAggregation}
                        margin={{ top: 20, right: 20, left: 15, bottom: 60 }}
                      >
                        <CartesianGrid
                          strokeDasharray="none"
                          stroke="rgba(255, 255, 255, 0.1)"
                          strokeWidth={0.5}
                          horizontal={false}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="status"
                          stroke="white"
                          fontSize={15}
                          {...getXAxisProps(budgetAggregation, 400)}
                          axisLine={{
                            stroke: "rgba(255, 255, 255, 0.3)",
                            strokeWidth: 0.5
                          }}
                          tickLine={{
                            stroke: "rgba(255, 255, 255, 0.2)",
                            strokeWidth: 0.5
                          }}
                        />
                        <YAxis
                          stroke="transparent"
                          domain={['dataMin', 'dataMax']}
                          axisLine={false}
                          tickLine={false}
                          tick={false}
                        />
                        <Tooltip
                          formatter={(value: any) => [
                            `$${value.toLocaleString()}`,
                            "Amount",
                          ]}
                          contentStyle={{
                            backgroundColor: "rgba(0, 0, 0, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            borderRadius: "8px",
                            color: "white",
                          }}
                          labelStyle={{ color: "white", fontWeight: "bold" }}
                        />
                        <Bar
                          dataKey="budget"
                          fill="#3b82f6"
                          fillOpacity={0.8}
                          stroke="#60a5fa"
                          strokeWidth={1}
                          radius={[4, 4, 0, 0]}
                          label={{
                            position: "top",
                            content: (props: any) => {
                              const { x, y, width, value } = props;
                              if (!value || value === 0) return null;

                              return (
                                <text
                                  x={x + width / 2}
                                  y={y - 12}
                                  fill="white"
                                  textAnchor="middle"
                                  fontSize="12"
                                  fontWeight="bold"
                                >
                                  ${(value / 1000).toFixed(1)}K
                                </text>
                              );
                            },
                          }}
                        />

                        {/* Gradient definition for left container bars */}
                        <defs>
                          <linearGradient
                            id="leftBarGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#60a5fa"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="100%"
                              stopColor="#3b82f6"
                              stopOpacity={0.6}
                            />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Right Container - Enhanced Pie Chart */}
              <div
                className="rounded-2xl border border-white/10 p-6 flex flex-col min-h-0 overflow-hidden"
                style={{ background: "rgba(255, 255, 255, 0.05)" }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    Allocation by Pillar
                  </h3>
                  <button
                    onClick={() =>
                      setChartType(chartType === "pie" ? "bar" : "pie")
                    }
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors duration-200 text-white/80 hover:text-white"
                    title={`Switch to ${chartType === "pie" ? "Bar" : "Pie"} Chart`}
                  >
                    {chartType === "pie" ? (
                      <BarChart3 className="w-4 h-4" />
                    ) : (
                      <PieChartIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {chartType === "pie" ? (
                  <div className="flex-1 flex gap-4 min-h-0 items-center">
                    {/* Pie Chart Section - Larger */}
                    <div className="flex-[4] flex flex-col">
                      <div className="relative h-[200px] sm:h-[220px] w-full flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            {/* Outer Ring */}
                            <Pie
                              data={pillarAggregation}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={90}
                              paddingAngle={3}
                              dataKey="budget"
                              isAnimationActive={pieAnimationActive}
                              animationBegin={200}
                              animationDuration={2000}
                              animationEasing="ease-in-out"
                              label={(props: any) => {
                                const {
                                  cx,
                                  cy,
                                  midAngle,
                                  innerRadius,
                                  outerRadius,
                                  startAngle,
                                  endAngle,
                                  index,
                                } = props;

                                // Get data from our pillar aggregation
                                const item = pillarAggregation[index];
                                const dataPercentage = parseFloat(item?.percentage || "0");
                                const statusName = item?.status || "";
                                const roundedPercentage = Math.round(dataPercentage);

                                // Smart overlap detection - don't show labels for slices less than 2% or very thin slices
                                const sliceAngle = Math.abs(endAngle - startAngle);
                                if (dataPercentage < 2 || sliceAngle < 20) {
                                  return null;
                                }

                                const RADIAN = Math.PI / 180;
                                const radius =
                                  innerRadius +
                                  (outerRadius - innerRadius) * 0.5;
                                const x =
                                  cx + radius * Math.cos(-midAngle * RADIAN);
                                const y =
                                  cy + radius * Math.sin(-midAngle * RADIAN);

                                return (
                                  <g>
                                    <text
                                      x={x}
                                      y={y - 3}
                                      fill="white"
                                      textAnchor="middle"
                                      dominantBaseline="central"
                                      style={{
                                        fontSize: "13.5px",
                                        fontWeight: "300",
                                        opacity: pieAnimationActive ? 0 : 1,
                                        transition:
                                          "opacity 0.8s ease-in-out 1.2s",
                                      }}
                                    >
                                      {statusName}
                                    </text>
                                    <text
                                      x={x}
                                      y={y + 9}
                                      fill="white"
                                      textAnchor="middle"
                                      dominantBaseline="central"
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: "300",
                                        opacity: pieAnimationActive ? 0 : 1,
                                        transition:
                                          "opacity 0.8s ease-in-out 1.5s",
                                      }}
                                    >
                                      ({roundedPercentage}%)
                                    </text>
                                  </g>
                                );
                              }}
                              labelLine={false}
                            >
                              {pillarAggregation.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={
                                    hoveredStatus === entry.status
                                      ? [
                                          "#3b82f6", // US - Blue
                                          "#10b981", // EU/MERT - Green
                                          "#f59e0b", // LATAM - Orange
                                          "#8b5cf6", // CN/HK - Purple
                                          "#06b6d4", // SEA - Cyan
                                          "#84cc16", // ANZ - Lime
                                          "#f97316", // BR - Orange
                                          "#ec4899", // JP - Pink
                                        ][index % 8]
                                      : [
                                          "url(#rightGradient0)",
                                          "url(#rightGradient1)",
                                          "url(#rightGradient2)",
                                          "url(#rightGradient3)",
                                          "url(#rightGradient4)",
                                          "url(#rightGradient5)",
                                          "url(#rightGradient6)",
                                          "url(#rightGradient7)",
                                        ][index % 8]
                                  }
                                  stroke={
                                    hoveredStatus === entry.status
                                      ? "rgba(255, 255, 255, 0.4)"
                                      : "rgba(255, 255, 255, 0.1)"
                                  }
                                  strokeWidth={
                                    hoveredStatus === entry.status ? 3 : 2
                                  }
                                  onMouseEnter={() =>
                                    setHoveredStatus(entry.status)
                                  }
                                  onMouseLeave={() => setHoveredStatus(null)}
                                  style={{
                                    cursor: "pointer",
                                    filter:
                                      hoveredStatus === entry.status
                                        ? "brightness(1.1)"
                                        : "none",
                                    transition: "all 0.2s ease",
                                  }}
                                />
                              ))}
                            </Pie>

                            {/* Center Text - Total Amount */}
                            <text
                              x="50%"
                              y="48%"
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="fill-blue-300"
                              style={{
                                fontSize: "14px",
                                fontWeight: "700",
                                opacity: pieAnimationActive ? 0 : 1,
                                transition: "opacity 0.8s ease-in-out 1.8s",
                              }}
                            >
                              $
                              {pillarAggregation
                                .reduce((sum, item) => sum + item.budget, 0)
                                .toLocaleString()}
                            </text>

                            <Tooltip
                              contentStyle={{
                                background:
                                  "linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(51, 65, 85, 0.95))",
                                border: "1px solid rgba(96, 165, 250, 0.3)",
                                borderRadius: "12px",
                                color: "white",
                                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
                                backdropFilter: "blur(10px)",
                              }}
                              formatter={(value: any, name: string) => [
                                <span className="font-semibold text-blue-300">
                                  ${value.toLocaleString()}
                                </span>,
                                <span className="text-white/80">Amount</span>,
                              ]}
                              labelFormatter={(label) => (
                                <span className="font-medium text-white">
                                  {label} Pillar
                                </span>
                              )}
                            />

                            {/* Gradient Definitions */}
                            <defs>
                              <linearGradient
                                id="rightGradient0"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#60a5fa"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#3b82f6"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="rightGradient1"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#34d399"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#10b981"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="rightGradient2"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#fbbf24"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#f59e0b"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="rightGradient3"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#f87171"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#ef4444"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="rightGradient4"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#a78bfa"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#8b5cf6"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="rightGradient5"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#22d3ee"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#06b6d4"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="rightGradient6"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#a3e635"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#84cc16"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                              <linearGradient
                                id="rightGradient7"
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="100%"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#f472b6"
                                  stopOpacity={0.6}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#ec4899"
                                  stopOpacity={0.4}
                                />
                              </linearGradient>
                            </defs>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Data Table Section - Smaller */}
                    <div className="flex-[2.5] flex flex-col">
                      <div
                        className="backdrop-blur-sm rounded-lg border border-white/10 flex flex-col"
                        style={{
                          height: "fit-content",
                          maxHeight: allocationView ? "240px" : "280px", // Increased to show 10 rows with scrolling
                        }}
                      >
                        {/* Table Header */}
                        <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-t-lg border-b border-white/10 px-2 py-1">
                          <div
                            className="grid grid-cols-12 gap-2 text-blue-200"
                            style={{
                              fontSize: allocationView ? "11px" : "10px",
                            }}
                          >
                            <div className="col-span-5">Pillar</div>
                            <div className="col-span-4 text-right">Amount</div>
                            <div className="col-span-3 text-right">Share</div>
                          </div>
                        </div>

                        {/* Table Body */}
                        <div
                          className="overflow-y-auto"
                          style={{
                            height: `calc(${Math.min(
                              pillarAggregation.filter(
                                (item) =>
                                  item.status &&
                                  item.status.trim() !== "" &&
                                  item.budget > 0,
                              ).length,
                              10,
                            )} * ${allocationView ? "28px" : "24px"})`,
                            maxHeight: `calc(10 * ${allocationView ? "28px" : "24px"})`,
                          }}
                        >
                          {pillarAggregation
                            .filter(
                              (item) =>
                                item.status &&
                                item.status.trim() !== "" &&
                                item.budget > 0,
                            )
                            .map((item, index) => (
                              <div
                                key={item.status}
                                className={`grid grid-cols-12 gap-2 px-2 border-b border-white/5 transition-all duration-200 cursor-pointer hover:bg-white/5 ${
                                  hoveredStatus === item.status
                                    ? "bg-blue-500/20 border-blue-400/30"
                                    : ""
                                }`}
                                style={{
                                  height: allocationView ? "28px" : "24px",
                                  minHeight: allocationView ? "28px" : "24px",
                                }}
                                onMouseEnter={() =>
                                  setHoveredStatus(item.status)
                                }
                                onMouseLeave={() => setHoveredStatus(null)}
                              >
                                <div className="col-span-5 flex items-center">
                                  <span
                                    className="text-white/90 truncate"
                                    style={{
                                      fontSize: allocationView
                                        ? "13px"
                                        : "11px",
                                    }}
                                  >
                                    {item.status || "Unknown"}
                                  </span>
                                </div>
                                <div
                                  className="col-span-4 text-right font-mono text-white/80 flex items-center justify-end"
                                  style={{
                                    fontSize: allocationView ? "13px" : "11px",
                                  }}
                                >
                                  ${item.formattedBudget}
                                </div>
                                <div
                                  className="col-span-3 text-right text-white/90 flex items-center justify-end"
                                  style={{
                                    fontSize: allocationView ? "13px" : "11px",
                                  }}
                                >
                                  {item.percentage}%
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Bar Chart View - Full Width */
                  <div className="flex-1 relative h-[280px] sm:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={pillarAggregation}
                        margin={{ top: 20, right: 20, left: 15, bottom: 60 }}
                      >
                        <CartesianGrid
                          strokeDasharray="none"
                          stroke="rgba(255, 255, 255, 0.1)"
                          strokeWidth={0.5}
                          horizontal={false}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="status"
                          stroke="white"
                          fontSize={15}
                          {...getXAxisProps(pillarAggregation, 400)}
                          axisLine={{
                            stroke: "rgba(255, 255, 255, 0.3)",
                            strokeWidth: 0.5
                          }}
                          tickLine={{
                            stroke: "rgba(255, 255, 255, 0.2)",
                            strokeWidth: 0.5
                          }}
                        />
                        <YAxis
                          stroke="transparent"
                          domain={['dataMin', 'dataMax']}
                          axisLine={false}
                          tickLine={false}
                          tick={false}
                        />
                        <Tooltip
                          formatter={(value: any) => [
                            `$${value.toLocaleString()}`,
                            "Amount",
                          ]}
                          contentStyle={{
                            backgroundColor: "rgba(0, 0, 0, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            borderRadius: "8px",
                            color: "white",
                          }}
                          labelStyle={{ color: "white", fontWeight: "bold" }}
                        />
                        <Bar
                          dataKey="budget"
                          fill="#3b82f6"
                          fillOpacity={0.8}
                          stroke="#60a5fa"
                          strokeWidth={1}
                          radius={[4, 4, 0, 0]}
                          label={{
                            position: "top",
                            content: (props: any) => {
                              const { x, y, width, value } = props;
                              if (!value || value === 0) return null;

                              return (
                                <text
                                  x={x + width / 2}
                                  y={y - 12}
                                  fill="white"
                                  textAnchor="middle"
                                  fontSize="12"
                                  fontWeight="bold"
                                >
                                  ${(value / 1000).toFixed(1)}K
                                </text>
                              );
                            },
                          }}
                        />

                        {/* Gradient definition for right container bars */}
                        <defs>
                          <linearGradient
                            id="rightBarGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#60a5fa"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="100%"
                              stopColor="#3b82f6"
                              stopOpacity={0.6}
                            />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Executive View Container */}
        {mainContentCollapsed && (
          <section className="flex-1 px-4 pb-4 flex flex-col transition-all duration-500 animate-in fade-in-0 min-h-0 min-w-0">
            <div
              className="flex-1 rounded-2xl border border-white/10 p-4 flex flex-col min-h-0 min-w-0 overflow-hidden"
              style={{ background: "rgba(255, 255, 255, 0.05)" }}
            >
              {/* Executive View Header */}
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Analyze Data
                </h3>
                <div className="flex items-center gap-2">
                  {/* Undo/Redo Buttons */}
                  <div className="flex items-center gap-1 mr-2">
                    <button
                      onClick={undo}
                      disabled={!canUndo}
                      className="bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 hover:text-gray-200 font-medium text-sm rounded-lg p-2 transition-colors duration-300 border border-gray-400/30 hover:border-gray-400/50 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Undo last change"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={redo}
                      disabled={!canRedo}
                      className="bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 hover:text-gray-200 font-medium text-sm rounded-lg p-2 transition-colors duration-300 border border-gray-400/30 hover:border-gray-400/50 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Redo last change"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
                        />
                      </svg>
                    </button>
                  </div>

                  <button
                    onClick={() =>
                      setShowExecutiveFilters(!showExecutiveFilters)
                    }
                    className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-purple-200 font-medium text-sm rounded-lg px-3 py-1.5 transition-colors duration-300 border border-purple-400/30 hover:border-purple-400/50"
                  >
                    {showExecutiveFilters ? "Hide Filters" : "Show Filters"}
                  </button>
                  {!showExecutiveFilters && executiveCards.length > 0 && (
                    <button
                      onClick={handleDownloadPDF}
                      className="bg-green-500/20 hover:bg-green-500/30 text-green-300 hover:text-green-200 font-medium text-sm rounded-lg px-3 py-1.5 transition-colors duration-300 border border-green-400/30 hover:border-green-400/50 flex items-center gap-2"
                      title="Download cards as PDF"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Download PDF
                    </button>
                  )}
                  <button
                    onClick={addExecutiveCard}
                    disabled={executiveCards.length >= 6}
                    className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 hover:text-blue-200 font-medium text-sm rounded-lg px-3 py-1.5 transition-colors duration-300 border border-blue-400/30 hover:border-blue-400/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add View
                    <span className="text-xs opacity-75">
                      ({executiveCards.length}/6)
                    </span>
                  </button>
                </div>
              </div>

              {/* Cards Container */}
              <div className="flex-1 min-h-0 overflow-auto">
                {executiveCards.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center">
                    <div className="text-center">
                      <div className="mb-4">
                        <svg
                          className="w-16 h-16 mx-auto text-white/30"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                      </div>
                      <h4 className="text-xl font-semibold text-white mb-2">
                        No Views Created
                      </h4>
                      <p className="text-white/70 mb-6 max-w-md">
                        Create custom charts by clicking "Add View" to start
                        your executive dashboard.
                      </p>
                      <p className="text-sm text-white/50 mb-2">
                        You can create up to 6 custom views with different
                        dimensions and measures.
                      </p>
                      <p className="text-xs text-white/40">
                        Tip: Press Ctrl + + to quickly add a new view
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    data-cards-container
                    className="h-full grid gap-1 auto-rows-fr"
                    style={{
                      gridTemplateColumns:
                        executiveCards.length === 1
                          ? "1fr"
                          : executiveCards.length === 2
                            ? "repeat(2, 1fr)"
                            : executiveCards.length <= 4
                              ? "repeat(2, 1fr)"
                              : "repeat(2, 1fr)",
                      gridTemplateRows:
                        executiveCards.length === 1
                          ? "1fr"
                          : executiveCards.length === 2
                            ? "1fr"
                            : executiveCards.length <= 4
                              ? "repeat(2, 1fr)"
                              : "repeat(3, 1fr)",
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      // If dropping on grid but not on a card, append to end
                      if (draggedCardId && !dragOverCardId) {
                        setExecutiveCards((prev) => {
                          const draggedIndex = prev.findIndex(
                            (card) => card.id === draggedCardId,
                          );
                          if (draggedIndex === -1) return prev;

                          // Reset expansion states for all cards to ensure clean layout
                          const resetCards = prev.map((card) => ({
                            ...card,
                            expanded: false,
                            colspan: undefined,
                          }));
                          const [draggedCard] = resetCards.splice(
                            draggedIndex,
                            1,
                          );
                          resetCards.push(draggedCard);

                          saveToHistory(resetCards);
                          return resetCards;
                        });

                        setDraggedCardId(null);
                        setDragOverCardId(null);
                      }
                    }}
                  >
                    {executiveCards.map((card, index) => {
                      const cardData = getCardData(
                        card.dimension,
                        card.measure,
                      );

                      return (
                        <div
                          key={card.id}
                          data-card={card.id}
                          draggable={!isDraggingBorder}
                          onDragStart={(e) => handleDragStart(e, card.id)}
                          onDragOver={(e) => handleDragOver(e, card.id)}
                          onDragLeave={(e) => handleDragLeave(e)}
                          onDrop={(e) => handleDrop(e, card.id)}
                          onDragEnd={handleDragEnd}
                          onDragEnter={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className={`bg-white/5 rounded-lg border border-white/10 pt-2 px-2 pb-1 flex flex-col min-h-0 relative transition-all duration-200 ${
                            card.expanded ? "col-span-2" : ""
                          } ${
                            draggedCardId === card.id
                              ? "opacity-50 scale-95 rotate-2 z-50"
                              : ""
                          } ${
                            dragOverCardId === card.id &&
                            draggedCardId !== card.id
                              ? "ring-4 ring-blue-400/70 bg-blue-500/20 border-blue-400/50 shadow-lg shadow-blue-500/25"
                              : ""
                          } ${
                            !isDraggingBorder
                              ? "cursor-move hover:bg-white/10"
                              : ""
                          } ${
                            draggedCardId && draggedCardId !== card.id
                              ? "hover:ring-2 hover:ring-blue-400/30"
                              : ""
                          }`}
                          style={{
                            height:
                              executiveCards.length === 1
                                ? "auto"
                                : executiveCards.length === 2
                                  ? "47vh"
                                  : executiveCards.length <= 4
                                    ? "38vh"
                                    : "25vh",
                          }}
                        >
                          {/* Left Border Expansion Zone */}
                          {index > 0 && !card.expanded && (
                            <div
                              className={`absolute left-0 top-0 w-2 h-full cursor-col-resize transition-all duration-200 ${
                                hoveredBorder?.cardId === card.id &&
                                hoveredBorder?.side === "left"
                                  ? "bg-blue-400/40 border-l-2 border-blue-400"
                                  : "bg-transparent hover:bg-blue-400/20"
                              }`}
                              onMouseEnter={() =>
                                handleBorderMouseEnter(card.id, "left")
                              }
                              onMouseLeave={handleBorderMouseLeave}
                              draggable={true}
                              onDragStart={(e) =>
                                handleBorderDragStart(e, card.id, "left")
                              }
                              onDragEnd={handleBorderDragEnd}
                              onDrop={(e) => handleBorderDrop(e, card.id)}
                              onDragOver={(e) => e.preventDefault()}
                              title="Drag to expand left and merge with previous card"
                            />
                          )}

                          {/* Right Border Expansion Zone */}
                          {index < executiveCards.length - 1 &&
                            !card.expanded && (
                              <div
                                className={`absolute right-0 top-0 w-2 h-full cursor-col-resize transition-all duration-200 ${
                                  hoveredBorder?.cardId === card.id &&
                                  hoveredBorder?.side === "right"
                                    ? "bg-blue-400/40 border-r-2 border-blue-400"
                                    : "bg-transparent hover:bg-blue-400/20"
                                }`}
                                onMouseEnter={() =>
                                  handleBorderMouseEnter(card.id, "right")
                                }
                                onMouseLeave={handleBorderMouseLeave}
                                draggable={true}
                                onDragStart={(e) =>
                                  handleBorderDragStart(e, card.id, "right")
                                }
                                onDragEnd={handleBorderDragEnd}
                                onDrop={(e) => handleBorderDrop(e, card.id)}
                                onDragOver={(e) => e.preventDefault()}
                                title="Drag to expand right and merge with next card"
                              />
                            )}

                          {/* Full Width Expansion Zone for Single Cards in Last Row */}
                          {isCardAloneInLastRow(index) && !card.expanded && (
                            <div
                              className={`absolute right-0 top-0 w-8 h-full cursor-pointer transition-all duration-200 flex items-center justify-center ${
                                hoveredBorder?.cardId === card.id &&
                                hoveredBorder?.side === "expand"
                                  ? "bg-green-400/40 border-r-4 border-green-400"
                                  : "bg-transparent hover:bg-green-400/20"
                              }`}
                              onMouseEnter={() =>
                                setHoveredBorder({
                                  cardId: card.id,
                                  side: "expand" as any,
                                })
                              }
                              onMouseLeave={handleBorderMouseLeave}
                              onClick={() => handleSingleCardExpand(card.id)}
                              title="Click to expand card to full row width"
                            >
                              <svg
                                className="w-4 h-4 text-green-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 8h16M4 16h16"
                                />
                              </svg>
                            </div>
                          )}

                          {/* Card Header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {showExecutiveFilters && (
                                <>
                                  {/* Dimension Filter */}
                                  <select
                                    value={card.dimension}
                                    onChange={(e) =>
                                      updateExecutiveCard(card.id, {
                                        dimension: e.target.value,
                                      })
                                    }
                                    className="glass-select text-xs rounded px-2 py-1 max-w-[120px]"
                                  >
                                    {getAvailableDimensions().map((dim) => (
                                      <option key={dim} value={dim}>
                                        {dim}
                                      </option>
                                    ))}
                                  </select>

                                  {/* Measure Filter */}
                                  <select
                                    value={card.measure}
                                    onChange={(e) =>
                                      updateExecutiveCard(card.id, {
                                        measure: e.target.value,
                                      })
                                    }
                                    className="glass-select text-xs rounded px-2 py-1 max-w-[120px]"
                                  >
                                    {getAvailableMeasures().map((measure) => (
                                      <option key={measure} value={measure}>
                                        {measure}
                                      </option>
                                    ))}
                                  </select>

                                  {/* Chart Type Toggle */}
                                  <button
                                    onClick={() =>
                                      updateExecutiveCard(card.id, {
                                        chartType:
                                          card.chartType === "pie"
                                            ? "bar"
                                            : "pie",
                                      })
                                    }
                                    className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors duration-200 text-white/80 hover:text-white"
                                    title={`Switch to ${card.chartType === "pie" ? "Bar" : "Pie"} Chart`}
                                  >
                                    {card.chartType === "pie" ? (
                                      <BarChart3 className="w-3 h-3" />
                                    ) : (
                                      <PieChartIcon className="w-3 h-3" />
                                    )}
                                  </button>

                                  {/* Collapse Button for Expanded Cards */}
                                  {card.expanded && (
                                    <button
                                      onClick={() =>
                                        updateExecutiveCard(card.id, {
                                          expanded: false,
                                          colspan: undefined,
                                        })
                                      }
                                      className="p-1 rounded bg-orange-500/20 hover:bg-orange-500/30 transition-colors duration-200 text-orange-400 hover:text-orange-300"
                                      title="Collapse card to normal size"
                                    >
                                      <svg
                                        className="w-3 h-3"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M20 12H4"
                                        />
                                      </svg>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Remove Card Button - Only show when filters are visible */}
                            {showExecutiveFilters && (
                              <button
                                onClick={() => removeExecutiveCard(card.id)}
                                className="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors duration-200"
                                title="Remove Card"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>

                          {/* Chart Area - Pie Chart + Data Table */}
                          <div className="flex-1 min-h-0">
                            {cardData.length > 0 ? (
                              card.chartType === "pie" ? (
                                <div className="h-full flex gap-1 min-h-0 items-center">
                                  {/* Pie Chart Section */}
                                  <div className="flex-[3] flex flex-col">
                                    <div
                                      className="relative w-full"
                                      style={{
                                        height:
                                          executiveCards.length === 1
                                            ? "380px"
                                            : executiveCards.length === 2
                                              ? "280px"
                                              : executiveCards.length <= 4
                                                ? "220px"
                                                : "180px",
                                      }}
                                    >
                                      <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                      >
                                        <PieChart>
                                          <Pie
                                            data={cardData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={
                                              executiveCards.length === 1
                                                ? 100
                                                : executiveCards.length === 2
                                                  ? 75
                                                  : executiveCards.length <= 4
                                                    ? 60
                                                    : 45
                                            }
                                            outerRadius={
                                              executiveCards.length === 1
                                                ? 180
                                                : executiveCards.length === 2
                                                  ? 135
                                                  : executiveCards.length <= 4
                                                    ? 105
                                                    : 85
                                            }
                                            paddingAngle={3}
                                            dataKey="value"
                                            isAnimationActive={
                                              pieAnimationActive
                                            }
                                            animationBegin={200}
                                            animationDuration={2000}
                                            animationEasing="ease-in-out"
                                            label={(props: any) => {
                                              const {
                                                cx,
                                                cy,
                                                midAngle,
                                                innerRadius,
                                                outerRadius,
                                                startAngle,
                                                endAngle,
                                                index,
                                              } = props;

                                              // Get data from our card aggregation
                                              const item = cardData[index];
                                              const dataPercentage = parseFloat(item?.percentage || "0");
                                              const statusName = item?.name || "";
                                              const roundedPercentage = Math.round(dataPercentage);

                                              // Smart overlap detection - don't show labels for slices less than 8% or very thin slices
                                              const sliceAngle = Math.abs(endAngle - startAngle);
                                              if (dataPercentage < 2 || sliceAngle < 20) {
                                                return null;
                                              }

                                              const RADIAN = Math.PI / 180;
                                              const radius =
                                                innerRadius +
                                                (outerRadius - innerRadius) *
                                                  0.5;
                                              const x =
                                                cx +
                                                radius *
                                                  Math.cos(-midAngle * RADIAN);
                                              const y =
                                                cy +
                                                radius *
                                                  Math.sin(-midAngle * RADIAN);

                                              return (
                                                <g>
                                                  <text
                                                    x={x}
                                                    y={y - 3}
                                                    fill="white"
                                                    textAnchor="middle"
                                                    dominantBaseline="central"
                                                    style={{
                                                      fontSize:
                                                        executiveCards.length ===
                                                        1
                                                          ? "13.5px"
                                                          : executiveCards.length ===
                                                              2
                                                            ? "12px"
                                                            : executiveCards.length <=
                                                                4
                                                              ? "10.5px"
                                                              : "9px",
                                                      fontWeight: "300",
                                                      opacity:
                                                        pieAnimationActive
                                                          ? 0
                                                          : 1,
                                                      transition:
                                                        "opacity 0.8s ease-in-out 1.2s",
                                                    }}
                                                  >
                                                    {statusName}
                                                  </text>
                                                  <text
                                                    x={x}
                                                    y={y + 9}
                                                    fill="white"
                                                    textAnchor="middle"
                                                    dominantBaseline="central"
                                                    style={{
                                                      fontSize:
                                                        executiveCards.length ===
                                                        1
                                                          ? "11px"
                                                          : executiveCards.length ===
                                                              2
                                                            ? "10px"
                                                            : executiveCards.length <=
                                                                4
                                                              ? "9px"
                                                              : "8px",
                                                      fontWeight: "300",
                                                      opacity:
                                                        pieAnimationActive
                                                          ? 0
                                                          : 1,
                                                      transition:
                                                        "opacity 0.8s ease-in-out 1.5s",
                                                    }}
                                                  >
                                                    ({roundedPercentage}%)
                                                  </text>
                                                </g>
                                              );
                                            }}
                                            labelLine={false}
                                          >
                                            {cardData.map((entry, index) => (
                                              <Cell
                                                key={`cell-${index}`}
                                                fill={
                                                  hoveredExecutiveItem?.cardId ===
                                                    card.id &&
                                                  hoveredExecutiveItem?.itemName ===
                                                    entry.name
                                                    ? [
                                                        "#3b82f6",
                                                        "#10b981",
                                                        "#f59e0b",
                                                        "#ef4444",
                                                        "#8b5cf6",
                                                        "#06b6d4",
                                                        "#84cc16",
                                                        "#f97316",
                                                      ][index % 8]
                                                    : [
                                                        "url(#execGradient0)",
                                                        "url(#execGradient1)",
                                                        "url(#execGradient2)",
                                                        "url(#execGradient3)",
                                                        "url(#execGradient4)",
                                                        "url(#execGradient5)",
                                                        "url(#execGradient6)",
                                                        "url(#execGradient7)",
                                                      ][index % 8]
                                                }
                                                stroke={
                                                  hoveredExecutiveItem?.cardId ===
                                                    card.id &&
                                                  hoveredExecutiveItem?.itemName ===
                                                    entry.name
                                                    ? "rgba(255, 255, 255, 0.4)"
                                                    : "rgba(255, 255, 255, 0.1)"
                                                }
                                                strokeWidth={
                                                  hoveredExecutiveItem?.cardId ===
                                                    card.id &&
                                                  hoveredExecutiveItem?.itemName ===
                                                    entry.name
                                                    ? 3
                                                    : 1
                                                }
                                                onMouseEnter={() =>
                                                  setHoveredExecutiveItem({
                                                    cardId: card.id,
                                                    itemName: entry.name,
                                                  })
                                                }
                                                onMouseLeave={() =>
                                                  setHoveredExecutiveItem(null)
                                                }
                                                style={{
                                                  cursor: "pointer",
                                                  filter:
                                                    hoveredExecutiveItem?.cardId ===
                                                      card.id &&
                                                    hoveredExecutiveItem?.itemName ===
                                                      entry.name
                                                      ? "brightness(1.1)"
                                                      : "none",
                                                  transition: "all 0.2s ease",
                                                }}
                                              />
                                            ))}
                                          </Pie>

                                          {/* Center Text - Total */}
                                          <text
                                            x="50%"
                                            y="48%"
                                            textAnchor="middle"
                                            dominantBaseline="central"
                                            className="fill-blue-300"
                                            style={{
                                              fontSize:
                                                executiveCards.length === 1
                                                  ? "16px"
                                                  : executiveCards.length === 2
                                                    ? "14px"
                                                    : executiveCards.length <= 4
                                                      ? "12px"
                                                      : "10px",
                                              fontWeight: "700",
                                            }}
                                          >
                                            $
                                            {cardData
                                              .reduce(
                                                (sum, item) => sum + item.value,
                                                0,
                                              )
                                              .toLocaleString()}
                                          </text>

                                          <Tooltip
                                            contentStyle={{
                                              background:
                                                "linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(51, 65, 85, 0.95))",
                                              border:
                                                "1px solid rgba(96, 165, 250, 0.3)",
                                              borderRadius: "8px",
                                              color: "white",
                                              boxShadow:
                                                "0 8px 20px rgba(0, 0, 0, 0.3)",
                                              backdropFilter: "blur(8px)",
                                              fontSize: "11px",
                                            }}
                                            formatter={(
                                              value: any,
                                              name: string,
                                            ) => [
                                              <span className="font-semibold text-blue-300">
                                                ${value.toLocaleString()}
                                              </span>,
                                              <span className="text-white/80">
                                                {card.measure}
                                              </span>,
                                            ]}
                                            labelFormatter={(label) => (
                                              <span className="font-medium text-white text-xs">
                                                {label}
                                              </span>
                                            )}
                                          />

                                          {/* Gradient Definitions for Executive Cards */}
                                          <defs>
                                            <linearGradient
                                              id="execGradient0"
                                              x1="0%"
                                              y1="0%"
                                              x2="100%"
                                              y2="100%"
                                            >
                                              <stop
                                                offset="0%"
                                                stopColor="#60a5fa"
                                                stopOpacity={0.6}
                                              />
                                              <stop
                                                offset="100%"
                                                stopColor="#3b82f6"
                                                stopOpacity={0.4}
                                              />
                                            </linearGradient>
                                            <linearGradient
                                              id="execGradient1"
                                              x1="0%"
                                              y1="0%"
                                              x2="100%"
                                              y2="100%"
                                            >
                                              <stop
                                                offset="0%"
                                                stopColor="#34d399"
                                                stopOpacity={0.6}
                                              />
                                              <stop
                                                offset="100%"
                                                stopColor="#10b981"
                                                stopOpacity={0.4}
                                              />
                                            </linearGradient>
                                            <linearGradient
                                              id="execGradient2"
                                              x1="0%"
                                              y1="0%"
                                              x2="100%"
                                              y2="100%"
                                            >
                                              <stop
                                                offset="0%"
                                                stopColor="#fbbf24"
                                                stopOpacity={0.6}
                                              />
                                              <stop
                                                offset="100%"
                                                stopColor="#f59e0b"
                                                stopOpacity={0.4}
                                              />
                                            </linearGradient>
                                            <linearGradient
                                              id="execGradient3"
                                              x1="0%"
                                              y1="0%"
                                              x2="100%"
                                              y2="100%"
                                            >
                                              <stop
                                                offset="0%"
                                                stopColor="#f87171"
                                                stopOpacity={0.6}
                                              />
                                              <stop
                                                offset="100%"
                                                stopColor="#ef4444"
                                                stopOpacity={0.4}
                                              />
                                            </linearGradient>
                                            <linearGradient
                                              id="execGradient4"
                                              x1="0%"
                                              y1="0%"
                                              x2="100%"
                                              y2="100%"
                                            >
                                              <stop
                                                offset="0%"
                                                stopColor="#a78bfa"
                                                stopOpacity={0.6}
                                              />
                                              <stop
                                                offset="100%"
                                                stopColor="#8b5cf6"
                                                stopOpacity={0.4}
                                              />
                                            </linearGradient>
                                            <linearGradient
                                              id="execGradient5"
                                              x1="0%"
                                              y1="0%"
                                              x2="100%"
                                              y2="100%"
                                            >
                                              <stop
                                                offset="0%"
                                                stopColor="#22d3ee"
                                                stopOpacity={0.6}
                                              />
                                              <stop
                                                offset="100%"
                                                stopColor="#06b6d4"
                                                stopOpacity={0.4}
                                              />
                                            </linearGradient>
                                            <linearGradient
                                              id="execGradient6"
                                              x1="0%"
                                              y1="0%"
                                              x2="100%"
                                              y2="100%"
                                            >
                                              <stop
                                                offset="0%"
                                                stopColor="#a3e635"
                                                stopOpacity={0.6}
                                              />
                                              <stop
                                                offset="100%"
                                                stopColor="#84cc16"
                                                stopOpacity={0.4}
                                              />
                                            </linearGradient>
                                            <linearGradient
                                              id="execGradient7"
                                              x1="0%"
                                              y1="0%"
                                              x2="100%"
                                              y2="100%"
                                            >
                                              <stop
                                                offset="0%"
                                                stopColor="#fb923c"
                                                stopOpacity={0.6}
                                              />
                                              <stop
                                                offset="100%"
                                                stopColor="#f97316"
                                                stopOpacity={0.4}
                                              />
                                            </linearGradient>
                                          </defs>
                                        </PieChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>

                                  {/* Data Table Section */}
                                  <div className="flex-[2] flex flex-col">
                                    <div
                                      className="backdrop-blur-sm rounded-lg border border-white/10 flex flex-col"
                                      style={{
                                        height: "fit-content",
                                        maxHeight: allocationView ?
                                          `calc(${Math.min(getTableRowLimit(executiveCards.length, cardData.length), 6)} * ${
                                            executiveCards.length === 1
                                              ? "20px"
                                              : executiveCards.length === 2
                                                ? "18px"
                                                : executiveCards.length <= 4
                                                  ? "16px"
                                                  : "14px"
                                          } + 32px)` : // Reduced for allocation view
                                          `calc(${getTableRowLimit(executiveCards.length, cardData.length)} * ${
                                            executiveCards.length === 1
                                              ? "24px"
                                              : executiveCards.length === 2
                                                ? "22px"
                                                : executiveCards.length <= 4
                                                  ? "20px"
                                                  : "18px"
                                          } + 40px)`, // +40px for header
                                      }}
                                    >
                                      {/* Table Header */}
                                      <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-t-lg border-b border-white/10 px-2 py-1">
                                        <div
                                          className="grid grid-cols-12 gap-1 text-blue-200"
                                          style={{
                                            fontSize:
                                              executiveCards.length === 1
                                                ? "11px"
                                                : executiveCards.length === 2
                                                  ? "10px"
                                                  : executiveCards.length <= 4
                                                    ? "9px"
                                                    : "8px",
                                          }}
                                        >
                                          <div className="col-span-5">
                                            {card.dimension}
                                          </div>
                                          <div className="col-span-5 text-right">
                                            {card.measure}
                                          </div>
                                          <div className="col-span-2 text-right">
                                            Share
                                          </div>
                                        </div>
                                      </div>

                                      {/* Table Body */}
                                      <div
                                        className="flex-1 overflow-y-auto relative"
                                        style={{
                                          maxHeight: allocationView ?
                                            `calc(${Math.min(getTableRowLimit(executiveCards.length, cardData.length), 6)} * ${
                                              executiveCards.length === 1
                                                ? "20px"
                                                : executiveCards.length === 2
                                                  ? "18px"
                                                  : executiveCards.length <= 4
                                                    ? "16px"
                                                    : "14px"
                                            })` : // Reduced for allocation view
                                            `calc(${getTableRowLimit(executiveCards.length, cardData.length)} * ${
                                              executiveCards.length === 1
                                                ? "24px"
                                                : executiveCards.length === 2
                                                  ? "22px"
                                                  : executiveCards.length <= 4
                                                    ? "20px"
                                                    : "18px"
                                            })`,
                                          scrollbarWidth: "thin",
                                          scrollbarColor: "rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1)",
                                        }}
                                      >
                                        {/* Scroll indicator */}
                                        {cardData.length > getTableRowLimit(executiveCards.length, cardData.length) && (
                                          <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-black/20 to-transparent pointer-events-none rounded-b-lg"></div>
                                        )}
                                        {cardData.map((item, index) => (
                                            <div
                                              key={index}
                                              className={`grid grid-cols-12 gap-1 px-2 border-b border-white/5 transition-all duration-200 cursor-pointer hover:bg-white/5 ${
                                                hoveredExecutiveItem?.cardId ===
                                                  card.id &&
                                                hoveredExecutiveItem?.itemName ===
                                                  item.name
                                                  ? "bg-blue-500/20 border-blue-400/30"
                                                  : ""
                                              }`}
                                              style={{
                                                minHeight:
                                                  executiveCards.length === 1
                                                    ? "24px"
                                                    : executiveCards.length ===
                                                        2
                                                      ? "22px"
                                                      : executiveCards.length <=
                                                          4
                                                        ? "20px"
                                                        : "18px",
                                                padding: "4px 0",
                                              }}
                                              onMouseEnter={() =>
                                                setHoveredExecutiveItem({
                                                  cardId: card.id,
                                                  itemName: item.name,
                                                })
                                              }
                                              onMouseLeave={() =>
                                                setHoveredExecutiveItem(null)
                                              }
                                            >
                                              <div className="col-span-5 flex items-start py-1">
                                                <span
                                                  className="text-white/90"
                                                  style={{
                                                    fontSize:
                                                      executiveCards.length ===
                                                      1
                                                        ? "16px"
                                                        : executiveCards.length ===
                                                            2
                                                          ? "14px"
                                                          : executiveCards.length <=
                                                              4
                                                            ? "13px"
                                                            : "11px",
                                                    wordBreak: "break-word",
                                                    lineHeight: "1.3",
                                                    display: "block",
                                                    width: "100%",
                                                  }}
                                                >
                                                  {item.name || "Unknown"}
                                                </span>
                                              </div>
                                              <div
                                                className="col-span-5 text-right font-mono text-white/80 flex items-start justify-end py-1"
                                                style={{
                                                  fontSize:
                                                    executiveCards.length === 1
                                                      ? "16px"
                                                      : executiveCards.length ===
                                                          2
                                                        ? "14px"
                                                        : executiveCards.length <=
                                                            4
                                                          ? "13px"
                                                          : "11px",
                                                }}
                                              >
                                                <span
                                                  style={{
                                                    wordBreak: "break-word",
                                                    lineHeight: "1.3",
                                                  }}
                                                >
                                                  ${item.formattedValue}
                                                </span>
                                              </div>
                                              <div
                                                className="col-span-2 text-right text-white/90 flex items-start justify-end py-1"
                                                style={{
                                                  fontSize:
                                                    executiveCards.length === 1
                                                      ? "16px"
                                                      : executiveCards.length ===
                                                          2
                                                        ? "14px"
                                                        : executiveCards.length <=
                                                            4
                                                          ? "13px"
                                                          : "11px",
                                                }}
                                              >
                                                <span
                                                  style={{
                                                    lineHeight: "1.3",
                                                  }}
                                                >
                                                  {item.percentage}%
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                /* Bar Chart View - Full Width */
                                <div className="h-full">
                                  <ResponsiveContainer
                                    width="100%"
                                    height="100%"
                                  >
                                    <BarChart
                                      data={cardData}
                                      margin={{
                                        top:
                                          executiveCards.length <= 4 ? 30 : 25,
                                        right: 5,
                                        left: 5,
                                        bottom:
                                          executiveCards.length === 1
                                            ? 80
                                            : executiveCards.length === 2
                                              ? 60
                                              : executiveCards.length <= 4
                                                ? 45
                                                : 35,
                                      }}
                                    >
                                      <CartesianGrid
                                        strokeDasharray="none"
                                        stroke="rgba(255, 255, 255, 0.1)"
                                        strokeWidth={0.5}
                                        horizontal={false}
                                        vertical={false}
                                      />
                                      <XAxis
                                        dataKey="name"
                                        stroke="white"
                                        fontSize={
                                          executiveCards.length === 1
                                            ? 16.5
                                            : executiveCards.length === 2
                                              ? 13.5
                                              : executiveCards.length <= 4
                                                ? 10.5
                                                : 9
                                        }
                                        {...(() => {
                                          const containerWidth = executiveCards.length === 1 ? 800 : executiveCards.length === 2 ? 400 : 300;
                                          const xAxisProps = getXAxisProps(cardData, containerWidth);
                                          return {
                                            angle: xAxisProps.angle,
                                            textAnchor: xAxisProps.textAnchor,
                                            height: xAxisProps.angle === 0 ?
                                              (executiveCards.length === 1 ? 40 : executiveCards.length === 2 ? 30 : 25) :
                                              (executiveCards.length === 1 ? 80 : executiveCards.length === 2 ? 60 : executiveCards.length <= 4 ? 45 : 35)
                                          };
                                        })()}
                                        interval={0}
                                        axisLine={{
                                          stroke: "rgba(255, 255, 255, 0.3)",
                                          strokeWidth: 0.5
                                        }}
                                        tickLine={{
                                          stroke: "rgba(255, 255, 255, 0.2)",
                                          strokeWidth: 0.5
                                        }}
                                      />
                                      <YAxis
                                        stroke="transparent"
                                        domain={['dataMin', 'dataMax']}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={false}
                                      />
                                      <Tooltip
                                        formatter={(value: any) => [
                                          `$${value.toLocaleString()}`,
                                          card.measure,
                                        ]}
                                        contentStyle={{
                                          background:
                                            "linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(51, 65, 85, 0.95))",
                                          border:
                                            "1px solid rgba(96, 165, 250, 0.3)",
                                          borderRadius: "8px",
                                          color: "white",
                                          boxShadow:
                                            "0 8px 20px rgba(0, 0, 0, 0.3)",
                                          backdropFilter: "blur(8px)",
                                          fontSize: "11px",
                                        }}
                                        labelStyle={{
                                          color: "white",
                                          fontWeight: "bold",
                                        }}
                                      />
                                      <Bar
                                        dataKey="value"
                                        fill="#3b82f6"
                                        fillOpacity={0.8}
                                        stroke="#60a5fa"
                                        strokeWidth={1}
                                        radius={[4, 4, 0, 0]}
                                        label={{
                                          position: "top",
                                          content: (props: any) => {
                                            const { x, y, width, value } =
                                              props;
                                            if (!value || value === 0)
                                              return null;
                                            return (
                                              <text
                                                x={x + width / 2}
                                                y={y - 8}
                                                fill="white"
                                                textAnchor="middle"
                                                fontSize={
                                                  executiveCards.length === 1
                                                    ? "11"
                                                    : "9"
                                                }
                                                fontWeight="bold"
                                              >
                                                ${(value / 1000).toFixed(1)}K
                                              </text>
                                            );
                                          },
                                        }}
                                      />

                                      {/* Gradient definition for executive bars */}
                                      <defs>
                                        <linearGradient
                                          id="executiveBarGradient"
                                          x1="0"
                                          y1="0"
                                          x2="0"
                                          y2="1"
                                        >
                                          <stop
                                            offset="0%"
                                            stopColor="#60a5fa"
                                            stopOpacity={0.8}
                                          />
                                          <stop
                                            offset="100%"
                                            stopColor="#3b82f6"
                                            stopOpacity={0.6}
                                          />
                                        </linearGradient>
                                      </defs>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              )
                            ) : (
                              <div className="h-full flex items-center justify-center">
                                <p className="text-white/50 text-sm">
                                  No data available
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Card Footer - Title */}
                          {!showExecutiveFilters && cardData.length > 0 && (
                            <div className="mt-2 text-center">
                              <p className="text-xs text-white/80 font-medium">
                                {card.measure} by {card.dimension}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
    </div>
  );
};

export default AllocationPage;
