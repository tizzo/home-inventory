# Label PDF Generation Flow

## End-to-End Process

### 1. User Clicks "Generate Labels" Button

**Frontend (`LabelsPage.tsx`):**
- User fills out form with:
  - Number of labels (default: 30, matching Avery 18660 template)
  - Template selection (currently only "avery_18660")
- Clicks "Generate Labels" button
- `handleGenerate` function is called

### 2. Generate Labels API Call

**Frontend → Backend:**
- POST request to `/api/labels/generate`
- Payload: `{ count: 30, template: "avery_18660" }`

**Backend (`routes/labels.rs` - `generate_labels`):**
1. Validates count (1-1000)
2. Generates a unique `batch_id` (UUID)
3. Queries database for max label number: `SELECT COALESCE(MAX(number), 0) FROM labels`
4. Creates labels in a loop:
   - Generates UUID for each label
   - Assigns sequential number (starting from max + 1)
   - Creates QR data URL: `{app_base_url}/l/{label_id}`
   - **Stores label metadata in database** (NOT the PDF)
   - Each label record contains: `id`, `number`, `qr_data`, `batch_id`, `created_at`
5. Returns response with `batch_id` and list of created labels

**State Storage:**
- ✅ **Labels metadata stored in PostgreSQL database** (persistent, survives restarts)
- ❌ **NO PDF stored anywhere** - PDFs are generated on-demand
- ❌ **NO server-side state** - each request is stateless

### 3. Automatic PDF Download

**Frontend (`LabelsPage.tsx`):**
- After successful generation, automatically calls `handleDownloadPdf(batch_id)`
- No alert shown (removed)
- PDF opens immediately in browser

### 4. PDF Generation (On-Demand)

**Frontend → Backend:**
- GET request to `/api/labels/print/{batchId}?template=avery_18660`

**Backend (`routes/labels.rs` - `print_labels`):**
1. **Queries database** for all labels with matching `batch_id`
   - `SELECT * FROM labels WHERE batch_id = $1 ORDER BY number ASC`
2. **Generates PDF in memory** (no file storage):
   - Calls `generate_label_pdf(&label_data)` from `services/qr_pdf.rs`
   - PDF is created entirely in RAM as `Vec<u8>`
3. **Returns PDF as HTTP response**:
   - Content-Type: `application/pdf`
   - Content-Disposition: `inline; filename="labels-{batchId}.pdf"`
   - Body: PDF bytes

**PDF Generation Details (`services/qr_pdf.rs`):**
- Creates PDF document using `printpdf` crate
- For each label:
  - Generates QR code image (300x300 pixels) from `qr_data` string
  - Positions QR code on label according to template (Avery 18660)
  - Adds label number text to the right of QR code
- Handles multiple pages if needed (30 labels per sheet)
- Returns PDF as `Vec<u8>` (in memory)

### 5. Browser Receives PDF

**Frontend:**
- Receives PDF blob from API
- Creates object URL: `window.URL.createObjectURL(blob)`
- Opens in new tab: `window.open(url, '_blank')`
- Browser handles PDF display (opens in PDF viewer or downloads based on user settings)
- Cleans up object URL after 100ms

## Key Architecture Points

### ✅ Stateless & Scalable
- **No PDF storage** - PDFs are generated on-demand from database records
- **No server-side state** - Each request is independent
- **Database is source of truth** - Label metadata stored in PostgreSQL
- **Works with multiple instances** - Any instance can generate PDF from batch_id
- **Lambda-friendly** - No file system dependencies, all in-memory

### Storage Breakdown

| What | Where | Persistence |
|------|-------|-------------|
| Label metadata (id, number, qr_data, batch_id) | PostgreSQL database | ✅ Persistent |
| PDF files | **Nowhere** - generated on-demand | ❌ Not stored |
| QR code images | Generated on-the-fly | ❌ Not stored |
| Batch information | Database (via batch_id) | ✅ Persistent |

### Flow Diagram

```
User clicks "Generate Labels"
    ↓
POST /api/labels/generate
    ↓
Backend: Create label records in DB
    ↓
Return batch_id
    ↓
Frontend: Auto-call GET /api/labels/print/{batchId}
    ↓
Backend: Query DB for labels by batch_id
    ↓
Backend: Generate PDF in memory (Vec<u8>)
    ↓
Backend: Return PDF as HTTP response
    ↓
Frontend: Open PDF in browser
```

## Future Considerations

If you need to cache PDFs (not recommended for Lambda):
- Store in S3/MinIO with batch_id as key
- Set expiration (e.g., 24 hours)
- Generate on first request, cache for subsequent requests
- But current approach (on-demand) is better for stateless architecture
