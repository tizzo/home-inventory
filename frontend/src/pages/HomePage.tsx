export default function HomePage() {
  return (
    <div className="page">
      <div className="hero">
        <h1>🏠 Home Inventory System</h1>
        <p className="subtitle">
          Organize your home with QR codes, barcodes, and hierarchical storage
        </p>
      </div>

      <div className="features">
        <div className="feature-card">
          <h2>📦 Hierarchical Organization</h2>
          <p>
            Organize from Room → Shelving Unit → Shelf → Container → Item
          </p>
        </div>

        <div className="feature-card">
          <h2>🏷️ QR Code Labels</h2>
          <p>
            Print and assign generic numbered labels to track everything
          </p>
        </div>

        <div className="feature-card">
          <h2>📱 Barcode Scanning</h2>
          <p>Scan product barcodes to auto-populate item details</p>
        </div>

        <div className="feature-card">
          <h2>🔍 Search & Tags</h2>
          <p>Full-text search across all items with flexible tagging</p>
        </div>

        <div className="feature-card">
          <h2>📸 Photo Management</h2>
          <p>Attach photos to any entity for visual reference</p>
        </div>

        <div className="feature-card">
          <h2>📝 Audit Trail</h2>
          <p>Complete history of all changes with timestamps</p>
        </div>
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions">
          <a href="/rooms" className="btn btn-primary">
            Manage Rooms
          </a>
          <a href="/scan" className="btn btn-secondary">
            Scan QR Code
          </a>
          <a href="/search" className="btn btn-secondary">
            Search Items
          </a>
        </div>
      </div>
    </div>
  );
}
