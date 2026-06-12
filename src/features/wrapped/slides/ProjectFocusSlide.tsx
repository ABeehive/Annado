import { SlideProps } from '../types';
import { SlideHeader } from './SlideHeader';
import { NoDataFallback } from './NoDataFallback';

export function ProjectFocusSlide({ data, active }: SlideProps) {
  if (data.topProjects.length === 0) {
    return <NoDataFallback message="No project data available" />;
  }

  const maxTasks = data.topProjects[0]?.tasks ?? 1;
  const periodName = data.period === 'weekly' ? 'week' : data.period === 'monthly' ? 'month' : 'year';

  return (
    <div className="h-full flex flex-col">
      <SlideHeader
        title="Where your focus went"
        subtitle={`${data.topProjects.length} projects this ${periodName}`}
      />

      <div className="flex-1 flex flex-col justify-center gap-4 wrapped-stagger">
        {data.topProjects.slice(0, 6).map((project) => {
          const momentumIcon = project.momentum === 'up' ? '↑' : project.momentum === 'down' ? '↓' : '→';
          const momentumColor = project.momentum === 'up' ? '#4CAF50' : project.momentum === 'down' ? '#E53935' : undefined;
          return (
            <div key={project.name} className="flex items-center gap-3.5">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span
                className="text-[16px] font-semibold flex-shrink-0 min-w-[100px]"
                style={{ color: 'var(--slide-accent)' }}
              >
                {project.name}
              </span>
              <div
                className="flex-1 h-[14px] rounded-[7px] overflow-hidden"
                style={{ backgroundColor: 'color-mix(in srgb, var(--slide-accent) 10%, transparent)' }}
              >
                <div
                  className="h-full rounded-[7px] transition-all duration-500"
                  style={{
                    width: active ? `${(project.tasks / maxTasks) * 100}%` : '0%',
                    backgroundColor: project.color,
                    transitionDelay: '0.25s',
                    transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
                  }}
                />
              </div>
              <span
                className="text-[20px] font-bold flex-shrink-0 w-[32px] text-right"
                style={{ color: 'var(--slide-accent)' }}
              >
                {project.tasks}
              </span>
              <span
                className="text-[16px] font-bold flex-shrink-0 w-[16px]"
                style={{ color: momentumColor ?? 'var(--slide-accent)', opacity: momentumColor ? 1 : 0.3 }}
                title={project.momentum === 'up' ? `+${project.tasks - project.prevTasks} vs previous period` : project.momentum === 'down' ? `${project.tasks - project.prevTasks} vs previous period` : 'Same as previous period'}
              >
                {momentumIcon}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
