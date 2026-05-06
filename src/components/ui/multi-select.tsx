import * as React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type MultiSelectOption = string | { value: string; label: string };

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  showSelectAll?: boolean;
}

interface NormalizedOption {
  value: string;
  label: string;
}

const normalizeOption = (option: MultiSelectOption): NormalizedOption =>
  typeof option === 'string' ? { value: option, label: option } : option;

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select items...',
  className,
  showSelectAll = true,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  // Safety check for options and selected - ensure they're always arrays
  const safeOptions = React.useMemo<NormalizedOption[]>(
    () => (Array.isArray(options) ? options.map(normalizeOption) : []),
    [options]
  );
  const safeSelected = React.useMemo(() => Array.isArray(selected) ? selected : [], [selected]);

  const labelByValue = React.useMemo(() => {
    const map = new Map<string, string>();
    safeOptions.forEach((option) => map.set(option.value, option.label));
    return map;
  }, [safeOptions]);

  // Filter options based on search term
  const filteredOptions = React.useMemo<NormalizedOption[]>(() => {
    if (!searchTerm.trim()) return safeOptions;
    const needle = searchTerm.toLowerCase();
    return safeOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.value.toLowerCase().includes(needle)
    );
  }, [safeOptions, searchTerm]);

  const handleUnselect = React.useCallback((item: string) => {
    onChange(safeSelected.filter((s) => s !== item));
  }, [safeSelected, onChange]);

  const handleSelect = React.useCallback((item: string) => {
    if (safeSelected.includes(item)) {
      onChange(safeSelected.filter((s) => s !== item));
    } else {
      onChange([...safeSelected, item]);
    }
  }, [safeSelected, onChange]);

  const handleToggleAll = React.useCallback(() => {
    const filteredValues = filteredOptions.map((option) => option.value);
    if (filteredValues.every((value) => safeSelected.includes(value))) {
      // Deselect all filtered options
      onChange(safeSelected.filter((s) => !filteredValues.includes(s)));
    } else {
      // Select all filtered options
      const newSelected = [...new Set([...safeSelected, ...filteredValues])];
      onChange(newSelected);
    }
  }, [safeSelected, filteredOptions, onChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between min-h-10 h-auto', className)}
        >
          <div className="flex gap-1 flex-wrap flex-1">
            {safeSelected.length === 0 && (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            {safeSelected.length > 0 && safeSelected.length <= 3 ? (
              safeSelected.map((item) => (
                <Badge
                  variant="secondary"
                  key={item}
                  className="mr-1 mb-1 text-xs"
                >
                  {labelByValue.get(item) ?? item}
                  <span
                    role="button"
                    tabIndex={0}
                    className="ml-1 inline-flex rounded-full ring-offset-background outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleUnselect(item);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUnselect(item);
                    }}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </span>
                </Badge>
              ))
            ) : safeSelected.length > 3 ? (
              <Badge variant="secondary" className="mr-1 mb-1 text-xs">
                {safeSelected.length} selected
              </Badge>
            ) : null}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full border bg-popover/95 p-0 text-popover-foreground shadow-xl backdrop-blur-xl" align="start">
        <div className="p-2">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="max-h-64 overflow-auto border-t">
          {showSelectAll && filteredOptions.length > 0 && (
            <div className="p-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleAll}
                className="w-full justify-start text-xs"
              >
                {filteredOptions.every((option) => safeSelected.includes(option.value))
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </div>
          )}
          {filteredOptions.length > 0 ? (
            <div className="p-1">
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center',
                    safeSelected.includes(option.value) && 'bg-accent text-accent-foreground'
                  )}
                >
                  <div
                    className={cn(
                      'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                      safeSelected.includes(option.value)
                        ? 'bg-primary text-primary-foreground'
                        : 'opacity-50 [&_svg]:invisible'
                    )}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {searchTerm ? 'No items found.' : 'No options available.'}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
