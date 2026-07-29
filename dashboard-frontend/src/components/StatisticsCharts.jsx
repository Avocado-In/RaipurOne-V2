import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { ticketAPI } from '../api';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const StatisticsCharts = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await ticketAPI.getAllTickets({});
      setTickets(response.data.data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const getStatusData = () => {
    const statusCounts = {
      open: tickets.filter(t => t.status === 'open').length,
      'in-progress': tickets.filter(t => t.status === 'in-progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length,
    };

    return {
      labels: ['Open', 'In Progress', 'Resolved', 'Closed'],
      datasets: [{
        data: [statusCounts.open, statusCounts['in-progress'], statusCounts.resolved, statusCounts.closed],
        backgroundColor: ['#3B82F6', '#F59E0B', '#10B981', '#6B7280'],
        borderColor: ['#2563EB', '#D97706', '#059669', '#4B5563'],
        borderWidth: 2,
      }],
    };
  };

  const getDepartmentData = () => {
    const departments = {};
    tickets.forEach(ticket => {
      const dept = ticket.department || 'Other';
      departments[dept] = (departments[dept] || 0) + 1;
    });

    return {
      labels: Object.keys(departments),
      datasets: [{
        label: 'Tickets by Department',
        data: Object.values(departments),
        backgroundColor: [
          '#3B82F6',
          '#10B981',
          '#F59E0B',
          '#EF4444',
          '#8B5CF6',
          '#EC4899',
          '#14B8A6',
          '#F97316',
        ],
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
      }],
    };
  };

  const getPriorityData = () => {
    const priorities = {
      urgent: tickets.filter(t => t.priority === 'urgent').length,
      high: tickets.filter(t => t.priority === 'high').length,
      medium: tickets.filter(t => t.priority === 'medium').length,
      low: tickets.filter(t => t.priority === 'low').length,
    };

    return {
      labels: ['Urgent', 'High', 'Medium', 'Low'],
      datasets: [{
        data: [priorities.urgent, priorities.high, priorities.medium, priorities.low],
        backgroundColor: ['#DC2626', '#F97316', '#F59E0B', '#10B981'],
        borderColor: ['#991B1B', '#C2410C', '#D97706', '#059669'],
        borderWidth: 2,
      }],
    };
  };

  const getTrendData = () => {
    // Get last 7 days
    const last7Days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      last7Days.push(date.toISOString().split('T')[0]);
    }

    const dailyCounts = last7Days.map(date => {
      return tickets.filter(t => {
        const ticketDate = new Date(t.createdAt).toISOString().split('T')[0];
        return ticketDate === date;
      }).length;
    });

    return {
      labels: last7Days.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [{
        label: 'Tickets Created',
        data: dailyCounts,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#3B82F6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      }],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          padding: 15,
          font: {
            size: 12,
            family: "'Inter', sans-serif",
          },
          color: '#000',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        cornerRadius: 8,
        titleFont: {
          size: 14,
          weight: 'bold',
        },
        bodyFont: {
          size: 13,
        },
      },
    },
  };

  const pieOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      legend: {
        ...chartOptions.plugins.legend,
        position: 'right',
      },
    },
  };

  const barOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          color: '#6B7280',
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        ticks: {
          color: '#6B7280',
        },
        grid: {
          display: false,
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"></div>
          <p className="text-sm text-black/60 dark:text-white/60">Loading statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-black dark:text-white">Statistics Dashboard</h2>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">Visual analytics of ticket data</p>
        </div>
        <button
          onClick={fetchTickets}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
        >
          <svg className="w-4 h-4 text-black dark:text-white group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm font-medium text-black dark:text-white">Refresh</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl p-6">
          <div className="text-sm text-black/60 dark:text-white/60 mb-1">Total Tickets</div>
          <div className="text-3xl font-bold text-black dark:text-white">{tickets.length}</div>
        </div>
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl p-6">
          <div className="text-sm text-black/60 dark:text-white/60 mb-1">Open</div>
          <div className="text-3xl font-bold text-blue-500">{tickets.filter(t => t.status === 'open').length}</div>
        </div>
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl p-6">
          <div className="text-sm text-black/60 dark:text-white/60 mb-1">In Progress</div>
          <div className="text-3xl font-bold text-yellow-500">{tickets.filter(t => t.status === 'in-progress').length}</div>
        </div>
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl p-6">
          <div className="text-sm text-black/60 dark:text-white/60 mb-1">Resolved</div>
          <div className="text-3xl font-bold text-green-500">{tickets.filter(t => t.status === 'resolved').length}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Status Pie Chart */}
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Ticket Status Distribution</h3>
          <div style={{ height: '300px' }}>
            <Pie data={getStatusData()} options={pieOptions} />
          </div>
        </div>

        {/* Priority Distribution Pie Chart */}
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Priority Distribution</h3>
          <div style={{ height: '300px' }}>
            <Pie data={getPriorityData()} options={pieOptions} />
          </div>
        </div>

        {/* Department Bar Chart */}
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Tickets by Department</h3>
          <div style={{ height: '300px' }}>
            <Bar data={getDepartmentData()} options={barOptions} />
          </div>
        </div>

        {/* Trend Line Chart */}
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">7-Day Ticket Trend</h3>
          <div style={{ height: '300px' }}>
            <Line data={getTrendData()} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Insights Section */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 border border-blue-500/20 dark:border-blue-500/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-black dark:text-white mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Key Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/50 dark:bg-black/30 rounded-lg p-4">
            <p className="text-sm text-black/60 dark:text-white/60 mb-1">Resolution Rate</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {tickets.length > 0 ? Math.round((tickets.filter(t => t.status === 'resolved').length / tickets.length) * 100) : 0}%
            </p>
          </div>
          <div className="bg-white/50 dark:bg-black/30 rounded-lg p-4">
            <p className="text-sm text-black/60 dark:text-white/60 mb-1">Pending Tickets</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {tickets.filter(t => t.status === 'open' || t.status === 'in-progress').length}
            </p>
          </div>
          <div className="bg-white/50 dark:bg-black/30 rounded-lg p-4">
            <p className="text-sm text-black/60 dark:text-white/60 mb-1">Most Active Dept</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {tickets.length > 0 ? Object.entries(
                tickets.reduce((acc, t) => {
                  const dept = t.department || 'Other';
                  acc[dept] = (acc[dept] || 0) + 1;
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A' : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsCharts;
