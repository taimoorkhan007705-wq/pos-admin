import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAdminLoggedIn, logout } from '../services/auth';
import { 
  getAllOrders, 
  updateOrderStatus,
  deleteOrder,
  syncWithServer 
} from '../services/db';
import { 
  updateOrderStatus as apiUpdateOrderStatus,
  deleteOrder as apiDeleteOrder,
  fetchOrderByNumber
} from '../services/api';
import { useNetwork } from '../context/NetworkContext';
import {
  MdDashboard,
  MdShoppingCart,
  MdCheckCircle,
  MdPending,
  MdRestaurant,
  MdAttachMoney,
  MdLogout,
  MdSync,
  MdDelete,
  MdExpandMore,
  MdExpandLess,
  MdPerson,
  MdRefresh,
  MdInventory
} from 'react-icons/md';

function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const navigate = useNavigate();
  const network = useNetwork();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isAdminLoggedIn()) {
      navigate('/login');
      return;
    }

    loadData();

    const handleOnlineEvent = () => {
      console.log('🌐 Back online');
      network.detectServer();
      handleSync();
    };

    const handleOfflineEvent = () => {
      console.log('📵 Gone offline');
    };

    window.addEventListener('online', handleOnlineEvent);
    window.addEventListener('offline', handleOfflineEvent);

    // Auto-refresh disabled; rely on manual Refresh button instead
    // If you want auto-refresh, re-enable a setInterval here.

    return () => {
      window.removeEventListener('online', handleOnlineEvent);
      window.removeEventListener('offline', handleOfflineEvent);
    };
  }, [navigate, network]);

  const loadData = async () => {
    try {
      let allOrders = [];
      
      if (network.isOnline && network.serverUrl) {
        try {
          console.log('🔍 Fetching from:', network.serverUrl);
          const response = await fetch(`${network.serverUrl}/api/orders`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            }
          });
          
          if (response.ok) {
            allOrders = await response.json();
            console.log(`✅ Got ${allOrders.length} orders from backend`);
            setLastUpdate(new Date());
          } else {
            console.warn('Backend response not OK, using local');
            allOrders = await getAllOrders();
          }
        } catch (error) {
          console.warn('Backend fetch failed, using local:', error.message);
          allOrders = await getAllOrders();
        }
      } else {
        console.log('📱 Using local orders (offline mode)');
        allOrders = await getAllOrders();
      }

      // Sort by timestamp (newest first)
      allOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setOrders(allOrders);

      // Calculate stats
      const pending = allOrders.filter(o => o.status === 'pending').length;
      const preparing = allOrders.filter(o => o.status === 'preparing').length;
      const completed = allOrders.filter(o => o.status === 'completed').length;
      const totalSales = allOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = allOrders.filter(o => {
        const oDate = new Date(o.timestamp);
        oDate.setHours(0, 0, 0, 0);
        return oDate >= today;
      });
      const todaySales = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      setStats({
        totalOrders: allOrders.length,
        pendingOrders: pending,
        preparingOrders: preparing,
        completedOrders: completed,
        totalSales,
        todayOrders: todayOrders.length,
        todaySales
      });
    } catch (error) {
      console.error('❌ Load data failed:', error);
    }
  };

  const handleSync = async () => {
    if (!network.isOnline) {
      alert('📵 Cannot sync while offline');
      return;
    }

    setSyncing(true);
    try {
      console.log('🔄 Manual sync started...');
      
      // Force fresh data from server
      if (network.serverUrl) {
        const response = await fetch(`${network.serverUrl}/api/orders`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
        
        if (response.ok) {
          const serverOrders = await response.json();
          console.log(`✅ Synced ${serverOrders.length} orders from server`);
        }
      }
      
      await syncWithServer();
      await loadData();
      
      alert('✅ Sync completed successfully!');
    } catch (error) {
      console.error('❌ Sync failed:', error);
      alert('❌ Sync failed: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleManualRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    loadData();
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const local = orders.find(o => 
        o._id === orderId || o.id === orderId || o.orderId === orderId
      );

      if (network.isOnline && local) {
        try {
          let serverId = local._id || null;

          if (!serverId && local.orderId) {
            const serverOrder = await fetchOrderByNumber(local.orderId);
            serverId = serverOrder?._id || null;
          }

          if (serverId) {
            await apiUpdateOrderStatus(serverId, newStatus);
            await syncWithServer();
            await loadData();
            return;
          }
        } catch (error) {
          console.log('Server update failed, using local:', error.message);
        }
      }

      if (local) {
        await updateOrderStatus(local.id || local._id || local.orderId, newStatus);
        await loadData();
      }
    } catch (error) {
      console.error('Status update failed:', error);
      alert('❌ Failed to update status');
    }
  };

  const handleDeleteOrder = async (orderKey) => {
    if (!network.isOnline) {
      alert('⚠️ Cannot delete while offline');
      return;
    }

    if (!window.confirm('Delete this order?')) return;

    try {
      const local = orders.find(o => 
        o._id === orderKey || String(o.id) === String(orderKey) || o.orderId === orderKey
      );

      await deleteOrder(local ? (local.id || local._id || local.orderId) : orderKey);

      if (network.isOnline && local) {
        try {
          let serverId = local._id || null;
          
          if (!serverId && local.orderId) {
            const serverOrder = await fetchOrderByNumber(local.orderId);
            serverId = serverOrder?._id || null;
          }

          if (serverId) {
            await apiDeleteOrder(serverId);
            await syncWithServer();
          }
        } catch (error) {
          console.log('Server delete failed:', error.message);
        }
      }

      await loadData();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('❌ Failed to delete order');
    }
  };

  const handleLogout = () => {
    if (window.confirm('Logout from admin panel?')) {
      logout();
      navigate('/login');
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filterStatus === 'all') return true;
    return order.status === filterStatus;
  });

  const getStatusBadge = (status) => {
    const colors = {
      pending: '#f59e0b',
      preparing: '#0ea5e9',
      ready: '#10b981',
      completed: '#16a34a'
    };
    
    const labels = {
      pending: 'Pending',
      preparing: 'Preparing',
      ready: 'Ready',
      completed: 'Completed'
    };

    return (
      <span style={{
        padding: '0.25rem 0.75rem',
        background: colors[status] || colors.pending,
        color: 'white',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 700
      }}>
        {labels[status] || 'Pending'}
      </span>
    );
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-PK', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAdminLoggedIn()) {
    return null;
  }

  return (
    <div className="app">
      {/* Header with Navigation */}
      <header className="app-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 2rem',
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        {/* Logo */}
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <MdDashboard size={32} style={{ color: '#6200ea' }} />
          <div className="logo-text">
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Admin Panel</h1>
            <p className="tagline" style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
              Last update: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Products Button */}
          <button 
            className="header-btn"
            onClick={() => navigate('/products')}
            style={{
              padding: '0.5rem 1rem',
              background: '#6200ea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <MdInventory size={20} />
            Products
          </button>

          {/* Connection Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: network.isOnline ? '#d1fae5' : '#fee2e2',
            color: network.isOnline ? '#065f46' : '#991b1b',
            borderRadius: '20px',
            fontSize: '0.875rem',
            fontWeight: 600
          }}>
            <span>{network.isOnline ? '🟢' : '🔴'}</span>
            <div>
              <div>{network.isOnline ? 'Online' : 'Offline'}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                {network.mode === 'online' && '☁️ Cloud'}
                {network.mode === 'local' && '📡 Hotspot'}
                {network.mode === 'localhost' && '💻 Local'}
              </div>
            </div>
          </div>

          {/* Manual Refresh Button */}
          <button 
            className="header-btn"
            onClick={handleManualRefresh}
            style={{
              padding: '0.5rem 1rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <MdRefresh size={20} />
            Refresh
          </button>

          {/* Sync Button */}
          <button 
            className="header-btn"
            onClick={handleSync}
            disabled={syncing || !network.isOnline}
            style={{
              padding: '0.5rem 1rem',
              background: '#03b9d1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: syncing || !network.isOnline ? 'not-allowed' : 'pointer',
              opacity: syncing || !network.isOnline ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <MdSync size={20} style={{
              animation: syncing ? 'spin 1s linear infinite' : 'none'
            }} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>

          {/* Logout Button */}
          <button 
            className="header-btn"
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <MdLogout size={20} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        <div className="admin-dashboard">
          {/* Stats Grid */}
          {stats && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div style={{ padding: '1.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <MdShoppingCart size={32} style={{ color: '#6200ea' }} />
                  <div>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.totalOrders}</div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>Total Orders</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '1.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <MdPending size={32} style={{ color: '#f59e0b' }} />
                  <div>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.pendingOrders}</div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>Pending</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '1.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <MdRestaurant size={32} style={{ color: '#0ea5e9' }} />
                  <div>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.preparingOrders}</div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>Preparing</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '1.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <MdCheckCircle size={32} style={{ color: '#16a34a' }} />
                  <div>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.completedOrders}</div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>Completed</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '1.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <MdAttachMoney size={32} style={{ color: '#16a34a' }} />
                  <div>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>Rs. {stats.todaySales}</div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>Today's Sales</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '1.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <MdAttachMoney size={32} style={{ color: '#6200ea' }} />
                  <div>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>Rs. {stats.totalSales}</div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>Total Sales</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orders Section */}
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                Orders ({filteredOrders.length})
              </h2>

              {/* Status Filters */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['all', 'pending', 'preparing', 'ready', 'completed'].map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: filterStatus === status ? '#6200ea' : '#f3f4f6',
                      color: filterStatus === status ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      fontSize: '0.875rem'
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem',
                color: '#9ca3af',
                background: 'white',
                borderRadius: '12px'
              }}>
                <MdShoppingCart size={64} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>No orders found</p>
                <p style={{ fontSize: '0.875rem' }}>Orders will appear here automatically</p>
              </div>
            ) : (
              filteredOrders.map(order => {
                const key = order._id || order.id || order.orderId;
                const isExpanded = expandedOrder === key;
                
                return (
                  <div key={key} style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginBottom: '1rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    border: order.status === 'pending' ? '2px solid #f59e0b' : 'none'
                  }}>
                    <div 
                      onClick={() => setExpandedOrder(isExpanded ? null : key)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                            #{order.orderId}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                            <MdPerson size={16} />
                            <span>{order.customerName}</span>
                            <span>•</span>
                            <span>{formatDate(order.timestamp)}</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div>
                            {getStatusBadge(order.status)}
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#6200ea', marginTop: '0.5rem' }}>
                              Rs. {order.total}
                            </div>
                          </div>
                          {isExpanded ? <MdExpandLess size={24} /> : <MdExpandMore size={24} />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
                        <h4 style={{ marginBottom: '1rem', fontWeight: 600 }}>Items:</h4>
                        {order.items.map((item, index) => (
                          <div key={index} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '0.75rem',
                            background: '#f9fafb',
                            borderRadius: '8px',
                            marginBottom: '0.5rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {item.image && (
                                typeof item.image === 'string' && (item.image.startsWith('http') || item.image.startsWith('data:image')) ? (
                                  <img 
                                    src={item.image} 
                                    alt={item.name}
                                    style={{ 
                                      width: 40,
                                      height: 40,
                                      objectFit: 'cover',
                                      borderRadius: '50%'
                                    }}
                                  />
                                ) : (
                                  <span style={{ fontSize: '1.5rem' }}>{item.image}</span>
                                )
                              )}
                              <span style={{ fontWeight: 600 }}>{item.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <span style={{ color: '#666' }}>x{item.quantity}</span>
                              <span style={{ fontWeight: 700 }}>Rs. {item.price * item.quantity}</span>
                            </div>
                          </div>
                        ))}

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                          {order.status === 'pending' && (
                            <button
                              onClick={() => handleStatusUpdate(key, 'preparing')}
                              style={{
                                padding: '0.5rem 1rem',
                                background: '#0ea5e9',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}
                            >
                              <MdRestaurant size={18} /> Start Preparing
                            </button>
                          )}

                          {order.status === 'preparing' && (
                            <button
                              onClick={() => handleStatusUpdate(key, 'ready')}
                              style={{
                                padding: '0.5rem 1rem',
                                background: '#16a34a',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}
                            >
                              <MdCheckCircle size={18} /> Mark Ready
                            </button>
                          )}

                          {order.status === 'ready' && (
                            <button
                              onClick={() => handleStatusUpdate(key, 'completed')}
                              style={{
                                padding: '0.5rem 1rem',
                                background: '#16a34a',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}
                            >
                              <MdCheckCircle size={18} /> Complete
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteOrder(key)}
                            disabled={!network.isOnline}
                            style={{
                              padding: '0.5rem 1rem',
                              background: !network.isOnline ? '#9ca3af' : '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontWeight: 600,
                              cursor: !network.isOnline ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              opacity: !network.isOnline ? 0.5 : 1
                            }}
                          >
                            <MdDelete size={18} /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default AdminDashboard;