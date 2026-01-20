import io from 'socket.io-client';
import { getServerUrl, invalidateServerCache } from '../utils/network';

let socket = null;
let currentUrl = null;

/**
 * Initialize Socket.io connection to the best available server
 * Auto-reconnects if server changes
 * @returns {Promise<Socket>} - Socket.io instance
 */
export async function initSocket() {
  try {
    // Disconnect existing socket if different server
    const { url: newUrl } = await getServerUrl();
    
    if (socket && currentUrl === newUrl && socket.connected) {
      return socket;
    }

    // Disconnect old socket
    if (socket) {
      socket.disconnect();
    }

    // Create new socket with auto-reconnect and multiple transports
    socket = io(newUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
      timeout: 60000,
      autoConnect: true
    });

    currentUrl = newUrl;

    // Handle connection events
    socket.on('connect', () => {
      console.log('✅ Socket connected:', newUrl);
    });

    socket.on('disconnect', (reason) => {
      console.log('⚠️ Socket disconnected:', reason);
      // Invalidate cache to try different server
      if (reason !== 'io client namespace disconnect') {
        invalidateServerCache();
      }
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Connection error:', err);
      invalidateServerCache();
    });

    return socket;
  } catch (err) {
    console.error('Failed to initialize socket:', err);
    throw err;
  }
}

/**
 * Get the current socket instance
 * @returns {Socket|null} - Socket.io instance or null
 */
export function getSocket() {
  if (!socket) {
    console.warn('Socket not initialized. Call initSocket() first.');
  }
  return socket;
}

/**
 * Emit an event through the socket
 * @param {string} event - Event name
 * @param {*} data - Event data
 * @returns {Promise} - Resolves when event is sent
 */
export async function emitEvent(event, data) {
  try {
    if (!socket) {
      await initSocket();
    }
    
    return new Promise((resolve, reject) => {
      socket.emit(event, data, (ack) => {
        resolve(ack);
      });

      // Timeout if no response within 10 seconds
      setTimeout(() => reject(new Error('Event timeout')), 10000);
    });
  } catch (err) {
    console.error('Failed to emit event:', err);
    throw err;
  }
}

/**
 * Listen to a socket event
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @returns {Function} - Cleanup function to remove listener
 */
export function listenToEvent(event, handler) {
  if (!socket) {
    console.warn('Socket not initialized');
    return () => {};
  }

  socket.on(event, handler);

  return () => {
    socket.off(event, handler);
  };
}

/**
 * Disconnect the socket
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentUrl = null;
  }
}

/**
 * Get connection status
 * @returns {boolean} - True if connected
 */
export function isSocketConnected() {
  return socket?.connected || false;
}
