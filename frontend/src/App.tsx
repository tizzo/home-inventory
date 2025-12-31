import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { HomePage, RoomsPage } from './pages';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

type Page = 'home' | 'rooms';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app">
        <nav className="navbar">
          <div className="nav-container">
            <h1 className="nav-brand" onClick={() => setCurrentPage('home')}>
              🏠 Home Inventory
            </h1>
            <ul className="nav-menu">
              <li>
                <button
                  className={currentPage === 'home' ? 'active' : ''}
                  onClick={() => setCurrentPage('home')}
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  className={currentPage === 'rooms' ? 'active' : ''}
                  onClick={() => setCurrentPage('rooms')}
                >
                  Rooms
                </button>
              </li>
            </ul>
          </div>
        </nav>

        <main className="main-content">
          {currentPage === 'home' && <HomePage />}
          {currentPage === 'rooms' && <RoomsPage />}
        </main>

        <footer className="footer">
          <p>
            Home Inventory System | Built with React + TypeScript + Rust
          </p>
        </footer>
      </div>
    </QueryClientProvider>
  );
}

export default App;
