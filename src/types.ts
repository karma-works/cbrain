export type PageType = 'decision' | 'concept' | 'person' | 'project' | 'meeting' | 'note' | 'session';
export type Confidence = 'high' | 'medium' | 'low';

export interface PageFrontmatter {
  slug: string;
  title: string;
  type: PageType;
  source: string;
  date: string;
  tags: string[];
  confidence: Confidence;
  schema_version?: number;
  links?: Array<{ target: string; type: string }>;
}

export interface Page extends PageFrontmatter {
  schema_version: number;
  content: string;
  embedding?: Float32Array;
  embedding_provider?: string;
  embedding_model?: string;
  created_at: number;
  updated_at: number;
}

export interface Link {
  id?: number;
  source_slug: string;
  target_slug: string;
  link_type: string;
  created_at: number;
}

export interface SearchResult {
  slug: string;
  title: string;
  type: PageType;
  source: string;
  date: string;
  tags: string[];
  confidence: Confidence;
  content: string;
  score: number;
  scores?: { vector?: number; bm25?: number; graph?: number };
}

export interface MaintainReport {
  stale: string[];
  orphans: string[];
  dead_links: Array<{ source: string; target: string; type: string }>;
  duplicates: Array<{ slug1: string; slug2: string; similarity: number }>;
}
