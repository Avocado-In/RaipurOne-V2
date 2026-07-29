import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AsiaThemedAQI = ({ city = 'Raipur' }) => {
  const [aqiData, setAqiData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAQI();
    const interval = setInterval(fetchAQI, 300000); // Update every 5 minutes
    return () => clearInterval(interval);
  }, [city]);

  const fetchAQI = async () => {
    try {
      // You can use APIs like WAQI (World Air Quality Index) or OpenWeatherMap
      // For demo, using mock data
      const mockAQI = Math.floor(Math.random() * 300) + 50;
      setAqiData({
        aqi: mockAQI,
        city: city,
        timestamp: new Date().toISOString(),
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching AQI:', error);
      setLoading(false);
    }
  };

  const getAQILevel = (aqi) => {
    if (aqi <= 50) return { level: 'Good', color: '#00E400', emoji: '😊', health: 'Excellent' };
    if (aqi <= 100) return { level: 'Moderate', color: '#FFFF00', emoji: '😐', health: 'Acceptable' };
    if (aqi <= 150) return { level: 'Unhealthy for Sensitive Groups', color: '#FF7E00', emoji: '😷', health: 'Caution' };
    if (aqi <= 200) return { level: 'Unhealthy', color: '#FF0000', emoji: '😨', health: 'Unhealthy' };
    if (aqi <= 300) return { level: 'Very Unhealthy', color: '#8F3F97', emoji: '🤢', health: 'Very Unhealthy' };
    return { level: 'Hazardous', color: '#7E0023', emoji: '☠️', health: 'Hazardous' };
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-orange-100 to-pink-100 dark:from-orange-900/20 dark:to-pink-900/20 rounded-2xl p-6 border-2 border-orange-200 dark:border-orange-800">
        <div className="animate-pulse">
          <div className="h-6 bg-orange-300 dark:bg-orange-700 rounded w-24 mb-4"></div>
          <div className="h-20 bg-orange-300 dark:bg-orange-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!aqiData) {
    return null;
  }

  const aqiLevel = getAQILevel(aqiData.aqi);
  const rotation = (aqiData.aqi / 500) * 180; // 0-180 degrees for semicircle

  return (
    <div 
      className="relative bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-950/30 dark:to-pink-950/30 rounded-3xl p-6 border-2 border-orange-200/50 dark:border-orange-800/50 overflow-hidden shadow-lg"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20% 50%, rgba(255,154,0,0.1) 0%, transparent 50%),
          radial-gradient(circle at 80% 50%, rgba(255,20,147,0.1) 0%, transparent 50%)
        `,
      }}
    >
      {/* Decorative Asian Pattern Background */}
      <div className="absolute inset-0 opacity-5 dark:opacity-10" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0c16.569 0 30 13.431 30 30 0 16.569-13.431 30-30 30C13.431 60 0 46.569 0 30 0 13.431 13.431 0 30 0zm0 10c11.046 0 20 8.954 20 20s-8.954 20-20 20-20-8.954-20-20 8.954-20 20-20z' fill='%23FF6B35' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
      }}></div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-2">
            <span className="text-lg">🌏</span>
            Air Quality Index
          </h3>
          <p className="text-xs text-orange-500/70 dark:text-orange-400/70 mt-1">{aqiData.city}</p>
        </div>
        <button
          onClick={fetchAQI}
          className="p-2 hover:bg-orange-200/50 dark:hover:bg-orange-800/50 rounded-full transition-colors"
          aria-label="Refresh AQI"
        >
          <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Asia-Themed Gauge */}
      <div className="relative z-10 flex flex-col items-center mb-6">
        {/* Semicircle Gauge */}
        <div className="relative w-48 h-24">
          <svg className="w-full h-full" viewBox="0 0 200 100">
            {/* Background arc */}
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="url(#gradient-bg)"
              strokeWidth="20"
              strokeLinecap="round"
            />
            
            {/* Gradient definitions */}
            <defs>
              <linearGradient id="gradient-bg" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: '#00E400', stopOpacity: 0.3 }} />
                <stop offset="20%" style={{ stopColor: '#FFFF00', stopOpacity: 0.3 }} />
                <stop offset="40%" style={{ stopColor: '#FF7E00', stopOpacity: 0.3 }} />
                <stop offset="60%" style={{ stopColor: '#FF0000', stopOpacity: 0.3 }} />
                <stop offset="80%" style={{ stopColor: '#8F3F97', stopOpacity: 0.3 }} />
                <stop offset="100%" style={{ stopColor: '#7E0023', stopOpacity: 0.3 }} />
              </linearGradient>
              
              <linearGradient id="gradient-active" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: '#00E400' }} />
                <stop offset="20%" style={{ stopColor: '#FFFF00' }} />
                <stop offset="40%" style={{ stopColor: '#FF7E00' }} />
                <stop offset="60%" style={{ stopColor: '#FF0000' }} />
                <stop offset="80%" style={{ stopColor: '#8F3F97' }} />
                <stop offset="100%" style={{ stopColor: '#7E0023' }} />
              </linearGradient>
            </defs>
            
            {/* Active arc showing current AQI */}
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="url(#gradient-active)"
              strokeWidth="20"
              strokeLinecap="round"
              strokeDasharray={`${(rotation / 180) * 251.2} 251.2`}
              className="transition-all duration-1000"
            />
            
            {/* Needle */}
            <g transform={`rotate(${rotation - 90} 100 90)`}>
              <line
                x1="100"
                y1="90"
                x2="100"
                y2="30"
                stroke={aqiLevel.color}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="100" cy="90" r="6" fill={aqiLevel.color} stroke="white" strokeWidth="2" />
            </g>
          </svg>
        </div>

        {/* AQI Number - Asia Style */}
        <div className="relative -mt-4 mb-4">
          <div 
            className="relative px-8 py-4 rounded-2xl shadow-2xl border-4"
            style={{
              backgroundColor: aqiLevel.color,
              borderColor: 'rgba(255,255,255,0.3)',
              boxShadow: `0 8px 32px ${aqiLevel.color}40`,
            }}
          >
            <div className="text-center">
              <div className="text-5xl font-bold text-white mb-1" style={{
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}>
                {aqiData.aqi}
              </div>
              <div className="text-xs text-white/90 font-medium uppercase tracking-widest">
                {aqiLevel.emoji} {aqiLevel.level}
              </div>
            </div>
            
            {/* Decorative corner elements */}
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-4 border-l-4 border-white/50 rounded-tl"></div>
            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-4 border-r-4 border-white/50 rounded-tr"></div>
            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-4 border-l-4 border-white/50 rounded-bl"></div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-4 border-r-4 border-white/50 rounded-br"></div>
          </div>
        </div>

        {/* Health Impact */}
        <div className="text-center px-4 py-2 bg-white/70 dark:bg-black/30 backdrop-blur-sm rounded-full border border-orange-200 dark:border-orange-800">
          <p className="text-xs font-semibold text-orange-800 dark:text-orange-200">
            Health Impact: <span className="font-bold">{aqiLevel.health}</span>
          </p>
        </div>
      </div>

      {/* Scale Reference */}
      <div className="relative z-10 grid grid-cols-3 gap-2 text-xs">
        {[
          { range: '0-50', label: 'Good', color: '#00E400' },
          { range: '51-100', label: 'Moderate', color: '#FFFF00' },
          { range: '101-150', label: 'USG', color: '#FF7E00' },
          { range: '151-200', label: 'Unhealthy', color: '#FF0000' },
          { range: '201-300', label: 'Very Unhealthy', color: '#8F3F97' },
          { range: '300+', label: 'Hazardous', color: '#7E0023' },
        ].map((item) => (
          <div
            key={item.range}
            className="flex items-center gap-2 px-2 py-1 bg-white/60 dark:bg-black/20 backdrop-blur-sm rounded-lg border border-orange-100 dark:border-orange-900"
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            ></div>
            <div>
              <div className="font-semibold text-orange-900 dark:text-orange-100">{item.range}</div>
              <div className="text-orange-600 dark:text-orange-400 text-[10px]">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Last Updated */}
      <div className="relative z-10 mt-4 text-center">
        <p className="text-xs text-orange-500/70 dark:text-orange-400/70">
          Updated: {new Date(aqiData.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
};

export default AsiaThemedAQI;
