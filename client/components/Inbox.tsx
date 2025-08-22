import React, { useState, useMemo, useEffect } from 'react';
import { Inbox as InboxIcon, ChevronDown, ChevronUp, Eye, Check, RotateCcw, X } from 'lucide-react';

interface OrderRecord {
  process: string;
  version: string;
  submittedBy: string;
  submittedDate: string;
  status: string;
  actionBy: string | null;
  actionDate: string | null;
}

interface PendingActionRecord {
  process: string;
  version: string;
  submittedBy: string;
  submittedDate: string;
  status: string;
  actionBy: string;
  actionDate: string;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string;
  direction: SortDirection;
}

const Inbox: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'pending' | 'past'>('orders');
  const [myOrdersData, setMyOrdersData] = useState<OrderRecord[]>([]);
  const [pendingActionsData, setPendingActionsData] = useState<PendingActionRecord[]>([]);
  const [pastActionsData, setPastActionsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Sort states for each tab
  const [ordersSort, setOrdersSort] = useState<SortState>({ column: '', direction: null });
  const [pendingSort, setPendingSort] = useState<SortState>({ column: '', direction: null });
  const [pastSort, setPastSort] = useState<SortState>({ column: '', direction: null });

  // Load data from JSON files
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load My Orders data
        const ordersResponse = await fetch('/client/data/my-orders.json');
        const ordersData = await ordersResponse.json();
        setMyOrdersData(ordersData);

        // Load Pending Actions data
        const pendingResponse = await fetch('/client/data/pending-actions.json');
        const pendingData = await pendingResponse.json();
        setPendingActionsData(pendingData);

        // Load Past Actions data
        const pastResponse = await fetch('/client/data/past-actions.json');
        const pastData = await pastResponse.json();
        setPastActionsData(pastData);

      } catch (error) {
        console.error('Error loading data:', error);
        setMyOrdersData([]);
        setPendingActionsData([]);
        setPastActionsData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);


  // Sorting functions
  const handleOrdersSort = (column: string) => {
    setOrdersSort(prev => ({
      column,
      direction: prev.column === column 
        ? (prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc')
        : 'asc'
    }));
  };

  const handlePendingSort = (column: string) => {
    setPendingSort(prev => ({
      column,
      direction: prev.column === column 
        ? (prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc')
        : 'asc'
    }));
  };

  const handlePastSort = (column: string) => {
    setPastSort(prev => ({
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

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortState.direction === 'asc' ? 1 : -1;
      if (bVal == null) return sortState.direction === 'asc' ? -1 : 1;

      // Handle version numbers
      if (sortState.column === 'version') {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      }

      // Handle dates
      if (sortState.column === 'submittedDate' || sortState.column === 'actionDate') {
        aVal = new Date(aVal?.replace('\n', ' ') || '');
        bVal = new Date(bVal?.replace('\n', ' ') || '');
      }

      // Handle status
      if (sortState.column === 'status') {
        const statusOrder = { 'PENDING APPROVAL': 1, 'APPROVED': 2, 'REJECTED': 3 };
        aVal = statusOrder[aVal as keyof typeof statusOrder] || 0;
        bVal = statusOrder[bVal as keyof typeof statusOrder] || 0;
      }

      // Handle empty strings
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
  const sortedOrdersData = useMemo(() => 
    sortData(myOrdersData, ordersSort), 
    [myOrdersData, ordersSort]
  );

  const sortedPendingData = useMemo(() => 
    sortData(pendingActionsData, pendingSort), 
    [pendingActionsData, pendingSort]
  );

  const sortedPastData = useMemo(() => 
    sortData(pastActionsData, pastSort), 
    [pastActionsData, pastSort]
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
      'PENDING APPROVAL': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'APPROVED': 'bg-green-500/20 text-green-300 border-green-500/30',
      'REJECTED': 'bg-red-500/20 text-red-300 border-red-500/30'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[status as keyof typeof statusColors]}`}>
        {status}
      </span>
    );
  };


  // Action handlers for pending actions
  const handleAction = (action: 'view' | 'approve' | 'sendBack' | 'reject', record: PendingActionRecord) => {
    console.log(`${action} action for:`, record);

    // Show visual feedback
    const actionText = action === 'approve' ? 'Approved' : action === 'sendBack' ? 'Sent Back' : action === 'reject' ? 'Rejected' : 'Viewed';
    const actionColor = action === 'approve' ? 'green' : action === 'sendBack' ? 'orange' : action === 'reject' ? 'red' : 'blue';

    // Create temporary notification
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg text-white z-50 animate-pulse`;
    notification.style.backgroundColor =
      actionColor === 'green' ? '#10b981' :
      actionColor === 'orange' ? '#f59e0b' :
      actionColor === 'red' ? '#ef4444' :
      '#3b82f6';
    notification.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="w-4 h-4">
          ${action === 'approve' ? '✓' : action === 'sendBack' ? '↩' : action === 'reject' ? '✗' : '👁'}
        </div>
        <span>Action ${actionText}: ${record.process}</span>
      </div>
    `;

    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);

    // Simulate record status update and movement between tabs for approve/reject
    if (action === 'approve' || action === 'reject') {
      const updatedRecord = {
        ...record,
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        actionDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).replace(',', '\n')
      };

      // Remove from pending actions
      setPendingActionsData(prev => prev.filter(item => item !== record));

      // Add to past actions
      setPastActionsData(prev => [updatedRecord, ...prev]);

      // Show additional success message
      setTimeout(() => {
        const moveNotification = document.createElement('div');
        moveNotification.className = 'fixed top-16 right-4 px-4 py-2 rounded-lg shadow-lg bg-blue-500 text-white z-50';
        moveNotification.innerHTML = `<span>Record moved to History tab</span>`;
        document.body.appendChild(moveNotification);

        setTimeout(() => {
          if (moveNotification.parentNode) {
            moveNotification.parentNode.removeChild(moveNotification);
          }
        }, 2000);
      }, 1000);
    }

    // TODO: Here you would implement the actual API call to update the record status
    // For example: updateRecordStatus(record.id, action);
  };

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'orders': return myOrdersData.length;
      case 'pending': return pendingActionsData.length;
      case 'past': return pastActionsData.length;
      default: return 0;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <InboxIcon className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-white/90">Inbox</h1>
            <p className="text-sm text-white/60">Manage your orders and approvals</p>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="px-6 pt-4">
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'orders'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-white/70 hover:text-white/90'
            }`}
          >
            My Orders {getTabCount('orders') > 0 && (
              <span className="ml-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                {getTabCount('orders')}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-white/70 hover:text-white/90'
            }`}
          >
            Pending Action {getTabCount('pending') > 0 && (
              <span className="ml-1 bg-orange-600 text-white text-xs px-2 py-0.5 rounded-full">
                {getTabCount('pending')}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'past'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-white/70 hover:text-white/90'
            }`}
          >
            History {getTabCount('past') > 0 && (
              <span className="ml-1 bg-gray-600 text-white text-xs px-2 py-0.5 rounded-full">
                {getTabCount('past')}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        {/* My Orders Tab */}
        {activeTab === 'orders' && (
          <div className="bg-white/5 rounded-lg border border-white/10">
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(15 * 2.5rem + 2.5rem)' }}>
              <table className="w-full border-separate border-spacing-0">
                <thead className="sticky top-0 bg-gray-800 backdrop-blur-sm z-20 shadow-md border-b border-white/10">
                  <tr>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handleOrdersSort('process')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Process {getSortIcon('process', ordersSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handleOrdersSort('version')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Version {getSortIcon('version', ordersSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handleOrdersSort('submittedBy')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Submitted By {getSortIcon('submittedBy', ordersSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handleOrdersSort('submittedDate')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Submitted Date {getSortIcon('submittedDate', ordersSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handleOrdersSort('status')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Status {getSortIcon('status', ordersSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handleOrdersSort('actionBy')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Action By {getSortIcon('actionBy', ordersSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handleOrdersSort('actionDate')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Action Date {getSortIcon('actionDate', ordersSort)}
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
                      <td colSpan={8} className="p-4 text-center text-white/60">
                        Loading...
                      </td>
                    </tr>
                  ) : sortedOrdersData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-white/60">
                        No orders found
                      </td>
                    </tr>
                  ) : sortedOrdersData.map((record, index) => (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-2 text-xs text-white/80">{record.process}</td>
                      <td className="p-2 text-xs text-white/80">{record.version}</td>
                      <td className="p-2 text-xs text-white/80">{record.submittedBy}</td>
                      <td className="p-2 text-xs text-white/80 whitespace-pre-line">{record.submittedDate}</td>
                      <td className="p-2">{getStatusBadge(record.status)}</td>
                      <td className="p-2 text-xs text-white/80">{record.actionBy || ''}</td>
                      <td className="p-2 text-xs text-white/80 whitespace-pre-line">{record.actionDate || ''}</td>
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
        )}

        {/* Pending Actions Tab */}
        {activeTab === 'pending' && (
          <div className="bg-white/5 rounded-lg border border-white/10 relative">
            <div className="overflow-auto relative" style={{ maxHeight: 'calc(15 * 2.5rem + 2.5rem)' }}>
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-800 z-40 shadow-lg">
                  <tr className="border-b-2 border-white/20">
                    <th className="text-left p-2 text-xs font-medium text-white/70 bg-gray-800">
                      <button
                        onClick={() => handlePendingSort('process')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Process {getSortIcon('process', pendingSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70 bg-gray-800">
                      <button
                        onClick={() => handlePendingSort('version')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Version {getSortIcon('version', pendingSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70 bg-gray-800">
                      <button
                        onClick={() => handlePendingSort('submittedBy')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Submitted By {getSortIcon('submittedBy', pendingSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70 bg-gray-800">
                      <button
                        onClick={() => handlePendingSort('submittedDate')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Submitted Date {getSortIcon('submittedDate', pendingSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70 bg-gray-800">
                      <button
                        onClick={() => handlePendingSort('status')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Status {getSortIcon('status', pendingSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70 bg-gray-800">
                      <button
                        onClick={() => handlePendingSort('actionBy')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Action By {getSortIcon('actionBy', pendingSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70 bg-gray-800">
                      <button
                        onClick={() => handlePendingSort('actionDate')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Action Date {getSortIcon('actionDate', pendingSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70 bg-gray-800">
                      <div className="flex items-center gap-1">
                        Actions <ChevronDown className="w-3 h-3" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-white/60">
                        Loading...
                      </td>
                    </tr>
                  ) : sortedPendingData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-white/60">
                        No pending actions found
                      </td>
                    </tr>
                  ) : sortedPendingData.map((record, index) => (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-2 text-xs text-white/80">{record.process}</td>
                      <td className="p-2 text-xs text-white/80">{record.version}</td>
                      <td className="p-2 text-xs text-white/80">{record.submittedBy}</td>
                      <td className="p-2 text-xs text-white/80 whitespace-pre-line">{record.submittedDate}</td>
                      <td className="p-2">{getStatusBadge(record.status)}</td>
                      <td className="p-2 text-xs text-white/80">{record.actionBy}</td>
                      <td className="p-2 text-xs text-white/80 whitespace-pre-line">{record.actionDate}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAction('view', record)}
                            className="p-1 rounded-full bg-blue-400 hover:bg-blue-500 text-white transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={() => handleAction('approve', record)}
                            className="p-1 rounded-full bg-green-400 hover:bg-green-500 text-white transition-colors"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={() => handleAction('sendBack', record)}
                            className="p-1 rounded-full bg-orange-400 hover:bg-orange-500 text-white transition-colors"
                            title="Send Back"
                          >
                            <RotateCcw className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={() => handleAction('reject', record)}
                            className="p-1 rounded-full bg-red-400 hover:bg-red-500 text-white transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Past Actions Tab */}
        {activeTab === 'past' && (
          <div className="bg-white/5 rounded-lg border border-white/10">
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(15 * 2.5rem + 2.5rem)' }}>
              <table className="w-full border-separate border-spacing-0">
                <thead className="sticky top-0 bg-gray-800 backdrop-blur-sm z-20 shadow-md border-b border-white/10">
                  <tr>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handlePastSort('process')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Process {getSortIcon('process', pastSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handlePastSort('version')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Version {getSortIcon('version', pastSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handlePastSort('submittedBy')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Submitted By {getSortIcon('submittedBy', pastSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handlePastSort('submittedDate')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Submitted Date {getSortIcon('submittedDate', pastSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handlePastSort('status')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Status {getSortIcon('status', pastSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handlePastSort('actionBy')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Action By {getSortIcon('actionBy', pastSort)}
                      </button>
                    </th>
                    <th className="text-left p-2 text-xs font-medium text-white/70">
                      <button 
                        onClick={() => handlePastSort('actionDate')}
                        className="flex items-center gap-1 hover:text-white/90 transition-colors"
                      >
                        Action Date {getSortIcon('actionDate', pastSort)}
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
                      <td colSpan={8} className="p-4 text-center text-white/60">
                        Loading...
                      </td>
                    </tr>
                  ) : sortedPastData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-white/60">
                        No history data available
                      </td>
                    </tr>
                  ) : sortedPastData.map((record, index) => (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-2 text-xs text-white/80">{record.process}</td>
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
        )}
      </div>

    </div>
  );
};

export default Inbox;
