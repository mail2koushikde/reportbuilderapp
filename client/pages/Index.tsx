import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import Navigation, { NavigationPage } from '../components/Navigation';
import AllocationPage from '../components/AllocationPage';
import Inbox from '../components/Inbox';
import SourceDataManagement from '../components/SourceDataManagement';
import ViewPublishedData from '../components/ViewPublishedData';
import BuildReport from '../components/BuildReport';
import ViewSavedReports, { SavedReport } from '../components/ViewSavedReports';

const Index: React.FC = () => {
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState<NavigationPage>('allocation');
  const [loadedReportState, setLoadedReportState] = useState<SavedReport['dashboardState'] | undefined>(undefined);

  const handleLoadReport = (reportState: SavedReport['dashboardState']) => {
    setLoadedReportState(reportState);
    setCurrentPage('build-report');
  };

  const handlePageChange = (page: NavigationPage) => {
    // Clear loaded report state when navigating away from build-report
    if (page !== 'build-report') {
      setLoadedReportState(undefined);
    }
    setCurrentPage(page);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'allocation':
        return <AllocationPage />;
      case 'inbox':
        return <Inbox />;
      case 'source-data':
        return <SourceDataManagement />;
      case 'published-data':
        return <ViewPublishedData />;
      case 'build-report':
        return <BuildReport loadedReportState={loadedReportState} />;
      case 'saved-reports':
        return <ViewSavedReports onLoadReport={handleLoadReport} />;
      default:
        return <AllocationPage />;
    }
  };

  return (
    <div className={`min-h-screen w-full p-1 sm:p-2 flex ${
      currentPage === 'build-report' ? 'items-start overflow-auto' : 'items-center overflow-hidden'
    }`}>
      <div className={`w-full flex gap-2 min-w-0 ${
        currentPage === 'build-report' ? 'min-h-[98vh]' : 'h-[98vh]'
      }`}>
        {/* Navigation Panel */}
        {!navigationCollapsed && (
          <Navigation
            isCollapsed={navigationCollapsed}
            currentPage={currentPage}
            onToggleCollapse={() => setNavigationCollapsed(!navigationCollapsed)}
            onPageChange={handlePageChange}
          />
        )}

        {/* Main Content Area */}
        <main className={`glass-card rounded-3xl flex-1 flex flex-col min-w-0 ${
          currentPage === 'build-report' ? 'overflow-visible' : 'overflow-hidden'
        } ${
          navigationCollapsed ? 'relative' : ''
        }`}>
          {/* Collapse button when navigation is hidden */}
          {navigationCollapsed && (
            <button
              onClick={() => setNavigationCollapsed(false)}
              className="absolute top-2 left-4 z-10 p-2 rounded-lg bg-transparent border-transparent hover:bg-white/10 transition-colors"
              title="Expand navigation"
            >
              <div className="flex">
                <ChevronRight className="w-3 h-5 text-white/70" />
                <ChevronRight className="w-3 h-5 text-white/70 -ml-1" />
              </div>
            </button>
          )}
          {renderCurrentPage()}
        </main>
      </div>
    </div>
  );
};

export default Index;
