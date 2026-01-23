import { useState, useEffect, useRef, useMemo } from 'react';
import { useTags } from '../hooks';
import type { TagResponse } from '../types/generated';

interface TagSelectorProps {
  value: string[]; // Array of tag IDs
  onChange: (tagIds: string[]) => void;
  placeholder?: string;
  label?: string;
  allowCreate?: boolean;
  onCreateTag?: (name: string) => Promise<TagResponse>;
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

export default function TagSelector({
  value = [],
  onChange,
  placeholder = 'Select tags...',
  label,
  allowCreate = false,
  onCreateTag,
}: TagSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch all tags
  const { data: tagsResponse } = useTags({ limit: 1000 });
  const allTags = tagsResponse?.data || [];

  // Get selected tags
  const selectedTags = useMemo(() => {
    return allTags.filter((tag) => value.includes(tag.id));
  }, [allTags, value]);

  // Filter tags based on search query
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) {
      return allTags;
    }
    return allTags.filter((tag) => fuzzyMatch(tag.name, searchQuery));
  }, [allTags, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const toggleTag = (tagId: string) => {
    if (value.includes(tagId)) {
      onChange(value.filter((id) => id !== tagId));
    } else {
      onChange([...value, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !onCreateTag) return;

    setIsCreating(true);
    try {
      const newTag = await onCreateTag(newTagName.trim());
      onChange([...value, newTag.id]);
      setNewTagName('');
      setSearchQuery('');
    } catch (err) {
      console.error('Failed to create tag:', err);
      alert('Failed to create tag. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const removeTag = (tagId: string) => {
    onChange(value.filter((id) => id !== tagId));
  };

  return (
    <div className="form-group" ref={containerRef}>
      {label && <label>{label}</label>}
      <div className="tag-selector">
        {/* Selected tags display */}
        <div className="tag-selector-input" onClick={() => setIsOpen(!isOpen)}>
          {selectedTags.length === 0 ? (
            <span className="tag-selector-placeholder">{placeholder}</span>
          ) : (
            <div className="tag-selector-selected">
              {selectedTags.map((tag) => (
                <span
                  key={tag.id}
                  className="tag tag-selector-tag"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag.id);
                  }}
                >
                  {tag.name}
                  <span className="tag-remove">×</span>
                </span>
              ))}
            </div>
          )}
          <span className="tag-selector-arrow">▼</span>
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="tag-selector-dropdown">
            {/* Search input */}
            <div className="tag-selector-search">
              <input
                type="text"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            {/* Create new tag option */}
            {allowCreate && onCreateTag && searchQuery.trim() && (
              <div className="tag-selector-create">
                <input
                  type="text"
                  placeholder={`Create "${searchQuery}"`}
                  value={newTagName || searchQuery}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateTag();
                    }
                  }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleCreateTag}
                  disabled={isCreating || !newTagName.trim()}
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            )}

            {/* Tag list */}
            <div className="tag-selector-list">
              {filteredTags.length === 0 ? (
                <div className="tag-selector-empty">
                  {searchQuery ? 'No tags found' : 'No tags available'}
                </div>
              ) : (
                filteredTags.map((tag) => (
                  <div
                    key={tag.id}
                    className={`tag-selector-option ${
                      value.includes(tag.id) ? 'selected' : ''
                    }`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    <input
                      type="checkbox"
                      checked={value.includes(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                    />
                    <span>{tag.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
