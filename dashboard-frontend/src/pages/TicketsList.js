import React, { useState, useEffect } from 'react';
import { ticketAPI } from '../api';
import TicketCard from '../components/TicketCard';
import TicketViewer from '../components/TicketViewer';

function TicketsList() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: '',
  });

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const normalizeTickets = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.data && Array.isArray(payload.data)) return payload.data;
    if (payload.items && Array.isArray(payload.items)) return payload.items;
    return [];
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await ticketAPI.getAllTickets(filters);
      setTickets(normalizeTickets(response?.data));
      setError(null);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTicketClick = (ticket) => {
    setSelectedTicket(ticket);
    setIsViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setIsViewerOpen(false);
    setSelectedTicket(null);
  };

  const handleTicketUpdate = (updatedTicket) => {
    setTickets((prevTickets) =>
      prevTickets.map((ticket) =>
        ticket._id === updatedTicket._id ? updatedTicket : ticket
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-black dark:text-white">
          Support Tickets
        </h1>

        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="status" className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1.5">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full px-4 py-2.5 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-colors"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label htmlFor="category" className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1.5">
              Category
            </label>
            <select
              id="category"
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="w-full px-4 py-2.5 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-colors"
            >
              <option value="">All Categories</option>
              <option value="support">Support</option>
              <option value="billing">Billing</option>
              <option value="technical">Technical</option>
              <option value="general">General</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label htmlFor="priority" className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1.5">
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              value={filters.priority}
              onChange={handleFilterChange}
              className="w-full px-4 py-2.5 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-colors"
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-black/60 dark:text-white/60">
            {loading ? 'Loading...' : `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}`}
          </h2>
          <button
            onClick={fetchTickets}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh tickets"
          >
            <svg 
              className={`w-4 h-4 text-black dark:text-white ${loading ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm font-medium text-black dark:text-white">Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"></div>
              <p className="text-sm text-black/60 dark:text-white/60">Loading tickets...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium text-black dark:text-white">{error}</p>
            </div>
          </div>
        ) : tickets.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {tickets.map((ticket) => (
              <div key={ticket._id} onClick={() => handleTicketClick(ticket)} className="cursor-pointer">
                <TicketCard ticket={ticket} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-2xl">
            <svg className="w-16 h-16 text-black/20 dark:text-white/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-base font-medium text-black dark:text-white mb-1">
              No tickets found
            </p>
            <p className="text-sm text-black/60 dark:text-white/60">
              Try adjusting your filters
            </p>
          </div>
        )}
      </div>

      {/* Ticket Viewer Modal */}
      {isViewerOpen && selectedTicket && (
        <TicketViewer
          ticket={selectedTicket}
          onClose={handleCloseViewer}
          onUpdate={handleTicketUpdate}
        />
      )}
    </div>
  );
}

export default TicketsList;
