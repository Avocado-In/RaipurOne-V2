import React, { useState } from 'react';
import { useAIAnalysis } from '../hooks/useAIAnalysis';
import { useDebounced } from '../hooks/useDebounced';
import { geminiAPI } from '../api';

/**
 * AIAnalysisPanel - Production-ready AI analysis with debounced inputs
 * 
 * Features:
 * - Debounced query input (600ms delay to prevent excessive API calls)
 * - Progressive loading states (idle → queued → in-progress → success/error)
 * - Expandable details section
 * - Request cancellation support
 * - Accessible live regions for status updates
 */
const AIAnalysisPanel = ({ ticketId, ticketQuery, onAnalysisComplete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customQuery, setCustomQuery] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  
  const { state, result, error, analyzeSingle, isLoading } = useAIAnalysis();
  const debouncedQuery = useDebounced(customQuery, 600);

  const handleDepartmentAnalysis = async () => {
    if (!ticketId) return;
    
    try {
      const analysisResult = await analyzeSingle(ticketId);
      if (onAnalysisComplete) {
        onAnalysisComplete(analysisResult);
      }
    } catch (err) {
      console.error('Department analysis error:', err);
    }
  };

  const handleCustomAnalysis = async () => {
    if (!debouncedQuery.trim()) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await geminiAPI.analyzeTicket(ticketId, debouncedQuery);
      setAnalysisResult(response.data.data);
    } catch (err) {
      setAnalysisError('Analysis failed. Please try again.');
      console.error('Custom analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const StateIcon = () => {
    if (state === 'queued') {
      return (
        <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" opacity="0.3" />
          <circle cx="12" cy="12" r="6" />
        </svg>
      );
    }
    
    if (state === 'in-progress' || isAnalyzing) {
      return (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    }

    if (state === 'success' || analysisResult) {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }

    if (state === 'error' || analysisError) {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }

    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  };

  const getStatusText = () => {
    if (isAnalyzing) return 'Analyzing with custom query...';
    if (state === 'idle' && !analysisResult) return 'Click to analyze this ticket';
    if (state === 'queued') return 'Analysis queued...';
    if (state === 'in-progress') return 'Analyzing ticket content...';
    if (state === 'success' || analysisResult) return 'Analysis complete';
    if (state === 'error' || analysisError) return 'Analysis failed';
    return 'Ready';
  };

  const displayResult = analysisResult || result;
  const displayError = analysisError || error;

  return (
    <div className="border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden bg-white dark:bg-black">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        aria-expanded={isExpanded}
        aria-controls="ai-analysis-panel"
      >
        <div className="flex items-center gap-3">
          <div className="text-black dark:text-white">
            <StateIcon />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-black dark:text-white">
              AI Analysis
            </h3>
            <p 
              className="text-xs text-black/60 dark:text-white/60"
              role="status"
              aria-live="polite"
            >
              {getStatusText()}
            </p>
          </div>
        </div>

        <svg
          className={`w-5 h-5 text-black dark:text-white transition-transform duration-200 motion-reduce:transition-none ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div id="ai-analysis-panel" className="border-t border-black/10 dark:border-white/10 p-4 space-y-4">
          {/* Department classification button */}
          {state === 'idle' && !displayResult && (
            <button
              onClick={handleDepartmentAnalysis}
              disabled={!ticketId || isLoading}
              className="w-full px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Department Analysis
            </button>
          )}

          {/* Custom query input - debounced for performance */}
          <div className="space-y-2">
            <label 
              htmlFor="custom-analysis-query"
              className="text-sm font-medium text-black dark:text-white"
            >
              Custom Analysis Query
            </label>
            <textarea
              id="custom-analysis-query"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Ask a specific question about this ticket..."
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg text-sm text-black dark:text-white placeholder-black/40 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none transition-colors"
              aria-describedby="query-help-text"
            />
            <p id="query-help-text" className="text-xs text-black/60 dark:text-white/60">
              Query updates are debounced by 600ms to optimize performance
            </p>
            <button
              onClick={handleCustomAnalysis}
              disabled={!debouncedQuery.trim() || isAnalyzing}
              className="w-full px-4 py-2 bg-white dark:bg-black border border-black/10 dark:border-white/10 text-black dark:text-white rounded-lg text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze with Custom Query'}
            </button>
          </div>

          {/* Loading state */}
          {(isLoading || isAnalyzing) && (
            <div 
              className="flex flex-col items-center gap-3 py-8"
              role="status"
              aria-live="polite"
              aria-label="Analysis in progress"
            >
              <div className="w-12 h-12 border-4 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin"></div>
              <p className="text-sm text-black/60 dark:text-white/60">
                Analyzing ticket with AI...
              </p>
            </div>
          )}

          {/* Success state - Department analysis */}
          {state === 'success' && displayResult && displayResult.ticket && (
            <div className="space-y-3" role="region" aria-label="Analysis results">
              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg">
                <h4 className="text-sm font-semibold text-black dark:text-white mb-2">
                  Department
                </h4>
                <p className="text-sm text-black/70 dark:text-white/70 capitalize">
                  {displayResult.ticket.department || 'Not classified'}
                </p>
              </div>
              
              {displayResult.analysis?.simplifiedSummary && (
                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg">
                  <h4 className="text-sm font-semibold text-black dark:text-white mb-2">
                    Summary
                  </h4>
                  <p className="text-sm text-black/70 dark:text-white/70">
                    {displayResult.analysis.simplifiedSummary}
                  </p>
                </div>
              )}

              {displayResult.analysis?.confidence !== undefined && (
                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg">
                  <h4 className="text-sm font-semibold text-black dark:text-white mb-2">
                    Confidence
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-black dark:bg-white transition-all duration-500 motion-reduce:transition-none"
                        style={{ width: `${displayResult.analysis.confidence}%` }}
                        role="progressbar"
                        aria-valuenow={displayResult.analysis.confidence}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                    </div>
                    <span className="text-sm font-medium text-black dark:text-white">
                      {displayResult.analysis.confidence}%
                    </span>
                  </div>
                </div>
              )}

              {/* Expandable details section */}
              {displayResult.analysis?.suggestedActions && (
                <details className="p-3 bg-black/5 dark:bg-white/5 rounded-lg">
                  <summary className="text-sm font-semibold text-black dark:text-white cursor-pointer hover:opacity-80">
                    Suggested Actions
                  </summary>
                  <ul className="mt-2 space-y-1 text-sm text-black/70 dark:text-white/70">
                    {displayResult.analysis.suggestedActions.map((action, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-black/40 dark:text-white/40">{idx + 1}.</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Success state - Custom analysis */}
          {analysisResult && !result && (
            <div className="space-y-3" role="region" aria-label="Custom analysis results">
              {analysisResult.summary && (
                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg">
                  <h4 className="text-sm font-semibold text-black dark:text-white mb-2">
                    Summary
                  </h4>
                  <p className="text-sm text-black/70 dark:text-white/70">
                    {analysisResult.summary}
                  </p>
                </div>
              )}

              {analysisResult.details && (
                <details className="p-3 bg-black/5 dark:bg-white/5 rounded-lg">
                  <summary className="text-sm font-semibold text-black dark:text-white cursor-pointer hover:opacity-80">
                    Detailed Analysis
                  </summary>
                  <pre className="mt-2 text-xs text-black/70 dark:text-white/70 overflow-x-auto">
                    {JSON.stringify(analysisResult.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Error state */}
          {displayError && (
            <div 
              className="p-4 bg-black/5 dark:bg-white/5 rounded-lg"
              role="alert"
              aria-live="assertive"
            >
              <p className="text-sm text-black/70 dark:text-white/70 mb-3">
                {displayError}
              </p>
              <button
                onClick={state === 'error' ? handleDepartmentAnalysis : handleCustomAnalysis}
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
              >
                Retry Analysis
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIAnalysisPanel;
