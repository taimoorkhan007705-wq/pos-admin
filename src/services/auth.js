// Authentication Service
const ADMIN_PASSWORD = 'admin123'; // Change this to your password

// Check if admin is logged in
export const isAdminLoggedIn = () => {
  const adminSession = localStorage.getItem('adminSession');
  if (!adminSession) return false;
  
  const session = JSON.parse(adminSession);
  const now = Date.now();
  
  // Session expires after 8 hours
  if (now - session.timestamp > 8 * 60 * 60 * 1000) {
    logout();
    return false;
  }
  
  return true;
};

// Admin login
export const loginAdmin = (password) => {
  if (password === ADMIN_PASSWORD) {
    const session = {
      isAdmin: true,
      timestamp: Date.now()
    };
    localStorage.setItem('adminSession', JSON.stringify(session));
    return { success: true };
  }
  return { success: false, error: 'Invalid password' };
};

// Logout
export const logout = () => {
  localStorage.removeItem('adminSession');
};

// Get current role
export const getCurrentRole = () => {
  return isAdminLoggedIn() ? 'admin' : 'user';
};

export default {
  isAdminLoggedIn,
  loginAdmin,
  logout,
  getCurrentRole
};