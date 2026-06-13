import type { AuthSession, BookPayload, ClassificationPayload, DuplicateMatch, ExternalBookMetadata, LibraryAccess, LibraryMember, LibraryRole, ReorganizationReport } from "./types";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "biblioteca.auth.token";

let authToken = window.localStorage.getItem(TOKEN_KEY) ?? "";

export function setAuthToken(token: string) {
  authToken = token;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken() {
  return authToken;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options?.headers ?? {})
    }
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
    throw new Error(payload?.error?.message ?? "No se pudo completar la accion");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!contentType.includes("application/json")) {
    throw new Error("La API no respondio con JSON. Revisa que los contenedores esten reconstruidos y que el backend este activo.");
  }

  return response.json() as Promise<T>;
}

export const api = {
  register: (payload: { name: string; email: string; password: string; libraryName?: string }) =>
    request<AuthSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  login: (payload: { email: string; password: string }) =>
    request<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  me: () => request<Omit<AuthSession, "token">>("/me"),
  listLibraries: () => request<{ items: LibraryAccess[] }>("/libraries"),
  switchLibrary: (libraryId: string) =>
    request<AuthSession>("/auth/switch-library", {
      method: "POST",
      body: JSON.stringify({ libraryId })
    }),
  listMembers: () => request<{ items: LibraryMember[] }>("/members"),
  addMember: (payload: { email: string; role: LibraryRole }) =>
    request<LibraryMember>("/members", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateMember: (id: string, payload: { role: LibraryRole }) =>
    request<LibraryMember>(`/members/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteMember: (id: string) =>
    request<void>(`/members/${id}`, {
      method: "DELETE"
    }),
  listBooks: (params: URLSearchParams) => request<any>(`/books?${params.toString()}`),
  listGenres: () => request<any>("/genres"),
  createGenre: (payload: { name: string; color: string; icon: string }) =>
    request<any>("/genres", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateGenre: (id: string, payload: { name?: string; color?: string; icon?: string }) =>
    request<any>(`/genres/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteGenre: (id: string) =>
    request<void>(`/genres/${id}`, {
      method: "DELETE"
    }),
  createSubgenre: (genreId: string, payload: { name: string }) =>
    request<any>(`/genres/${genreId}/subgenres`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateSubgenre: (id: string, payload: { name?: string }) =>
    request<any>(`/subgenres/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteSubgenre: (id: string) =>
    request<void>(`/subgenres/${id}`, {
      method: "DELETE"
    }),
  lookupIsbn: (isbn: string) => request<ExternalBookMetadata>(`/external-books/isbn/${encodeURIComponent(isbn)}`),
  searchExternalBooks: (params: { title: string; author?: string; publisher?: string; year?: string }) => {
    const query = new URLSearchParams({ title: params.title });
    if (params.author?.trim()) query.set("author", params.author.trim());
    if (params.publisher?.trim()) query.set("publisher", params.publisher.trim());
    if (params.year?.trim()) query.set("year", params.year.trim());
    return request<{ items: ExternalBookMetadata[] }>(`/external-books/search?${query.toString()}`);
  },
  suggestClassification: (payload: { title: string; authors: string[]; genre?: string; synopsis?: string }) =>
    request<ClassificationPayload>("/classifications/suggest", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  saveClassification: (bookId: string, payload: ClassificationPayload) =>
    request<any>(`/books/${bookId}/classification`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  createBook: (payload: BookPayload) =>
    request<any>("/books", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  findDuplicates: (payload: Pick<BookPayload, "title" | "authors" | "isbn10" | "isbn13">) =>
    request<{ matches: DuplicateMatch[] }>("/books/duplicates", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateBook: (id: string, payload: Partial<BookPayload>) =>
    request<any>(`/books/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteBook: (id: string) =>
    request<void>(`/books/${id}`, {
      method: "DELETE"
    }),
  listShelves: () => request<any>("/shelves"),
  createShelf: (payload: { name: string; homeLocation: string; description?: string; mapX?: number; mapY?: number; mapWidth?: number; mapHeight?: number; capacity?: number; genreIds?: string[] }) =>
    request<any>("/shelves", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateShelf: (id: string, payload: { name?: string; homeLocation?: string; description?: string; mapX?: number; mapY?: number; mapWidth?: number; mapHeight?: number; capacity?: number; genreIds?: string[] }) =>
    request<any>(`/shelves/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteShelf: (id: string) =>
    request<void>(`/shelves/${id}`, {
      method: "DELETE"
    }),
  createSection: (shelfId: string, payload: { name: string; position: number; description?: string; genreId?: string; genreIds?: string[]; capacity?: number }) =>
    request<any>(`/shelves/${shelfId}/sections`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateSection: (id: string, payload: { name?: string; position?: number; description?: string; genreId?: string; genreIds?: string[]; capacity?: number }) =>
    request<any>(`/shelf-sections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  reorderSectionBooks: (shelfId: string, sectionId: string, bookIds: string[]) =>
    request<any>(`/shelves/${shelfId}/repisas/${sectionId}/books/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ bookIds })
    }),
  deleteSection: (id: string) =>
    request<void>(`/shelf-sections/${id}`, {
      method: "DELETE"
    }),
  createLoan: (bookId: string, payload: { borrowerName: string; borrowerContact?: string; dueAt?: string; notes?: string }) =>
    request<any>(`/books/${bookId}/loans`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  returnLoan: (loanId: string) =>
    request<any>(`/loans/${loanId}/return`, {
      method: "PATCH"
    }),
  suggestReorganization: () =>
    request<ReorganizationReport>("/reorganization/suggest", {
      method: "POST",
      body: JSON.stringify({})
    })
};
