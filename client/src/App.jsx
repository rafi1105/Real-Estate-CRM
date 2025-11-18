import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Property from './pages/Property';
import About from './pages/About';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PropertyManagement from './pages/PropertyManagement';
import TaskManager from './pages/TaskManager';
import Profile from './pages/Profile';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public routes - only Home is accessible without login */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" /> : <Register />} />
      <Route path="/admin-login" element={isAuthenticated ? <Navigate to="/" /> : <AdminLogin />} />

      {/* Protected routes - require authentication */}
      <Route 
        path="/property" 
        element={
          <ProtectedRoute>
            <Property />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/about" 
        element={
          <ProtectedRoute>
            <About />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/contact" 
        element={
          <ProtectedRoute>
            <Contact />
          </ProtectedRoute>
        } 
      />

      {/* Dashboard routes */}
      <Route 
        path="/dashboard/super-admin" 
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/admin" 
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/agent" 
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'admin', 'agent']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Property Management Routes */}
      <Route 
        path="/dashboard/properties" 
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <PropertyManagement />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/my-properties" 
        element={
          <ProtectedRoute allowedRoles={['agent']}>
            <PropertyManagement />
          </ProtectedRoute>
        } 
      />

      {/* Task Management Routes */}
      <Route 
        path="/dashboard/tasks" 
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'admin', 'agent']}>
            <TaskManager />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/my-tasks" 
        element={
          <ProtectedRoute allowedRoles={['agent']}>
            <TaskManager />
          </ProtectedRoute>
        } 
      />

      {/* Customer Management Routes */}
      <Route 
        path="/dashboard/customers" 
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/my-customers" 
        element={
          <ProtectedRoute allowedRoles={['agent']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Agent Management Routes */}
      <Route 
        path="/dashboard/agents" 
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Profile Route */}
      <Route 
        path="/dashboard/profile" 
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

export default App;
