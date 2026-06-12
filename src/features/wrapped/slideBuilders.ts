import { WrappedData, SlideConfig, SlideTheme } from './types';
import { IntroSlide } from './slides/IntroSlide';
import { BigNumberSlide } from './slides/BigNumberSlide';
import { BarChartSlide } from './slides/BarChartSlide';
import { ComparisonSlide } from './slides/ComparisonSlide';
import { ProjectFocusSlide } from './slides/ProjectFocusSlide';
import { AreaDistributionSlide } from './slides/AreaDistributionSlide';
import { ContrastSlide } from './slides/ContrastSlide';
import { ListSlide } from './slides/ListSlide';
import { LookAheadSlide } from './slides/LookAheadSlide';
import { PersonalitySlide } from './slides/PersonalitySlide';
import { OutroSlide } from './slides/OutroSlide';
import { HeatmapSlide } from './slides/HeatmapSlide';
import { TaskAgeSlide } from './slides/TaskAgeSlide';

const SLIDE_THEMES: Record<string, SlideTheme> = {
  'intro': {
    gradient: 'linear-gradient(150deg, #E8E4F8 0%, #D4CEF0 50%, #C5BFEA 100%)',
    gradientDark: 'linear-gradient(150deg, #252040 0%, #201A38 50%, #1A1530 100%)',
    accent: '#4A3D80',
    accentDark: '#B0A8D8',
  },
  'big-total': {
    gradient: 'linear-gradient(150deg, #FFF3E0 0%, #FFE5C0 50%, #FFD8A0 100%)',
    gradientDark: 'linear-gradient(150deg, #2A2215 0%, #252010 50%, #201A08 100%)',
    accent: '#805520',
    accentDark: '#D4A860',
  },
  'big-streak': {
    gradient: 'linear-gradient(150deg, #FFF3E0 0%, #FFE5C0 50%, #FFD8A0 100%)',
    gradientDark: 'linear-gradient(150deg, #2A2215 0%, #252010 50%, #201A08 100%)',
    accent: '#805520',
    accentDark: '#D4A860',
  },
  'daily-chart': {
    gradient: 'linear-gradient(150deg, #E0F0FA 0%, #C8E4F5 50%, #B5D8F0 100%)',
    gradientDark: 'linear-gradient(150deg, #182535 0%, #152030 50%, #121A28 100%)',
    accent: '#2A5580',
    accentDark: '#6AA0D0',
  },
  'weekly-chart': {
    gradient: 'linear-gradient(150deg, #E0F0FA 0%, #C8E4F5 50%, #B5D8F0 100%)',
    gradientDark: 'linear-gradient(150deg, #182535 0%, #152030 50%, #121A28 100%)',
    accent: '#2A5580',
    accentDark: '#6AA0D0',
  },
  'monthly-chart': {
    gradient: 'linear-gradient(150deg, #E0F0FA 0%, #C8E4F5 50%, #B5D8F0 100%)',
    gradientDark: 'linear-gradient(150deg, #182535 0%, #152030 50%, #121A28 100%)',
    accent: '#2A5580',
    accentDark: '#6AA0D0',
  },
  'weekday-chart': {
    gradient: 'linear-gradient(150deg, #E0F0FA 0%, #C8E4F5 50%, #B5D8F0 100%)',
    gradientDark: 'linear-gradient(150deg, #182535 0%, #152030 50%, #121A28 100%)',
    accent: '#2A5580',
    accentDark: '#6AA0D0',
  },
  'comparison': {
    gradient: 'linear-gradient(150deg, #E0F5EC 0%, #C8ECD8 50%, #B0E4C8 100%)',
    gradientDark: 'linear-gradient(150deg, #1A2820 0%, #15221A 50%, #101C15 100%)',
    accent: '#2A6048',
    accentDark: '#60A878',
  },
  'projects': {
    gradient: 'linear-gradient(150deg, #EDE8F5 0%, #E0D8F0 50%, #D5CDE8 100%)',
    gradientDark: 'linear-gradient(150deg, #241E35 0%, #1E1830 50%, #181228 100%)',
    accent: '#4A3D70',
    accentDark: '#A898C8',
  },
  'areas': {
    gradient: 'linear-gradient(150deg, #E8E4F8 0%, #DDD4F0 50%, #D5CDE8 100%)',
    gradientDark: 'linear-gradient(150deg, #252040 0%, #1E1830 50%, #181228 100%)',
    accent: '#4A3D70',
    accentDark: '#A898C8',
  },
  'contrast': {
    gradient: 'linear-gradient(150deg, #FCEAEF 0%, #F5D5DE 50%, #F0C5D2 100%)',
    gradientDark: 'linear-gradient(150deg, #301A25 0%, #28151E 50%, #201018 100%)',
    accent: '#8B3050',
    accentDark: '#D07090',
  },
  'tags': {
    gradient: 'linear-gradient(150deg, #E8EEF2 0%, #D8E4EA 50%, #C8D8E0 100%)',
    gradientDark: 'linear-gradient(150deg, #1E252C 0%, #1A2025 50%, #151A20 100%)',
    accent: '#3A4A55',
    accentDark: '#8098A8',
  },
  'look-ahead': {
    gradient: 'linear-gradient(150deg, #E0F0FA 0%, #D0E8F0 50%, #C8ECD8 100%)',
    gradientDark: 'linear-gradient(150deg, #182535 0%, #152228 50%, #121E18 100%)',
    accent: '#2A5580',
    accentDark: '#6AA0D0',
  },
  'personality': {
    gradient: 'linear-gradient(150deg, #EDE8F5 0%, #E8DDF0 50%, #F5E8D8 100%)',
    gradientDark: 'linear-gradient(150deg, #241E35 0%, #221A30 50%, #252018 100%)',
    accent: '#4A3D80',
    accentDark: '#B0A8D8',
  },
  'outro': {
    gradient: 'linear-gradient(150deg, #FFF3E0 0%, #FCEAEF 50%, #E8E4F8 100%)',
    gradientDark: 'linear-gradient(150deg, #2A2215 0%, #28151E 50%, #201A38 100%)',
    accent: '#4A3D80',
    accentDark: '#B0A8D8',
  },
  'heatmap': {
    gradient: 'linear-gradient(150deg, #E0F5EC 0%, #C8ECD8 50%, #B0E4C8 100%)',
    gradientDark: 'linear-gradient(150deg, #1A2820 0%, #15221A 50%, #101C15 100%)',
    accent: '#2A6048',
    accentDark: '#60A878',
  },
  'task-age': {
    gradient: 'linear-gradient(150deg, #FFF8E1 0%, #FFF0C0 50%, #FFE8A0 100%)',
    gradientDark: 'linear-gradient(150deg, #2A2510 0%, #25200A 50%, #201A05 100%)',
    accent: '#705010',
    accentDark: '#C8A050',
  },
};

function withTheme(slide: SlideConfig): SlideConfig {
  return { ...slide, theme: SLIDE_THEMES[slide.id] };
}

export function buildSlides(data: WrappedData): SlideConfig[] {
  const { period } = data;
  const slides: SlideConfig[] = [];

  // Intro — all periods
  slides.push({ id: 'intro', component: IntroSlide });

  // Comparison — weekly + monthly
  if ((period === 'weekly' || period === 'monthly') && data.previousCompleted !== null) {
    slides.push({ id: 'comparison', component: ComparisonSlide });
  }

  // Big number: total — yearly only
  if (period === 'yearly') {
    slides.push({
      id: 'big-total',
      component: BigNumberSlide,
      props: {
        number: data.totalCompleted,
        label: 'Total completed in ' + data.periodLabel,
        sublabel: `${data.totalCreated} created — ${data.completionRate}% completion rate`,
      },
    });
  }

  // Bar chart: daily (weekly), weekly (monthly), monthly (yearly)
  if (period === 'weekly' && data.dailyCompleted.length > 0) {
    slides.push({
      id: 'daily-chart',
      component: BarChartSlide,
      props: {
        title: 'Daily Breakdown',
        subtitle: 'Tasks completed each day',
        bars: data.dailyCompleted,
      },
    });
  }
  if (period === 'monthly' && data.weeklyCompleted.length > 0) {
    slides.push({
      id: 'weekly-chart',
      component: BarChartSlide,
      props: {
        title: 'Weekly Breakdown',
        subtitle: 'Tasks completed each week',
        bars: data.weeklyCompleted,
      },
    });
  }
  if (period === 'yearly' && data.monthlyCompleted.length > 0) {
    slides.push({
      id: 'monthly-chart',
      component: BarChartSlide,
      props: {
        title: 'Monthly Breakdown',
        subtitle: 'Tasks completed each month',
        bars: data.monthlyCompleted,
      },
    });
  }

  // Heatmap — yearly only
  if (period === 'yearly' && data.heatmapDays.length > 0) {
    slides.push({ id: 'heatmap', component: HeatmapSlide });
  }

  // Big number: streak — yearly only
  if (period === 'yearly' && data.longestStreak > 0) {
    slides.push({
      id: 'big-streak',
      component: BigNumberSlide,
      props: {
        number: data.longestStreak,
        label: 'Longest streak',
        sublabel: 'Consecutive days completing tasks',
        suffix: ' days',
      },
    });
  }

  // Project focus — all periods (if data exists)
  if (data.topProjects.length > 0) {
    slides.push({ id: 'projects', component: ProjectFocusSlide });
  }

  // Area distribution — monthly + yearly
  if ((period === 'monthly' || period === 'yearly') && data.areas.length > 1) {
    slides.push({ id: 'areas', component: AreaDistributionSlide });
  }

  // Weekday distribution — yearly only
  if (period === 'yearly' && data.weekdayDistribution.some((d) => d.count > 0)) {
    slides.push({
      id: 'weekday-chart',
      component: BarChartSlide,
      props: {
        title: 'Busiest Days',
        subtitle: 'When you get the most done',
        bars: data.weekdayDistribution.map((d) => ({ label: d.day, count: d.count })),
      },
    });
  }

  // Task age — all periods (if any tasks have creation dates)
  if (data.taskAgeBuckets.some((b) => b.count > 0)) {
    slides.push({ id: 'task-age', component: TaskAgeSlide });
  }

  // Contrast — monthly + yearly
  if ((period === 'monthly' || period === 'yearly') && (data.longestTask || data.stalestTask)) {
    slides.push({ id: 'contrast', component: ContrastSlide });
  }

  // Tags list — yearly only
  if (period === 'yearly' && data.topTags.length > 0) {
    slides.push({
      id: 'tags',
      component: ListSlide,
      props: {
        title: 'Top Tags',
        subtitle: 'Your most used tags',
        items: data.topTags.map((t) => ({ label: `#${t.tag}`, value: t.count })),
      },
    });
  }

  // Look-ahead — weekly + monthly
  if (period === 'weekly' || period === 'monthly') {
    slides.push({ id: 'look-ahead', component: LookAheadSlide });
  }

  // Personality — yearly only
  if (period === 'yearly' && data.personalityType) {
    slides.push({ id: 'personality', component: PersonalitySlide });
  }

  // Outro — all periods
  slides.push({ id: 'outro', component: OutroSlide });

  return slides.map(withTheme);
}
