import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import {
  User,
  Settings,
  Bell,
  LogOut,
  ChevronDown,
  Mail,
  Shield
} from 'lucide-react';

const UserProfile: React.FC = () => {
  const { userEmail, displayName, initials } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
