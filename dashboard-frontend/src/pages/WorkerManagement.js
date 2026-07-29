import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

const WorkerManagement = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorker, setNewWorker] = useState({
    worker_id: '',
    name: '',
    phone: '',
    email: '',
    departments: []
  });

  const departmentOptions = [
    'WATER', 'ROAD', 'GARBAGE', 'ELECTRICITY', 'PARKS', 'HEALTH', 'SAFETY', 'GENERAL'
  ];

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/workers`);
      setWorkers(response.data.data || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/workers`, newWorker);
      setShowAddWorker(false);
      setNewWorker({ worker_id: '', name: '', phone: '', email: '', departments: [] });
      fetchWorkers();
    } catch (error) {
      console.error('Error adding worker:', error);
      alert('Failed to add worker');
    }
  };

  const toggleDepartment = (dept) => {
    setNewWorker(prev => ({
      ...prev,
      departments: prev.departments.includes(dept)
        ? prev.departments.filter(d => d !== dept)
        : [...prev.departments, dept]
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'bg-blue-500';
      case 'busy':
        return 'bg-red-500';
      case 'offline':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getDepartmentColor = (dept) => {
    const colors = {
      WATER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      ROAD: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200',
      GARBAGE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      ELECTRICITY: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      PARKS: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      HEALTH: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
      SAFETY: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      GENERAL: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    };
    return colors[dept] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-black dark:text-white">
            Worker Management
          </h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">
            Manage workers and their assignments
          </p>
        </div>
        <button
          onClick={() => setShowAddWorker(true)}
          className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-80 transition-opacity font-medium"
        >
          + Add Worker
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl p-6">
          <div className="text-sm text-black/60 dark:text-white/60 mb-1">Total Workers</div>
          <div className="text-3xl font-bold text-black dark:text-white">{workers.length}</div>
        </div>
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl p-6">
          <div className="text-sm text-black/60 dark:text-white/60 mb-1">Available</div>
          <div className="text-3xl font-bold text-blue-500">
            {workers.filter(w => w.status === 'available').length}
          </div>
        </div>
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl p-6">
          <div className="text-sm text-black/60 dark:text-white/60 mb-1">Busy</div>
          <div className="text-3xl font-bold text-red-500">
            {workers.filter(w => w.status === 'busy').length}
          </div>
        </div>
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl p-6">
          <div className="text-sm text-black/60 dark:text-white/60 mb-1">Offline</div>
          <div className="text-3xl font-bold text-gray-500 dark:text-gray-400">
            {workers.filter(w => w.status === 'offline').length}
          </div>
        </div>
      </div>

      {/* Workers Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-12 h-12 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((worker) => (
            <div
              key={worker.worker_id}
              className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-xl p-6 hover:shadow-lg transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center">
                    <span className="text-xl font-bold text-black dark:text-white">
                      {worker.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-black dark:text-white">{worker.name}</h3>
                    <p className="text-xs text-black/60 dark:text-white/60">{worker.worker_id}</p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${getStatusColor(worker.status)}`}></div>
              </div>

              {/* Contact */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-black/80 dark:text-white/80">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {worker.phone}
                </div>
                {worker.email && (
                  <div className="flex items-center gap-2 text-sm text-black/80 dark:text-white/80">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {worker.email}
                  </div>
                )}
              </div>

              {/* Departments */}
              <div className="mb-4">
                <div className="text-xs text-black/60 dark:text-white/60 mb-2">Departments</div>
                <div className="flex flex-wrap gap-1">
                  {worker.departments?.map((dept) => (
                    <span
                      key={dept}
                      className={`px-2 py-1 rounded text-xs font-medium ${getDepartmentColor(dept)}`}
                    >
                      {dept}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between pt-4 border-t border-black/10 dark:border-white/10">
                <div className="text-center">
                  <div className="text-xl font-bold text-black dark:text-white">{worker.active_tasks || 0}</div>
                  <div className="text-xs text-black/60 dark:text-white/60">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-black dark:text-white">{worker.completed_tasks || 0}</div>
                  <div className="text-xs text-black/60 dark:text-white/60">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-black dark:text-white">
                    {worker.rating?.toFixed(1) || '0.0'}
                  </div>
                  <div className="text-xs text-black/60 dark:text-white/60">Rating</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Worker Modal */}
      {showAddWorker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-black max-w-md w-full rounded-2xl shadow-2xl p-6">
            <h2 className="text-2xl font-bold text-black dark:text-white mb-6">Add New Worker</h2>
            
            <form onSubmit={handleAddWorker} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  Worker ID
                </label>
                <input
                  type="text"
                  required
                  value={newWorker.worker_id}
                  onChange={(e) => setNewWorker({ ...newWorker, worker_id: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  placeholder="WRK-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={newWorker.name}
                  onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  required
                  value={newWorker.phone}
                  onChange={(e) => setNewWorker({ ...newWorker, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  placeholder="+91-9876543210"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={newWorker.email}
                  onChange={(e) => setNewWorker({ ...newWorker, email: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  placeholder="worker@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  Departments
                </label>
                <div className="flex flex-wrap gap-2">
                  {departmentOptions.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => toggleDepartment(dept)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        newWorker.departments.includes(dept)
                          ? 'bg-black text-white dark:bg-white dark:text-black'
                          : 'bg-black/5 text-black dark:bg-white/5 dark:text-white'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddWorker(false)}
                  className="flex-1 px-4 py-2 border border-black/10 dark:border-white/10 rounded-lg text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-80 transition-opacity"
                >
                  Add Worker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerManagement;
