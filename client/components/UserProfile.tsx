import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import {
  LogOut,
  Mail,
  Shield,
  Moon,
  Sun
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const UserProfile: React.FC = () => {
  const { userEmail, displayName, initials } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button (no arrow, avatar is the trigger) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-lg hover:brightness-110 transition"
        title={`${displayName} - Click for profile options`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {initials}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 dropdown-panel rounded-xl shadow-2xl z-50 overflow-hidden">
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

          {/* Theme Toggle */}
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center justify-start w-full">
              <button
                onClick={toggleTheme}
                aria-label="Toggle light/dark theme"
                className={`relative inline-flex items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  theme === 'light' ? 'bg-gray-200' : 'bg-zinc-800'
                } w-16 h-8 px-1`}
              >
                <Sun className={`w-3.5 h-3.5 transition-colors ${theme === 'light' ? 'text-yellow-500' : 'text-gray-400'}`} />
                <Moon className={`w-3.5 h-3.5 ml-auto transition-colors ${theme === 'dark' ? 'text-blue-400' : 'text-gray-400'}`} />
                <span
                  className={`absolute top-1 left-1 inline-block w-6 h-6 rounded-full bg-white shadow transition-transform duration-300 ${
                    theme === 'dark' ? 'translate-x-8' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-2">
            <button
              onClick={() => {
                setIsOpen(false);
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
