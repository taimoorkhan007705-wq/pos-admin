import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAdminLoggedIn, logout } from '../services/auth';
import { useNetwork } from '../context/NetworkContext';
import {
  MdAdd,
  MdEdit,
  MdDelete,
  MdClose,
  MdSave,
  MdCloudUpload,
  MdDashboard,
  MdLogout
} from 'react-icons/md';

function ProductsManager() {
  const [products, setProducts] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const network = useNetwork();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    price: '',
    category: 'food',
    image: '',
    description: '',
    available: true
  });

  // Authentication check
  useEffect(() => {
    if (!isAdminLoggedIn()) {
      navigate('/login');
      return;
    }
    loadProducts();
  }, [navigate]);

  // Return null if not authenticated
  if (!isAdminLoggedIn()) {
    return null;
  }

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${network.serverUrl}/api/products`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
        console.log('✅ Loaded products:', data.length);
      }
    } catch (error) {
      console.error('❌ Load products error:', error);
      alert('Failed to load products: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle image upload
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setFormData(prev => ({ ...prev, image: base64String }));
        setImagePreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateProductId = () => {
    return 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    
    if (!formData.image) {
      alert('Please upload a product image');
      return;
    }

    setLoading(true);

    try {
      const productData = {
        ...formData,
        id: generateProductId(),
        price: parseFloat(formData.price)
      };

      const response = await fetch(`${network.serverUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });

      if (response.ok) {
        alert('✅ Product added successfully!');
        setShowAddForm(false);
        resetForm();
        loadProducts();
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || errorData.message || `Server error: ${response.status}`;
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('❌ Add product error:', error);
      console.error('Server URL:', network.serverUrl);
      console.error('Network status:', network.isOnline ? 'Online' : 'Offline');
      alert('Failed to add product: ' + error.message + '\n\nServer: ' + network.serverUrl);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price)
      };

      const response = await fetch(`${network.serverUrl}/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });

      if (response.ok) {
        alert('✅ Product updated successfully!');
        setEditingProduct(null);
        resetForm();
        loadProducts();
      } else {
        throw new Error('Failed to update product');
      }
    } catch (error) {
      console.error('❌ Update product error:', error);
      alert('Failed to update product: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    setLoading(true);
    try {
      const response = await fetch(`${network.serverUrl}/api/products/${productId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('✅ Product deleted!');
        loadProducts();
      } else {
        throw new Error('Failed to delete product');
      }
    } catch (error) {
      console.error('❌ Delete product error:', error);
      alert('Failed to delete product: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      id: product.id,
      name: product.name,
      price: product.price.toString(),
      category: product.category,
      image: product.image,
      description: product.description || '',
      available: product.available
    });
    setImagePreview(product.image);
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      price: '',
      category: 'food',
      image: '',
      description: '',
      available: true
    });
    setImagePreview(null);
    setEditingProduct(null);
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingProduct(null);
    resetForm();
  };

  const handleLogout = () => {
    if (window.confirm('Logout from admin panel?')) {
      logout();
      navigate('/login');
    }
  };

  const categories = [
    { value: 'food', label: 'Food' },
    { value: 'drinks', label: 'Drinks' },
    { value: 'desserts', label: 'Desserts' },
    { value: 'snacks', label: 'Snacks' }
  ];

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <MdDashboard size={32} style={{ color: '#6200ea' }} />
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Admin Panel</h1>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>Product Management</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '0.5rem 1.5rem',
              background: 'transparent',
              color: '#374151',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            📊 Orders
          </button>
          
          <button
            style={{
              padding: '0.5rem 1.5rem',
              background: '#6200ea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            📦 Products
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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

          {/* Logout */}
          <button
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
      <main className="app-main" style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Page Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem'
          }}>
            <div>
              <h1 style={{ 
                fontSize: '2rem', 
                fontWeight: 700,
                marginBottom: '0.5rem'
              }}>
                Products Management
              </h1>
              <p style={{ 
                fontSize: '0.875rem', 
                color: '#6b7280',
                margin: 0
              }}>
                Manage your menu items and availability
              </p>
            </div>
            
            {/* Single Launch Button */}
            <button
              onClick={() => setShowAddForm(true)}
              disabled={loading}
              style={{
                padding: '0.75rem 2rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                opacity: loading ? 0.5 : 1,
                boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.3s ease',
                transform: loading ? 'none' : 'translateY(0)',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(102, 126, 234, 0.3)';
                }
              }}
            >
              <MdAdd size={24} />
              🚀 Launch New Product
            </button>
          </div>

          {/* Add/Edit Form Modal */}
          {showAddForm && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h2>
                  <button
                    onClick={cancelForm}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.5rem'
                    }}
                  >
                    <MdClose size={24} />
                  </button>
                </div>

                <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct}>
                  {/* Image Upload */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: 600
                    }}>
                      Product Image *
                    </label>
                    
                    {/* Image Preview */}
                    {imagePreview ? (
                      <div style={{
                        position: 'relative',
                        marginBottom: '1rem'
                      }}>
                        <img
                          src={imagePreview}
                          alt="Preview"
                          style={{
                            width: '100%',
                            maxHeight: '300px',
                            objectFit: 'contain',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImagePreview(null);
                            setFormData(prev => ({ ...prev, image: '' }));
                          }}
                          style={{
                            position: 'absolute',
                            top: '0.5rem',
                            right: '0.5rem',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <MdClose size={20} />
                        </button>
                      </div>
                    ) : (
                      <label style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '3rem 2rem',
                        border: '2px dashed #d1d5db',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: '#f9fafb'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6200ea'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                      >
                        <MdCloudUpload size={48} style={{ color: '#6b7280', marginBottom: '1rem' }} />
                        <span style={{ fontWeight: 600, color: '#6200ea', marginBottom: '0.5rem' }}>
                          Click to upload image
                        </span>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          PNG, JPG, WEBP (Max 5MB)
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Product Name */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: 600
                    }}>
                      Product Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., Chicken Burger"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '1rem'
                      }}
                    />
                  </div>

                  {/* Price */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: 600
                    }}>
                      Price (Rs.) *
                    </label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      required
                      min="0"
                      step="0.01"
                      placeholder="e.g., 250"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '1rem'
                      }}
                    />
                  </div>

                  {/* Category */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: 600
                    }}>
                      Category *
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '1rem'
                      }}
                    >
                      {categories.map(cat => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: 600
                    }}>
                      Description (Optional)
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Brief description..."
                      rows="3"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  {/* Available Toggle */}
                  <div style={{
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <input
                      type="checkbox"
                      name="available"
                      checked={formData.available}
                      onChange={handleInputChange}
                      id="available"
                      style={{
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer'
                      }}
                    />
                    <label htmlFor="available" style={{
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}>
                      Available for sale
                    </label>
                  </div>

                  {/* Buttons */}
                  <div style={{
                    display: 'flex',
                    gap: '1rem',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      type="button"
                      onClick={cancelForm}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        opacity: loading ? 0.5 : 1
                      }}
                    >
                      <MdSave size={20} />
                      {loading ? 'Saving...' : (editingProduct ? 'Update Product' : 'Add Product')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Products Grid */}
          {loading && !showAddForm ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
              <p>Loading products...</p>
            </div>
          ) : products.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
              <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>No products yet</p>
              <p style={{ marginTop: '0.5rem' }}>Click "🚀 Launch New Product" to get started!</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1.5rem'
            }}>
              {products.map(product => (
                <div
                  key={product.id}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    border: product.available ? '1px solid #e5e7eb' : '1px solid #ef4444',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Product Image */}
                  <div style={{
                    width: '100%',
                    height: '200px',
                    background: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    <img
                      src={product.image}
                      alt={product.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<div style="font-size: 4rem">📦</div>';
                      }}
                    />
                  </div>

                  <div style={{ 
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1
                  }}>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      marginBottom: '0.5rem',
                      textAlign: 'center'
                    }}>
                      {product.name}
                    </h3>
                    
                    <div style={{
                      textAlign: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: '#6200ea',
                      marginBottom: '0.5rem'
                    }}>
                      Rs. {product.price}
                    </div>
                    
                    <div style={{
                      textAlign: 'center',
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      marginBottom: '0.5rem',
                      textTransform: 'capitalize'
                    }}>
                      {product.category}
                    </div>

                    <p style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      marginBottom: '1rem',
                      textAlign: 'center',
                      minHeight: '40px'
                    }}>
                      {product.description || ''}
                    </p>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1rem',
                      gap: '0.5rem'
                    }}>
                      <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: product.available ? '#10b981' : '#ef4444'
                      }}></div>
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: product.available ? '#10b981' : '#ef4444'
                      }}>
                        {product.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '0.5rem',
                      marginTop: 'auto'
                    }}>
                      <button
                        onClick={() => startEdit(product)}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: '#0ea5e9',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <MdEdit size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <MdDelete size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ProductsManager;