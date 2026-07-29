import { useState, useCallback, useRef } from 'react';
import { analysisAPI } from '../api';

const AI_STATES = {
  IDLE: 'idle',
  QUEUED: 'queued',
  IN_PROGRESS: 'in-progress',
  SUCCESS: 'success',
  ERROR: 'error',
};

/**
 * Hook for AI analysis with cancellation, retry logic, and mock mode support.
 * Manages request lifecycle including exponential backoff retry on failure.
 */
export const useAIAnalysis = () => {
  const [state, setState] = useState(AI_STATES.IDLE);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  /**
   * Retry with exponential backoff (max 2 attempts)
   * Delays increase as: 1000ms, 2000ms
   */
  const retryWithBackoff = async (fn, maxRetries = 2) => {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        
        if (err.cancelled || attempt === maxRetries - 1) {
          throw err;
        }
        
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  };

  const analyzeSingle = useCallback(async (ticketId) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setState(AI_STATES.QUEUED);
    setError(null);

    try {
      setState(AI_STATES.IN_PROGRESS);
      
      const response = await retryWithBackoff(async () => {
        return await analysisAPI.analyzeSingleTicket(ticketId, abortControllerRef.current.signal);
      });
      
      setResult(response.data);
      setState(AI_STATES.SUCCESS);
      return response.data;
    } catch (err) {
      if (err.cancelled) {
        setState(AI_STATES.IDLE);
        return null;
      }
      
      const errorMessage = err.response?.data?.message || err.message || 'Analysis failed';
      setError(errorMessage);
      setState(AI_STATES.ERROR);
      throw err;
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const analyzeAll = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setState(AI_STATES.QUEUED);
    setError(null);

    try {
      setState(AI_STATES.IN_PROGRESS);
      
      const response = await retryWithBackoff(async () => {
        return await analysisAPI.analyzeAllTickets(abortControllerRef.current.signal);
      });
      
      setResult(response.data);
      setState(AI_STATES.SUCCESS);
      return response.data;
    } catch (err) {
      if (err.cancelled) {
        setState(AI_STATES.IDLE);
        return null;
      }
      
      const errorMessage = err.response?.data?.message || err.message || 'Batch analysis failed';
      setError(errorMessage);
      setState(AI_STATES.ERROR);
      throw err;
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setState(AI_STATES.IDLE);
      setError(null);
    }
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState(AI_STATES.IDLE);
    setResult(null);
    setError(null);
  }, [cancel]);

  return {
    state,
    result,
    error,
    analyzeSingle,
    analyzeAll,
    cancel,
    reset,
    isLoading: state === AI_STATES.QUEUED || state === AI_STATES.IN_PROGRESS,
    isSuccess: state === AI_STATES.SUCCESS,
    isError: state === AI_STATES.ERROR,
  };
};
