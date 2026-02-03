import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFloorPlans, useDeleteFloorPlan } from '../hooks/useFloorPlans';
import { FloorPlanUpload } from '../components/FloorPlanUpload';
import '../App.css';

export function FloorPlansPage() {
  const navigate = useNavigate();
  const { data: floorPlans, isLoading, error } = useFloorPlans();
  const deleteFloorPlan = useDeleteFloorPlan();

  const [showUpload, setShowUpload] = useState(false);

  const handleDelete = async (id: string, name: string) => {
    if (
      confirm(
        `Delete floor plan "${name}"? This will also remove all unit positions on this floor plan.`
      )
    ) {
      try {
        await deleteFloorPlan.mutateAsync(id);
      } catch (err) {
        console.error('Failed to delete floor plan:', err);
        alert('Failed to delete floor plan');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="loading">Loading floor plans...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="error">Failed to load floor plans</div>
      </div>
    );
  }

  if (showUpload) {
    return (
      <div className="page-container">
        <FloorPlanUpload
          onUploadComplete={(id) => {
            setShowUpload(false);
            navigate(`/floor-plans/${id}`);
          }}
          onCancel={() => setShowUpload(false)}
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Floor Plans</h1>
        <button onClick={() => setShowUpload(true)} className="btn btn-primary">
          Add Floor Plan
        </button>
      </div>

      {floorPlans?.length === 0 ? (
        <div className="empty-state">
          <h2>No Floor Plans Yet</h2>
          <p>
            Upload a floor plan image to start placing your shelving units on a
            visual map.
          </p>
          <p className="hint">
            Export your floor plan from MagicPlan or Polycam as a PNG or JPG
            image.
          </p>
          <button onClick={() => setShowUpload(true)} className="btn btn-primary">
            Upload Your First Floor Plan
          </button>
        </div>
      ) : (
        <div className="floor-plans-grid">
          {floorPlans?.map((fp) => (
            <div key={fp.id} className="floor-plan-card">
              <div
                className="floor-plan-thumbnail"
                onClick={() => navigate(`/floor-plans/${fp.id}`)}
              >
                <img
                  src={fp.thumbnail_url || fp.url}
                  alt={fp.name}
                  loading="lazy"
                />
              </div>
              <div className="floor-plan-card-content">
                <h3
                  className="floor-plan-name"
                  onClick={() => navigate(`/floor-plans/${fp.id}`)}
                >
                  {fp.name}
                </h3>
                {fp.description && (
                  <p className="floor-plan-description">{fp.description}</p>
                )}
                <div className="floor-plan-meta">
                  <span>
                    {fp.width} x {fp.height} px
                  </span>
                </div>
                <div className="floor-plan-actions">
                  <button
                    onClick={() => navigate(`/floor-plans/${fp.id}`)}
                    className="btn btn-sm btn-secondary"
                  >
                    View
                  </button>
                  <button
                    onClick={() => navigate(`/floor-plans/${fp.id}/edit`)}
                    className="btn btn-sm btn-primary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(fp.id, fp.name)}
                    className="btn btn-sm btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
