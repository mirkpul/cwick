import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import OAuthCallback from './pages/OAuthCallback';
import OnboardingWizard from './pages/OnboardingWizard';
import ProfessionalDashboard from './pages/ProfessionalDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Chat from './pages/Chat';
import EmailOAuthCallback from './pages/EmailOAuthCallback';
import BenchmarkDashboard from './pages/Benchmark/BenchmarkDashboard';

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/onboarding" /> : <Register />} />
      <Route path="/oauth/callback" element={<OAuthCallback />} />

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute allowedRoles={['professional']}>
            <OnboardingWizard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['professional']}>
            <ProfessionalDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/benchmark"
        element={
          <ProtectedRoute allowedRoles={['professional', 'super_admin']}>
            <BenchmarkDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="/chat/:twinId" element={<Chat />} />

      <Route path="/auth/email/callback" element={<EmailOAuthCallback />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppRoutes />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
                padding: '16px',
                fontSize: '15px',
                borderRadius: '8px',
                maxWidth: '500px',
                fontWeight: '500',
              },
              success: {
                duration: 4000,
                style: {
                  background: '#10b981',
                },
                iconTheme: {
                  primary: '#fff',
                  secondary: '#10b981',
                },
              },
              error: {
                duration: 300000, // 5 minuti - praticamente non scompare
                style: {
                  background: '#ef4444',
                  color: '#fff',
                  minWidth: '400px',
                  fontWeight: '600',
                  boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.3), 0 4px 6px -2px rgba(239, 68, 68, 0.15)',
                },
                iconTheme: {
                  primary: '#fff',
                  secondary: '#ef4444',
                },
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
