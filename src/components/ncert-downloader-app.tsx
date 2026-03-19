"use client";

import {
  BookOpen,
  Boxes,
  Download,
  Filter,
  Layers3,
  LoaderCircle,
  NotebookText,
  Search,
} from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";

import { NcertBookReader } from "@/components/ncert-book-reader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  NCERT_CLASS_OPTIONS,
  NCERT_SUBJECT_OPTIONS,
  NCERT_THEMES,
  getNcertTheme,
} from "@/lib/ncert/catalog";
import type { NcertCatalogBook, NcertThemeSlug } from "@/lib/ncert/types";

type DownloaderProps = {
  catalog: NcertCatalogBook[];
};

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="min-w-0 border-stone-300/80 bg-white/90 shadow-[0_24px_80px_-48px_rgba(17,24,39,0.7)]">
      <CardHeader className="min-w-0 pb-2">
        <CardDescription className="text-xs uppercase tracking-[0.28em] text-stone-500">
          {title}
        </CardDescription>
        <CardTitle className="break-words font-serif text-3xl text-stone-900">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm leading-6 text-stone-600">{description}</CardContent>
    </Card>
  );
}

function BookCard({
  book,
  selected,
  active,
  onSelect,
  onToggleSelection,
}: {
  book: NcertCatalogBook;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  onToggleSelection: (checked: boolean) => void;
}) {
  return (
    <div
      className={`group min-w-0 w-full rounded-[1.75rem] border p-4 text-left transition sm:p-5 ${
        active
          ? "border-stone-900 bg-stone-950 text-stone-50 shadow-[0_24px_80px_-48px_rgba(17,24,39,0.9)]"
          : "border-stone-300/80 bg-white/80 text-stone-900 hover:border-stone-500 hover:bg-white"
      }`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={
                active
                  ? "border-stone-700 bg-stone-800 text-stone-100"
                  : "border-stone-300 bg-stone-100 text-stone-700"
              }
              variant="outline"
            >
              {book.classLabel}
            </Badge>
            <Badge
              className={
                active
                  ? "border-amber-500/30 bg-amber-400/10 text-amber-200"
                  : "border-amber-400/40 bg-amber-100 text-amber-900"
              }
              variant="outline"
            >
              {book.subject}
            </Badge>
          </div>
          <div className="min-w-0">
            <h3 className="break-words font-serif text-2xl leading-tight">{book.title}</h3>
            <p
              className={`mt-2 text-sm leading-6 ${
                active ? "text-stone-300" : "text-stone-600"
              }`}
            >
              Read online or download the PDF.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            {book.themes.slice(0, 3).map((themeSlug) => {
              const theme = getNcertTheme(themeSlug);
              if (!theme) {
                return null;
              }

              return (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    active ? "bg-stone-800 text-stone-200" : theme.accent
                  }`}
                  key={themeSlug}
                >
                  {theme.label}
                </span>
              );
            })}
          </div>
        </div>
        <div
          className={`self-start rounded-full border p-2.5 ${
            active ? "border-stone-700 bg-stone-900" : "border-stone-300 bg-white"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox checked={selected} onCheckedChange={(checked) => onToggleSelection(Boolean(checked))} />
        </div>
      </div>
    </div>
  );
}

export function NcertDownloaderApp({ catalog }: DownloaderProps) {
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<number | "all">("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedTheme, setSelectedTheme] = useState<NcertThemeSlug | "all">("all");
  const [selectedBookId, setSelectedBookId] = useState(catalog[0]?.id ?? "");
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const normalizedSearch = useDeferredValue(search.trim().toLowerCase());

  const filteredBooks = catalog.filter((book) => {
    const classMatch = selectedClass === "all" || book.classValue === selectedClass;
    const subjectMatch = selectedSubject === "all" || book.subject === selectedSubject;
    const themeMatch = selectedTheme === "all" || book.themes.includes(selectedTheme);
    const searchMatch = !normalizedSearch || book.searchText.includes(normalizedSearch);

    return classMatch && subjectMatch && themeMatch && searchMatch;
  });

  useEffect(() => {
    if (!filteredBooks.length) {
      setSelectedBookId("");
      return;
    }

    if (!filteredBooks.some((book) => book.id === selectedBookId)) {
      setSelectedBookId(filteredBooks[0].id);
    }
  }, [filteredBooks, selectedBookId]);

  const activeBook = catalog.find((book) => book.id === selectedBookId) ?? null;
  const readerRoute = activeBook ? `/api/books/${activeBook.id}/download?inline=1` : "";
  const readerTitle = activeBook ? activeBook.title : "";

  const classLabel =
    selectedClass === "all"
      ? null
      : NCERT_CLASS_OPTIONS.find((option) => option.value === selectedClass)?.label ?? null;
  const themeLabel = selectedTheme === "all" ? null : getNcertTheme(selectedTheme)?.label ?? null;

  const batchSourceLabel =
    selectedBookIds.length > 0
      ? "Manual selection"
      : classLabel && themeLabel
        ? `${classLabel} • ${themeLabel}`
        : classLabel
          ? `${classLabel} collection`
          : themeLabel
            ? `${themeLabel} collection`
            : selectedSubject !== "all"
              ? `${selectedSubject} collection`
              : normalizedSearch
                ? "Search results"
                : "Full English library";

  function toggleSelection(bookId: string, checked: boolean) {
    setSelectedBookIds((current) => {
      if (checked) {
        return current.includes(bookId) ? current : [...current, bookId];
      }

      return current.filter((entry) => entry !== bookId);
    });
  }

  function selectFilteredBooks() {
    setSelectedBookIds(filteredBooks.map((book) => book.id));
  }

  function clearSelection() {
    setSelectedBookIds([]);
  }

  function triggerBrowserDownload(url: string, filename?: string) {
    const anchor = document.createElement("a");
    anchor.href = url;
    if (filename) {
      anchor.download = filename;
    }
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  function getFilenameFromDisposition(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const basicMatch = value.match(/filename="?([^"]+)"?/i);
    return basicMatch?.[1] ?? null;
  }

  function downloadBooks(bookIds: string[]) {
    setDownloadError(null);
    setIsBulkDownloading(true);

    void (async () => {
      try {
        if (bookIds.length === 1) {
          triggerBrowserDownload(`/api/books/${bookIds[0]}/download`);
          return;
        }

        const response = await fetch("/api/download/bulk", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ bookIds }),
        });

        if (!response.ok) {
          let message = "The NCERT batch export failed.";

          try {
            const payload = (await response.json()) as { error?: string };
            if (payload.error) {
              message = payload.error;
            }
          } catch {
            // Keep the default message when the response is not JSON.
          }

          throw new Error(message);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        triggerBrowserDownload(
          url,
          getFilenameFromDisposition(response.headers.get("content-disposition")) ??
            `ncert-${bookIds.length}-books.zip`,
        );
        URL.revokeObjectURL(url);
      } catch (error: unknown) {
        setDownloadError(
          error instanceof Error ? error.message : "Could not download the selected NCERT books.",
        );
      } finally {
        setIsBulkDownloading(false);
      }
    })();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.18),transparent_36%),linear-gradient(180deg,#f6f1e7_0%,#efe4d4_50%,#e9dcc8_100%)] text-stone-900">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8 px-3 py-4 sm:px-6 lg:px-8 lg:py-6">
        <section className="overflow-hidden rounded-[2rem] border border-stone-300/80 bg-stone-950 text-stone-50 shadow-[0_40px_120px_-52px_rgba(17,24,39,0.85)]">
          <div className="grid gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:px-10 lg:py-10">
            <div className="min-w-0 space-y-6">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.28em] text-amber-200/90">
                <Badge className="border-amber-300/30 bg-amber-400/10 text-amber-200" variant="outline">
                  NCERT books
                </Badge>
                <span>Read and download</span>
              </div>
              <div className="min-w-0 space-y-4">
                <h1 className="max-w-4xl break-words font-serif text-4xl leading-tight sm:text-5xl lg:text-6xl">
                  Find NCERT books, read them online, and download PDFs when you need them.
                </h1>
                <p className="max-w-3xl break-words text-base leading-7 text-stone-300 sm:text-lg">
                  Search by class, subject, or theme, open any book to start reading, and download one book or many
                  together.
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap gap-3 text-sm text-stone-200">
                <span className="inline-flex items-center gap-2 rounded-full border border-stone-700 bg-stone-900/70 px-4 py-2">
                  <BookOpen className="h-4 w-4" />
                  Read in the browser
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-stone-700 bg-stone-900/70 px-4 py-2">
                  <Boxes className="h-4 w-4" />
                  Download many books together
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-stone-700 bg-stone-900/70 px-4 py-2">
                  <NotebookText className="h-4 w-4" />
                  Search by class or subject
                </span>
              </div>
            </div>
            <div className="min-w-0 grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              <StatCard
                description="Books available in this library."
                title="Catalog"
                value={`${catalog.length}`}
              />
              <StatCard
                description="Books matching your current search and filters."
                title="Filtered"
                value={`${filteredBooks.length}`}
              />
              <StatCard
                description="Books selected to download together."
                title="Selected"
                value={`${selectedBookIds.length}`}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0 space-y-6">
            <Card className="min-w-0 border-stone-300/80 bg-white/90 shadow-[0_24px_80px_-48px_rgba(17,24,39,0.7)]">
              <CardHeader className="space-y-4 px-3 sm:px-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="font-serif text-3xl text-stone-900">Browse the library</CardTitle>
                    <CardDescription className="mt-1 text-sm leading-6 text-stone-600">
                      Search or filter to find books, then download one or many.
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button className="rounded-full" onClick={selectFilteredBooks} variant="secondary">
                      Select filtered
                    </Button>
                    <Button
                      className="rounded-full"
                      disabled={!filteredBooks.length || isBulkDownloading}
                      onClick={() => downloadBooks(filteredBooks.map((book) => book.id))}
                      variant="outline"
                    >
                      {isBulkDownloading ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Download filtered
                    </Button>
                  </div>
                </div>
                <div className="rounded-[1.25rem] border border-stone-300 bg-stone-50 p-3 text-sm leading-6 text-stone-600">
                  Showing: <span className="font-medium text-stone-900">{batchSourceLabel}</span>
                  <span className="text-stone-500"> • {filteredBooks.length} books in the current export view</span>
                </div>

                <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <Input
                      className="h-12 rounded-full border-stone-300 bg-stone-50 pl-11 pr-4"
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by title, class, subject or theme"
                      value={search}
                    />
                  </div>
                  <label className="flex min-w-0 h-12 items-center gap-3 rounded-full border border-stone-300 bg-stone-50 px-4 text-sm text-stone-700">
                    <Filter className="h-4 w-4 text-stone-500" />
                    <select
                      className="min-w-0 w-full bg-transparent outline-none"
                      onChange={(event) => setSelectedSubject(event.target.value)}
                      value={selectedSubject}
                    >
                      <option value="all">All subjects</option>
                      {NCERT_SUBJECT_OPTIONS.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="min-w-0 space-y-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-stone-500">
                    <Layers3 className="h-4 w-4" />
                    Class filters
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <Button
                      className="rounded-full"
                      onClick={() => setSelectedClass("all")}
                      variant={selectedClass === "all" ? "default" : "outline"}
                    >
                      All classes
                    </Button>
                    {NCERT_CLASS_OPTIONS.map((classOption) => (
                      <Button
                        className="rounded-full"
                        key={classOption.value}
                        onClick={() => setSelectedClass(classOption.value)}
                        variant={selectedClass === classOption.value ? "default" : "outline"}
                      >
                        {classOption.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="min-w-0 space-y-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-stone-500">
                    <NotebookText className="h-4 w-4" />
                    Theme filters
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <Button
                      className="rounded-full"
                      onClick={() => setSelectedTheme("all")}
                      variant={selectedTheme === "all" ? "default" : "outline"}
                    >
                      All themes
                    </Button>
                    {NCERT_THEMES.map((theme) => (
                      <button
                        className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                          selectedTheme === theme.slug
                            ? "border-stone-900 bg-stone-950 text-stone-50"
                            : `${theme.accent} border-transparent hover:border-stone-400`
                        }`}
                        key={theme.slug}
                        onClick={() => setSelectedTheme(theme.slug)}
                        type="button"
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="min-w-0 border-stone-300/80 bg-white/90 shadow-[0_24px_80px_-48px_rgba(17,24,39,0.7)]">
              <CardHeader className="pb-3 px-3 sm:px-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="font-serif text-3xl text-stone-900">Books</CardTitle>
                    <CardDescription className="mt-1 text-sm leading-6 text-stone-600">
                      Click a book to read it or download it.
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      className="rounded-full"
                      disabled={!selectedBookIds.length}
                      onClick={() => downloadBooks(selectedBookIds)}
                    >
                      {isBulkDownloading ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Download selection
                    </Button>
                    <Button className="rounded-full" onClick={clearSelection} variant="outline">
                      Clear selection
                    </Button>
                  </div>
                </div>
                {downloadError ? <p className="text-sm text-red-700">{downloadError}</p> : null}
              </CardHeader>
              <CardContent className="min-w-0 px-3 pt-0 sm:px-4">
                <ScrollArea className="h-[760px] pr-4">
                  <div className="min-w-0 space-y-4">
                    {filteredBooks.length ? (
                      filteredBooks.map((book) => (
                        <BookCard
                          active={book.id === selectedBookId}
                          book={book}
                          key={book.id}
                          onSelect={() => setSelectedBookId(book.id)}
                          onToggleSelection={(checked) => toggleSelection(book.id, checked)}
                          selected={selectedBookIds.includes(book.id)}
                        />
                      ))
                    ) : (
                      <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 p-10 text-center text-stone-600">
                        No NCERT books match the current filters. Reset the theme or widen the search text.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0">
            <Card className="min-w-0 overflow-hidden border-stone-300/80 bg-white/90 shadow-[0_24px_80px_-48px_rgba(17,24,39,0.7)]">
              <CardHeader className="space-y-4 bg-[linear-gradient(135deg,rgba(17,24,39,0.96),rgba(68,64,60,0.94))] px-3 text-stone-50 sm:px-4">
                {activeBook ? (
                  <>
                    <div className="flex min-w-0 flex-wrap gap-2">
                      <Badge className="border-stone-600 bg-stone-900/50 text-stone-100" variant="outline">
                        {activeBook.classLabel}
                      </Badge>
                      <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-200" variant="outline">
                        {activeBook.subject}
                      </Badge>
                    </div>
                    <div className="min-w-0 space-y-2">
                      <CardTitle className="break-words font-serif text-4xl leading-tight text-stone-50">
                        {activeBook.title}
                      </CardTitle>
                      <CardDescription className="text-sm leading-6 text-stone-300">
                        Start reading below or download the PDF.
                      </CardDescription>
                    </div>
                    <Button
                      asChild
                      className="w-full rounded-full bg-amber-300 text-stone-950 hover:bg-amber-200 sm:w-auto"
                    >
                      <a href={`/api/books/${activeBook.id}/download`}>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </a>
                    </Button>
                  </>
                ) : (
                  <>
                    <CardTitle className="font-serif text-4xl text-stone-50">Pick a book</CardTitle>
                    <CardDescription className="text-sm leading-6 text-stone-300">
                      Choose a book to start reading.
                    </CardDescription>
                  </>
                )}
              </CardHeader>

              <CardContent className="p-4 sm:p-5">
                <NcertBookReader activeBook={activeBook} loading={false} sourceUrl={readerRoute} title={readerTitle} />
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
