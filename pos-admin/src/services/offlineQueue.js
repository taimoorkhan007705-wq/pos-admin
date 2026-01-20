/**
 * Offline Queue Service - uses IndexedDB to persist orders
 * Syncs with server when connection available
 */

import { openDB } from 'idb';

const DB_NAME = 'POS_ADMIN_DB';
const STORE_NAME = 'orders';

let db = null;

/**
 * Initialize IndexedDB
 */
async function initDB() {
  if (db) return db;

  try {
    db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          // Index for synced status and timestamp
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      }
    });
    return db;
  } catch (err) {
    console.error('Failed to initialize IndexedDB:', err);
    throw err;
  }
}

/**
 * Add an order to the offline queue
 * @param {Object} order - Order object with items, total, customerName
 * @returns {Promise<number>} - Order ID in queue
 */
export async function enqueueOrder(order) {
  try {
    const database = await initDB();
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const queuedOrder = {
      ...order,
      synced: false,
      timestamp: Date.now(),
      retryCount: 0
    };

    const id = await store.add(queuedOrder);
    await tx.done;

    console.log(`✅ Order queued (ID: ${id})`);
    return id;
  } catch (err) {
    console.error('Failed to enqueue order:', err);
    throw err;
  }
}

/**
 * Get all queued orders
 * @param {boolean} unsynced - If true, only return unsynced orders
 * @returns {Promise<Array>} - Array of orders
 */
export async function getQueuedOrders(unsynced = false) {
  try {
    const database = await initDB();
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('synced');

    let orders;
    if (unsynced) {
      orders = await index.getAll(false);
    } else {
      orders = await store.getAll();
    }

    await tx.done;
    return orders;
  } catch (err) {
    console.error('Failed to get queued orders:', err);
    throw err;
  }
}

/**
 * Mark orders as synced
 * @param {Array<number>} orderIds - IDs of orders to mark as synced
 * @returns {Promise<void>}
 */
export async function markOrdersAsSynced(orderIds) {
  try {
    const database = await initDB();
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const id of orderIds) {
      const order = await store.get(id);
      if (order) {
        order.synced = true;
        order.syncedAt = Date.now();
        await store.put(order);
      }
    }

    await tx.done;
    console.log(`✅ Marked ${orderIds.length} orders as synced`);
  } catch (err) {
    console.error('Failed to mark orders as synced:', err);
    throw err;
  }
}

/**
 * Sync queued orders with server
 * @param {Function} syncFn - Function that takes orders array and syncs them
 * @returns {Promise<Object>} - {synced: number, failed: number}
 */
export async function syncQueuedOrders(syncFn) {
  try {
    const unsynced = await getQueuedOrders(true);
    
    if (unsynced.length === 0) {
      console.log('📭 No orders to sync');
      return { synced: 0, failed: 0 };
    }

    console.log(`📤 Syncing ${unsynced.length} orders...`);

    const syncedIds = [];
    let failedCount = 0;

    for (const order of unsynced) {
      try {
        // Call the sync function (typically API call)
        await syncFn(order);
        syncedIds.push(order.id);
      } catch (err) {
        console.warn(`Failed to sync order ${order.id}:`, err);
        failedCount++;
        
        // Increment retry count
        const database = await initDB();
        const tx = database.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        order.retryCount = (order.retryCount || 0) + 1;
        await store.put(order);
        await tx.done;
      }
    }

    // Mark successfully synced orders
    if (syncedIds.length > 0) {
      await markOrdersAsSynced(syncedIds);
    }

    console.log(`✅ Synced: ${syncedIds.length}, ❌ Failed: ${failedCount}`);
    return { synced: syncedIds.length, failed: failedCount };
  } catch (err) {
    console.error('Sync failed:', err);
    throw err;
  }
}

/**
 * Clear synced orders from the queue
 * @returns {Promise<number>} - Number of orders deleted
 */
export async function clearSyncedOrders() {
  try {
    const database = await initDB();
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('synced');
    const synced = await index.getAll(true);

    for (const order of synced) {
      await store.delete(order.id);
    }

    await tx.done;
    console.log(`🗑️ Cleared ${synced.length} synced orders`);
    return synced.length;
  } catch (err) {
    console.error('Failed to clear synced orders:', err);
    throw err;
  }
}

/**
 * Get queue statistics
 * @returns {Promise<Object>} - {total, synced, unsynced}
 */
export async function getQueueStats() {
  try {
    const all = await getQueuedOrders(false);
    const unsynced = await getQueuedOrders(true);

    return {
      total: all.length,
      synced: all.length - unsynced.length,
      unsynced: unsynced.length
    };
  } catch (err) {
    console.error('Failed to get queue stats:', err);
    throw err;
  }
}

/**
 * Clear all orders from queue (for testing/reset)
 * @returns {Promise<number>} - Number of orders deleted
 */
export async function clearAllOrders() {
  try {
    const database = await initDB();
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const all = await store.getAll();
    await store.clear();
    await tx.done;

    console.log(`🗑️ Cleared all ${all.length} orders`);
    return all.length;
  } catch (err) {
    console.error('Failed to clear all orders:', err);
    throw err;
  }
}
