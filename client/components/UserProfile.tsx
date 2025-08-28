import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Settings,
  Moon,
  Sun,
  Monitor,
  Bell,
  LogOut,
  ChevronDown,
  Mail,
  Shield
} from 'lucide-react';

interface UserProfileProps {
  userEmail: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ userEmail }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get user initials from email
  const getUserInitials = (email: string) => {
    const namePart = email.split('@')[0];
    const parts = namePart.split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return namePart.slice(0, 2).toUpperCase();
  };

  // Get display name from email
  const getDisplayName = (email: string) => {
    const namePart = email.split('@')[0];
    const parts = namePart.split(/[._-]/);
    if (parts.length >= 2) {
      return parts.map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join(' ');
    }
    return namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const initials = getUserInitials(userEmail);
  const displayName = getDisplayName(userEmail);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 transition-colors group"
        title={`${displayName} - Click for profile options`}
      >
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-lg">
          {initials}
        </div>
        <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-black/90 border border-white/20 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-lg font-semibold shadow-lg">
                {initials}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">{displayName}</h3>
                <div className="flex items-center gap-1 text-sm text-white/70">
                  <Mail className="w-3 h-3" />
                  {userEmail}
                </div>
                <div className="flex items-center gap-1 text-xs text-green-400 mt-1">
                  <Shield className="w-3 h-3" />
                  Admin Access
                </div>
              </div>
            </div>
          </div>

          {/* Profile Preferences */}
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Profile Preferences
              </h4>
              
              {/* Theme Selection */}
              <div className="space-y-2">
                <label className="text-xs text-white/70">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors ${
                      theme === 'light'
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-400/30'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    <Sun className="w-3 h-3" />
                    Light
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors ${
                      theme === 'dark'
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-400/30'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    <Moon className="w-3 h-3" />
                    Dark
                  </button>
                  <button
                    onClick={() => setTheme('auto')}
                    className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors ${
                      theme === 'auto'
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-400/30'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    <Monitor className="w-3 h-3" />
                    Auto
                  </button>
                </div>
              </div>

              {/* Notifications */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-white/70" />
                  <span className="text-sm text-white/80">Notifications</span>
                </div>
                <button
                  onClick={() => setNotifications(!notifications)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                    notifications ? 'bg-blue-600' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                      notifications ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-white/10 p-2">
            <button
              onClick={() => {
                setIsOpen(false);
                // TODO: Implement logout functionality
                console.log('Logout clicked');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
