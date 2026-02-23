import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import {
  HomePage,
  RoomsPage,
  ShelvingUnitsPage,
  ShelvesPage,
  ContainersPage,
  ContainerContentsPage,
  ItemsPage,
  ItemViewPage,
  LabelsPage,
  BatchDetailPage,
  LabelDetailPage,
  TagsPage,
  AuditLogPage,
  QRScanPage,
  ItemImportDraftPage,
  ContactPage,
  AllowedEmailsPage,
} from './pages';
import { NavBar } from './components/NavBar';
import { ProtectedRoute } from './components/ProtectedRoute';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});


function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-background">
            <NavBar />

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <Routes>
                <Route path="/" element={<HomePage />} />

                {/* Public Routes */}
                <Route path="/items/:itemId/view" element={<ItemViewPage />} />
                <Route path="/contact" element={<ContactPage />} />

                {/* Protected Routes */}
                <Route element={<ProtectedRoute />}>
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
                    path="/containers/:containerId/children"
                    element={<ContainerContentsPage />}
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
                  <Route
                    path="/rooms/:roomId/containers"
                    element={<ContainersPage />}
                  />
                  <Route
                    path="/rooms/:roomId/containers/:containerId/edit"
                    element={<ContainersPage />}
                  />
                  <Route
                    path="/rooms/:roomId/items"
                    element={<ItemsPage />}
                  />
                  <Route
                    path="/rooms/:roomId/items/:itemId/edit"
                    element={<ItemsPage />}
                  />
                  <Route path="/labels" element={<LabelsPage />} />
                  <Route path="/labels/batches/:batchId" element={<BatchDetailPage />} />
                  <Route path="/l/:labelId" element={<LabelDetailPage />} />
                  <Route path="/labels/:labelId" element={<LabelDetailPage />} />
                  <Route path="/tags" element={<TagsPage />} />
                  <Route path="/tags/:tagId/edit" element={<TagsPage />} />
                  <Route path="/audit" element={<AuditLogPage />} />
                  <Route path="/scan" element={<QRScanPage />} />
                  <Route path="/drafts/:draftId" element={<ItemImportDraftPage />} />
                  <Route path="/allowed-emails" element={<AllowedEmailsPage />} />
                </Route>
              </Routes>
            </main>

            <footer className="hidden sm:block bg-background border-t border-border py-6 mt-8 text-center text-muted-foreground">
              <p>
                Home Inventory System | Built with React + TypeScript + Rust
              </p>
            </footer>
          </div>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
