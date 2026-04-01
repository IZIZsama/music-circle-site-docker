import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Calendar from './pages/Calendar';
import DayDetail from './pages/DayDetail';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import Ranking from './pages/Ranking';
import AdminBands from './pages/admin/Bands';
import AdminUsers from './pages/admin/Users';
import AdminGrant from './pages/admin/GrantAdmin';
import AdminCircleFees from './pages/admin/CircleFees';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">読み込み中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">読み込み中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Calendar />} />
        <Route path="day/:date" element={<DayDetail />} />
        <Route path="profile" element={<Profile />} />
        <Route path="user/:userId" element={<UserProfile />} />
        <Route path="ranking" element={<Ranking />} />
        <Route
          path="admin/bands"
          element={
            <AdminRoute>
              <AdminBands />
            </AdminRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          }
        />
        <Route
          path="admin/grant"
          element={
            <AdminRoute>
              <AdminGrant />
            </AdminRoute>
          }
        />
        <Route
          path="admin/circle-fees"
          element={
            <AdminRoute>
              <AdminCircleFees />
            </AdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
