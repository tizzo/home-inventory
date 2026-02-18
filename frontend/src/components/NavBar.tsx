import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggleDropdown } from './ThemeToggle';

interface NavLink {
  to: string;
  label: string;
  requiresAuth?: boolean;
}

const navLinks: NavLink[] = [
  { to: '/', label: 'Home' },
  { to: '/rooms', label: 'Rooms', requiresAuth: true },
  { to: '/units', label: 'Units', requiresAuth: true },
  { to: '/shelves', label: 'Shelves', requiresAuth: true },
  { to: '/containers', label: 'Containers', requiresAuth: true },
  { to: '/items', label: 'Items', requiresAuth: true },
  { to: '/labels', label: 'Labels', requiresAuth: true },
  { to: '/tags', label: 'Tags', requiresAuth: true },
];

function NavLink({ to, label, isActive, onClick }: { to: string; label: string; isActive: boolean; onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      {label}
    </Link>
  );
}

function MobileNavLink({ to, label, isActive, onClick }: { to: string; label: string; isActive: boolean; onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`block px-4 py-3 text-base font-medium border-b border-border transition-colors ${
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-foreground hover:bg-accent'
      }`}
    >
      {label}
    </Link>
  );
}

function UserAvatar({ user }: { user: { name: string; picture?: string; email: string } }) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-colors">
      {user.picture ? (
        <img
          src={user.picture}
          alt={user.name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
          {initials}
        </div>
      )}
    </div>
  );
}

function GoogleLoginButton() {
  return (
    <a
      href="/api/auth/login"
      className="inline-flex items-center gap-3 bg-white text-gray-700 px-4 py-2 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
    >
      <svg className="w-4 h-4" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" fillRule="evenodd">
          <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.96-2.18l-2.908-2.258c-.806.54-1.837.86-3.052.86-2.347 0-4.33-1.585-5.04-3.714H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
          <path d="M3.96 10.708c-.18-.54-.282-1.117-.282-1.708s.102-1.168.282-1.708V4.95H.957C.348 6.174 0 7.55 0 9s.348 2.826.957 4.05l3.003-2.342z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.95L3.96 7.292C4.67 5.163 6.653 3.58 9 3.58z" fill="#EA4335"/>
        </g>
      </svg>
      Sign in
    </a>
  );
}

export function NavBar() {
  const location = useLocation();
  const { user, isLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const filteredLinks = navLinks.filter(
    (link) => !link.requiresAuth || user
  );

  return (
    <nav className="bg-background border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Brand */}
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold text-primary hover:opacity-80 transition-opacity"
          >
            <img src="/api/logo.svg" alt="" className="h-7 w-auto" />
            <span className="leading-none">Home Inventory</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {filteredLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                label={link.label}
                isActive={isActive(link.to)}
              />
            ))}
            {user && (
              <NavLink
                to="/scan"
                label="Scan"
                isActive={isActive('/scan')}
              />
            )}
          </div>

          {/* Desktop Auth & Theme */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggleDropdown />
            {isLoading ? (
              <span className="text-sm text-muted-foreground">...</span>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="cursor-pointer">
                    <UserAvatar user={user} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2">
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/audit" className="cursor-pointer">
                      Audit Logs
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logout()}
                    className="text-destructive cursor-pointer"
                  >
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <GoogleLoginButton />
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggleDropdown />
            {!isLoading && !user && <GoogleLoginButton />}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
                    />
                  </svg>
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="p-4 border-b border-border">
                  <SheetTitle className="text-left">Home Inventory</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col">
                  {/* User info at top if logged in */}
                  {user && (
                    <div className="p-4 border-b border-border bg-muted/50">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={user} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation Links */}
                  <div className="flex-1">
                    {filteredLinks.map((link) => (
                      <MobileNavLink
                        key={link.to}
                        to={link.to}
                        label={link.label}
                        isActive={isActive(link.to)}
                        onClick={() => setMobileMenuOpen(false)}
                      />
                    ))}
                    {user && (
                      <MobileNavLink
                        to="/scan"
                        label="Scan QR Code"
                        isActive={isActive('/scan')}
                        onClick={() => setMobileMenuOpen(false)}
                      />
                    )}
                    {user && (
                      <MobileNavLink
                        to="/audit"
                        label="Audit Logs"
                        isActive={isActive('/audit')}
                        onClick={() => setMobileMenuOpen(false)}
                      />
                    )}
                  </div>

                  {/* Logout button at bottom */}
                  {user && (
                    <div className="p-4 border-t border-border mt-auto">
                      <Button
                        variant="outline"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          logout();
                          setMobileMenuOpen(false);
                        }}
                      >
                        Logout
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
