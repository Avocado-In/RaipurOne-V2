import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Staff sign-in. Matches the monochrome dashboard styling used across the app.
 */
const Login = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 401
          ? 'Invalid username or password.'
          : err?.response?.data?.detail || 'Could not sign in. Is the backend running?'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">RaipurOne</h1>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            Grievance management — staff sign in
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-black dark:text-white mb-1.5">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              className="w-full rounded-lg border border-black/15 dark:border-white/15 bg-white dark:bg-black px-3 py-2.5 text-black dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-black dark:text-white mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-black/15 dark:border-white/15 bg-white dark:bg-black px-3 py-2.5 text-black dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-black dark:bg-white px-4 py-2.5 text-sm font-semibold text-white dark:text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
