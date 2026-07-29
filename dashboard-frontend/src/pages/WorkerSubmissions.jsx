import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function WorkerSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPendingSubmissions();
  }, []);

  const fetchPendingSubmissions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/workers/submissions/pending`);
      if (response.data.success) {
        setSubmissions(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedSubmission) return;
    
    setProcessing(true);
    try {
      const response = await axios.patch(
        `${process.env.REACT_APP_API_URL}/workers/tasks/${selectedSubmission.id}/approve`,
        { admin_review_notes: reviewNotes }
      );

      if (response.data.success) {
        alert('✅ Work approved! Video and documents sent to user.');
        setSelectedSubmission(null);
        setReviewNotes('');
        fetchPendingSubmissions();
      }
    } catch (error) {
      console.error('Error approving:', error);
      alert('Failed to approve submission');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedSubmission || !reviewNotes) {
      alert('Please provide rejection reason');
      return;
    }

    setProcessing(true);
    try {
      const response = await axios.patch(
        `${process.env.REACT_APP_API_URL}/workers/tasks/${selectedSubmission.id}/reject`,
        { admin_review_notes: reviewNotes }
      );

      if (response.data.success) {
        alert('❌ Work rejected. Worker will be notified.');
        setSelectedSubmission(null);
        setReviewNotes('');
        fetchPendingSubmissions();
      }
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Failed to reject submission');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-black min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-black dark:text-white">🔍 Worker Submissions Review</h1>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"></div>
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-xl text-black/60 dark:text-white/60">No pending submissions to review</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Submissions List */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-black dark:text-white mb-4">
                Pending Reviews ({submissions.length})
              </h2>
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  onClick={() => setSelectedSubmission(submission)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedSubmission?.id === submission.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-black/10 dark:border-white/10 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-black dark:text-white">{submission.workers?.name}</p>
                      <p className="text-sm text-black/60 dark:text-white/60">
                        {submission.workers?.work_type}
                      </p>
                    </div>
                    <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                      Pending
                    </span>
                  </div>
                  <p className="text-sm text-black/80 dark:text-white/80 line-clamp-2 mb-2">
                    {submission.task_description}
                  </p>
                  <p className="text-xs text-black/50 dark:text-white/50">
                    Submitted: {new Date(submission.submitted_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {/* Review Panel */}
            {selectedSubmission ? (
              <div className="border-2 border-black/10 dark:border-white/10 rounded-lg p-6 sticky top-6">
                <h2 className="text-xl font-bold text-black dark:text-white mb-4">Review Submission</h2>

                {/* Worker Info */}
                <div className="mb-4 p-4 bg-black/5 dark:bg-white/5 rounded-lg">
                  <p className="font-bold text-black dark:text-white">{selectedSubmission.workers?.name}</p>
                  <p className="text-sm text-black/60 dark:text-white/60">{selectedSubmission.task_description}</p>
                </div>

                {/* Video Player */}
                {selectedSubmission.video_url && (
                  <div className="mb-4">
                    <p className="font-semibold text-black dark:text-white mb-2">📹 Completion Video</p>
                    <video
                      src={selectedSubmission.video_url}
                      controls
                      className="w-full rounded-lg border-2 border-black/10 dark:border-white/10"
                      style={{ maxHeight: '400px' }}
                    />
                  </div>
                )}

                {/* Document Link */}
                {selectedSubmission.document_url && (
                  <div className="mb-4">
                    <p className="font-semibold text-black dark:text-white mb-2">📄 Authorization Document</p>
                    <a
                      href={selectedSubmission.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                    >
                      View Document →
                    </a>
                  </div>
                )}

                {/* Submission Notes */}
                {selectedSubmission.submission_notes && (
                  <div className="mb-4 p-4 bg-black/5 dark:bg-white/5 rounded-lg">
                    <p className="font-semibold text-black dark:text-white mb-2">📝 Worker Notes</p>
                    <p className="text-sm text-black/80 dark:text-white/80">{selectedSubmission.submission_notes}</p>
                  </div>
                )}

                {/* Review Notes */}
                <div className="mb-4">
                  <label className="block font-semibold text-black dark:text-white mb-2">
                    Admin Review Notes
                  </label>
                  <textarea
                    className="w-full p-3 border-2 border-black/10 dark:border-white/10 rounded-lg bg-white dark:bg-black text-black dark:text-white"
                    rows="3"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add comments (optional for approval, required for rejection)"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
                  >
                    {processing ? '⏳ Processing...' : '✅ Approve & Send to User'}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={processing || !reviewNotes}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
                  >
                    {processing ? '⏳ Processing...' : '❌ Reject'}
                  </button>
                </div>
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
