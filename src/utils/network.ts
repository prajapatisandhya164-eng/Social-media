import { useEffect, useState } from 'react';
import { NetworkStatus } from '../types/social';

interface NetworkInformationLike {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

const DATA_SAVER_KEY = 'connectly_data_saver';

export function useNetworkStatus(): NetworkStatus & {
  toggleDataSaver: () => void;
  isSlowConnection: boolean;
} {
  const getInitialEffectiveType = () => {
    const conn = (navigator as unknown as { connection?: NetworkInformationLike }).connection;
    return conn?.effectiveType || '4g';
  };

  const getInitialDataSaver = () => {
    try {
      const saved = localStorage.getItem(DATA_SAVER_KEY);
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore storage failure
    }
    const conn = (navigator as unknown as { connection?: NetworkInformationLike }).connection;
    return Boolean(conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g');
  };

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [effectiveType, setEffectiveType] = useState<string>(getInitialEffectiveType);
  const [dataSaver, setDataSaver] = useState<boolean>(getInitialDataSaver);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const conn = (navigator as unknown as { connection?: NetworkInformationLike }).connection;
    const handleConnectionChange = () => {
      if (conn?.effectiveType) {
        setEffectiveType(conn.effectiveType);
      }
    };
    conn?.addEventListener?.('change', handleConnectionChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      conn?.removeEventListener?.('change', handleConnectionChange);
    };
  }, []);

  const toggleDataSaver = () => {
    setDataSaver((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DATA_SAVER_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const isSlowConnection =
    dataSaver || effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g';

  return { isOnline, effectiveType, dataSaver, toggleDataSaver, isSlowConnection };
}
