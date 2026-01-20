import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import ProductsManager from './components/productManager';
import { initDB } from './services/db';
import { isAdminLoggedIn } from './services/auth';
import { NetworkProvider } from './context/NetworkContext';
import './App.css';

function ProtectedRoute({ children }) {
  return isAdminLoggedIn() ? children : <Navigate to="/login" />;
}

function App() {
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 Starting Admin App...');
      
      await initDB();
      console.log('✅ Database initialized');

    } catch (error) {
      console.error('❌ Init error:', error);
    }
  };

  return (
    <NetworkProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/products" 
            element={
              <ProtectedRoute>
                <ProductsManager />
              </ProtectedRoute>
            } 
          />
          
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </NetworkProvider>
  );
}

export default App;