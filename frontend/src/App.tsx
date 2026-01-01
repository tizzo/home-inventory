import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  HomePage,
  RoomsPage,
  ShelvesPage,
  ContainersPage,
  LabelsPage,
} from './pages';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function NavBar() {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-brand">
          🏠 Home Inventory
        </Link>
        <ul className="nav-menu">
          <li>
            <Link
              to="/"
              className={location.pathname === '/' ? 'active' : ''}
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              to="/rooms"
              className={location.pathname.startsWith('/rooms') ? 'active' : ''}
            >
              Rooms
            </Link>
          </li>
          <li>
            <Link
              to="/labels"
              className={location.pathname.startsWith('/labels') ? 'active' : ''}
            >
              Labels
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="app">
          <NavBar />

          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/rooms/:roomId/edit" element={<RoomsPage />} />
              <Route path="/shelves" element={<ShelvesPage />} />
              <Route path="/shelves/:shelfId/edit" element={<ShelvesPage />} />
              <Route path="/units/:unitId/shelves" element={<ShelvesPage />} />
              <Route
                path="/units/:unitId/shelves/:shelfId/edit"
                element={<ShelvesPage />}
              />
              <Route path="/containers" element={<ContainersPage />} />
              <Route
                path="/containers/:containerId/edit"
                element={<ContainersPage />}
              />
              <Route
                path="/shelves/:shelfId/containers"
                element={<ContainersPage />}
              />
              <Route
                path="/shelves/:shelfId/containers/:containerId/edit"
                element={<ContainersPage />}
              />
              <Route
                path="/containers/:parentId/children"
                element={<ContainersPage />}
              />
              <Route
                path="/containers/:parentId/children/:containerId/edit"
                element={<ContainersPage />}
              />
              <Route path="/labels" element={<LabelsPage />} />
            </Routes>
          </main>

          <footer className="footer">
            <p>
              Home Inventory System | Built with React + TypeScript + Rust
            </p>
          </footer>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
