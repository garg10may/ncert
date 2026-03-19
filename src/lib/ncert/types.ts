export type NcertThemeSlug =
  | "language"
  | "mathematics"
  | "science"
  | "geography"
  | "history"
  | "politics"
  | "economics"
  | "arts"
  | "technology"
  | "health"
  | "commerce"
  | "social-science"
  | "vocational";

export type NcertTheme = {
  slug: NcertThemeSlug;
  label: string;
  accent: string;
};

export type NcertCatalogBook = {
  id: string;
  classLabel: string;
  classValue: number;
  language: "english";
  medium: "english";
  subject: string;
  canonicalSubject: string;
  title: string;
  routeKey: string;
  routeQuery: string;
  route: string;
  themes: NcertThemeSlug[];
  batchKeys: string[];
  downloadReady: boolean;
  searchText: string;
};

export type NcertManifestSection = {
  id: string;
  label: string;
  href: string;
  sourceType: "asset" | "zip-entry";
  includeInFullBook: boolean;
  kind: "cover" | "content" | "supplement";
  pageCount: number;
  startPage: number;
};

export type NcertBookManifest = {
  book: NcertCatalogBook;
  previewHref?: string;
  zipHref?: string;
  sections: NcertManifestSection[];
  assemblyNotes: string[];
  warnings: string[];
  sourceSummary: {
    zipHref: string;
    coverSource: "none" | "external-asset" | "zip-entry";
    sectionCount: number;
  };
};
