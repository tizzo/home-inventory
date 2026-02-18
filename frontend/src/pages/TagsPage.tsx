import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '../hooks';
import { Modal, Pagination } from '../components';
import { useToast } from '../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    } catch (err: unknown) {
      console.error('Failed to create tag:', err);
      const message = (err as { response?: { status?: number } })?.response?.status === 409
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
    } catch (err: unknown) {
      console.error('Failed to update tag:', err);
      const message = (err as { response?: { status?: number } })?.response?.status === 409
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

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading tags...</div>;
  if (error) return <div className="text-destructive">Error: {error.message}</div>;

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Tags</h1>
        <Button onClick={openCreateModal}>
          Create Tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No tags found. Create your first tag to get started.
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium">Name</th>
                    <th className="text-left py-3 px-2 font-medium">Created</th>
                    <th className="text-left py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((tag) => (
                    <tr key={tag.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm">
                          {tag.name}
                        </span>
                      </td>
                      <td className="py-3 px-2">{new Date(tag.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(tag.id)}
                            disabled={updateTag.isPending}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(tag.id, tag.name)}
                            disabled={deleteTag.isPending}
                          >
                            Delete
                          </Button>
                        </div>
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
          </CardContent>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Create Tag"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">Name *</Label>
            <Input
              id="create-name"
              type="text"
              value={createFormData.name}
              onChange={(e) => setCreateFormData({ name: e.target.value })}
              required
              maxLength={100}
              placeholder="e.g., electronics, kitchen, furniture"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Tag names must be unique and up to 100 characters</p>
          </div>
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="submit"
              disabled={createTag.isPending}
              className="flex-1"
            >
              {createTag.isPending ? 'Creating...' : 'Create Tag'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={closeCreateModal}
              className="flex-1"
            >
              Cancel
            </Button>
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
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                type="text"
                value={editFormData.name || ''}
                onChange={(e) => setEditFormData({ name: e.target.value })}
                required
                maxLength={100}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Tag names must be unique and up to 100 characters</p>
            </div>
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button
                type="submit"
                disabled={updateTag.isPending}
                className="flex-1"
              >
                {updateTag.isPending ? 'Updating...' : 'Update Tag'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={closeEditModal}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
