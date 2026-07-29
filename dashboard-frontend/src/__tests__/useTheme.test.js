import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../hooks/useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('should initialize with auto theme by default', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('auto');
  });

  it('should persist theme to localStorage', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme('theme-dark');
    });

    expect(localStorage.getItem('r1-dashboard-theme')).toBe('theme-dark');
    expect(result.current.theme).toBe('theme-dark');
  });

  it('should apply theme class to document root', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme('theme-light');
    });

    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
  });

  it('should toggle between themes', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme('theme-light');
    });
    expect(result.current.theme).toBe('theme-light');

    act(() => {
      result.current.setTheme('theme-dark');
    });
    expect(result.current.theme).toBe('theme-dark');
    expect(document.documentElement.classList.contains('theme-light')).toBe(false);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
  });
});
