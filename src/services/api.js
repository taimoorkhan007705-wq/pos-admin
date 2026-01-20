// API Service - Backend Connection with Dynamic Server Detection
import { getServerUrl } from '../utils/network';

let API_URL = 'http://localhost:3001/api';
let currentServerUrl = null;

/**
 * Initialize API with best available server
 */
export const initAPI = async () => {
  try {
    const { url } = await getServerUrl();
    
    if (url !== currentServerUrl) {
      currentServerUrl = url;
      API_URL = `${url}/api`;
      console.log('🌐 Admin API URL updated to:', API_URL);
    }
    
    return API_URL;
  } catch (error) {
    console.error('Failed to initialize API:', error);
    // Fallback to localhost (same port as backend)
    API_URL = 'http://localhost:3001/api';
    return API_URL;
  }
};

/**
 * Get current API URL (ensure it's initialized)
 */
const getAPIUrl = async () => {
  if (!currentServerUrl) {
    await initAPI();
  }
  return API_URL;
};

export const isOnline = () => {
  return navigator.onLine;
};

// ==================== PRODUCTS ====================

export const fetchProducts = async () => {
  try {
    const url = await getAPIUrl();
    const response = await fetch(`${url}/products`);
    if (!response.ok) throw new Error('Failed to fetch products');
    return await response.json();
  } catch (error) {
    console.error('❌ Fetch products error:', error);
    throw error;
  }
};

export const syncProducts = async (products) => {
  try {
    const url = await getAPIUrl();
    const response = await fetch(`${url}/products/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products })
    });
    
    if (!response.ok) throw new Error('Failed to sync products');
    return await response.json();
  } catch (error) {
    console.error('❌ Sync products error:', error);
    throw error;
  }
};

// ==================== ORDERS ====================

export const fetchOrders = async (status = null) => {
  try {
    const baseUrl = await getAPIUrl();
    const url = status ? `${baseUrl}/orders?status=${status}` : `${baseUrl}/orders`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error('Failed to fetch orders');
    return await response.json();
  } catch (error) {
    console.error('❌ Fetch orders error:', error);
    throw error;
  }
};

export const fetchOrderByNumber = async (orderNumber) => {
  try {
    const url = await getAPIUrl();
    const response = await fetch(`${url}/orders/number/${orderNumber}`);
    if (!response.ok) throw new Error('Failed to fetch order by number');
    return await response.json();
  } catch (error) {
    console.error('❌ Fetch order by number error:', error);
    throw error;
  }
};

export const createOrder = async (orderData) => {
  try {
    const url = await getAPIUrl();
    const response = await fetch(`${url}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    
    if (!response.ok) throw new Error('Failed to create order');
    return await response.json();
  } catch (error) {
    console.error('❌ Create order error:', error);
    throw error;
  }
};

// Bulk sync orders (upsert)
export const syncOrders = async (orders) => {
  try {
    const url = await getAPIUrl();
    const response = await fetch(`${url}/orders/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    });

    if (!response.ok) throw new Error('Failed to sync orders');
    return await response.json();
  } catch (error) {
    console.error('❌ Sync orders error:', error);
    throw error;
  }
};

export const updateOrderStatus = async (orderId, status) => {
  try {
    const url = await getAPIUrl();
    // Backend expects PATCH /api/orders/:id with { status }
    const response = await fetch(`${url}/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    
    if (!response.ok) throw new Error('Failed to update status');
    return await response.json();
  } catch (error) {
    console.error('❌ Update status error:', error);
    throw error;
  }
};

export const deleteOrder = async (orderId) => {
  try {
    const url = await getAPIUrl();
    const response = await fetch(`${url}/orders/${orderId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Failed to delete order');
    return await response.json();
  } catch (error) {
    console.error('❌ Delete order error:', error);
    throw error;
  }
};

export const fetchStats = async () => {
  try {
    const url = await getAPIUrl();
    const response = await fetch(`${url}/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return await response.json();
  } catch (error) {
    console.error('❌ Fetch stats error:', error);
    throw error;
  }
};

// Initialize API on module load
initAPI();

const api = {
  initAPI,
  isOnline,
  fetchProducts,
  syncProducts,
  fetchOrders,
  createOrder,
  syncOrders,
  updateOrderStatus,
  deleteOrder,
  fetchStats,
  fetchOrderByNumber
};

export default api;