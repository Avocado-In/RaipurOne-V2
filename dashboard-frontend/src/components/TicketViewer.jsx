import React, { useState, useEffect } from 'react';
import { geminiAPI, imageAPI } from '../api';

/**
 * TicketViewer - Production-ready ticket display with image transcription
 * 
 * Features:
 * - Responsive layout (stacked mobile, side-by-side desktop)
 * - Image preview with zoom capability
 * - AI-powered transcription via Gemini Vision API
 * - Progressive loading states
 * - Inline SVG icons only (no emojis)
 * - Accessible keyboard navigation
 */
function TicketViewer({ ticket }) {
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState(null);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (ticket?.ticketId) {
      fetchImages();
    }
  }, [ticket?.ticketId]);

  const fetchImages = async () => {
    try {
      setImagesLoading(true);
      const response = await imageAPI.getTicketImages(ticket.ticketId);
      const fetchedImages = (response.data.images || []).map((img) => ({
        // Normalize returned image shape - backend may use "url" or "storage_url"
        id: img.id,
        fileName: img.fileName || img.file_name || img.fileName,
        url: img.url || img.storage_url || img.storageUrl || img.storage_url,
        createdAt: img.createdAt || img.created_at || img.createdAt,
      }));
      setImages(fetchedImages);

      // Auto-select first image if available
      if (fetchedImages.length > 0) {
        setSelectedImage(fetchedImages[0]);
      }
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setImagesLoading(false);
    }
  };

  const handleTranscribe = async () => {
    if (!selectedImage?.url) return;

    setIsTranscribing(true);
    setTranscribeError(null);

    try {
      const response = await geminiAPI.transcribeImage(selectedImage.url);
      const data = response.data.data;
      
      setTranscription(data.transcription || data.description || 'No text detected');
    } catch (error) {
      // Surface backend errors if available to help debugging
      const backendMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message;
      setTranscribeError(backendMessage || 'Unable to transcribe image. Please try again.');
      console.error('Transcription failed:', backendMessage || error.message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleDownload = () => {
    if (selectedImage?.url) {
      const link = document.createElement('a');
      link.href = selectedImage.url;
      link.download = selectedImage.fileName || 'ticket-image.jpg';
      link.click();
    }
  };

  if (!ticket) {
    return (
      <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-2xl p-6">
        <p className="text-sm text-black/60 dark:text-white/60">No ticket selected</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden">
      {/* Header with metadata */}
      <div className="p-6 border-b border-black/10 dark:border-white/10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-black dark:text-white mb-1">
              {ticket.ticketId}
            </h2>
            <p className="text-sm text-black/60 dark:text-white/60">
              {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            ticket.status === 'open' ? 'bg-black text-white dark:bg-white dark:text-black' :
            ticket.status === 'resolved' ? 'bg-black/50 text-white dark:bg-white/50 dark:text-black' :
            'bg-black/30 text-white dark:bg-white/30 dark:text-black'
          }`}>
            {ticket.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-black/60 dark:text-white/60 mb-1">User</p>
            <p className="text-black dark:text-white font-medium">
              {ticket.firstName || ticket.username || 'Anonymous'}
            </p>
          </div>
          <div>
            <p className="text-black/60 dark:text-white/60 mb-1">Category</p>
            <p className="text-black dark:text-white font-medium capitalize">
              {ticket.category || 'General'}
            </p>
          </div>
        </div>
      </div>

      {/* Main content: Image + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Left: Image preview */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-black dark:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Image Attachment</span>
          </div>

          {imagesLoading ? (
            <div className="aspect-video bg-black/5 dark:bg-white/5 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-black/60 dark:text-white/60">Loading images...</p>
              </div>
            </div>
          ) : images.length === 0 ? (
            <div className="aspect-video bg-black/5 dark:bg-white/5 rounded-lg flex items-center justify-center">
              <p className="text-sm text-black/60 dark:text-white/60">No images attached</p>
            </div>
          ) : (
            <>
              <div 
                className="relative aspect-video bg-black/5 dark:bg-white/5 rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => setIsZoomed(!isZoomed)}
                role="button"
                tabIndex={0}
                aria-label="Click to zoom image"
                onKeyDown={(e) => e.key === 'Enter' && setIsZoomed(!isZoomed)}
              >
                <img
                  src={selectedImage?.url}
                  alt="Ticket attachment"
                  className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-10 h-10 text-white dark:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Image thumbnails if multiple */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {images.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedImage(img)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                        selectedImage?.id === img.id
                          ? 'border-black dark:border-white'
                          : 'border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30'
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={`Thumbnail ${img.id}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleTranscribe}
                  disabled={isTranscribing || !selectedImage}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Transcribe image using AI"
                >
                  {isTranscribing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin"></div>
                      <span>Transcribing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Transcribe Image</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownload}
                  disabled={!selectedImage}
                  className="px-4 py-2.5 bg-white dark:bg-black border border-black/10 dark:border-white/10 text-black dark:text-white rounded-lg font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Download image"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right: Details and transcription */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-black dark:text-white mb-2">Query</h3>
            <p className="text-sm text-black/80 dark:text-white/80 leading-relaxed">
              {ticket.query || 'No description provided'}
            </p>
          </div>

          {transcription && (
            <div 
              className="p-4 bg-black/5 dark:bg-white/5 rounded-lg"
              role="region"
              aria-live="polite"
              aria-label="Image transcription result"
            >
              <h3 className="text-sm font-semibold text-black dark:text-white mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Transcription</span>
              </h3>
              <p className="text-sm text-black/70 dark:text-white/70 leading-relaxed whitespace-pre-wrap">
                {transcription}
              </p>
            </div>
          )}

          {transcribeError && (
            <div className="p-4 bg-black/5 dark:bg-white/5 rounded-lg border-l-4 border-black dark:border-white">
              <p className="text-sm text-black/70 dark:text-white/70">{transcribeError}</p>
            </div>
          )}

          {ticket.priority && (
            <div>
              <h3 className="text-sm font-semibold text-black dark:text-white mb-2">Priority</h3>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                ticket.priority === 'urgent' || ticket.priority === 'high'
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : ticket.priority === 'medium'
                  ? 'bg-black/50 text-white dark:bg-white/50 dark:text-black'
                  : 'bg-black/20 text-black dark:bg-white/20 dark:text-white'
              }`}>
                <span className="w-2 h-2 rounded-full bg-current"></span>
                <span className="capitalize">{ticket.priority}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Zoomed lightbox */}
      {isZoomed && selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 dark:bg-white/90 flex items-center justify-center p-4 motion-reduce:transition-none"
          onClick={() => setIsZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image zoom view"
        >
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white dark:bg-black rounded-full text-black dark:text-white hover:opacity-80 transition-opacity"
            aria-label="Close zoom view"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={selectedImage.url}
            alt="Zoomed ticket attachment"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Development debug panel - visible only in development mode */}
      {process.env.NODE_ENV === 'development' && (
        <details className="p-4 mt-4 text-xs text-black/60 dark:text-white/60 bg-black/5 dark:bg-white/5 rounded-lg">
          <summary className="cursor-pointer font-medium">Debug: ticket & images</summary>
          <pre className="mt-2 overflow-auto">{JSON.stringify({ ticket, images, selectedImage }, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

export default TicketViewer;
