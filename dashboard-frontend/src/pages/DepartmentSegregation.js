import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ticketAPI } from '../api';

// Department configurations with unique SVG icons and colors
const departmentConfig = {
  General: {
    color: 'from-slate-500 to-zinc-500',
    bgLight: 'bg-slate-50 dark:bg-slate-950/20',
    border: 'border-slate-200 dark:border-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 16v-4M12 8h.01" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  Plumbing: {
    color: 'from-blue-500 to-cyan-500',
    bgLight: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-600 dark:text-blue-400',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  Electrical: {
    color: 'from-yellow-500 to-orange-500',
    bgLight: 'bg-yellow-50 dark:bg-yellow-950/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-600 dark:text-yellow-400',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  Roadways: {
    color: 'from-gray-600 to-gray-700',
    bgLight: 'bg-gray-50 dark:bg-gray-950/20',
    border: 'border-gray-300 dark:border-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  "Cleaning and Sanitation": {
    color: 'from-green-500 to-emerald-500',
    bgLight: 'bg-green-50 dark:bg-green-950/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-600 dark:text-green-400',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="10" y1="11" x2="10" y2="17" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="14" y1="11" x2="14" y2="17" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  "Public Health": {
    color: 'from-red-500 to-pink-500',
    bgLight: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-600 dark:text-red-400',
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
};

function DepartmentSegregation() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [departmentStats, setDepartmentStats] = useState({});

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await ticketAPI.getAllTickets();
      const allTickets = response.data.data || [];
      
      // Group tickets by department
      const stats = {};
      allTickets.forEach(ticket => {
        const dept = ticket.department || 'General';
        if (!stats[dept]) {
          stats[dept] = {
            total: 0,
            open: 0,
            inProgress: 0,
            resolved: 0,
            tickets: []
          };
        }
        stats[dept].total++;
        stats[dept].tickets.push(ticket);
        
        if (ticket.status === 'open') stats[dept].open++;
        else if (ticket.status === 'in-progress') stats[dept].inProgress++;
        else if (ticket.status === 'resolved' || ticket.status === 'closed') stats[dept].resolved++;
      });
      
      setDepartmentStats(stats);
      setTickets(allTickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketClick = (ticketId) => {
    navigate(`/tickets/${ticketId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"></div>
          <p className="text-sm text-black/60 dark:text-white/60">Loading departments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
            Department Segregation
          </h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            AI-classified complaints organized by departments
          </p>
        </div>
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl shadow-lg">
          <p className="text-xs uppercase tracking-wide opacity-90">Total Complaints</p>
          <p className="text-3xl font-bold">{tickets.length}</p>
        </div>
      </div>

      {/* Department Grid */}
      {!selectedDepartment ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Object.entries(departmentStats).map(([dept, stats]) => {
            const config = departmentConfig[dept] || departmentConfig.General;
            
            return (
              <div
                key={dept}
                onClick={() => setSelectedDepartment(dept)}
                className={`${config.bgLight} ${config.border} border-2 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 group`}
              >
                {/* Icon */}
                <div className={`bg-gradient-to-br ${config.color} text-white rounded-xl p-4 w-20 h-20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  {config.icon}
                </div>

                {/* Department Name */}
                <h3 className="text-xl font-bold text-black dark:text-white mb-2">
                  {dept}
                </h3>

                {/* Stats */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-black/60 dark:text-white/60">Total</span>
                    <span className="text-lg font-bold text-black dark:text-white">{stats.total}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                    <div className="text-center">
                      <p className="text-xs text-black/60 dark:text-white/60 mb-1">Open</p>
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">{stats.open}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-black/60 dark:text-white/60 mb-1">Progress</p>
                      <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{stats.inProgress}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-black/60 dark:text-white/60 mb-1">Done</p>
                      <p className="text-sm font-bold text-green-600 dark:text-green-400">{stats.resolved}</p>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="mt-4 flex items-center justify-end">
                  <svg className="w-5 h-5 text-black/40 dark:text-white/40 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Department Detail View */
        <div className="space-y-6">
          {/* Back Button & Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedDepartment(null)}
              className="p-3 rounded-xl bg-white dark:bg-black border-2 border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 transition-colors"
            >
              <svg className="w-6 h-6 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className={`flex-1 ${departmentConfig[selectedDepartment]?.bgLight} ${departmentConfig[selectedDepartment]?.border} border-2 rounded-2xl p-6 flex items-center gap-6`}>
              <div className={`bg-gradient-to-br ${departmentConfig[selectedDepartment]?.color} text-white rounded-xl p-4 w-20 h-20 flex items-center justify-center`}>
                {departmentConfig[selectedDepartment]?.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-black dark:text-white mb-1">
                  {selectedDepartment} Department
                </h2>
                <p className="text-sm text-black/60 dark:text-white/60">
                  {departmentStats[selectedDepartment]?.total} complaints
                </p>
              </div>
            </div>
          </div>

          {/* Tickets List */}
          <div className="grid grid-cols-1 gap-4">
            {departmentStats[selectedDepartment]?.tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => handleTicketClick(ticket.ticket_id || ticket.ticketId)}
                className="bg-white dark:bg-black border-2 border-black/10 dark:border-white/10 rounded-xl p-6 cursor-pointer hover:shadow-lg hover:border-black/20 dark:hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-black dark:text-white">
                      {ticket.ticket_id || ticket.ticketId}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      ticket.status === 'open' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                      ticket.status === 'in-progress' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {ticket.status}
                    </span>
                    {ticket.priority && (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        ticket.priority === 'urgent' ? 'bg-red-600 text-white' :
                        ticket.priority === 'high' ? 'bg-orange-500 text-white' :
                        ticket.priority === 'medium' ? 'bg-yellow-500 text-black' :
                        'bg-green-500 text-white'
                      }`}>
                        {ticket.priority}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-base text-black dark:text-white mb-4 line-clamp-2">
                  {ticket.query}
                </p>

                <div className="flex items-center gap-4 text-xs text-black/60 dark:text-white/60">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{ticket.first_name || ticket.username || 'Anonymous'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>
                      {new Date(ticket.created_at || ticket.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DepartmentSegregation;
