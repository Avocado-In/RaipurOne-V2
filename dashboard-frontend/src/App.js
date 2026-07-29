import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Preloader from './components/Preloader';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import NotificationBell from './components/NotificationBell';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const PushNotifications = lazy(() => import('./pages/PushNotifications'));
const TicketsList = lazy(() => import('./pages/TicketsList'));
const TicketDetail = lazy(() => import('./pages/TicketDetail'));
const Statistics = lazy(() => import('./pages/Statistics'));
const DepartmentView = lazy(() => import('./pages/DepartmentView'));
const DepartmentSegregation = lazy(() => import('./pages/DepartmentSegregation'));
const WorkerManagement = lazy(() => import('./pages/WorkerManagement'));
const WorkerSubmissions = lazy(() => import('./pages/WorkerSubmissions'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"></div>
      <p className="text-sm text-black/60 dark:text-white/60">Loading...</p>
    </div>
  </div>
);

const API_BASE_URL = process.env.REACT_APP_API_URL?.replace(/\/api$/, '') || 'http://127.0.0.1:8000';

function App() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const healthUrl = `${API_BASE_URL}/health`;

    fetch(healthUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then((data) => {
        console.log(`[Frontend] Backend connected at ${API_BASE_URL} — health status:`, data);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(`[Frontend] Backend connection failed at ${API_BASE_URL}:`, err.message);
      });

    return () => controller.abort();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NotificationProvider>
          <Router>
            <Preloader isLoading={isInitialLoading} />
            
            {!isInitialLoading && (
              <div className="flex min-h-screen bg-white dark:bg-black transition-theme">
                <Sidebar />
                
                <main className="flex-1 ml-sidebar-collapsed lg:ml-sidebar-expanded transition-all duration-300">
                  {/* Top Bar with Notification Bell */}
                  <div className="sticky top-0 bg-white dark:bg-black border-b border-black/10 dark:border-white/10 px-6 py-4 flex items-center justify-between z-40">
                    <h1 className="text-2xl font-bold text-black dark:text-white">
                      Admin Dashboard
                    </h1>
                    <div className="flex items-center gap-4">
                      <NotificationBell />
                      <button className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <svg className="w-6 h-6 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
                    <Suspense fallback={<LoadingFallback />}>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/notifications" element={<PushNotifications />} />
                        <Route path="/tickets" element={<TicketsList />} />
                        <Route path="/tickets/:id" element={<TicketDetail />} />
                        <Route path="/statistics" element={<Statistics />} />
                        <Route path="/departments" element={<DepartmentView />} />
                        <Route path="/department-segregation" element={<DepartmentSegregation />} />
                        <Route path="/workers" element={<WorkerManagement />} />
                        <Route path="/worker-submissions" element={<WorkerSubmissions />} />
                      </Routes>
                    </Suspense>
                  </div>
                </main>
              </div>
            )}
          </Router>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
