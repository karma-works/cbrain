import { Database } from 'bun:sqlite';
import { DB_PATH, ensureDir, CBRAIN_DIR } from './config.ts';
import type { Page, Link, Summary } from './types.ts';

const SCHEMA_VERSION = 2;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_meta (
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'cbrain',
  date TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  confidence TEXT NOT NULL DEFAULT 'medium',
  schema_version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL DEFAULT '',
  immutable INTEGER NOT NULL DEFAULT 0,
  embedding BLOB,
  embedding_provider TEXT,
  embedding_model TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_slug TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'leaf',
  level INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL DEFAULT '',
  token_count INTEGER NOT NULL DEFAULT 0,
  parent_id INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES summaries(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_summaries_page_kind ON summaries(page_slug, kind);
CREATE INDEX IF NOT EXISTS idx_summaries_parent ON summaries(parent_id);

CREATE INDEX IF NOT EXISTS idx_pages_type ON pages(type);
CREATE INDEX IF NOT EXISTS idx_pages_source ON pages(source);
CREATE INDEX IF NOT EXISTS idx_pages_date ON pages(date);
CREATE INDEX IF NOT EXISTS idx_pages_confidence ON pages(confidence);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_slug TEXT NOT NULL,
  target_slug TEXT NOT NULL,
  link_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (source_slug) REFERENCES pages(slug) ON DELETE CASCADE,
  UNIQUE(source_slug, target_slug, link_type)
);

CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_slug);
CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_slug);

CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
  slug UNINDEXED,
  title,
  content,
  content=pages,
  content_rowid=rowid
);

CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
  INSERT INTO pages_fts(rowid, slug, title, content)
  VALUES (new.rowid, new.slug, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
  INSERT INTO pages_fts(pages_fts, rowid, slug, title, content)
  VALUES ('delete', old.rowid, old.slug, old.title, old.content);
END;

CREATE TRIGGER IF NOT EXISTS pages_au AFTER UPDATE ON pages BEGIN
  INSERT INTO pages_fts(pages_fts, rowid, slug, title, content)
  VALUES ('delete', old.rowid, old.slug, old.title, old.content);
  INSERT INTO pages_fts(rowid, slug, title, content)
  VALUES (new.rowid, new.slug, new.title, new.content);
END;
`;

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;
  ensureDir(CBRAIN_DIR);
  _db = new Database(DB_PATH, { create: true });
  _db.exec('PRAGMA journal_mode=WAL;');
  _db.exec('PRAGMA foreign_keys=ON;');
  _db.exec(SCHEMA);
  const meta = _db.query('SELECT version FROM schema_meta LIMIT 1').get() as { version: number } | null;
  if (!meta) {
    _db.exec(`INSERT INTO schema_meta(version) VALUES (${SCHEMA_VERSION})`);
  } else if (meta.version < SCHEMA_VERSION) {
    runMigrations(_db, meta.version);
  }
  return _db;
}

function runMigrations(db: Database, fromVersion: number) {
  if (fromVersion < 2) {
    // v1 → v2: add immutable column to pages and create summaries table
    const cols = db.query('PRAGMA table_info(pages)').all() as Array<{ name: string }>;
    if (!cols.some(c => c.name === 'immutable')) {
      db.exec('ALTER TABLE pages ADD COLUMN immutable INTEGER NOT NULL DEFAULT 0;');
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_slug TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'leaf',
        level INTEGER NOT NULL DEFAULT 1,
        content TEXT NOT NULL DEFAULT '',
        token_count INTEGER NOT NULL DEFAULT 0,
        parent_id INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES summaries(id) ON DELETE SET NULL
      );
    `);
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_summaries_page_kind ON summaries(page_slug, kind);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_summaries_parent ON summaries(parent_id);');
    db.exec(`UPDATE schema_meta SET version = 2;`);
  }
}

export function closeDb() {
  if (_db) { _db.close(); _db = null; }
}

// --- Page CRUD ---

export function upsertPage(page: Omit<Page, 'created_at' | 'updated_at'> & { created_at?: number; updated_at?: number }) {
  const db = getDb();
  const now = Date.now();
  const existing = db.query('SELECT created_at FROM pages WHERE slug = ?').get(page.slug) as { created_at: number } | null;

  const embeddingBlob = page.embedding
    ? Buffer.from(page.embedding.buffer)
    : null;

  db.query(`
    INSERT INTO pages (slug, title, type, source, date, tags, confidence, schema_version, content,
      immutable, embedding, embedding_provider, embedding_model, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      title=excluded.title, type=excluded.type, source=excluded.source, date=excluded.date,
      tags=excluded.tags, confidence=excluded.confidence, schema_version=excluded.schema_version,
      content=excluded.content, immutable=excluded.immutable, embedding=excluded.embedding,
      embedding_provider=excluded.embedding_provider, embedding_model=excluded.embedding_model,
      updated_at=excluded.updated_at
  `).run(
    page.slug, page.title, page.type, page.source, page.date,
    JSON.stringify(page.tags), page.confidence, page.schema_version ?? 1,
    page.content, page.immutable ? 1 : 0, embeddingBlob,
    page.embedding_provider ?? null, page.embedding_model ?? null,
    page.created_at ?? existing?.created_at ?? now, now
  );
}

export function getPage(slug: string): Page | null {
  const db = getDb();
  const row = db.query('SELECT * FROM pages WHERE slug = ?').get(slug) as any;
  if (!row) return null;
  return rowToPage(row);
}

export function listPages(filter?: { type?: string; source?: string; limit?: number }): Page[] {
  const db = getDb();
  let sql = 'SELECT * FROM pages WHERE 1=1';
  const params: any[] = [];
  if (filter?.type) { sql += ' AND type = ?'; params.push(filter.type); }
  if (filter?.source) { sql += ' AND source = ?'; params.push(filter.source); }
  sql += ' ORDER BY updated_at DESC';
  if (filter?.limit) { sql += ' LIMIT ?'; params.push(filter.limit); }
  return (db.query(sql).all(...params) as any[]).map(rowToPage);
}

export function deletePage(slug: string) {
  getDb().query('DELETE FROM pages WHERE slug = ?').run(slug);
}

export function getAllEmbeddings(): Array<{ slug: string; embedding: Float32Array }> {
  const db = getDb();
  const rows = db.query('SELECT slug, embedding FROM pages WHERE embedding IS NOT NULL').all() as any[];
  return rows.map(r => ({
    slug: r.slug,
    embedding: new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4),
  }));
}

function rowToPage(row: any): Page {
  return {
    slug: row.slug,
    title: row.title,
    type: row.type,
    source: row.source,
    date: row.date,
    tags: JSON.parse(row.tags || '[]'),
    confidence: row.confidence,
    schema_version: row.schema_version,
    content: row.content,
    immutable: row.immutable === 1,
    embedding: row.embedding
      ? new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4)
      : undefined,
    embedding_provider: row.embedding_provider ?? undefined,
    embedding_model: row.embedding_model ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// --- Summary CRUD ---

export function upsertSummary(summary: Omit<Summary, 'id' | 'created_at' | 'updated_at'>): number {
  const db = getDb();
  const now = Date.now();
  const existing = db.query('SELECT id, created_at FROM summaries WHERE page_slug = ? AND kind = ?')
    .get(summary.page_slug, summary.kind) as { id: number; created_at: number } | null;

  if (existing) {
    db.query(`
      UPDATE summaries SET level=?, content=?, token_count=?, parent_id=?, updated_at=?
      WHERE id=?
    `).run(summary.level, summary.content, summary.token_count, summary.parent_id ?? null, now, existing.id);
    return existing.id;
  } else {
    const result = db.query(`
      INSERT INTO summaries (page_slug, kind, level, content, token_count, parent_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      summary.page_slug, summary.kind, summary.level, summary.content,
      summary.token_count, summary.parent_id ?? null, now, now
    );
    return result.lastInsertRowid as number;
  }
}

export function getSummaryForSlug(slug: string, kind: 'leaf' | 'condensed' = 'leaf'): Summary | null {
  const row = getDb()
    .query('SELECT * FROM summaries WHERE page_slug = ? AND kind = ?')
    .get(slug, kind) as any;
  return row ? rowToSummary(row) : null;
}

export function getSummariesForSlugs(slugs: string[]): Map<string, Summary> {
  if (!slugs.length) return new Map();
  const db = getDb();
  const placeholders = slugs.map(() => '?').join(',');
  const rows = db.query(
    `SELECT * FROM summaries WHERE page_slug IN (${placeholders}) AND kind = 'leaf'`
  ).all(...slugs) as any[];
  return new Map(rows.map(r => [r.page_slug, rowToSummary(r)]));
}

export function deleteSummariesForSlug(slug: string) {
  getDb().query('DELETE FROM summaries WHERE page_slug = ?').run(slug);
}

export function getPagesNeedingSummary(): Page[] {
  const db = getDb();
  const rows = db.query(`
    SELECT p.* FROM pages p
    LEFT JOIN summaries s ON s.page_slug = p.slug AND s.kind = 'leaf'
    WHERE s.id IS NULL OR s.updated_at < p.updated_at
    ORDER BY p.updated_at DESC
  `).all() as any[];
  return rows.map(rowToPage);
}

function rowToSummary(row: any): Summary {
  return {
    id: row.id,
    page_slug: row.page_slug,
    kind: row.kind,
    level: row.level,
    content: row.content,
    token_count: row.token_count,
    parent_id: row.parent_id ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// --- Link CRUD ---

export function upsertLink(link: Omit<Link, 'id' | 'created_at'>) {
  getDb().query(`
    INSERT OR IGNORE INTO links (source_slug, target_slug, link_type, created_at)
    VALUES (?, ?, ?, ?)
  `).run(link.source_slug, link.target_slug, link.link_type, Date.now());
}

export function getLinksFrom(slug: string): Link[] {
  return getDb().query('SELECT * FROM links WHERE source_slug = ?').all(slug) as Link[];
}

export function getLinksTo(slug: string): Link[] {
  return getDb().query('SELECT * FROM links WHERE target_slug = ?').all(slug) as Link[];
}

export function getAllLinks(): Link[] {
  return getDb().query('SELECT * FROM links').all() as Link[];
}

export function deleteLinksFrom(slug: string) {
  getDb().query('DELETE FROM links WHERE source_slug = ?').run(slug);
}

// --- FTS5 BM25 search ---

export function bm25Search(query: string, limit = 20): Array<{ slug: string; score: number }> {
  const db = getDb();
  try {
    const rows = db.query(`
      SELECT p.slug, bm25(pages_fts) AS bm25_score
      FROM pages_fts
      JOIN pages p ON pages_fts.rowid = p.rowid
      WHERE pages_fts MATCH ?
      ORDER BY bm25_score ASC
      LIMIT ?
    `).all(query, limit) as Array<{ slug: string; bm25_score: number }>;
    return rows.map((r, i) => ({ slug: r.slug, score: -(r.bm25_score) }));
  } catch {
    return [];
  }
}

// --- Graph neighbors ---

export function graphNeighbors(slugs: string[], hops = 1): string[] {
  const db = getDb();
  let frontier = new Set(slugs);
  const visited = new Set(slugs);
  for (let h = 0; h < hops; h++) {
    const arr = Array.from(frontier);
    const placeholders = arr.map(() => '?').join(',');
    if (!arr.length) break;
    const out = db.query(`SELECT DISTINCT target_slug AS s FROM links WHERE source_slug IN (${placeholders})`).all(...arr) as Array<{ s: string }>;
    const inn = db.query(`SELECT DISTINCT source_slug AS s FROM links WHERE target_slug IN (${placeholders})`).all(...arr) as Array<{ s: string }>;
    frontier = new Set();
    for (const r of [...out, ...inn]) {
      if (!visited.has(r.s)) { visited.add(r.s); frontier.add(r.s); }
    }
  }
  return Array.from(visited).filter(s => !slugs.includes(s));
}

// --- Stats ---

export function getStats() {
  const db = getDb();
  const pages = (db.query('SELECT COUNT(*) as n FROM pages').get() as any).n as number;
  const links = (db.query('SELECT COUNT(*) as n FROM links').get() as any).n as number;
  const withEmbedding = (db.query('SELECT COUNT(*) as n FROM pages WHERE embedding IS NOT NULL').get() as any).n as number;
  const withSummary = (db.query("SELECT COUNT(*) as n FROM summaries WHERE kind = 'leaf'").get() as any).n as number;
  const staleSummaries = (db.query(`
    SELECT COUNT(*) as n FROM pages p
    LEFT JOIN summaries s ON s.page_slug = p.slug AND s.kind = 'leaf'
    WHERE s.id IS NULL OR s.updated_at < p.updated_at
  `).get() as any).n as number;
  const byType = db.query('SELECT type, COUNT(*) as n FROM pages GROUP BY type').all() as Array<{ type: string; n: number }>;
  return { pages, links, withEmbedding, withSummary, staleSummaries, byType };
}
