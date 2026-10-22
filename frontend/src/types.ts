export interface SearchResultItem {
  title: string;
  magnet_link: string;
  size: string;
  seeders: number;
  leechers: number;
  provider_name: string;
  provider_short: string;
  score: number;
}

export type TabType = 'search' | 'indexers';

export type SortOption = 'availability' | 'quality' | 'size';

export interface FilterState {
  sortOption: SortOption;
  qualities: string[];
  sizes: string[];
  providers: string[];
}

export interface IndexerInfo {
  short: string;
  name: string;
  description: string;
  type: 'api' | 'scrape';
}
