import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  name: string;
  url?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb">
      {items.map((item, index) => (
        <span key={index}>
          {item.url ? (
            <Link to={item.url}>{item.name}</Link>
          ) : (
            <span>{item.name}</span>
          )}
          {index < items.length - 1 && ' → '}
        </span>
      ))}
    </nav>
  );
}
