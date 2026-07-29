import React, { useState, useEffect, useCallback } from 'react';

const TicketViewer = ({ ticket, onClose, onAssignWorker, onRespond, onUpdate }) => {
  const [response, setResponse] = useState('');
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAssignWorker, setShowAssignWorker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ticket?.images) {
      setImages(ticket.images);
    }
  }, [ticket]);

  const handleRespond = async () => {
    if (!response.trim()) return;
    
    setLoading(true);
    await onRespond(ticket.ticketId, response);
    setResponse('');
    setLoading(false);
  };

  const location = ticket?.location || { lat: 21.2514, lng: 81.6296 }; // Default: Raipur

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-black max-w-6xl w-full max-h-[90vh] overflow-auto rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-black text-white p-6 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div>
              <h2 className="text-xl font-bold">{ticket?.ticketId}</h2>
              <p className="text-sm text-white/60">Ticket Details</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Department Badge */}
            {ticket?.department && (
              <span className={`px-4 py-2 rounded-lg text-sm font-bold uppercase ${
                ticket.department === 'WATER' ? 'bg-blue-500' :
                ticket.department === 'ROAD' ? 'bg-gray-600' :
                ticket.department === 'GARBAGE' ? 'bg-green-600' :
                ticket.department === 'ELECTRICITY' ? 'bg-yellow-600 text-black' :
                'bg-gray-500'
              }`}>
                {ticket.department}
              </span>
            )}
            
            {/* Priority Badge */}
            {ticket?.priority && (
              <span className={`px-4 py-2 rounded-lg text-sm font-bold uppercase ${
                ticket.priority === 'urgent' ? 'bg-red-600' :
                ticket.priority === 'high' ? 'bg-orange-500' :
                ticket.priority === 'medium' ? 'bg-yellow-500 text-black' :
                'bg-green-500'
              }`}>
                ðŸ”¥ {ticket.priority}
              </span>
            )}
            
            {/* Status */}
            <span className={`px-4 py-2 rounded-lg text-sm font-medium ${
              ticket?.status === 'open' ? 'bg-white text-black' :
              ticket?.status === 'in-progress' ? 'bg-white/70 text-black' :
              'bg-white/50 text-black'
            }`}>
              {ticket?.status}
            </span>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
          {/* Left Column: Query & Images */}
          <div className="space-y-6">
            {/* Query Text */}
            <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-xl">
              <h3 className="text-sm font-bold text-black/60 dark:text-white/60 uppercase mb-3">
                Complaint Description
              </h3>
              <p className="text-lg text-black dark:text-white leading-relaxed">
                {ticket?.description || ticket?.message || ticket?.query || 'No description provided'}
              </p>
            </div>

            {/* Images Gallery */}
            {images.length > 0 && (
              <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-xl">
                <h3 className="text-sm font-bold text-black/60 dark:text-white/60 uppercase mb-3">
                  Attached Images ({images.length})
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-video bg-black/10 rounded-lg overflow-hidden cursor-pointer hover:ring-2 ring-black dark:ring-white transition-all"
                      onClick={() => setSelectedImage(img)}
                    >
                      <img
                        src={img.url || img}
                        alt={`Evidence ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Info */}
            <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-xl">
              <h3 className="text-sm font-bold text-black/60 dark:text-white/60 uppercase mb-3">
                Reported By
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-black dark:bg-white rounded-full flex items-center justify-center">
                  <span className="text-white dark:text-black font-bold text-lg">
                    {ticket?.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-black dark:text-white">
                    {ticket?.username || 'Anonymous'}
                  </p>
                  <p className="text-sm text-black/60 dark:text-white/60">
                    {ticket?.userId || 'No contact'}
                  </p>
                </div>
              </div>
              <div className="mt-4 text-sm text-black/60 dark:text-white/60">
                <p>ðŸ“… {new Date(ticket?.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Map & Actions */}
          <div className="space-y-6">
            {/* Location Display - Beautiful Card */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-bold text-black/60 dark:text-white/60 uppercase mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Location
              </h3>
              
              {/* Map Pin Icon */}
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg mb-4">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              
              {/* Coordinates */}
              <div className="flex items-center gap-3 bg-white dark:bg-black rounded-lg px-4 py-3 border border-black/10 dark:border-white/10 mb-3">
                <span className="text-xl">ðŸ“</span>
                <span className="text-sm font-mono font-semibold text-black dark:text-white flex-1">
                  {location.lat}, {location.lng}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${location.lat}, ${location.lng}`);
                    alert('ðŸ“‹ Coordinates copied!');
                  }}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                  title="Copy coordinates"
                >
                  <svg className="w-4 h-4 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              
              {/* Map Links */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg text-xs font-semibold transition-all shadow hover:shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Google Maps
                </a>
                <a
                  href={`https://maps.apple.com/?q=${location.lat},${location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg text-xs font-semibold transition-all shadow hover:shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Apple Maps
                </a>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => setShowAssignWorker(true)}
                className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold text-lg hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Assign to Worker
              </button>

              <button
                onClick={() => window.open(`https://wa.me/${ticket?.userId}?text=Regarding ${ticket?.ticketId}`, '_blank')}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Contact on WhatsApp
              </button>
            </div>

            {/* Response Section */}
            <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-xl">
              <h3 className="text-sm font-bold text-black/60 dark:text-white/60 uppercase mb-3">
                Send Response
              </h3>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Type your response to the user..."
                className="w-full bg-white dark:bg-black border-2 border-black/10 dark:border-white/10 rounded-lg p-4 text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                rows={4}
              />
              <button
                onClick={handleRespond}
                disabled={loading || !response.trim()}
                className="mt-3 w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Response'}
              </button>
            </div>

            {/* Previous Responses */}
            {ticket?.responses && ticket.responses.length > 0 && (
              <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-xl">
                <h3 className="text-sm font-bold text-black/60 dark:text-white/60 uppercase mb-3">
                  Response History ({ticket.responses.length})
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {ticket.responses.map((resp, idx) => (
                    <div key={idx} className="bg-white dark:bg-black p-4 rounded-lg border border-black/10 dark:border-white/10">
                      <p className="text-sm text-black dark:text-white">{resp.message}</p>
                      <p className="text-xs text-black/60 dark:text-white/60 mt-2">
                        {new Date(resp.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Image Lightbox */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <img
              src={selectedImage.url || selectedImage}
              alt="Full view"
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-white text-black p-3 rounded-full hover:bg-gray-200"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Worker Assignment Modal */}
        {showAssignWorker && (
          <WorkerAssignmentModal
            ticket={ticket}
            onClose={() => setShowAssignWorker(false)}
            onAssign={onAssignWorker}
          />
        )}
      </div>
    </div>
  );
};

// Worker Assignment Modal Component
const WorkerAssignmentModal = ({ ticket, onClose, onAssign }) => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [assignmentDetails, setAssignmentDetails] = useState({
    message: '',
    deadline: '',
    includeImages: true,
    includeLocation: true,
  });

  const fetchAvailableWorkers = useCallback(async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://127.0.0.1:8000';
      const response = await fetch(`${apiUrl}/api/workers/available?department=${ticket.department || ''}`);
      const data = await response.json();
      setWorkers(data.data || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoading(false);
    }
  }, [ticket.department]);

  useEffect(() => {
    fetchAvailableWorkers();
  }, [fetchAvailableWorkers]);

  const handleAssign = async () => {
    if (!selectedWorker) return;
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://127.0.0.1:8000';
      const response = await fetch(`${apiUrl}/api/workers/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: selectedWorker.worker_id,
          ticketId: ticket.ticket_id || ticket.ticketId,
          message: assignmentDetails.message,
          deadline: assignmentDetails.deadline,
        }),
      });
      
      if (response.ok) {
        if (onAssign) {
          await onAssign({
            workerId: selectedWorker.worker_id,
            ticketId: ticket.ticket_id || ticket.ticketId,
            ...assignmentDetails,
          });
        }
        onClose();
      }
    } catch (error) {
      console.error('Error assigning worker:', error);
      alert('Failed to assign worker');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-black max-w-4xl w-full max-h-[80vh] overflow-auto rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-black text-white p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Assign Worker</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Available Workers */}
          <div>
            <h3 className="text-sm font-bold text-black/60 dark:text-white/60 uppercase mb-4">
              Available Workers {loading && '(Loading...)'}
            </h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin mx-auto"></div>
              </div>
            ) : workers.length === 0 ? (
              <div className="text-center py-8 text-black/60 dark:text-white/60">
                No available workers found
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workers.map((worker) => (
                  <div
                    key={worker.worker_id}
                    onClick={() => setSelectedWorker(worker)}
                    className={`p-6 rounded-xl cursor-pointer transition-all ${
                      selectedWorker?.worker_id === worker.worker_id
                        ? 'bg-black dark:bg-white text-white dark:text-black ring-4 ring-black/20 dark:ring-white/20'
                        : 'bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        selectedWorker?.worker_id === worker.worker_id ? 'bg-white dark:bg-black' : 'bg-black dark:bg-white'
                      }`}>
                        <span className={`font-bold ${
                          selectedWorker?.worker_id === worker.worker_id ? 'text-black dark:text-white' : 'text-white dark:text-black'
                        }`}>
                          {worker.name.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold">{worker.name}</p>
                        <p className="text-sm opacity-60">{worker.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="opacity-60">Active tasks: {worker.active_tasks || 0}</span>
                      <span className="px-3 py-1 bg-blue-500 text-white rounded-full text-xs font-bold">
                        AVAILABLE
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assignment Details */}
          {selectedWorker && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-black/60 dark:text-white/60 uppercase">
                Assignment Details
              </h3>
              
              <textarea
                value={assignmentDetails.message}
                onChange={(e) => setAssignmentDetails({ ...assignmentDetails, message: e.target.value })}
                placeholder="Message to worker (optional)"
                className="w-full bg-gray-50 dark:bg-white/5 border-2 border-black/10 dark:border-white/10 rounded-lg p-4 text-black dark:text-white"
                rows={3}
              />

              <input
                type="datetime-local"
                value={assignmentDetails.deadline}
                onChange={(e) => setAssignmentDetails({ ...assignmentDetails, deadline: e.target.value })}
                className="w-full bg-gray-50 dark:bg-white/5 border-2 border-black/10 dark:border-white/10 rounded-lg p-4 text-black dark:text-white"
              />

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignmentDetails.includeImages}
                    onChange={(e) => setAssignmentDetails({ ...assignmentDetails, includeImages: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <span className="text-black dark:text-white">Include images</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignmentDetails.includeLocation}
                    onChange={(e) => setAssignmentDetails({ ...assignmentDetails, includeLocation: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <span className="text-black dark:text-white">Include location</span>
                </label>
              </div>

              <button
                onClick={handleAssign}
                className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold text-lg hover:opacity-80 transition-opacity"
              >
                Assign to {selectedWorker.name}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketViewer;

