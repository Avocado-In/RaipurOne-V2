import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../hooks/useTheme';

// The hook is a deliberate two-mode switcher: light or dark, persisted under
// `r1_theme`, applied as Tailwind's `.dark` class on <html>. An earlier three-mode
// version with an "auto" setting and `theme-*` classes is gone.
describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('defaults to light when nothing is stored', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('restores a stored preference', () => {
    localStorage.setItem('r1_theme', 'dark');

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('ignores an unrecognised stored value rather than applying it', () => {
    localStorage.setItem('r1_theme', 'theme-neon');

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
  });

  it('persists the theme and applies the dark class', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(localStorage.getItem('r1_theme')).toBe('dark');
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggles back and forth between light and dark', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
