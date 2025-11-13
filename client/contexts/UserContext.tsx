import React, { createContext, useContext, useState, useEffect } from 'react';

interface UserContextType {
  userEmail: string;
  setUserEmail: (email: string) => void;
  displayName: string;
  initials: string;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: React.ReactNode;
  initialUserEmail?: string;
}

export const UserProvider: React.FC<UserProviderProps> = ({ 
  children, 
  initialUserEmail = "mayank.jain@abc.com" 
}) => {
  const [userEmail, setUserEmail] = useState(initialUserEmail);

  // Helper function to get display name from email
  const getDisplayName = (email: string): string => {
    if (!email) return 'Unknown User';
    
    const localPart = email.split('@')[0];
    if (!localPart) return 'Unknown User';
    
    // Handle common email formats
    return localPart
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper function to get initials from email
  const getUserInitials = (email: string): string => {
    if (!email) return 'U';
    
    const displayName = getDisplayName(email);
    const nameParts = displayName.split(' ');
    
    if (nameParts.length === 1) {
      return nameParts[0].charAt(0).toUpperCase();
    }
    
    return nameParts.slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  };

  const displayName = getDisplayName(userEmail);
  const initials = getUserInitials(userEmail);

  const value = {
    userEmail,
    setUserEmail,
    displayName,
    initials,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
