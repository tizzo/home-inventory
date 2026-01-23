import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/utils';
import Breadcrumb, { type BreadcrumbItem } from '../Breadcrumb';

describe('Breadcrumb', () => {
  it('should render breadcrumb items', () => {
    const items: BreadcrumbItem[] = [
      { name: 'Home', url: '/' },
      { name: 'Rooms', url: '/rooms' },
      { name: 'Kitchen' },
    ];

    render(<Breadcrumb items={items} />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Rooms')).toBeInTheDocument();
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
  });

  it('should render links for items with URLs', () => {
    const items: BreadcrumbItem[] = [
      { name: 'Home', url: '/' },
      { name: 'Rooms', url: '/rooms' },
    ];

    render(<Breadcrumb items={items} />);

    const homeLink = screen.getByText('Home').closest('a');
    const roomsLink = screen.getByText('Rooms').closest('a');

    expect(homeLink).toHaveAttribute('href', '/');
    expect(roomsLink).toHaveAttribute('href', '/rooms');
  });

  it('should render plain text for items without URLs', () => {
    const items: BreadcrumbItem[] = [
      { name: 'Home', url: '/' },
      { name: 'Current Page' },
    ];

    render(<Breadcrumb items={items} />);

    const currentPage = screen.getByText('Current Page');
    expect(currentPage.tagName).toBe('SPAN');
    expect(currentPage.closest('a')).toBeNull();
  });

  it('should render separators between items', () => {
    const items: BreadcrumbItem[] = [
      { name: 'Home', url: '/' },
      { name: 'Rooms', url: '/rooms' },
      { name: 'Kitchen' },
    ];

    render(<Breadcrumb items={items} />);

    const breadcrumb = screen.getByRole('navigation');
    expect(breadcrumb.textContent).toContain(' → ');
  });

  it('should not render separator after last item', () => {
    const items: BreadcrumbItem[] = [{ name: 'Home', url: '/' }];

    render(<Breadcrumb items={items} />);

    const breadcrumb = screen.getByRole('navigation');
    expect(breadcrumb.textContent).not.toContain(' → ');
  });

  it('should handle empty items array', () => {
    render(<Breadcrumb items={[]} />);

    const breadcrumb = screen.getByRole('navigation');
    expect(breadcrumb.children.length).toBe(0);
  });
});
