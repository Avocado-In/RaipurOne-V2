import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom markers by status/priority
const createCustomIcon = (status, priority) => {
  let color = '#3B82F6'; // blue default

  if (status === 'closed') color = '#6B7280'; // gray
  else if (status === 'resolved') color = '#10B981'; // green
  else if (priority === 'urgent') color = '#DC2626'; // red
  else if (priority === 'high') color = '#F97316'; // orange
  else if (status === 'in-progress') color = '#F59E0B'; // amber

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <div style="
          transform: rotate(45deg);
          color: white;
          text-align: center;
          font-size: 16px;
          margin-top: 3px;
        ">📍</div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Component to fit bounds
const FitBounds = ({ markers }) => {
  const map = useMap();

  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [markers, map]);

  return null;
};

const DashboardMapView = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, open, in-progress, urgent
  const navigate = useNavigate();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/tickets`);

      if (response.data.success) {
        const ticketsWithLocation = response.data.data
          .filter((ticket) => ticket.location)
          .map((ticket) => {
            const location = parseLocation(ticket.location);
            if (location) {
              return { ...ticket, ...location };
            }
            return null;
          })
          .filter(Boolean);

        setTickets(ticketsWithLocation);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseLocation = (locationString) => {
    try {
      if (typeof locationString === 'object' && locationString.latitude && locationString.longitude) {
        return {
          lat: parseFloat(locationString.latitude),
          lng: parseFloat(locationString.longitude),
        };
      } else if (typeof locationString === 'string') {
        const coordMatch = locationString.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
        if (coordMatch) {
          return {
            lat: parseFloat(coordMatch[1]),
            lng: parseFloat(coordMatch[2]),
          };
        }
      }
    } catch (error) {
      console.error('Error parsing location:', error);
    }
    return null;
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (filter === 'all') return true;
    if (filter === 'urgent') return ticket.priority === 'urgent';
    return ticket.status === filter;
  });

  const defaultCenter = [21.2514, 81.6296]; // Raipur coordinates

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-black border-2 border-black/10 dark:border-white/10 rounded-3xl overflow-hidden shadow-lg">
      {/* Header with Filters */}
      <div className="p-6 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-black dark:text-white flex items-center gap-2">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Complaint Map
          </h2>
          <span className="text-sm text-black/60 dark:text-white/60">
            {filteredTickets.length} location{filteredTickets.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all', label: 'All', color: 'bg-black dark:bg-white text-white dark:text-black' },
            { value: 'open', label: 'Open', color: 'bg-blue-500 text-white' },
            { value: 'in-progress', label: 'In Progress', color: 'bg-amber-500 text-white' },
            { value: 'urgent', label: 'Urgent', color: 'bg-red-500 text-white' },
          ].map((filterOption) => (
            <button
              key={filterOption.value}
              onClick={() => setFilter(filterOption.value)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                filter === filterOption.value
                  ? filterOption.color
                  : 'bg-black/5 dark:bg-white/5 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10'
              }`}
            >
              {filterOption.label}
            </button>
          ))}
          <button
            onClick={fetchTickets}
            className="ml-auto px-4 py-2 rounded-lg font-medium text-sm bg-black/5 dark:bg-white/5 text-black dark:text-white hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="h-[600px] relative">
        {filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg className="w-20 h-20 text-black/20 dark:text-white/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-lg text-black/60 dark:text-white/60">No tickets with location data</p>
            <p className="text-sm text-black/40 dark:text-white/40 mt-1">
              Tickets will appear here when they have location information
            </p>
          </div>
        ) : (
          <MapContainer
            center={defaultCenter}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FitBounds markers={filteredTickets} />

            {filteredTickets.map((ticket) => (
              <Marker
                key={ticket._id || ticket.ticketId}
                position={[ticket.lat, ticket.lng]}
                icon={createCustomIcon(ticket.status, ticket.priority)}
              >
                <Popup>
                  <div className="min-w-[250px] p-2">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-mono text-xs font-semibold text-black">
                        {ticket.ticketId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                          ticket.status === 'open'
                            ? 'bg-blue-500'
                            : ticket.status === 'in-progress'
                            ? 'bg-amber-500'
                            : ticket.status === 'resolved'
                            ? 'bg-green-500'
                            : 'bg-gray-500'
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </div>

                    {ticket.priority && (
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-semibold mb-2 ${
                          ticket.priority === 'urgent'
                            ? 'bg-red-100 text-red-700'
                            : ticket.priority === 'high'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-100 text-black'
                        }`}
                      >
                        {ticket.priority} priority
                      </span>
                    )}

                    <p className="text-sm text-black mb-3 line-clamp-2">
                      {ticket.query}
                    </p>

                    {ticket.department && (
                      <div className="flex items-center gap-1 mb-2 text-xs text-black/70">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span>{ticket.department}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 mb-3 text-xs text-black/70">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>

                    <button
                      onClick={() => navigate(`/tickets/${ticket._id}`)}
                      className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      View Details →
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-semibold text-black dark:text-white">Legend:</span>
          {[
            { color: '#DC2626', label: 'Urgent' },
            { color: '#F97316', label: 'High Priority' },
            { color: '#F59E0B', label: 'In Progress' },
            { color: '#3B82F6', label: 'Open' },
            { color: '#10B981', label: 'Resolved' },
            { color: '#6B7280', label: 'Closed' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                style={{ backgroundColor: item.color }}
                className="w-4 h-4 rounded-full border-2 border-white shadow"
              ></div>
              <span className="text-black/70 dark:text-white/70">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardMapView;
