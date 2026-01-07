import EntitySelector, { type EntityType } from './EntitySelector';

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
    <div className="form-group">
      <label>
        {label}
        {required && ' *'}
      </label>
      <EntitySelector
        entityType={entityType}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
      />
      {helpText && <small className="help-text">{helpText}</small>}
    </div>
  );
}
