import React from 'react';

const Preloader = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-black transition-theme"
      role="alert"
      aria-live="assertive"
      aria-label="Loading dashboard"
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-800 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
        
        <h1 className="text-xl font-medium text-center text-black dark:text-white tracking-tight">
          R1 dashboard - a nagar nigam dashboard
        </h1>
      </div>
    </div>
  );
};

export default Preloader;
