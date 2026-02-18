import EntitySelector, { type EntityType } from './EntitySelector';
import { Label } from '@/components/ui/label';

interface EntityFieldProps {
  label: string;
  entityType: EntityType;
  value?: string;
  onChange: (value: string | undefined) => void;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
}

/**
 * FormField wrapper for EntitySelector - provides consistent styling
 * and integrates EntitySelector into form layouts
 */
export default function EntityField({
  label,
  entityType,
  value,
  onChange,
  required = false,
  placeholder,
  helpText,
}: EntityFieldProps) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <EntitySelector
        entityType={entityType}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
      />
      {helpText && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
