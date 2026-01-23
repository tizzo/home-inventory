import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function LoginButton() {
    const { user, isLoading, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    if (isLoading) {
        return <div className="auth-loading">...</div>;
    }

    if (user) {
        const initials = user.name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

        return (
            <div className="user-menu-container" ref={dropdownRef}>
                <button
                    className="user-avatar-btn"
                    onClick={() => setIsOpen(!isOpen)}
                    title={user.name}
                >
                    {user.picture ? (
                        <img
                            src={user.picture}
                            alt={user.name}
                            className="user-avatar-img"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="user-avatar-placeholder">
                            {initials}
                        </div>
                    )}
                </button>

                {isOpen && (
                    <div className="user-dropdown">
                        <div className="user-dropdown-header">
                            <span className="dropdown-user-name">{user.name}</span>
                            <span className="dropdown-user-email">{user.email}</span>
                        </div>
                        <Link
                            to="/audit"
                            className="dropdown-item"
                            onClick={() => setIsOpen(false)}
                        >
                            Audit Logs
                        </Link>
                        <button
                            onClick={() => logout()}
                            className="dropdown-item logout"
                        >
                            Logout
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <a href="/api/auth/login" className="btn-login-google">
            <svg className="google-logo" width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <g fill="none" fillRule="evenodd">
                    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.96-2.18l-2.908-2.258c-.806.54-1.837.86-3.052.86-2.347 0-4.33-1.585-5.04-3.714H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                    <path d="M3.96 10.708c-.18-.54-.282-1.117-.282-1.708s.102-1.168.282-1.708V4.95H.957C.348 6.174 0 7.55 0 9s.348 2.826.957 4.05l3.003-2.342z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.95L3.96 7.292C4.67 5.163 6.653 3.58 9 3.58z" fill="#EA4335"/>
                </g>
            </svg>
            Sign in with Google
        </a>
    );
}
