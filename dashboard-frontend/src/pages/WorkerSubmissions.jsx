import React, { useCallback, useEffect, useState } from 'react';
import { submissionAPI } from '../api';

// Review screen for work submitted from the field worker app (/worker on the API host).
//
// A submission is only ever created with a photo of the finished job and the worker's GPS
// position, so this screen is where that evidence is checked. Approving moves the
// complaint to resolved and the citizen who filed it gets a Telegram message; rejecting
// sends it back to the worker with a reason.

const metres = (value) => (value == null ? null : `${Math.round(value)}m`);

const when = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

const errorText = (error) =>
  error?.response?.data?.detail || error?.message || 'Something went wrong';

export default function WorkerSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [banner, setBanner] = useState('');

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await submissionAPI.getPending();
      setSubmissions(response.data?.data || []);
    } catch (error) {
      setSubmissions([]);
      setLoadError(errorText(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const review = async (approve) => {
    if (!selected) return;
    const notes = reviewNotes.trim();
    if (!approve && !notes) {
      setActionError('Tell the worker why the work was rejected.');
      return;
    }

    setProcessing(true);
    setActionError('');
    try {
      if (approve) {
        await submissionAPI.approve(selected.id, notes);
        setBanner(
          selected.has_telegram
            ? 'Approved. The complaint is resolved and the citizen has been messaged on Telegram.'
            : 'Approved and the complaint is resolved. This complaint has no Telegram channel, so no message was sent.'
        );
      } else {
        await submissionAPI.reject(selected.id, notes);
        setBanner('Sent back to the worker for rework.');
      }
      setSelected(null);
      setReviewNotes('');
      await fetchPending();
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      setProcessing(false);
    }
  };

  const select = (submission) => {
    setSelected(submission);
    setReviewNotes('');
    setActionError('');
  };

  return (
    <div className="p-6 bg-white dark:bg-black min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <h1 className="text-3xl font-bold text-black dark:text-white">🔍 Worker Submissions</h1>
          <button
            onClick={fetchPending}
            className="px-4 py-2 border-2 border-black/10 dark:border-white/10 rounded-lg text-black dark:text-white hover:border-blue-400 transition"
          >
            Refresh
          </button>
        </div>

        {banner && (
          <div className="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-2 border-green-500 text-green-800 dark:text-green-200">
            {banner}
          </div>
        )}

        {loadError && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-500 text-red-800 dark:text-red-200">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : submissions.length === 0 && !loadError ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-xl text-black/60 dark:text-white/60">No work waiting for review</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Queue */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-black dark:text-white mb-4">
                Pending Reviews ({submissions.length})
              </h2>
              {submissions.map((submission) => (
                <button
                  key={submission.id}
                  onClick={() => select(submission)}
                  className={`w-full text-left p-4 border-2 rounded-lg transition-all ${
                    selected?.id === submission.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-black/10 dark:border-white/10 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-bold text-black dark:text-white truncate">
                        {submission.complaint_title || submission.complaint_id}
                      </p>
                      <p className="text-sm text-black/60 dark:text-white/60">
                        {submission.worker_name} · {submission.complaint_category}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs px-2 py-1 rounded ${
                        submission.location_verified
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      }`}
                    >
                      {submission.location_verified
                        ? `📍 ${metres(submission.distance_m)} away`
                        : '📍 unverified'}
                    </span>
                  </div>
                  <p className="text-xs text-black/50 dark:text-white/50">
                    Submitted: {when(submission.submitted_at)}
                  </p>
                </button>
              ))}
            </div>

            {/* Review panel */}
            {selected ? (
              <div className="border-2 border-black/10 dark:border-white/10 rounded-lg p-6 lg:sticky lg:top-6 h-fit">
                <h2 className="text-xl font-bold text-black dark:text-white mb-4">Review Submission</h2>

                <div className="mb-4 p-4 bg-black/5 dark:bg-white/5 rounded-lg">
                  <p className="font-bold text-black dark:text-white">
                    {selected.complaint_title || selected.complaint_id}
                  </p>
                  <p className="text-sm text-black/60 dark:text-white/60">
                    Worker: {selected.worker_name} · Citizen: {selected.citizen_name || 'Citizen'}
                  </p>
                </div>

                {/* Proof: photo */}
                <div className="mb-4">
                  <p className="font-semibold text-black dark:text-white mb-2">📷 Completed work</p>
                  {selected.photo_url ? (
                    <a href={selected.photo_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={selected.photo_url}
                        alt="Work completed by the field worker"
                        className="w-full rounded-lg border-2 border-black/10 dark:border-white/10"
                        style={{ maxHeight: '420px', objectFit: 'contain' }}
                      />
                    </a>
                  ) : (
                    <p className="text-sm text-black/50 dark:text-white/50">
                      The photo could not be loaded from storage.
                    </p>
                  )}
                </div>

                {/* Proof: location */}
                <div className="mb-4 p-4 bg-black/5 dark:bg-white/5 rounded-lg">
                  <p className="font-semibold text-black dark:text-white mb-2">📍 Where the worker stood</p>
                  <p className="text-sm text-black/80 dark:text-white/80">
                    {Number(selected.lat).toFixed(5)}, {Number(selected.lng).toFixed(5)}
                    {selected.accuracy_m != null && ` (±${metres(selected.accuracy_m)})`}
                  </p>
                  <p className="text-sm mt-1 text-black/60 dark:text-white/60">
                    {selected.location_verified
                      ? `✅ ${metres(selected.distance_m)} from the reported location.`
                      : 'This complaint has no coordinates, so the distance could not be checked. The position above is the only proof of presence.'}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-sm text-blue-500 hover:underline"
                  >
                    Open in Maps →
                  </a>
                </div>

                {selected.notes && (
                  <div className="mb-4 p-4 bg-black/5 dark:bg-white/5 rounded-lg">
                    <p className="font-semibold text-black dark:text-white mb-2">📝 Worker notes</p>
                    <p className="text-sm text-black/80 dark:text-white/80">{selected.notes}</p>
                  </div>
                )}

                <div className="mb-4">
                  <label
                    htmlFor="review-notes"
                    className="block font-semibold text-black dark:text-white mb-2"
                  >
                    Review notes
                  </label>
                  <textarea
                    id="review-notes"
                    className="w-full p-3 border-2 border-black/10 dark:border-white/10 rounded-lg bg-white dark:bg-black text-black dark:text-white"
                    rows="3"
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    placeholder="Optional on approval, required when rejecting"
                  />
                </div>

                {actionError && (
                  <p className="mb-3 text-sm text-red-600 dark:text-red-400">{actionError}</p>
                )}

                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => review(true)}
                    disabled={processing}
                    className="flex-1 min-w-[160px] bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
                  >
                    {processing ? '⏳ Processing...' : '✅ Approve & resolve'}
                  </button>
                  <button
                    onClick={() => review(false)}
                    disabled={processing}
                    className="flex-1 min-w-[160px] bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
                  >
                    {processing ? '⏳ Processing...' : '❌ Send back'}
                  </button>
                </div>
                <p className="mt-3 text-xs text-black/50 dark:text-white/50">
                  {selected.has_telegram
                    ? 'Approving tells the citizen on Telegram that their complaint is resolved.'
                    : 'This complaint was not filed on Telegram, so approving sends no citizen message.'}
                </p>
              </div>
            ) : (
              <div className="border-2 border-dashed border-black/10 dark:border-white/10 rounded-lg p-12 flex items-center justify-center">
                <p className="text-black/40 dark:text-white/40 text-center">
                  Select a submission to review
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
