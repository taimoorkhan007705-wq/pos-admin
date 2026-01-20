import { openDB } from 'idb';
import { fetchOrders as apiFetchOrders, syncOrders as apiSyncOrders, updateOrderStatus as apiUpdateOrderStatus, fetchOrderByNumber as apiFetchOrderByNumber } from './api';

const DB_NAME = 'pos-admin-db';
const DB_VERSION = 1;

// ==================== DATABASE INITIALIZATION ====================

export const initDB = async () => {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Orders store (for caching)
      if (!db.objectStoreNames.contains('orders')) {
        const orderStore = db.createObjectStore('orders', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        orderStore.createIndex('orderId', 'orderId', { unique: false });
        orderStore.createIndex('status', 'status', { unique: false });
        orderStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    }
  });

  return db;
};

// ==================== ORDERS (READ ONLY - Admin View) ====================

export const getAllOrders = async () => {
  // Try to get from server first
  if (navigator.onLine) {
    try {
      const orders = await apiFetchOrders();
      console.log('db.getAllOrders: fetched from server', Array.isArray(orders) ? orders.length : '(not array)');
      // Cache locally
      const db = await initDB();
      const tx = db.transaction('orders', 'readwrite');
      await tx.store.clear(); // Clear old cache
      for (const order of orders) {
        await tx.store.add(order);
      }
      await tx.done;
      return orders.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.log('Using cached orders (fetch error):', error.message);
    }
  }

  // Fallback to cache
  const db = await initDB();
  const orders = await db.getAll('orders');
  console.log('db.getAllOrders: returned from cache', Array.isArray(orders) ? orders.length : '(not array)');
  return orders.sort((a, b) => b.timestamp - a.timestamp);
};

export const getOrderById = async (id) => {
  const db = await initDB();
  return await db.get('orders', id);
};

export const updateOrderStatus = async (orderId, status) => {
  const db = await initDB();
  // Try direct primary key lookup first
  let order = await db.get('orders', orderId);

  // If not found, try to find by orderId or _id fields
  if (!order) {
    const all = await db.getAll('orders');
    order = all.find(o => o._id === orderId || o.orderId === orderId || String(o.id) === String(orderId));
  }

  if (!order) {
    throw new Error('Order not found');
  }

  order.status = status;
  // mark as dirty/offline-change so it can be reconciled later if needed
  order.dirty = true;
  await db.put('orders', order);

  console.log('✅ Order status updated locally:', order.orderId || orderId, '→', status);
  return order;
};

// Save or update a single order (used by bluetooth incoming sync)
export const saveOrder = async (order) => {
  const db = await initDB();
  // Use put to add or update (preserve given id if present)
  await db.put('orders', order);
  console.log('✅ Order saved locally:', order.id || order.orderId || 'unknown');
  return order;
};

// Clear all locally cached orders
export const clearOrders = async () => {
  const db = await initDB();
  await db.clear('orders');
  console.log('✅ All cached orders cleared');
};

export const deleteOrder = async (orderId) => {
  const db = await initDB();
  // Try primary key delete first
  let existing = await db.get('orders', orderId);
  if (!existing) {
    const all = await db.getAll('orders');
    existing = all.find(o => o._id === orderId || o.orderId === orderId || String(o.id) === String(orderId));
  }
  if (existing) {
    await db.delete('orders', existing.id);
    console.log('✅ Order deleted locally:', existing.orderId || existing._id || existing.id);
    return existing;
  } else {
    console.log('⚠️ Order to delete not found locally:', orderId);
    return null;
  }
};

// ==================== SYNC ====================

export const syncWithServer = async () => {
  if (!navigator.onLine) {
    console.log('📵 Offline - sync skipped');
    return { success: false, message: 'Offline' };
  }

  try {
    console.log('🔄 Syncing orders from server...');
    await getAllOrders(); // This already syncs
    console.log('✅ Sync completed');
    return { success: true };
  } catch (error) {
    console.error('❌ Sync error:', error);
    return { success: false, error: error.message };
  }
};

// Get pending (unsynced) orders saved locally (created from Bluetooth)
export const getUnsyncedOrders = async () => {
  const db = await initDB();
  const all = await db.getAll('orders');
  return all.filter(o => !o.synced);
};

// Mark an order as synced locally (by orderId or _id)
export const markOrderAsSynced = async (orderId) => {
  const db = await initDB();
  const orders = await db.getAll('orders');
  const order = orders.find(o => o.id === orderId || o.orderId === orderId || o._id === orderId);
  if (order) {
    order.synced = true;
    await db.put('orders', order);
    console.log('✅ Order marked synced locally:', order.orderId || orderId);
    return order;
  }
  return null;
};

// Sync unsynced orders to server (bulk)
export const syncPendingOrders = async () => {
  if (!navigator.onLine) {
    console.log('📵 Offline - pending sync skipped');
    return { success: false, message: 'Offline' };
  }
  try {
    const db = await initDB();
    const pending = await getUnsyncedOrders();
    if (pending.length === 0) {
      return { success: true, synced: 0 };
    }
    console.log('🔄 Syncing pending orders to server...', pending.length);
    const result = await apiSyncOrders(pending);
    const syncedOrders = result.orders || (Array.isArray(result) ? result : []);
    for (const o of syncedOrders) {
      await markOrderAsSynced(o.orderId || o._id || o.id);
      await saveOrder(o); // update local with server data
    }

    // Also try to push status updates for locally dirty orders
    const allOrders = await db.getAll('orders');
    const dirty = allOrders.filter(o => o.dirty);
    for (const d of dirty) {
      try {
        // Prefer server _id
        let serverId = d._id || null;
        if (!serverId && d.orderId) {
          const serverOrder = await apiFetchOrderByNumber(d.orderId);
          serverId = serverOrder?._id || null;
        }
        if (serverId) {
          await apiUpdateOrderStatus(serverId, d.status);
          d.dirty = false;
          await db.put('orders', d);
          console.log('✅ Pushed status update to server for', d.orderId || d._id || d.id);
        }
      } catch (err) {
        console.warn('⚠️ Failed to push dirty status for', d.orderId || d._id || d.id, err.message);
      }
    }

    console.log('✅ Pending orders synced:', syncedOrders.length);
    return { success: true, synced: syncedOrders.length };
  } catch (err) {
    console.error('❌ Sync pending orders failed:', err);
    return { success: false, error: err.message };
  }
};

// ==================== EXPORT ====================

export const exportAllData = async () => {
  const db = await initDB();
  const orders = await db.getAll('orders');
  
  return {
    orders,
    exportedAt: Date.now()
  };
};

export const importAllData = async (data) => {
  const db = await initDB();
  
  if (data.orders && data.orders.length > 0) {
    const tx = db.transaction('orders', 'readwrite');
    for (const order of data.orders) {
      await tx.store.put(order);
    }
    await tx.done;
    console.log('✅ Orders imported');
  }
  
  return true;
};

const dbExports = {
  initDB,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  saveOrder,
  clearOrders,
  deleteOrder,
  syncWithServer,
  exportAllData,
  importAllData
};

export default dbExports;