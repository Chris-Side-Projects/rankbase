import styles from './Tabs.module.css';

export interface TabOption<T extends string> {
  value: T;
  label: string;
}

interface TabsProps<T extends string> {
  label: string;
  options: Array<TabOption<T>>;
  value: T;
  onChange: (value: T) => void;
}

export function Tabs<T extends string>({ label, options, value, onChange }: TabsProps<T>) {
  return (
    <div className={styles.tabs} role="group" aria-label={label}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
