import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const NetworkContext = createContext(null);

// Helper function to detect server URL
async function detectServerUrl() {
  // Priority order of URLs to check
  const urlsToCheck = [
    // Cloud/Production (if deployed)
    import.meta.env.VITE_BACKEND_URL,
    
    // Local network (hotspot) - try common IPs
    'http://192.168.137.1:3001',
    'http://192.168.1.1:3001',
    'http://192.168.0.1:3001',
    
    // Localhost variants
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
  ].filter(Boolean); // Remove undefined values

  console.log('🔍 Checking servers:', urlsToCheck);

  for (const url of urlsToCheck) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Server found at:', url, data);
        
        // Determine mode based on URL
        let mode = 'localhost';
        if (url.includes('192.168') || url.includes('10.0')) {
          mode = 'local'; // Hotspot/LAN
        } else if (url.includes('cloud') || url.includes('herokuapp') || url.includes('vercel')) {
          mode = 'online'; // Cloud
        }

        return { url, mode };
      }
    } catch (error) {
      console.log(`❌ Server not found at ${url}:`, error.message);
      continue;
    }
  }

  // Fallback
  console.warn('⚠️ No server found, using localhost as fallback');
  return { 
    url: 'http://localhost:3001', 
    mode: 'disconnected' 
  };
}

// Listen to network changes
function listenToNetworkChanges(onOnline, onOffline) {
  const handleOnline = () => {
    console.log('🌐 Network: ONLINE');
    onOnline?.();
  };

  const handleOffline = () => {
    console.log('📵 Network: OFFLINE');
    onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Network Provider - manages connectivity state and server selection
 */
export function NetworkProvider({ children }) {
  const [serverUrl, setServerUrl] = useState('http://localhost:3001');
  const [mode, setMode] = useState('disconnected');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [detecting, setDetecting] = useState(false);

  // Detect server on mount and periodically
  const detectServer = useCallback(async () => {
    if (detecting) return; // Prevent multiple simultaneous detections
    
    setDetecting(true);
    try {
      console.log('🔍 Detecting server...');
      const result = await detectServerUrl();
      
      setServerUrl(result.url);
      setMode(isOnline ? result.mode : 'disconnected');
      setLastError(null);
      
      console.log('✅ Server detected:', result);
    } catch (err) {
      console.error('❌ Server detection failed:', err);
      setLastError(err.message);
      setMode('disconnected');
    } finally {
      setDetecting(false);
    }
  }, [isOnline, detecting]);

  // Initial server detection
  useEffect(() => {
    detectServer();
  }, [detectServer]);

  // Listen for online/offline events
  useEffect(() => {
    const cleanup = listenToNetworkChanges(
      () => {
        setIsOnline(true);
        detectServer();
      },
      () => {
        setIsOnline(false);
        setMode('disconnected');
      }
    );

    return cleanup;
  }, [detectServer]);

  // Periodic server detection (every 10 seconds when online)
  useEffect(() => {
    if (!isOnline) return;

    const timer = setInterval(() => {
      console.log('🔄 Periodic server check...');
      detectServer();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(timer);
  }, [detectServer, isOnline]);

  // Auto-sync queued orders when we become online
  useEffect(() => {
    let interval = null;

    const tryFlush = async () => {
      if (!isOnline || !serverUrl) return;

      try {
        // Check if there's an offline queue module
        const queueModule = await import('../services/offlineQueue').catch(() => null);
        if (!queueModule) return;

        const queued = await queueModule.getQueuedOrders?.(true);
        if (!queued || queued.length === 0) {
          setQueuedCount(0);
          return;
        }

        setQueuedCount(queued.length);
        console.log(`📤 Auto-syncing ${queued.length} queued orders...`);

        // POST batch
        const resp = await fetch(`${serverUrl}/sync/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queued)
        });

        if (resp.ok || resp.status === 202 || resp.status === 207) {
          const data = await resp.json();
          console.log('✅ Sync successful:', data);
          
          // Mark orders as synced
          if (data.synced && data.synced > 0) {
            const ids = (data.orders || []).map(o => o.id).filter(Boolean);
            if (ids.length && queueModule.markOrdersAsSynced) {
              await queueModule.markOrdersAsSynced(ids);
              setQueuedCount(0);
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ Auto-sync attempt failed:', err.message);
      }
    };

    if (isOnline) {
      // Try immediately, then periodically
      tryFlush();
      interval = setInterval(tryFlush, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOnline, serverUrl]);

  const value = {
    serverUrl,
    mode,
    isOnline,
    queuedCount,
    setQueuedCount,
    syncing,
    setSyncing,
    lastError,
    detectServer,
    detecting
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

/**
 * Hook to use network context
 */
export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
}