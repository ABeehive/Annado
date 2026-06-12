import { ComponentType } from 'react';

export type WrappedPeriod = 'weekly' | 'monthly' | 'yearly';

export interface WrappedDateRange {
  start: string;        // YYYY-MM-DD
  end: string;
  prevStart?: string;   // Previous period for comparison
  prevEnd?: string;
}

export interface WrappedData {
  period: WrappedPeriod;
  periodLabel: string;        // "Week 7" / "February" / "2025"
  dateRange: WrappedDateRange;
  hasEnoughData: boolean;     // <3 weekly, <10 monthly → false

  // Core
  totalCompleted: number;
  totalCreated: number;
  completionRate: number;
  previousCompleted: number | null;
  deltaCompleted: number | null;

  // Time distribution (bars)
  dailyCompleted: { label: string; count: number }[];
  weeklyCompleted: { label: string; count: number }[];
  monthlyCompleted: { label: string; count: number }[];
  weekdayDistribution: { day: string; count: number }[];

  // Project & Area
  topProjects: { name: string; area: string | null; tasks: number; color: string; prevTasks: number; momentum: 'up' | 'down' | 'flat' }[];
  areas: { name: string; tasks: number; pct: number; color: string }[];

  // Tags & Persons
  topTags: { tag: string; count: number }[];
  topPersons: { name: string; tasks: number }[];

  // Contrast
  longestTask: { title: string; days: number; project: string | null } | null;
  stalestTask: { title: string; daysOpen: number } | null;

  // Streak & Priority
  longestStreak: number;
  priorityBreakdown: { high: number; medium: number; low: number; none: number };

  // Look-ahead
  upcomingTasks: number;
  upcomingDeadlines: { title: string; deadline: string }[];

  // Yearly only
  personalityType?: string;
  personalitySubtitle?: string;

  // New slides
  heatmapDays: { date: string; count: number }[];          // yearly: full-year day → count
  taskAgeBuckets: { label: string; count: number }[];      // all periods: age-at-completion distribution
}

export interface SlideTheme {
  gradient: string;
  gradientDark: string;
  accent: string;
  accentDark: string;
}

export interface SlideConfig {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  props?: Record<string, unknown>;
  theme?: SlideTheme;
}

export interface SlideProps {
  data: WrappedData;
  active: boolean;
}
