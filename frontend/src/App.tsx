import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import {
  HomePage,
  RoomsPage,
  ShelvingUnitsPage,
  ShelvesPage,
  ContainersPage,
  ItemsPage,
  LabelsPage,
  BatchDetailPage,
  AuditLogPage,
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
              to="/units"
              className={location.pathname.startsWith('/units') ? 'active' : ''}
            >
              Units
            </Link>
          </li>
          <li>
            <Link
              to="/shelves"
              className={location.pathname.startsWith('/shelves') ? 'active' : ''}
            >
              Shelves
            </Link>
          </li>
          <li>
            <Link
              to="/containers"
              className={location.pathname.startsWith('/containers') ? 'active' : ''}
            >
              Containers
            </Link>
          </li>
          <li>
            <Link
              to="/items"
              className={location.pathname.startsWith('/items') ? 'active' : ''}
            >
              Items
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
          <li>
            <Link
              to="/audit"
              className={location.pathname.startsWith('/audit') ? 'active' : ''}
            >
              Audit Logs
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
      <ToastProvider>
        <BrowserRouter>
          <div className="app">
            <NavBar />

            <main className="main-content">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/rooms" element={<RoomsPage />} />
                <Route path="/rooms/:roomId/edit" element={<RoomsPage />} />
                <Route path="/units" element={<ShelvingUnitsPage />} />
                <Route path="/units/:unitId/edit" element={<ShelvingUnitsPage />} />
                <Route path="/rooms/:roomId/units" element={<ShelvingUnitsPage />} />
                <Route
                  path="/rooms/:roomId/units/:unitId/edit"
                  element={<ShelvingUnitsPage />}
                />
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
                <Route path="/items" element={<ItemsPage />} />
                <Route path="/items/:itemId/edit" element={<ItemsPage />} />
                <Route path="/shelves/:shelfId/items" element={<ItemsPage />} />
                <Route
                  path="/shelves/:shelfId/items/:itemId/edit"
                  element={<ItemsPage />}
                />
                <Route
                  path="/containers/:containerId/items"
                  element={<ItemsPage />}
                />
                <Route
                  path="/containers/:containerId/items/:itemId/edit"
                  element={<ItemsPage />}
                />
                <Route path="/labels" element={<LabelsPage />} />
                <Route path="/labels/batches/:batchId" element={<BatchDetailPage />} />
                <Route path="/audit" element={<AuditLogPage />} />
              </Routes>
            </main>

            <footer className="footer">
              <p>
                Home Inventory System | Built with React + TypeScript + Rust
              </p>
            </footer>
          </div>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
