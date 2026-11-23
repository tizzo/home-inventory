import { Link } from 'react-router-dom';
import { useFloorPlans, useDeleteFloorPlan } from '../hooks';
import { useToast } from '../context/ToastContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function FloorPlansPage() {
  const { data: floorPlans, isLoading, error } = useFloorPlans();
  const deleteFloorPlan = useDeleteFloorPlan();
  const { showError, showSuccess } = useToast();

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Delete floor plan "${name}"? Its rooms will be unlinked and the positions of their shelving units removed. The rooms and units themselves are kept.`
    );
    if (!confirmed) return;

    try {
      await deleteFloorPlan.mutateAsync(id);
      showSuccess(`Deleted "${name}"`);
    } catch (err) {
      console.error('Failed to delete floor plan:', err);
      showError('Failed to delete floor plan. Please try again.');
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading floor plans...</div>;
  }
  if (error) {
    return <div className="text-center py-12 text-destructive">Error: {error.message}</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Floor Plans</h1>
        <Button asChild>
          <Link to="/floor-plans/new">Add Floor Plan</Link>
        </Button>
      </div>

      {floorPlans?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground space-y-2">
          <p>No floor plans yet.</p>
          <p className="text-sm">
            Upload an image of your floor plan, link your rooms to it, then mark where
            each shelving unit stands.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {floorPlans?.map((floorPlan) => (
            <Card key={floorPlan.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <Link
                  to={`/floor-plans/${floorPlan.id}`}
                  className="block aspect-video rounded-lg overflow-hidden mb-3 bg-muted hover:opacity-90 transition-opacity"
                >
                  <img
                    src={floorPlan.url}
                    alt={floorPlan.name}
                    loading="lazy"
                    className="w-full h-full object-contain"
                  />
                </Link>
                <h3 className="font-semibold text-lg truncate">
                  <Link to={`/floor-plans/${floorPlan.id}`} className="hover:underline">
                    {floorPlan.name}
                  </Link>
                </h3>
                {floorPlan.description && (
                  <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                    {floorPlan.description}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap pt-3 mt-3 border-t border-border">
                  <Button variant="secondary" size="sm" asChild>
                    <Link to={`/floor-plans/${floorPlan.id}`}>View</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/floor-plans/${floorPlan.id}/edit`}>Place Units</Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="ml-auto"
                    onClick={() => handleDelete(floorPlan.id, floorPlan.name)}
                    disabled={deleteFloorPlan.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
