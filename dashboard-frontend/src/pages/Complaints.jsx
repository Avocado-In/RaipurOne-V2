import React, { useState } from 'react';
import { complaintAPI } from '../api';

function Complaints() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const payload = {
        title,
        description,
        category: category || null,
      };
      const response = await complaintAPI.createComplaint(payload);
      setStatus(response.data);
      setTitle('');
      setDescription('');
      setCategory('');
    } catch (err) {
      console.error('Failed to create complaint:', err);
      setError('Unable to submit complaint. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-black dark:text-white">Submit Complaint</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Enter the complaint details below. The backend will classify category automatically using the model.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-3xl p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-black dark:text-white">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary of the issue"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-black dark:text-white">Category (optional)</span>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Leave blank to infer from the description"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-black dark:text-white">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Describe the complaint in detail"
            className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            required
          />
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {status && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-100">
            Complaint submitted successfully.
            <div className="mt-2">
              <strong>Category:</strong> {status.category}
            </div>
            <div>
              <strong>Priority:</strong> {status.priority}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-black text-white hover:bg-black/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : 'Submit Complaint'}
        </button>
      </form>
    </div>
  );
}

export default Complaints;
