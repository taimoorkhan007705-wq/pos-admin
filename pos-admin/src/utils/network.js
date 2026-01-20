/**
 * ADMIN APP - Network Detection & Server Resolution
 * Admin laptop par chalti hai jahan backend bhi hai
 */

// ==========================================
// SERVER CONFIGURATION FOR ADMIN
// ==========================================

const SERVER_URLS = {
  // Cloud server (agar backend cloud par deployed hai)
  cloud: process.env.REACT_APP_CLOUD_SERVER || 'http://localhost:3001',

  // Local server (admin laptop par backend chal raha hai)
  // Admin khud laptop par hai to localhost
  local: process.env.REACT_APP_LOCAL_SERVER || 'http://localhost:3001',

  // Development fallback
  localhost: 'http://localhost:3001',

  // Additional local network IPs (in case admin is on different machine)
  localNetworks: [
    'http://192.168.137.1:3001',
    'http://192.168.1.1:3001',
    'http://192.168.0.1:3001',
    'http://10.0.0.1:3001'
  ]
};

let cachedMode = null;
let lastCheck = 0;
const CACHE_DURATION = 5000; // Cache for 5 seconds

/**
 * Check if a server is reachable
 */
export async function isServerAvailable(url, timeout = 2000) {
  try {
    console.log(`🔍 [Admin] Testing server: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }
    });

    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ [Admin] Server available: ${url}`, data);
      return true;
    }
    
    console.log(`⚠️ [Admin] Server responded but not OK: ${url}`);
    return false;
  } catch (err) {
    console.log(`❌ [Admin] Server unavailable: ${url} - ${err.message}`);
    return false;
  }
}

/**
 * Get the best available server URL for ADMIN
 * Priority: Localhost (same machine) > Cloud > Local network
 */
export async function getServerUrl() {
  const now = Date.now();
  
  // Use cache if fresh
  if (cachedMode && (now - lastCheck) < CACHE_DURATION) {
    console.log(`📦 [Admin] Using cached mode: ${cachedMode}`);
    return { 
      url: SERVER_URLS[cachedMode],
      mode: cachedMode === 'cloud' ? 'online' : cachedMode
    };
  }

  console.log('🔍 [Admin] Detecting best server...');
  console.log('📋 [Admin] Available servers:', SERVER_URLS);

  // ⚠️ ADMIN PRIORITY: Try localhost FIRST (admin and backend on same machine)
  if (await isServerAvailable(SERVER_URLS.localhost, 2000)) {
    cachedMode = 'localhost';
    lastCheck = now;
    console.log('💻 ✅ [Admin] Using LOCALHOST server:', SERVER_URLS.localhost);
    return { url: SERVER_URLS.localhost, mode: 'localhost' };
  }

  // Try local network IP (agar admin alag machine se access kar raha ho)
  if (SERVER_URLS.local !== SERVER_URLS.localhost) {
    if (await isServerAvailable(SERVER_URLS.local, 2000)) {
      cachedMode = 'local';
      lastCheck = now;
      console.log('🏠 [Admin] Using LOCAL network server:', SERVER_URLS.local);
      return { url: SERVER_URLS.local, mode: 'local' };
    }
  }

  // Try cloud server
  if (navigator.onLine && SERVER_URLS.cloud !== SERVER_URLS.localhost) {
    if (await isServerAvailable(SERVER_URLS.cloud, 3000)) {
      cachedMode = 'cloud';
      lastCheck = now;
      console.log('🌐 [Admin] Using CLOUD server:', SERVER_URLS.cloud);
      return { url: SERVER_URLS.cloud, mode: 'online' };
    }
  }

  // If all fail, default to localhost
  console.warn('⚠️ [Admin] All servers unavailable, defaulting to localhost');
  cachedMode = 'localhost';
  lastCheck = now;
  return { url: SERVER_URLS.localhost, mode: 'localhost' };
}

/**
 * Force use a specific server URL (for testing)
 */
export function forceServerUrl(url) {
  console.log(`🔧 [Admin] Force setting server URL: ${url}`);
  SERVER_URLS.local = url;
  SERVER_URLS.localhost = url;
  invalidateServerCache();
}

/**
 * Get current server URLs configuration
 */
export function getServerConfig() {
  return { ...SERVER_URLS };
}

/**
 * Check browser online status
 */
export function isBrowserOnline() {
  return navigator.onLine;
}

/**
 * Listen for online/offline events
 */
export function listenToNetworkChanges(onOnline, onOffline) {
  const handleOnline = () => {
    console.log('🌐 [Admin] Browser is ONLINE');
    invalidateServerCache();
    onOnline();
  };
  
  const handleOffline = () => {
    console.log('🔵 [Admin] Browser is OFFLINE');
    onOffline();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Invalidate the server cache to force re-detection
 */
export function invalidateServerCache() {
  console.log('🔄 [Admin] Server cache invalidated');
  cachedMode = null;
  lastCheck = 0;
}

/**
 * Perform periodic server health checks
 */
export function startHealthChecks(intervalMs = 30000) {
  console.log(`⏰ [Admin] Starting health checks every ${intervalMs}ms`);
  
  const interval = setInterval(() => {
    console.log('🏥 [Admin] Performing periodic health check...');
    invalidateServerCache();
  }, intervalMs);

  return () => {
    console.log('⏹️ [Admin] Health checks stopped');
    clearInterval(interval);
  };
}

/**
 * Test all servers and return their status
 */
export async function testAllServers() {
  console.log('🧪 [Admin] Testing all servers...');
  
  const results = {
    localhost: await isServerAvailable(SERVER_URLS.localhost, 2000),
    local: await isServerAvailable(SERVER_URLS.local, 2000),
    cloud: await isServerAvailable(SERVER_URLS.cloud, 3000)
  };
  
  console.log('🧪 [Admin] Test results:', results);
  return results;
}