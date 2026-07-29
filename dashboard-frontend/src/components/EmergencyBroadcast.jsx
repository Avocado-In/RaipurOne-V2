import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tab,
  Tabs
} from '@mui/material';
import {
  Send as SendIcon,
  Image as ImageIcon,
  Map as MapIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  WhatsApp as WhatsAppIcon,
  Telegram as TelegramIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

const EmergencyBroadcast = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [broadcasts, setBroadcasts] = useState([]);
  const [stats, setStats] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    severity: 'high',
    category: 'outbreak',
    affected_areas: '',
    latitude: null,
    longitude: null,
    radius: 5,
    image_url: '',
    send_telegram: true,
    send_whatsapp: true,
    send_push: true,
    target_users: 'all'
  });
  
  const [mapOpen, setMapOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'info' });

  useEffect(() => {
    if (tabValue === 1) fetchBroadcasts();
    if (tabValue === 2) fetchStats();
  }, [tabValue]);

  const fetchBroadcasts = async () => {
    try {
      const response = await axios.get(`${API_URL}/emergency/broadcasts`);
      setBroadcasts(response.data.data);
    } catch (error) {
      showAlert('Failed to fetch broadcasts', 'error');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/emergency/stats`);
      setStats(response.data.data);
    } catch (error) {
      showAlert('Failed to fetch stats', 'error');
    }
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);

    // Upload to Supabase storage
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      // You'll need to create this endpoint
      const response = await axios.post(`${API_URL}/upload/emergency-image`, formData);
      handleChange('image_url', response.data.url);
      showAlert('Image uploaded successfully', 'success');
    } catch (error) {
      showAlert('Image upload failed', 'error');
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.message) {
      showAlert('Title and message are required', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        affected_areas: formData.affected_areas 
          ? formData.affected_areas.split(',').map(a => a.trim())
          : []
      };

      const response = await axios.post(`${API_URL}/emergency/broadcast`, payload);
      showAlert('Broadcast sent successfully!', 'success');
      
      // Reset form
      setFormData({
        title: '',
        message: '',
        severity: 'high',
        category: 'outbreak',
        affected_areas: '',
        latitude: null,
        longitude: null,
        radius: 5,
        image_url: '',
        send_telegram: true,
        send_whatsapp: true,
        send_push: true,
        target_users: 'all'
      });
      setImagePreview(null);
      
    } catch (error) {
      showAlert(error.response?.data?.message || 'Failed to send broadcast', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (message, severity) => {
    setAlert({ show: true, message, severity });
    setTimeout(() => setAlert({ show: false, message: '', severity: 'info' }), 5000);
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'error',
      high: 'warning',
      medium: 'info',
      low: 'default'
    };
    return colors[severity] || 'default';
  };

  const getSeverityEmoji = (severity) => {
    const emojis = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️'
    };
    return emojis[severity] || 'ℹ️';
  };

  const getCategoryEmoji = (category) => {
    const emojis = {
      outbreak: '🦠',
      disease: '💊',
      emergency: '🆘',
      info: '📢'
    };
    return emojis[category] || '📢';
  };

  // Map component for location selection
  const LocationPicker = () => {
    const MapClickHandler = () => {
      useMapEvents({
        click(e) {
          handleChange('latitude', e.latlng.lat);
          handleChange('longitude', e.latlng.lng);
        }
      });
      return null;
    };

    return (
      <Dialog open={mapOpen} onClose={() => setMapOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Select Affected Area
          <IconButton
            onClick={() => setMapOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ height: 400, width: '100%' }}>
            <MapContainer
              center={[21.2514, 81.6296]} // Raipur coordinates
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <MapClickHandler />
              {formData.latitude && formData.longitude && (
                <>
                  <Marker position={[formData.latitude, formData.longitude]} />
                  <Circle
                    center={[formData.latitude, formData.longitude]}
                    radius={formData.radius * 1000}
                    pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }}
                  />
                </>
              )}
            </MapContainer>
          </Box>
          <TextField
            fullWidth
            label="Radius (km)"
            type="number"
            value={formData.radius}
            onChange={(e) => handleChange('radius', parseFloat(e.target.value))}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMapOpen(false)}>Close</Button>
          <Button variant="contained" onClick={() => setMapOpen(false)}>
            Confirm Location
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Compose Tab
  const ComposeTab = () => (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          🚨 Send Emergency Broadcast
        </Typography>

        {alert.show && (
          <Alert severity={alert.severity} sx={{ mb: 2 }} onClose={() => setAlert({ ...alert, show: false })}>
            {alert.message}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Basic Info */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Broadcast Title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g., Dengue Outbreak Alert"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Message"
              value={formData.message}
              onChange={(e) => handleChange('message', e.target.value)}
              placeholder="Describe the situation and provide instructions..."
            />
          </Grid>

          {/* Severity and Category */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Severity Level</InputLabel>
              <Select
                value={formData.severity}
                onChange={(e) => handleChange('severity', e.target.value)}
                label="Severity Level"
              >
                <MenuItem value="critical">🚨 Critical</MenuItem>
                <MenuItem value="high">⚠️ High</MenuItem>
                <MenuItem value="medium">⚡ Medium</MenuItem>
                <MenuItem value="low">ℹ️ Low</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                label="Category"
              >
                <MenuItem value="outbreak">🦠 Disease Outbreak</MenuItem>
                <MenuItem value="disease">💊 Disease Spread</MenuItem>
                <MenuItem value="emergency">🆘 Emergency</MenuItem>
                <MenuItem value="info">📢 Information</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Affected Areas */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Affected Areas (comma separated)"
              value={formData.affected_areas}
              onChange={(e) => handleChange('affected_areas', e.target.value)}
              placeholder="e.g., Civil Lines, Shankar Nagar, Telibandha"
            />
          </Grid>

          {/* Location */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<MapIcon />}
                onClick={() => setMapOpen(true)}
              >
                Select Location on Map
              </Button>
              {formData.latitude && formData.longitude && (
                <Chip
                  label={`📍 ${formData.latitude.toFixed(4)}, ${formData.longitude.toFixed(4)} (${formData.radius}km radius)`}
                  onDelete={() => {
                    handleChange('latitude', null);
                    handleChange('longitude', null);
                  }}
                />
              )}
            </Box>
          </Grid>

          {/* Image Upload */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<ImageIcon />}
              >
                Upload Image
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </Button>
              {imagePreview && (
                <Box>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{ height: 100, borderRadius: 8 }}
                  />
                  <IconButton size="small" onClick={() => {
                    setImagePreview(null);
                    handleChange('image_url', '');
                  }}>
                    <CloseIcon />
                  </IconButton>
                </Box>
              )}
            </Box>
          </Grid>

          {/* Channel Selection */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Delivery Channels
            </Typography>
            <FormGroup row>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.send_telegram}
                    onChange={(e) => handleChange('send_telegram', e.target.checked)}
                    icon={<TelegramIcon />}
                    checkedIcon={<TelegramIcon color="primary" />}
                  />
                }
                label="Telegram"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.send_whatsapp}
                    onChange={(e) => handleChange('send_whatsapp', e.target.checked)}
                    icon={<WhatsAppIcon />}
                    checkedIcon={<WhatsAppIcon color="success" />}
                  />
                }
                label="WhatsApp"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.send_push}
                    onChange={(e) => handleChange('send_push', e.target.checked)}
                    icon={<NotificationsIcon />}
                    checkedIcon={<NotificationsIcon color="secondary" />}
                  />
                }
                label="Push Notifications"
              />
            </FormGroup>
          </Grid>

          {/* Target Users */}
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Target Users</InputLabel>
              <Select
                value={formData.target_users}
                onChange={(e) => handleChange('target_users', e.target.value)}
                label="Target Users"
              >
                <MenuItem value="all">All Users</MenuItem>
                <MenuItem value="area">Users in Affected Area (requires location)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Submit Button */}
          <Grid item xs={12}>
            <Button
              fullWidth
              variant="contained"
              color="error"
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Emergency Broadcast'}
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  // History Tab
  const HistoryTab = () => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5">Broadcast History</Typography>
          <IconButton onClick={fetchBroadcasts}>
            <RefreshIcon />
          </IconButton>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="center">Telegram</TableCell>
                <TableCell align="center">WhatsApp</TableCell>
                <TableCell align="center">Push</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {broadcasts.map((broadcast) => (
                <TableRow key={broadcast.id}>
                  <TableCell>
                    {new Date(broadcast.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{broadcast.title}</TableCell>
                  <TableCell>
                    <Chip
                      label={`${getSeverityEmoji(broadcast.severity)} ${broadcast.severity}`}
                      color={getSeverityColor(broadcast.severity)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {getCategoryEmoji(broadcast.category)} {broadcast.category}
                  </TableCell>
                  <TableCell align="center">
                    {broadcast.sent_telegram ? `✓ ${broadcast.telegram_count}` : '✗'}
                  </TableCell>
                  <TableCell align="center">
                    {broadcast.sent_whatsapp ? `✓ ${broadcast.whatsapp_count}` : '✗'}
                  </TableCell>
                  <TableCell align="center">
                    {broadcast.sent_push ? `✓ ${broadcast.push_count}` : '✗'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={broadcast.status}
                      color={broadcast.status === 'sent' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  // Stats Tab
  const StatsTab = () => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5">Statistics</Typography>
          <IconButton onClick={fetchStats}>
            <RefreshIcon />
          </IconButton>
        </Box>

        {stats && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h4">{stats.total_broadcasts}</Typography>
                  <Typography color="textSecondary">Total Broadcasts</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card variant="outlined" sx={{ bgcolor: '#e3f2fd' }}>
                <CardContent>
                  <Typography variant="h4">
                    <TelegramIcon /> {stats.total_telegram_count}
                  </Typography>
                  <Typography color="textSecondary">Telegram Messages</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card variant="outlined" sx={{ bgcolor: '#e8f5e9' }}>
                <CardContent>
                  <Typography variant="h4">
                    <WhatsAppIcon /> {stats.total_whatsapp_count}
                  </Typography>
                  <Typography color="textSecondary">WhatsApp Messages</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card variant="outlined" sx={{ bgcolor: '#f3e5f5' }}>
                <CardContent>
                  <Typography variant="h4">
                    <NotificationsIcon /> {stats.total_push_count}
                  </Typography>
                  <Typography color="textSecondary">Push Notifications</Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* By Severity */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>By Severity</Typography>
                  {stats.by_severity.map((item) => (
                    <Box key={item.severity} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Chip
                        label={`${getSeverityEmoji(item.severity)} ${item.severity}`}
                        color={getSeverityColor(item.severity)}
                        size="small"
                      />
                      <Typography variant="h6">{item.count}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>

            {/* By Category */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>By Category</Typography>
                  {stats.by_category.map((item) => (
                    <Box key={item.category} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography>
                        {getCategoryEmoji(item.category)} {item.category}
                      </Typography>
                      <Typography variant="h6">{item.count}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab label="📝 Compose" />
        <Tab label="📜 History" />
        <Tab label="📊 Statistics" />
      </Tabs>

      {tabValue === 0 && <ComposeTab />}
      {tabValue === 1 && <HistoryTab />}
      {tabValue === 2 && <StatsTab />}

      <LocationPicker />
    </Box>
  );
};

export default EmergencyBroadcast;
