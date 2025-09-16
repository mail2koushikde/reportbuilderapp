import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import Navigation, { NavigationPage } from '../components/Navigation';
import BuildReport from '../components/BuildReport';
import ViewSavedReports, { SavedReport } from '../components/ViewSavedReports';
import FileHistoryWithSession from '../components/FileHistoryWithSession';

const Index: React.FC = () => {
  const { userEmail } = useUser();
  const [navigationCollapsed, setNavigationCollapsed] = useState(window.innerWidth < 1024); // Auto-collapse on tablets and mobile
  const [currentPage, setCurrentPage] = useState<NavigationPage>('build-report');
  const [loadedReportState, setLoadedReportState] = useState<SavedReport['dashboardState'] | undefined>(undefined);

  const handleLoadReport = (reportState: SavedReport['dashboardState']) => {
    setLoadedReportState(reportState);
    setCurrentPage('build-report');
  };

  const handlePageChange = (page: NavigationPage) => {
    setCurrentPage(page);
    // Auto-close navigation on mobile after selection
    if (window.innerWidth < 1024) {
      setNavigationCollapsed(true);
    }
  };

  // Handle window resize for responsive navigation
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setNavigationCollapsed(true);
      } else {
        setNavigationCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'build-report':
        return <BuildReport loadedReportState={loadedReportState} userEmail={userEmail} />;
      case 'saved-reports':
        return <ViewSavedReports onLoadReport={handleLoadReport} />;
      case 'file-history':
        return <FileHistoryWithSession />;
      default:
        return <BuildReport loadedReportState={loadedReportState} userEmail={userEmail} />;
    }
  };

  return (
    <div className={`min-h-screen w-full p-1 sm:p-2 lg:p-4 flex ${
      currentPage === 'build-report' ? 'items-start overflow-auto' : 'items-center overflow-hidden'
    }`}>
      <div className={`w-full flex gap-1 sm:gap-2 lg:gap-4 min-w-0 ${
        currentPage === 'build-report' ? 'min-h-[98vh]' : 'h-[98vh]'
      }`}>
        {/* Navigation Panel */}
        <>
          {/* Mobile backdrop */}
          {!navigationCollapsed && window.innerWidth < 1024 && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setNavigationCollapsed(true)}
            />
          )}

          {/* Navigation */}
          <div
            onMouseLeave={() => setNavigationCollapsed(true)}
            className={`${
              navigationCollapsed
                ? 'fixed inset-y-0 left-0 z-50 transform -translate-x-full transition-transform duration-300 lg:relative lg:transform-none'
                : 'fixed inset-y-0 left-0 z-50 transition-transform duration-300 lg:relative lg:z-auto'
            }`}
          >
            {!navigationCollapsed && (
              <Navigation
                isCollapsed={navigationCollapsed}
                currentPage={currentPage}
                onToggleCollapse={() => setNavigationCollapsed(!navigationCollapsed)}
                onPageChange={handlePageChange}
              />
            )}
          </div>
        </>

        {/* Main Content Area */}
        <main className={`glass-card rounded-xl sm:rounded-2xl lg:rounded-3xl flex-1 flex flex-col min-w-0 relative ${
          currentPage === 'build-report' ? 'overflow-visible' : 'overflow-hidden'
        }`}>
          {/* Collapse button when navigation is hidden */}
          {navigationCollapsed && (
            <button
              onClick={() => setNavigationCollapsed(false)}
              onMouseEnter={() => setNavigationCollapsed(false)}
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
