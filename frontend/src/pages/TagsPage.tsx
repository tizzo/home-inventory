import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '../hooks';
import { Modal, Pagination } from '../components';
import { useToast } from '../context/ToastContext';
import type { CreateTagRequest, UpdateTagRequest } from '../types/generated';

export default function TagsPage() {
  const navigate = useNavigate();
  const { tagId } = useParams<{ tagId: string }>();
  const { showSuccess, showError } = useToast();
  const [pagination, setPagination] = useState({ limit: 100, offset: 0 });
  const { data: tagsResponse, isLoading, error } = useTags(pagination);
  const tags = tagsResponse?.data || [];
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateTagRequest>({
    name: '',
  });
  const [editFormData, setEditFormData] = useState<UpdateTagRequest>({
    name: '',
  });

  // Get the tag being edited from URL
  const editingTag = tags.find((t) => t.id === tagId);

  // Handle URL-based edit modal
  useEffect(() => {
    if (tagId && editingTag) {
      setEditFormData({
        name: editingTag.name,
      });
    }
  }, [tagId, editingTag]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTag.mutateAsync(createFormData);
      setCreateFormData({ name: '' });
      setShowCreateModal(false);
      showSuccess('Tag created successfully');
    } catch (err: any) {
      console.error('Failed to create tag:', err);
      const message = err?.response?.status === 409 
        ? 'A tag with this name already exists'
        : 'Failed to create tag. Please try again.';
      showError(message);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagId) return;

    try {
      await updateTag.mutateAsync({
        id: tagId,
        data: editFormData,
      });
      setEditFormData({ name: '' });
      navigate('/tags'); // Close modal by navigating back
      showSuccess('Tag updated successfully');
    } catch (err: any) {
      console.error('Failed to update tag:', err);
      const message = err?.response?.status === 409 
        ? 'A tag with this name already exists'
        : 'Failed to update tag. Please try again.';
      showError(message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the tag "${name}"? This will remove it from all entities.`)) {
      try {
        await deleteTag.mutateAsync(id);
        // If we're viewing/editing this tag, navigate back to list
        if (tagId === id) {
          navigate('/tags');
        }
        showSuccess('Tag deleted successfully');
      } catch (err) {
        console.error('Failed to delete tag:', err);
        showError('Failed to delete tag. Please try again.');
      }
    }
  };

  const openEditModal = (id: string) => {
    navigate(`/tags/${id}/edit`);
  };

  const closeEditModal = () => {
    navigate('/tags');
    setEditFormData({ name: '' });
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateFormData({ name: '' });
  };

  if (isLoading) return <div className="loading">Loading tags...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tags</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          Create Tag
        </button>
      </div>

      {tags.length === 0 ? (
        <div className="empty-state">
          <p>No tags found. Create your first tag to get started.</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => (
                  <tr key={tag.id}>
                    <td>
                      <span className="tag" style={{ fontSize: '1rem', padding: '0.25rem 0.5rem' }}>
                        {tag.name}
                      </span>
                    </td>
                    <td>{new Date(tag.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(tag.id)}
                        disabled={updateTag.isPending}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(tag.id, tag.name)}
                        disabled={deleteTag.isPending}
                        style={{ marginLeft: '0.5rem' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {tagsResponse && tagsResponse.total > 0 && (
            <Pagination
              total={tagsResponse.total}
              limit={tagsResponse.limit}
              offset={tagsResponse.offset}
              onPageChange={(newOffset) => setPagination({ ...pagination, offset: newOffset })}
            />
          )}
        </>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create Tag"
      >
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label htmlFor="create-name">Name *</label>
            <input
              id="create-name"
              type="text"
              value={createFormData.name}
              onChange={(e) => setCreateFormData({ name: e.target.value })}
              required
              maxLength={100}
              placeholder="e.g., electronics, kitchen, furniture"
            />
            <small>Tag names must be unique and up to 100 characters</small>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeCreateModal}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createTag.isPending}
            >
              {createTag.isPending ? 'Creating...' : 'Create Tag'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      {tagId && editingTag && (
        <Modal
          isOpen={!!tagId}
          onClose={closeEditModal}
          title="Edit Tag"
        >
          <form onSubmit={handleEdit}>
            <div className="form-group">
              <label htmlFor="edit-name">Name *</label>
              <input
                id="edit-name"
                type="text"
                value={editFormData.name || ''}
                onChange={(e) => setEditFormData({ name: e.target.value })}
                required
                maxLength={100}
              />
              <small>Tag names must be unique and up to 100 characters</small>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeEditModal}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={updateTag.isPending}
              >
                {updateTag.isPending ? 'Updating...' : 'Update Tag'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
