export type BuiltinStoryType = 'latest' | 'serieA' | 'estero' | 'serieB' | 'editoriale';
export type StoryType = BuiltinStoryType | string;

export type FeedKind = 'tmw' | 'rss';

export interface ConfiguredFeed {
  id: string;
  label: string;
  kind: FeedKind;
  source: string;
  url: string;
}

export const STORY_TYPE_META: Record<BuiltinStoryType, { path: string; label: string }> = {
  latest: { path: 'ricerca', label: 'ULTIME' },
  serieA: { path: 'serie-a', label: 'SERIE A' },
  estero: { path: 'calcio-estero', label: 'ESTERO' },
  serieB: { path: 'serie-b', label: 'SERIE B' },
  editoriale: { path: 'editoriale', label: 'EDITORIALI' },
};

export const ALL_STORY_TYPES: BuiltinStoryType[] = [
  'latest',
  'serieA',
  'estero',
  'serieB',
  'editoriale',
];

export const DEFAULT_CONFIGURED_FEEDS: ConfiguredFeed[] = [
  {
    id: 'latest',
    label: 'Ultime TMW',
    kind: 'tmw',
    source: 'latest',
    url: 'https://www.tuttomercatoweb.com/ricerca/',
  },
  {
    id: 'serieA',
    label: 'Serie A',
    kind: 'tmw',
    source: 'serieA',
    url: 'https://www.tuttomercatoweb.com/serie-a/',
  },
  {
    id: 'estero',
    label: 'Estero',
    kind: 'tmw',
    source: 'estero',
    url: 'https://www.tuttomercatoweb.com/calcio-estero/',
  },
  {
    id: 'serieB',
    label: 'Serie B',
    kind: 'tmw',
    source: 'serieB',
    url: 'https://www.tuttomercatoweb.com/serie-b/',
  },
  {
    id: 'editoriale',
    label: 'Editoriali',
    kind: 'tmw',
    source: 'editoriale',
    url: 'https://www.tuttomercatoweb.com/editoriale/',
  },
];

export function isBuiltinStoryType(id: string): id is BuiltinStoryType {
  return (ALL_STORY_TYPES as string[]).includes(id);
}

export interface CustomRssFeed {
  id: string;
  label: string;
  url: string;
}

export type FetchMode = 'eager' | 'lazy';

export type CommentsOrder = 'natural' | 'newestFirst' | 'oldestFirst';

export type DateDisplayFormat = 'timeAgo' | 'yMd' | 'yMEd' | 'yMMMd' | 'yMMMEd';

export type StoryMarkingMode = 'tap' | 'scroll';

export type FontOption =
  | 'RobotoSlab'
  | 'Ubuntu'
  | 'UbuntuMono'
  | 'NotoSerif'
  | 'Exo2'
  | 'AtkinsonHyperlegible'
  | 'System';

export const FONT_OPTIONS: Array<{ id: FontOption; label: string; isSerif?: boolean }> = [
  { id: 'RobotoSlab', label: 'Roboto Slab', isSerif: true },
  { id: 'Ubuntu', label: 'Ubuntu' },
  { id: 'UbuntuMono', label: 'Ubuntu Mono' },
  { id: 'NotoSerif', label: 'Noto Serif', isSerif: true },
  { id: 'Exo2', label: 'Exo 2' },
  { id: 'AtkinsonHyperlegible', label: 'Atkinson Hyperlegible' },
  { id: 'System', label: 'System Sans' },
];

export type FontSizeOption = 'small' | 'regular' | 'large' | 'xlarge' | 'xxlarge';

export const FONT_SIZE_OPTIONS: Array<{ id: FontSizeOption; label: string; px: number }> = [
  { id: 'small', label: 'Small', px: 14 },
  { id: 'regular', label: 'Regular', px: 15 },
  { id: 'large', label: 'Large', px: 16.5 },
  { id: 'xlarge', label: 'XLarge', px: 18 },
  { id: 'xxlarge', label: 'XXLarge', px: 20 },
];

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AccentColorOption {
  id: string;
  label: string;
  hex: string;
}

export const ACCENT_COLORS: AccentColorOption[] = [
  { id: 'deepOrange', label: 'Deep Orange', hex: '#FF5722' },
  { id: 'orange', label: 'Orange', hex: '#FF9800' },
  { id: 'amber', label: 'Amber', hex: '#F59E0B' },
  { id: 'red', label: 'Red', hex: '#EF4444' },
  { id: 'pink', label: 'Pink', hex: '#EC4899' },
  { id: 'purple', label: 'Purple', hex: '#8B5CF6' },
  { id: 'indigo', label: 'Indigo', hex: '#6366F1' },
  { id: 'blue', label: 'Blue', hex: '#3B82F6' },
  { id: 'teal', label: 'Teal', hex: '#14B8A6' },
  { id: 'green', label: 'Green', hex: '#22C55E' },
];

export interface Item {
  id: number;
  time: number;
  score: number;
  parent: number;
  descendants: number;
  deleted: boolean;
  dead: boolean;
  hidden: boolean;
  by: string;
  text: string;
  url: string;
  title: string;
  type: 'story' | 'comment' | string;
  kids: number[];
  parts: number[];
  image?: string;
  category?: string;
  label?: string;
  subtitle?: string;
  related?: Story[];
}

export interface Story extends Item {
  type: 'story' | string;
}

export interface Comment extends Item {
  level: number;
  isFromCache?: boolean;
}

export interface WebPreviewInfo {
  title?: string;
  description?: string;
  image?: string;
  icon?: string;
}

export type TypeTagFilter =
  | 'serie-a'
  | 'serie-b'
  | 'calcio-estero'
  | 'editoriale'
  | 'rassegna-stampa'
  | 'esclusiva';

export const ALL_TYPE_TAG_FILTERS: TypeTagFilter[] = [
  'serie-a',
  'serie-b',
  'calcio-estero',
  'editoriale',
  'rassegna-stampa',
  'esclusiva',
];

export interface SearchParams {
  query: string;
  page: number;
  sorted: boolean;
  exactMatch: boolean;
  postedBy: string;
  typeTag: TypeTagFilter | null;
  startTime: number | null; // ms epoch
  endTime: number | null; // ms epoch
}

export interface Preferences {
  fetchMode: FetchMode;
  commentsOrder: CommentsOrder;
  font: FontOption;
  fontSize: FontSizeOption;
  tabOrder: StoryType[];
  configuredFeeds: ConfiguredFeed[];
  storyMarkingMode: StoryMarkingMode;
  appColorId: string;
  dateFormat: DateDisplayFormat;
  textScaleFactor: number;
  themeMode: ThemeMode;
  isComplexStoryTileEnabled: boolean;
  isFaviconEnabled: boolean;
  isMetadataEnabled: boolean;
  isUrlEnabled: boolean;
  isMarkReadStoriesEnabled: boolean;
  isNotificationEnabled: boolean;
  isAutoScrollEnabled: boolean;
  isTapAnywhereToCollapseEnabled: boolean;
  isManualPaginationEnabled: boolean;
  isEyeCandyEnabled: boolean;
  isTrueDarkModeEnabled: boolean;
  isDevModeEnabled: boolean;
}

export interface ItemScreenArgs {
  item: Item;
  onlyShowTargetComment?: boolean;
  shouldMarkNewComment?: boolean;
  targetComments?: Comment[];
}

export type ProfileSubPage = 'fav' | 'search' | 'settings';

export interface ToastMessage {
  id: number;
  text: string;
  variant?: 'default' | 'error' | 'success';
  actionLabel?: string;
  onAction?: () => void;
}
