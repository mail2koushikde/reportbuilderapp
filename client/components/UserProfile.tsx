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
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-center">
              <div className="relative bg-gray-800 rounded-full p-1 w-32 h-10">
                {/* Background slider */}
                <div
                  className={`absolute top-1 w-14 h-8 bg-blue-600 rounded-full transition-transform duration-300 ease-in-out ${
                    theme === 'light' ? 'transform translate-x-0' : 'transform translate-x-16'
                  }`}
                />

                {/* Light option */}
                <button
                  onClick={() => theme !== 'light' && toggleTheme()}
                  className={`relative z-10 w-14 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    theme === 'light' ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                </button>

                {/* Dark option */}
                <button
                  onClick={() => theme !== 'dark' && toggleTheme()}
                  className={`relative z-10 w-14 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Labels */}
            <div className="flex justify-between mt-2 px-2">
              <span className={`text-xs font-medium ${theme === 'light' ? 'text-white' : 'text-white/50'}`}>
                LIGHT
              </span>
              <span className={`text-xs font-medium ${theme === 'dark' ? 'text-white' : 'text-white/50'}`}>
                DARK
              </span>
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
