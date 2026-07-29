import React, { useState, useEffect, useMemo } from 'react';
import { ticketAPI } from '../api';
import StatCard from '../components/StatCard';
import TicketCard from '../components/TicketCard';
import AnalyticsDashboard from '../components/AnalyticsDashboard';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const normalizeStats = (payload) => {
    if (!payload) return null;

    if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
      return payload.data;
    }

    return payload;
  };

  const normalizeTickets = (payload) => {
    if (!payload) return [];

    if (Array.isArray(payload)) return payload;
    if (payload.data && Array.isArray(payload.data)) return payload.data;
    if (payload.items && Array.isArray(payload.items)) return payload.items;
    return [];
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, ticketsRes] = await Promise.all([
        ticketAPI.getDashboardStats(),
        ticketAPI.getAllTickets(),
      ]);

      const normalizedStats = normalizeStats(statsRes?.data);
      const normalizedTickets = normalizeTickets(ticketsRes?.data);

      setStats(normalizedStats);
      setRecentTickets(normalizedTickets.slice(0, 5));
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const statsData = useMemo(() => [
    { title: 'Total Tickets', number: stats?.totalTickets || 0 },
    { title: 'Open Tickets', number: stats?.openTickets || 0 },
    { title: 'In Progress', number: stats?.inProgressTickets || 0 },
    { title: 'Resolved', number: stats?.resolvedTickets || 0 },
    { title: 'Total Users', number: stats?.totalUsers || 0 },
  ], [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"></div>
          <p className="text-sm text-black/60 dark:text-white/60">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium text-black dark:text-white mb-2">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-80 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-black dark:text-white">
          Dashboard
        </h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Tickets are automatically analyzed and sorted by AI when created
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statsData.map((stat) => (
          <StatCard key={stat.title} title={stat.title} number={stat.number} />
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-black dark:text-white">
          Recent Tickets
        </h2>

        {recentTickets.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {recentTickets.map((ticket) => (
              <TicketCard key={ticket._id} ticket={ticket} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-2xl">
            <svg className="w-16 h-16 text-black/20 dark:text-white/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-base font-medium text-black dark:text-white mb-1">
              No tickets yet
            </p>
            <p className="text-sm text-black/60 dark:text-white/60">
              Tickets will appear here once users start creating them
            </p>
          </div>
        )}
      </div>

      {/* Analytics Dashboard */}
      <div className="mt-8">
        <AnalyticsDashboard apiUrl={process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'} />
      </div>
    </div>
  );
}

export default Dashboard;
