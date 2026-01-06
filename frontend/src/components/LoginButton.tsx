import { useState, useRef, useEffect } from 'react';
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
                        {/* Add more menu items here if needed, e.g. Settings */}
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
            Login with Google
        </a>
    );
}
