import { useAuth } from '../hooks/useAuth';

export function LoginButton() {
    const { user, isLoading, logout } = useAuth();

    if (isLoading) {
        return <div className="auth-loading">...</div>;
    }

    if (user) {
        return (
            <div className="auth-user">
                <span className="user-name">{user.name}</span>
                <button onClick={() => logout()} className="btn-logout">
                    Logout
                </button>
            </div>
        );
    }

    return (
        <a href="/api/auth/login" className="btn-login-google">
            Login with Google
        </a>
    );

}
