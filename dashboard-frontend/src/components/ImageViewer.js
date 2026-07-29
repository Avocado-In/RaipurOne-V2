import React, { useState, useEffect } from 'react';
import { imageAPI } from '../api';
import './ImageViewer.css';

function ImageViewer({ ticketId }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    fetchImages();
  }, [ticketId]);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await imageAPI.getTicketImages(ticketId);
      console.log('Images API response:', response.data);
      setImages(response.data.images || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching images:', err);
      setError('Failed to load images');
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const openLightbox = (index) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleKeyDown = (e) => {
    if (!lightboxOpen) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') nextImage();
    if (e.key === 'ArrowLeft') prevImage();
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, images.length]);

  if (loading) {
    return (
      <div className="images-section">
        <h3 className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Images
        </h3>
        <div className="loading-images">Loading images...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="images-section">
        <h3 className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Images
        </h3>
        <div className="error-images">{error}</div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="images-section">
        <h3 className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Images
        </h3>
        <div className="no-images">No images attached to this ticket</div>
      </div>
    );
  }

  return (
    <>
      <div className="images-section">
        <h3 className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Images ({images.length})
        </h3>
        <div className="image-grid">
            {images.map((image, index) => {
              const src = image.url || image.storage_url || image.storageUrl;
              return (
                <div
                  key={image.id}
                  className="image-thumbnail"
                  onClick={() => openLightbox(index)}
                >
                  <img
                    src={src}
                    alt={`Ticket image ${index + 1}`}
                    loading="lazy"
                  />
                  <div className="image-overlay">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                    </svg>
                    <span>View</span>
                  </div>
                </div>
              );
            })}
          </div>
      </div>

      {lightboxOpen && (
        <div className="lightbox" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox} aria-label="Close image viewer">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {images.length > 1 && (
              <>
                <button className="lightbox-prev" onClick={prevImage} aria-label="Previous image">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button className="lightbox-next" onClick={nextImage} aria-label="Next image">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            <img
              src={images[currentImageIndex].url || images[currentImageIndex].storage_url}
              alt={`Ticket image ${currentImageIndex + 1}`}
              className="lightbox-image"
            />

            <div className="lightbox-info">
              <span className="image-counter">
                {currentImageIndex + 1} / {images.length}
              </span>
              <span className="image-date">
                {new Date(images[currentImageIndex].created_at).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ImageViewer;
