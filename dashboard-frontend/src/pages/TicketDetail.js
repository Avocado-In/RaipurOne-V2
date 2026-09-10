import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ticketAPI, geminiAPI, imageAPI } from '../api';
import AIAnalysisPanel from '../components/AIAnalysisPanel';
import WorkerAssignmentModal from '../components/WorkerAssignmentModal';

const statusColors = {
  open: 'bg-black text-white dark:bg-white dark:text-black',
  'in-progress': 'bg-black/70 text-white dark:bg-white/70 dark:text-black',
  resolved: 'bg-black/50 text-white dark:bg-white/50 dark:text-black',
  closed: 'bg-black/30 text-white dark:bg-white/30 dark:text-black',
};

const priorityColors = {
  low: 'bg-black/20 dark:bg-white/20',
  medium: 'bg-black/50 dark:bg-white/50',
  high: 'bg-black dark:bg-white',
};

// Mirrors ALLOWED_TRANSITIONS in backend/app/core/domain.py. The page used to offer
// fixed actions regardless of where the complaint was, so "Assign to Worker" and
// "Close Ticket" on a freshly submitted complaint both asked for a jump the API
// rejects with 409.
const ALLOWED_TRANSITIONS = {
  submitted: ['assigned', 'rejected'],
  assigned: ['in_progress', 'submitted', 'rejected'],
  in_progress: ['under_review', 'resolved', 'assigned'],
  under_review: ['resolved', 'in_progress', 'rejected'],
  resolved: ['closed', 'in_progress'],
  closed: [],
  rejected: [],
};

const STATUS_ACTION_LABELS = {
  assigned: 'Mark Assigned',
  in_progress: 'Start Work',
  under_review: 'Send for Review',
  resolved: 'Mark Resolved',
  closed: 'Close Ticket',
  rejected: 'Reject',
  submitted: 'Send Back',
};

const canonicalStatus = (value) => String(value || '').trim().toLowerCase().replace(/[\s-]/g, '_');

const nextStatusesFor = (value) => ALLOWED_TRANSITIONS[canonicalStatus(value)] || [];

function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticketData, setTicketData] = useState(null);
  const [images, setImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [transcriptions, setTranscriptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (id) {
      fetchTicket();
      fetchImages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (ticketData && ticketData.location) {
      parseLocation(ticketData.location);
    }
  }, [ticketData]);

  const parseLocation = (locationString) => {
    try {
      // Try to parse as JSON first
      if (typeof locationString === 'object' && locationString.latitude && locationString.longitude) {
        setLocation({
          lat: parseFloat(locationString.latitude),
          lng: parseFloat(locationString.longitude),
        });
      } else if (typeof locationString === 'string') {
        // Try to extract coordinates from string
        const coordMatch = locationString.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
        if (coordMatch) {
          setLocation({
            lat: parseFloat(coordMatch[1]),
            lng: parseFloat(coordMatch[2]),
          });
        }
      }
    } catch (error) {
      console.error('Error parsing location:', error);
    }
  };

  const normalizeTicket = (payload) => {
    if (!payload) return null;
    if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
      return payload.data;
    }
    return payload;
  };

  const fetchTicket = async () => {
    try {
      setLoading(true);
      const response = await ticketAPI.getTicketById(id);
      const normalizedTicket = normalizeTicket(response?.data);
      setTicketData(normalizedTicket);
    } catch (error) {
      console.error('Error fetching ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchImages = async () => {
    try {
      // Must go through the axios instance: /images/ticket/{id} requires a bearer token
      // and only that instance attaches one. A raw fetch() got 401 for every complaint,
      // so `data.success` was undefined and the gallery silently stayed empty.
      const response = await imageAPI.getTicketImages(id);
      const data = response?.data || {};

      if (data.success && data.images) {
        const normalizedImages = data.images.map((img) => ({
          ...img,
          url: img.url || img.storage_url || img.storageUrl || img.publicUrl || '',
          mimeType: img.mimeType || img.mime_type || 'image/jpeg', // Normalize mimeType field
        }));
        console.log('📸 Fetched media files:', normalizedImages);
        setImages(normalizedImages);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  };

  const handleTranscribe = async () => {
    const selectedImage = images[selectedImageIndex];
    if (!selectedImage?.url) return;

    setTranscribing(true);
    try {
      const result = await geminiAPI.transcribeImage(selectedImage.url);
      setTranscriptions((prev) => ({
        ...prev,
        [selectedImage.url]: result.transcription,
      }));
    } catch (error) {
      console.error('Transcription failed:', error);
      alert('Failed to transcribe image. Please try again.');
    } finally {
      setTranscribing(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setUpdating(true);
      const ticketId = ticketData.ticket_id || ticketData.ticketId || ticketData.id;
      const response = await ticketAPI.updateTicketStatus(ticketId, newStatus);
      setTicketData(response.data.data);
      return true;
    } catch (error) {
      console.error('Error updating status:', error);
      // The API explains an illegal lifecycle jump in `detail`; axios's own message is
      // only "Request failed with status code 409", which tells the operator nothing.
      const reason = error?.response?.data?.detail || error.message || 'Unknown error';
      alert(`Failed to update status: ${reason}`);
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenWorkerModal = () => {
    setShowWorkerModal(true);
  };

  const handleWorkerAssigned = async (worker) => {
    // 'assigned' is the state the lifecycle actually moves to here. Asking for
    // 'in-progress' from 'submitted' is an illegal jump and came back as a 409.
    const success = await handleStatusChange('assigned');
    if (success) {
      setShowWorkerModal(false);
    }
  };

  const handleTransition = async (target) => {
    if (target === 'closed' || target === 'rejected') {
      const label = target === 'closed' ? 'close' : 'reject';
      if (!window.confirm(`Are you sure you want to ${label} this ticket?`)) return;
    }

    const success = await handleStatusChange(target);
    if (success && (target === 'closed' || target === 'rejected')) {
      alert(`Ticket ${target === 'closed' ? 'closed' : 'rejected'} successfully.`);
    }
  };

  const selectedImage = images[selectedImageIndex];
  const currentTranscription = selectedImage?.url ? transcriptions[selectedImage.url] : null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-white/20 flex items-center justify-center z-50 animate-fade-in">
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-scale-in">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"></div>
            <p className="text-sm text-black/60 dark:text-white/60">Loading ticket...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!ticketData) {
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-white/20 flex items-center justify-center z-50 animate-fade-in">
        <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-scale-in">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-black/20 dark:text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium text-black dark:text-white mb-2">Ticket not found</p>
            <p className="text-sm text-black/60 dark:text-white/60 mb-6">This ticket may have been deleted or doesn't exist.</p>
            <button
              onClick={() => navigate('/tickets')}
              className="px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-80 transition-opacity"
            >
              Back to Tickets
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 dark:bg-black/80 z-40 animate-fade-in"
        onClick={() => navigate('/tickets')}
      />

      {/* Card Modal */}
      <div className="fixed inset-0 overflow-y-auto z-50 p-4 md:p-8 pointer-events-none">
        <div className="min-h-full flex items-center justify-center">
          <div className="bg-white dark:bg-black border-2 border-black/20 dark:border-white/20 rounded-3xl shadow-2xl max-w-4xl w-full pointer-events-auto animate-slide-up-fade overflow-hidden">
            
            {/* Close Button */}
            <button
              onClick={() => navigate('/tickets')}
              className="absolute top-6 right-6 z-10 p-2 rounded-full bg-white/90 dark:bg-black/90 border border-black/10 dark:border-white/10 hover:bg-white dark:hover:bg-black transition-all hover:scale-110"
              aria-label="Close ticket"
            >
              <svg className="w-5 h-5 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image/Video Section - Top */}
            {images.length > 0 && (
              <div className="relative bg-black/5 dark:bg-white/5 aspect-video">
                {/* Check if current media is video */}
                {selectedImage?.mimeType?.startsWith('video/') ? (
                  <video
                    src={selectedImage?.url}
                    controls
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      console.error('Video load error:', e);
                    }}
                  >
                    Your browser does not support video playback.
                  </video>
                ) : (
                  <img
                    src={selectedImage?.url}
                    alt={`Attachment ${selectedImageIndex + 1}`}
                    className="w-full h-full object-contain cursor-pointer transition-transform hover:scale-[1.02]"
                    onClick={() => !selectedImage?.mimeType?.startsWith('video/') && setShowLightbox(true)}
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EImage not available%3C/text%3E%3C/svg%3E';
                    }}
                  />
                )}
                
                {/* Image Counter + Navigation */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 dark:bg-white/80 backdrop-blur-sm rounded-full px-4 py-2">
                    <button
                      onClick={() => setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length)}
                      className="p-1 hover:bg-white/20 dark:hover:bg-black/20 rounded-full transition-colors"
                      aria-label="Previous image"
                    >
                      <svg className="w-5 h-5 text-white dark:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm font-medium text-white dark:text-black px-2">
                      {selectedImageIndex + 1} / {images.length}
                    </span>
                    <button
                      onClick={() => setSelectedImageIndex((prev) => (prev + 1) % images.length)}
                      className="p-1 hover:bg-white/20 dark:hover:bg-black/20 rounded-full transition-colors"
                      aria-label="Next image"
                    >
                      <svg className="w-5 h-5 text-white dark:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Media Type Badge */}
                <div className="absolute top-4 right-4 px-3 py-1 bg-black/80 dark:bg-white/80 backdrop-blur-sm text-white dark:text-black rounded-lg text-xs font-medium">
                  {selectedImage?.mimeType?.startsWith('video/') ? '🎥 Video' : '📸 Photo'}
                </div>

                {/* Transcribe Button - Only for images */}
                {!selectedImage?.mimeType?.startsWith('video/') && (
                  <button
                    onClick={handleTranscribe}
                    disabled={transcribing}
                    className="absolute top-4 left-4 px-4 py-2 bg-black/80 dark:bg-white/80 backdrop-blur-sm text-white dark:text-black rounded-lg text-sm font-medium hover:bg-black dark:hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {transcribing ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin"></div>
                        Transcribing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Transcribe
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Content Section */}
            <div className="p-6 md:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Ticket ID - Prominent Display */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl p-4 text-white shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-wider opacity-90 mb-1">Ticket ID</p>
                <h1 className="text-2xl md:text-3xl font-bold break-words">
                  {ticketData.ticket_id || ticketData.ticketId || 'N/A'}
                </h1>
              </div>

              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[ticketData.status] || statusColors.open}`}>
                      {ticketData.status}
                    </span>
                    {ticketData.priority && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-black/10 dark:bg-white/10 text-black dark:text-white flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${priorityColors[ticketData.priority] || priorityColors.low}`}></span>
                        <span className="capitalize">{ticketData.priority}</span>
                      </span>
                    )}
                    {ticketData.category && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-black/10 dark:bg-white/10 text-black dark:text-white capitalize">
                        {ticketData.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-black/60 dark:text-white/60 uppercase tracking-wide">Description</h2>
                <p className="text-base md:text-lg text-black dark:text-white leading-relaxed">
                  {ticketData.description || ticketData.message || ticketData.query || 'No description provided'}
                </p>
              </div>

              {/* Transcription */}
              {currentTranscription && (
                <div className="space-y-3 p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10 animate-fade-in">
                  <h2 className="text-sm font-semibold text-black/60 dark:text-white/60 uppercase tracking-wide flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Transcription
                  </h2>
                  <p className="text-sm text-black/80 dark:text-white/80 leading-relaxed whitespace-pre-wrap">
                    {currentTranscription}
                  </p>
                </div>
              )}

              {/* Location - Simple Display */}
              {location && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-black/60 dark:text-white/60 uppercase tracking-wide flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Location
                  </h2>
                  
                  {/* Location Card with Visual Representation */}
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800 shadow-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-4">
                        {/* Map Pin Icon */}
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        
                        {/* Coordinates */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-black/60 dark:text-white/60 uppercase tracking-wide">GPS Coordinates:</span>
                          </div>
                          <div className="flex items-center gap-3 bg-white dark:bg-black rounded-lg px-4 py-3 border border-black/10 dark:border-white/10">
                            <span className="text-2xl">📍</span>
                            <span className="text-base font-mono font-semibold text-black dark:text-white">
                              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${location.lat}, ${location.lng}`);
                                alert('📋 Coordinates copied to clipboard!');
                              }}
                              className="ml-auto p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                              title="Copy coordinates"
                            >
                              <svg className="w-4 h-4 text-black dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        {/* Address/Location String */}
                        {ticketData.location && typeof ticketData.location === 'string' && !ticketData.location.match(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/) && (
                          <div className="flex items-start gap-3 bg-white dark:bg-black rounded-lg px-4 py-3 border border-black/10 dark:border-white/10">
                            <span className="text-xl">🗺️</span>
                            <p className="text-sm text-black/80 dark:text-white/80 leading-relaxed flex-1">
                              {ticketData.location}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <a
                        href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open in Google Maps
                      </a>
                      <a
                        href={`https://maps.apple.com/?q=${location.lat},${location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        Open in Apple Maps
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata - Reporter & Date */}
              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-black/10 dark:border-white/10">
                <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 border border-black/10 dark:border-white/10">
                  <p className="text-xs text-black/60 dark:text-white/60 mb-2 uppercase tracking-wide font-semibold">👤 Reporter</p>
                  <p className="text-lg font-bold text-black dark:text-white">
                    {ticketData.first_name || ticketData.firstName || ticketData.username || 'Anonymous'}
                  </p>
                </div>
                <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 border border-black/10 dark:border-white/10">
                  <p className="text-xs text-black/60 dark:text-white/60 mb-2 uppercase tracking-wide font-semibold">📅 Date & Time</p>
                  <p className="text-sm font-bold text-black dark:text-white">
                    {new Date(ticketData.created_at || ticketData.createdAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {/* AI Analysis Panel */}
              <div className="pt-4 border-t border-black/10 dark:border-white/10">
                <AIAnalysisPanel ticketId={ticketData.ticket_id || ticketData.ticketId || ticketData.id} />
              </div>
            </div>

            {/* Action Buttons - Bottom */}
            {/* Only the moves the API will actually accept from this status are offered. */}
            <div className="px-6 md:px-8 pb-6 md:pb-8 flex flex-col sm:flex-row flex-wrap gap-3">
              {nextStatusesFor(ticketData.status).includes('assigned') && (
                <button
                  onClick={handleOpenWorkerModal}
                  disabled={updating}
                  className="flex-1 min-w-[12rem] px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02]"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Assign to Worker
                </button>
              )}

              {nextStatusesFor(ticketData.status)
                .filter((target) => target !== 'assigned')
                .map((target) => (
                  <button
                    key={target}
                    onClick={() => handleTransition(target)}
                    disabled={updating}
                    className={`flex-1 min-w-[12rem] px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-[1.02] ${
                      target === 'rejected'
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                        : 'bg-black/10 dark:bg-white/10 text-black dark:text-white border-2 border-black/20 dark:border-white/20 hover:bg-black/20 dark:hover:bg-white/20'
                    }`}
                  >
                    {STATUS_ACTION_LABELS[target] || target}
                  </button>
                ))}

              {nextStatusesFor(ticketData.status).length === 0 && (
                <p className="flex-1 px-6 py-3 text-sm text-black/60 dark:text-white/60 text-center">
                  This ticket is {canonicalStatus(ticketData.status).replace(/_/g, ' ')} and can no longer change status.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for zoomed image/video */}
      {showLightbox && selectedImage && (
        <div
          className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowLightbox(false)}
        >
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close lightbox"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {selectedImage?.mimeType?.startsWith('video/') ? (
            <video
              src={selectedImage.url}
              controls
              className="max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              Your browser does not support video playback.
            </video>
          ) : (
            <img
              src={selectedImage.url}
              alt="Zoomed attachment"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {/* Worker Assignment Modal */}
      {showWorkerModal && ticketData && (
        <WorkerAssignmentModal
          ticket={{ ...ticketData, images: images }}
          onClose={() => setShowWorkerModal(false)}
          onAssign={handleWorkerAssigned}
        />
      )}
    </>
  );
}

export default TicketDetail;

