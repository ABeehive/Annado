import { useTaskStore } from '../stores/taskStore';

interface ProjectSelectorProps {
  value: string;
  onChange: (project: string) => void;
  className?: string;
}

export function ProjectSelector({ value, onChange, className }: ProjectSelectorProps) {
  const { availableProjects } = useTaskStore();

  return (
    <div className="flex items-center gap-1.5">
      <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="5" />
      </svg>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className ?? "task-input text-[12px] px-2 py-1 rounded border border-[#E8E8E8] dark:border-[#3A3A3A] bg-white dark:bg-[#333] text-[#1A1A1A] dark:text-[#E0E0E0] focus:outline-none cursor-pointer max-w-[120px]"}
      >
        <option value="">No Project</option>
        {availableProjects.map((p) => (
          <option key={p.name} value={p.name}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
