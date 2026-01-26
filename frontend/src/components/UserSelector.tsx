import { useState, useEffect, useRef, useMemo } from 'react';
import type { User } from '../types/generated';

interface UserSelectorProps {
  value?: string;
  onChange: (userId: string | undefined) => void;
  required?: boolean;
  placeholder?: string;
  label?: string;
  fetchUsers: (search?: string) => Promise<User[]>;
}

// Simple fuzzy match function
const fuzzyMatch = (text: string, query: string): boolean => {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match
  if (lowerText.includes(lowerQuery)) return true;

  // Fuzzy match: check if all query characters appear in order
  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === lowerQuery.length;
};

export default function UserSelector({
  value,
  onChange,
  required = false,
  placeholder = 'Select a user...',
  label = 'User',
  fetchUsers,
}: UserSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch users on mount and when search query changes
  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const fetchedUsers = await fetchUsers(searchQuery || undefined);
        setUsers(fetchedUsers);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [searchQuery, fetchUsers]);

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    return users.filter(user =>
      fuzzyMatch(user.name, searchQuery) ||
      fuzzyMatch(user.email, searchQuery)
    );
  }, [users, searchQuery]);

  // Get selected user
  const selectedUser = users.find(u => u.id === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (userId: string) => {
    onChange(userId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    onChange(undefined);
    setSearchQuery('');
  };

  return (
    <div className="mb-4" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Display selected user or input */}
        {selectedUser ? (
          <div className="flex items-center justify-between bg-white border border-gray-300 rounded-md px-3 py-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">{selectedUser.name}</span>
              <span className="text-xs text-gray-500">{selectedUser.email}</span>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {/* Dropdown */}
        {isOpen && !selectedUser && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No users found</div>
            ) : (
              filteredUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelect(user.id)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">{user.name}</span>
                    <span className="text-xs text-gray-500">{user.email}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
