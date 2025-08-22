import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  BarChart,
  FileText,
  Bookmark,
  Inbox,
} from "lucide-react";

export type NavigationPage = 'allocation' | 'source-data' | 'published-data' | 'build-report' | 'saved-reports' | 'inbox';

interface NavigationProps {
  isCollapsed: boolean;
  currentPage: NavigationPage;
  onToggleCollapse: () => void;
  onPageChange: (page: NavigationPage) => void;
}

const Navigation: React.FC<NavigationProps> = ({
  isCollapsed,
  currentPage,
  onToggleCollapse,
  onPageChange,
}) => {
  const navigationItems = [
    {
      id: 'allocation' as NavigationPage,
      label: 'Allocation',
      icon: BarChart,
      description: 'Budget allocation and analysis'
    },
    {
      id: 'inbox' as NavigationPage,
      label: 'Inbox',
      icon: Inbox,
      description: 'Manage orders and approvals'
    },
    {
      id: 'source-data' as NavigationPage,
      label: 'Source Data Management',
      icon: Database,
      description: 'Manage and import data sources'
    },
    {
      id: 'published-data' as NavigationPage,
      label: 'View Published Data',
      icon: Eye,
      description: 'View and analyze published datasets'
    },
    {
      id: 'build-report' as NavigationPage,
      label: 'Build Report',
      icon: FileText,
      description: 'Generate and manage reports'
    },
    {
      id: 'saved-reports' as NavigationPage,
      label: 'View Saved Reports',
      icon: Bookmark,
      description: 'View and restore saved dashboard reports'
    }
  ];

  return (
    <div className={`transition-all duration-300 ease-in-out ${
      isCollapsed ? 'w-0 opacity-0' : 'w-64'
    } flex-shrink-0 overflow-hidden`}>
      <nav className="glass-card rounded-3xl h-full flex flex-col p-4">
        {/* Navigation Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title={isCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 text-white/70" />
            ) : (
              <div className="flex">
                <ChevronLeft className="w-3 h-5 text-white/70" />
                <ChevronLeft className="w-3 h-5 text-white/70 -ml-1" />
              </div>
            )}
          </button>
          {!isCollapsed && (
            <h2 className="text-sm font-normal text-white/80">Marcom Finance Suite</h2>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex flex-col gap-2 flex-1">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 text-left ${
                  isActive
                    ? 'bg-blue-600/30 text-white border border-blue-400/30'
                    : 'hover:bg-white/10 text-white/80 hover:text-white'
                }`}
                title={isCollapsed ? item.label : ''}
              >
                <IconComponent className={`w-5 h-5 flex-shrink-0 ${
                  isActive ? 'text-blue-300' : 'text-white/70'
                }`} />
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-sm truncate">{item.label}</span>
                    <span className="text-xs text-white/60 truncate">{item.description}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>


      </nav>
    </div>
  );
};

export default Navigation;
