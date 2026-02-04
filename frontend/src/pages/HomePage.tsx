import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <div className="text-center py-8 mb-8">
        <h1 className="text-3xl font-bold mb-4">Home Inventory System</h1>
        <p className="text-lg text-muted-foreground">
          Organize your home with QR codes, barcodes, and hierarchical storage
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-2">Hierarchical Organization</h2>
            <p className="text-muted-foreground text-sm">
              Organize from Room → Shelving Unit → Shelf → Container → Item
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-2">QR Code Labels</h2>
            <p className="text-muted-foreground text-sm">
              Print and assign generic numbered labels to track everything
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-2">Barcode Scanning</h2>
            <p className="text-muted-foreground text-sm">
              Scan product barcodes to auto-populate item details
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-2">Search & Tags</h2>
            <p className="text-muted-foreground text-sm">
              Full-text search across all items with flexible tagging
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-2">Photo Management</h2>
            <p className="text-muted-foreground text-sm">
              Attach photos to any entity for visual reference
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-2">Audit Trail</h2>
            <p className="text-muted-foreground text-sm">
              Complete history of all changes with timestamps
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/rooms">Manage Rooms</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/scan">Scan QR Code</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/search">Search Items</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
