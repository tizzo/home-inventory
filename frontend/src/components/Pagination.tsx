import { Button } from '@/components/ui/button';

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
  // Guard against invalid values
  const safeTotal = total ?? 0;
  const safeLimit = limit ?? 50;
  const safeOffset = offset ?? 0;

  const currentPage = Math.floor(safeOffset / safeLimit) + 1;
  const totalPages = Math.ceil(safeTotal / safeLimit);
  const startItem = safeOffset + 1;
  const endItem = Math.min(safeOffset + safeLimit, safeTotal);

  // Don't show pagination if there's only one page or no results
  if (totalPages <= 1 || safeTotal === 0) {
    return null;
  }

  const handlePrevious = () => {
    if (safeOffset > 0) {
      onPageChange(Math.max(0, safeOffset - safeLimit));
    }
  };

  const handleNext = () => {
    if (safeOffset + safeLimit < safeTotal) {
      onPageChange(safeOffset + safeLimit);
    }
  };

  const handlePageClick = (page: number) => {
    onPageChange((page - 1) * safeLimit);
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
    <div className="mt-8 p-4 bg-background border border-border rounded-lg">
      {/* Mobile layout: stacked with simplified controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        {/* Results count */}
        <div className="text-sm text-muted-foreground text-center sm:text-left">
          <span className="hidden sm:inline">
            Showing {startItem} to {endItem} of {safeTotal} results
          </span>
          <span className="sm:hidden">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        {/* Navigation controls */}
        <div className="flex justify-center gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={safeOffset === 0}
            className="h-9"
          >
            Previous
          </Button>

          {/* Page numbers - hidden on mobile, shown on sm+ */}
          <div className="hidden sm:flex gap-1">
            {getPageNumbers().map((page, index) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-2 py-1 text-muted-foreground"
                  >
                    ...
                  </span>
                );
              }

              const pageNum = page as number;
              const isActive = pageNum === currentPage;

              return (
                <Button
                  key={pageNum}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePageClick(pageNum)}
                  className="min-w-[2.5rem] h-9"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          {/* Page indicator on mobile */}
          <span className="sm:hidden text-sm text-muted-foreground px-2">
            {currentPage} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={safeOffset + safeLimit >= safeTotal}
            className="h-9"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
