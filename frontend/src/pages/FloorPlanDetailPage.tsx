import { useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useFloorPlan, useUpdateFloorPlan } from '../hooks/useFloorPlans';
import { FloorPlanViewer } from '../components/FloorPlanViewer';
import { FloorPlanSearch } from '../components/FloorPlanSearch';
import '../App.css';

export function FloorPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = location.pathname.endsWith('/edit');

  const { data, isLoading, error } = useFloorPlan(id);
  const updateFloorPlan = useUpdateFloorPlan();

  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleNameEdit = async () => {
    if (!id || !editedName.trim()) return;

    try {
      await updateFloorPlan.mutateAsync({
        id,
        data: { name: editedName.trim() },
      });
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update name:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="loading">Loading floor plan...</div>
      </div>
    );
  }

  if (error || !data || !id) {
    return (
      <div className="page-container">
        <div className="error">Failed to load floor plan</div>
        <button onClick={() => navigate('/floor-plans')} className="btn btn-secondary">
          Back to Floor Plans
        </button>
      </div>
    );
  }

  const { floor_plan, positions, linked_rooms } = data;

  return (
    <div className="page-container floor-plan-detail-page">
      {/* Header */}
      <div className="page-header">
        <div className="breadcrumb">
          <button onClick={() => navigate('/floor-plans')} className="breadcrumb-link">
            Floor Plans
          </button>
          <span className="breadcrumb-separator">/</span>
          {isEditingName ? (
            <div className="inline-edit">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameEdit();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                autoFocus
              />
              <button onClick={handleNameEdit} className="btn btn-sm btn-primary">
                Save
              </button>
              <button
                onClick={() => setIsEditingName(false)}
                className="btn btn-sm btn-secondary"
              >
                Cancel
              </button>
            </div>
          ) : (
            <h1
              onClick={() => {
                setEditedName(floor_plan.name);
                setIsEditingName(true);
              }}
              style={{ cursor: 'pointer' }}
              title="Click to edit"
            >
              {floor_plan.name}
            </h1>
          )}
        </div>

        <div className="header-actions">
          {!isEditMode && (
            <FloorPlanSearch
              positions={positions}
              onSearchChange={handleSearchChange}
              onSelectPosition={(pos) => {
                // Scroll to the position or highlight it
                setSearchQuery(pos.shelving_unit_name);
              }}
            />
          )}

          {isEditMode ? (
            <button
              onClick={() => navigate(`/floor-plans/${id}`)}
              className="btn btn-secondary"
            >
              Done Editing
            </button>
          ) : (
            <button
              onClick={() => navigate(`/floor-plans/${id}/edit`)}
              className="btn btn-primary"
            >
              Edit Placements
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="floor-plan-stats">
        <div className="stat">
          <span className="stat-value">{linked_rooms.length}</span>
          <span className="stat-label">Linked Rooms</span>
        </div>
        <div className="stat">
          <span className="stat-value">{positions.length}</span>
          <span className="stat-label">Placed Units</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {linked_rooms.reduce((sum, r) => sum + r.shelving_unit_count, 0) -
              positions.length}
          </span>
          <span className="stat-label">Unplaced Units</span>
        </div>
      </div>

      {/* Main viewer */}
      <FloorPlanViewer
        floorPlanId={id}
        editMode={isEditMode}
        searchQuery={searchQuery}
      />

      {/* Linked rooms list (collapsed by default in view mode) */}
      {!isEditMode && linked_rooms.length > 0 && (
        <div className="linked-rooms-section">
          <h3>Linked Rooms</h3>
          <div className="linked-rooms-list">
            {linked_rooms.map((room) => (
              <div
                key={room.id}
                className="linked-room-item"
                onClick={() => navigate(`/rooms/${room.id}`)}
              >
                <span className="room-name">{room.name}</span>
                <span className="unit-count">
                  {room.shelving_unit_count} units
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
