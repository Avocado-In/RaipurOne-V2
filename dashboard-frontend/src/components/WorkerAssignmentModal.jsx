import React, { useState, useEffect, useCallback } from 'react';
import { workerAPI } from '../api';

const WorkerAssignmentModal = ({ ticket, onClose, onAssign }) => {
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [assignmentDetails, setAssignmentDetails] = useState({
    deadline: '',
    message: '',
    forwardImages: true,
    forwardLocation: true,
  });

  const fetchAvailableWorkers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await workerAPI.getAvailable(ticket.department, ticket.category);
      
      if (response.data.success) {
        setWorkers(response.data.workers || []);
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoading(false);
    }
  }, [ticket.department, ticket.category]);

  useEffect(() => {
    fetchAvailableWorkers();
  }, [fetchAvailableWorkers]);

  const handleWorkerSelect = (worker) => {
    setSelectedWorker(worker);
    setShowConfirmation(true);
  };

  const handleAssign = async () => {
    if (!selectedWorker) return;

    try {
      const assignmentData = {
        ticketId: ticket.ticketId,
        workerId: selectedWorker.worker_id,
        deadline: assignmentDetails.deadline,
        message: assignmentDetails.message || ticket.query,
        forwardImages: assignmentDetails.forwardImages,
        forwardLocation: assignmentDetails.forwardLocation,
        ticketDetails: {
          query: ticket.query,
          location: ticket.location,
          images: ticket.images || [],
          priority: ticket.priority,
          department: ticket.department,
        },
      };

      const response = await workerAPI.assign(assignmentData);

      if (response.data.success) {
        alert('Worker assigned successfully!');
        onAssign(selectedWorker);
        onClose();
      }
    } catch (error) {
      console.error('Error assigning worker:', error);
      alert('Failed to assign worker. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center animate-fade-in">
        <div className="bg-white dark:bg-black border-2 border-black/20 dark:border-white/20 rounded-3xl p-8 max-w-sm w-full mx-4">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"></div>
            <p className="text-sm text-black/60 dark:text-white/60">Loading available workers...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-black border-2 border-black/20 dark:border-white/20 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-black dark:text-white">
            {showConfirmation ? 'Confirm Assignment' : 'Assign Worker'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          {!showConfirmation ? (
            <div className="p-6">
              {/* Ticket Info */}
              <div className="mb-6 p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
                <h3 className="text-sm font-semibold text-black/60 dark:text-white/60 uppercase tracking-wide mb-2">
                  Ticket Details
                </h3>
                <p className="text-base text-black dark:text-white mb-2">{ticket.query}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-3 py-1 bg-blue-500 text-white rounded-full font-medium">
                    {ticket.department}
                  </span>
                  {ticket.priority && (
                    <span className="px-3 py-1 bg-red-500 text-white rounded-full font-medium">
                      {ticket.priority} Priority
                    </span>
                  )}
                </div>
              </div>

              {/* Workers Grid */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-black dark:text-white">
                  Available Workers ({workers.length})
                </h3>
                <button
                  onClick={fetchAvailableWorkers}
                  className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors group"
                  title="Refresh workers"
                >
                  <svg className="w-5 h-5 text-black dark:text-white group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {workers.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-black/20 dark:text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <p className="text-black/60 dark:text-white/60">No workers available at the moment</p>
                  <p className="text-sm text-black/40 dark:text-white/40 mt-2">Try again later or check worker attendance</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {workers.map((worker) => (
                    <div
                      key={worker.worker_id}
                      onClick={() => handleWorkerSelect(worker)}
                      className="bg-white dark:bg-black border-2 border-black/10 dark:border-white/10 rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:border-blue-500 hover:shadow-lg hover:scale-[1.02]"
                    >
                      {/* Worker Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {worker.name?.charAt(0).toUpperCase() || 'W'}
                          </div>
                          <div>
                            <h4 className="font-semibold text-black dark:text-white">{worker.name}</h4>
                            <p className="text-xs text-black/60 dark:text-white/60">{worker.work_type}</p>
                          </div>
                        </div>
                        {worker.is_active ? (
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-700 dark:text-green-400 rounded-full">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-medium">Available</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-700 dark:text-gray-400 rounded-full">
                            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                            <span className="text-xs font-medium">Busy</span>
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center bg-blue-500/10 rounded-lg py-2">
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {worker.active_tasks || 0}
                          </p>
                          <p className="text-xs text-black/60 dark:text-white/60">Active Tasks</p>
                        </div>
                        <div className="text-center bg-green-500/10 rounded-lg py-2">
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {worker.completed_tasks || 0}
                          </p>
                          <p className="text-xs text-black/60 dark:text-white/60">Completed</p>
                        </div>
                        <div className="text-center bg-yellow-500/10 rounded-lg py-2">
                          <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                            {worker.rating ? worker.rating.toFixed(1) : 'N/A'}
                          </p>
                          <p className="text-xs text-black/60 dark:text-white/60">⭐ Rating</p>
                        </div>
                      </div>

                      {/* Contact */}
                      {worker.phone_number && (
                        <div className="flex items-center gap-2 text-xs text-black/60 dark:text-white/60">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span>{worker.phone_number}</span>
                        </div>
                      )}

                      {/* Select Button */}
                      <button className="w-full mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Select Worker
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              {/* Selected Worker Info */}
              <div className="mb-6 p-5 bg-blue-500/10 border-2 border-blue-500/30 rounded-2xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                    {selectedWorker?.name?.charAt(0).toUpperCase() || 'W'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-black dark:text-white">{selectedWorker?.name}</h3>
                    <p className="text-sm text-black/60 dark:text-white/60">{selectedWorker?.work_type}</p>
                    <p className="text-xs text-black/60 dark:text-white/60">{selectedWorker?.phone_number}</p>
                  </div>
                </div>
              </div>

              {/* Assignment Options */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                    Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={assignmentDetails.deadline}
                    onChange={(e) => setAssignmentDetails({ ...assignmentDetails, deadline: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-black border-2 border-black/10 dark:border-white/10 rounded-xl text-black dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                    Additional Message (Optional)
                  </label>
                  <textarea
                    value={assignmentDetails.message}
                    onChange={(e) => setAssignmentDetails({ ...assignmentDetails, message: e.target.value })}
                    placeholder="Add instructions for the worker..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white dark:bg-black border-2 border-black/10 dark:border-white/10 rounded-xl text-black dark:text-white focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignmentDetails.forwardImages}
                      onChange={(e) => setAssignmentDetails({ ...assignmentDetails, forwardImages: e.target.checked })}
                      className="w-5 h-5 rounded border-2 border-black/20 dark:border-white/20 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-black dark:text-white">Forward images to worker</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignmentDetails.forwardLocation}
                      onChange={(e) => setAssignmentDetails({ ...assignmentDetails, forwardLocation: e.target.checked })}
                      className="w-5 h-5 rounded border-2 border-black/20 dark:border-white/20 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-black dark:text-white">Forward location details</span>
                  </label>
                </div>
              </div>

              {/* Back Button */}
              <button
                onClick={() => setShowConfirmation(false)}
                className="w-full mt-4 px-4 py-2 text-black dark:text-white border-2 border-black/20 dark:border-white/20 rounded-xl font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                ← Back to Workers
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {showConfirmation && (
          <div className="p-6 border-t border-black/10 dark:border-white/10 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-black/10 dark:bg-white/10 text-black dark:text-white border-2 border-black/20 dark:border-white/20 rounded-xl font-semibold hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Confirm Assignment
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerAssignmentModal;
