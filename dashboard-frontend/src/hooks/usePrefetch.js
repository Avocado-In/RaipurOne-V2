import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const usePrefetch = (routes = []) => {
  const navigate = useNavigate();

  useEffect(() => {
    routes.forEach((route) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = route;
      document.head.appendChild(link);
    });

    return () => {
      const links = document.querySelectorAll('link[rel="prefetch"]');
      links.forEach((link) => link.remove());
    };
  }, [routes]);

  return navigate;
};
