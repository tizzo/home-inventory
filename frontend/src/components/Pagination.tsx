interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
}

export default function Pagination({
  total,
  limit,
  offset,
  onPageChange,
}: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const startItem = offset + 1;
  const endItem = Math.min(offset + limit, total);

  if (totalPages <= 1) {
    return null;
  }

  const handlePrevious = () => {
    if (offset > 0) {
      onPageChange(Math.max(0, offset - limit));
    }
  };

  const handleNext = () => {
    if (offset + limit < total) {
      onPageChange(offset + limit);
    }
  };

  const handlePageClick = (page: number) => {
    onPageChange((page - 1) * limit);
  };

  // Calculate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;
    
    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      // Show last page
      pages.push(totalPages);
    }
    
    return pages;
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '2rem',
        padding: '1rem',
        background: 'var(--surface-color)',
        borderRadius: '0.5rem',
        border: '1px solid var(--border-color)',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        Showing {startItem} to {endItem} of {total} results
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handlePrevious}
          disabled={offset === 0}
        >
          Previous
        </button>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  style={{
                    padding: '0.5rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handlePageClick(pageNum)}
                style={{
                  minWidth: '2.5rem',
                }}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleNext}
          disabled={offset + limit >= total}
        >
          Next
        </button>
      </div>
    </div>
  );
}
