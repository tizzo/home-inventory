import { Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return <div className="loading">Loading...</div>;
    }

    if (!user) {
        return (
            <div className="empty-state">
                <h2>Access Denied</h2>
                <p>You must be signed in to view this page.</p>
                <div style={{ marginTop: '1rem' }}>
                    {/* The LoginButton component will handle the actual login link/button style from the navbar, 
                       but here we can just prompt or duplicate it. For now, simply blocking access. */}
                    <p>Please click "Login with Google" in the top right.</p>
                </div>
            </div>
        );
    }

    return <Outlet />;
}
