/**
 * Network Status Hook
 * Monitors network connectivity and provides status
 */

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
// Note: Network plugin needs to be installed: npm install @capacitor/network
// For now, using navigator.onLine as fallback

export interface NetworkStatus {
  connected: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
  isOnline: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    connected: navigator.onLine,
    connectionType: 'unknown',
    isOnline: navigator.onLine,
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      // Web implementation
      const handleOnline = () => {
        setStatus({
          connected: true,
          connectionType: 'unknown',
          isOnline: true,
        });
      };

      const handleOffline = () => {
        setStatus({
          connected: false,
          connectionType: 'none',
          isOnline: false,
        });
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } else {
      // Native implementation - fallback to web API until Network plugin is installed
      // TODO: Install @capacitor/network and use Network.getStatus()
      const handleOnline = () => {
        setStatus({
          connected: true,
          connectionType: 'unknown',
          isOnline: true,
        });
      };

      const handleOffline = () => {
        setStatus({
          connected: false,
          connectionType: 'none',
          isOnline: false,
        });
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  return status;
}
