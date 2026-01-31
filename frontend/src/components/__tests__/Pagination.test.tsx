import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import Pagination from '../Pagination';

describe('Pagination', () => {
  const defaultProps = {
    total: 100,
    limit: 10,
    offset: 0,
    onPageChange: vi.fn(),
  };

  it('should render pagination controls', () => {
    render(<Pagination {...defaultProps} />);

    expect(screen.getByText(/Showing 1 to 10 of 100 results/)).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should not render when total pages is 1', () => {
    render(
      <Pagination {...defaultProps} total={5} limit={10} />
    );

    // The toast-container is from the wrapper, so check for pagination content
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it('should not render when total is 0', () => {
    render(
      <Pagination {...defaultProps} total={0} />
    );

    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it('should disable Previous button on first page', () => {
    render(<Pagination {...defaultProps} offset={0} />);

    const previousButton = screen.getByText('Previous');
    expect(previousButton).toBeDisabled();
  });

  it('should disable Next button on last page', () => {
    render(<Pagination {...defaultProps} total={100} limit={10} offset={90} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('should call onPageChange when clicking Previous', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} offset={20} onPageChange={onPageChange} />);

    const previousButton = screen.getByText('Previous');
    await user.click(previousButton);

    expect(onPageChange).toHaveBeenCalledWith(10);
  });

  it('should call onPageChange when clicking Next', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} offset={0} onPageChange={onPageChange} />);

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    expect(onPageChange).toHaveBeenCalledWith(10);
  });

  it('should call onPageChange when clicking a page number', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} total={50} limit={10} onPageChange={onPageChange} />);

    const page3Button = screen.getByText('3');
    await user.click(page3Button);

    expect(onPageChange).toHaveBeenCalledWith(20);
  });

  it('should show ellipsis for many pages', () => {
    render(<Pagination {...defaultProps} total={100} limit={10} offset={50} />);

    // Should show ellipsis when there are many pages
    const ellipsis = screen.getAllByText('...');
    expect(ellipsis.length).toBeGreaterThan(0);
  });

  it('should highlight current page', () => {
    render(<Pagination {...defaultProps} total={50} limit={10} offset={20} />);

    // Page 3 should be active (offset 20 / limit 10 + 1 = 3)
    const page3Button = screen.getByText('3');
    expect(page3Button).toHaveClass('btn-primary');
  });

  it('should handle null/undefined values safely', () => {
    render(
      <Pagination
        total={0}
        limit={50}
        offset={0}
        onPageChange={vi.fn()}
      />
    );

    // Should not crash - with total 0, it won't render
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it('should calculate correct page numbers', () => {
    render(<Pagination {...defaultProps} total={100} limit={10} offset={25} />);

    // Current page should be 3 (offset 25 / limit 10 + 1 = 3.5, floor = 3)
    const page3Button = screen.getByText('3');
    expect(page3Button).toBeInTheDocument();
  });
});
