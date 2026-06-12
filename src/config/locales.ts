export interface LocaleKeywords {
  today: string[];
  tonight: string[];
  tomorrow: string[];
  dayAfterTomorrow?: string[];
  thisWeekend: string[];
  nextWeekend: string[];
  nextWeek: string[];
  nextMonth: string[];
  endOfWeek: string[];
  endOfMonth: string[];
  anytime: string[];
  someday: string[];
  inPrefix: string[];   // prefixes like "in", "over"
  nextPrefix: string[]; // prefixes like "next", "volgende"
  days: string[];
  weeks: string[];
  months: string[];
  numberWords: Record<string, number>; // spelled-out counts: "three" → 3, "twee" → 2
}

export interface LocaleConfig {
  code: string; // BCP-47 locale code used for Intl API (e.g. 'en', 'nl')
  keywords: LocaleKeywords;
}

export const LOCALES: LocaleConfig[] = [
  {
    code: 'en',
    keywords: {
      today: ['today'],
      tonight: ['this evening', 'tonight'],
      tomorrow: ['tomorrow'],
      thisWeekend: ['this weekend', 'weekend'],
      nextWeekend: ['next weekend'],
      nextWeek: ['next week'],
      nextMonth: ['next month'],
      endOfWeek: ['end of week', 'end of the week'],
      endOfMonth: ['end of month', 'end of the month'],
      anytime: ['anytime'],
      someday: ['someday'],
      inPrefix: ['in'],
      nextPrefix: ['next'],
      days: ['day', 'days'],
      weeks: ['week', 'weeks'],
      months: ['month', 'months'],
      numberWords: {
        a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
        seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
      },
    },
  },
  {
    code: 'nl',
    keywords: {
      today: ['vandaag'],
      tonight: ['vanavond'],
      tomorrow: ['morgen'],
      dayAfterTomorrow: ['overmorgen'],
      thisWeekend: ['dit weekend'],
      nextWeekend: ['volgend weekend'],
      nextWeek: ['volgende week'],
      nextMonth: ['volgende maand'],
      endOfWeek: ['eind van de week', 'einde van de week'],
      endOfMonth: ['eind van de maand', 'einde van de maand'],
      anytime: ['altijd'],
      someday: ['ooit'],
      inPrefix: ['over'],
      nextPrefix: ['volgende'],
      days: ['dag', 'dagen'],
      weeks: ['week', 'weken'],
      months: ['maand', 'maanden'],
      numberWords: {
        een: 1, 'één': 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6,
        zeven: 7, acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12,
      },
    },
  },
  // To add a new language, add a block here with its BCP-47 code and keywords.
  // Month and day names are generated automatically via the Intl API — no manual lists needed.
];
