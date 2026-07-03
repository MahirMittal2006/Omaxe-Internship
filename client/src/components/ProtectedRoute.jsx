import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowRoles }) {
  const { isAuthenticated, isBootstrapping, user } = useAuth();

  if (isBootstrapping) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowRoles && !allowRoles.includes(user?.role)) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/chat'} replace />;
  }

  return children;
}
