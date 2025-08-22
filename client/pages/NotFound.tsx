import React from 'react';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 to-blue-800 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <p className="text-xl mb-8">Page not found</p>
        <a 
          href="/" 
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg transition-colors"
        >
          Go Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
