export type AvailabilityStatus = "EN_MI_BIBLIOTECA" | "PRESTADO";
export type ReadingStatus = "SIN_ESTADO" | "LEIDO" | "POR_LEER";

export type LibraryRole = "OWNER" | "EDITOR" | "READER";

export type AuthSession = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  library: {
    id: string;
    name: string;
    role: LibraryRole;
  };
};

export type LibraryMember = {
  id: string;
  role: LibraryRole;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
};

export type Author = {
  id: string;
  fullName: string;
};

export type ShelfSection = {
  id: string;
  shelfId: string;
  name: string;
  position: number;
  description?: string | null;
  genreId?: string | null;
  genreRef?: Genre | null;
  genres: Genre[];
  capacity: number;
};

export type Subgenre = {
  id: string;
  genreId: string;
  name: string;
  slug: string;
};

export type Genre = {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
  createdAt: string;
  subgenres: Subgenre[];
};

export type Shelf = {
  id: string;
  name: string;
  description?: string | null;
  homeLocation: string;
  mapX: number;
  mapY: number;
  mapWidth: number;
  mapHeight: number;
  capacity: number;
  genres: Genre[];
  sections: ShelfSection[];
  _count?: { books: number };
};

export type Loan = {
  id: string;
  bookId: string;
  borrowerName: string;
  borrowerContact?: string | null;
  loanedAt: string;
  dueAt?: string | null;
  returnedAt?: string | null;
  notes?: string | null;
  status: "ACTIVO" | "DEVUELTO";
};

export type Book = {
  id: string;
  title: string;
  subtitle?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  publisher?: { id: string; name: string } | null;
  publicationYear?: number | null;
  pageCount?: number | null;
  genre?: string | null;
  genreId?: string | null;
  subgenreId?: string | null;
  deweyGenreRaw?: string | null;
  genreRef?: Genre | null;
  subgenre?: Subgenre | null;
  languageCode?: string | null;
  synopsis?: string | null;
  edition?: string | null;
  coverUrl?: string | null;
  deweyCode?: string | null;
  deweyHierarchy: string[];
  deweyExplanation?: string | null;
  lcCode?: string | null;
  lcHierarchy: string[];
  lcExplanation?: string | null;
  customTags: string[];
  classificationUpdatedAt?: string | null;
  labelSerial?: string | null;
  labelSystem?: "DEWEY" | "LC" | "PROPIA" | null;
  labelSize?: "PEQUENO" | "MEDIANO" | "PERSONALIZADO" | null;
  availabilityStatus: AvailabilityStatus;
  readingStatus: ReadingStatus;
  isReference: boolean;
  shelfSortOrder: number;
  shelf?: Shelf | null;
  shelfSection?: ShelfSection | null;
  authors: Author[];
  loans: Loan[];
  activeLoan?: Loan | null;
};

export type BookPayload = {
  title: string;
  authors: string[];
  subtitle?: string;
  isbn10?: string;
  isbn13?: string;
  publisher?: string;
  publicationYear?: number | "";
  pageCount?: number | "";
  genre?: string;
  genreId?: string;
  subgenreId?: string;
  deweyGenreRaw?: string;
  languageCode?: string;
  synopsis?: string;
  edition?: string;
  coverUrl?: string;
  deweyCode?: string;
  deweyHierarchy?: string[];
  deweyExplanation?: string;
  lcCode?: string;
  lcHierarchy?: string[];
  lcExplanation?: string;
  customTags?: string[];
  labelSerial?: string;
  labelSystem?: "DEWEY" | "LC" | "PROPIA";
  labelSize?: "PEQUENO" | "MEDIANO" | "PERSONALIZADO";
  availabilityStatus: AvailabilityStatus;
  readingStatus: ReadingStatus;
  isReference: boolean;
  shelfId?: string;
  shelfSectionId?: string;
};

export type DeweyGenreSuggestion = {
  genero_principal: string;
  subgenero?: string | null;
  confianza: "alta" | "media" | "baja";
  razon: string;
  genreId?: string | null;
  subgenreId?: string | null;
  isExistingGenre?: boolean;
  isExistingSubgenre?: boolean;
};

export type ExternalBookMetadata = {
  source: "open_library" | "google_books";
  isbn10?: string | null;
  isbn13?: string | null;
  title: string;
  authors: string[];
  publisher?: string | null;
  publicationYear?: number | null;
  pageCount?: number | null;
  genre?: string | null;
  subjects?: string[];
  deweyCode?: string | null;
  genreSuggestion?: DeweyGenreSuggestion | null;
  languageCode?: string | null;
  synopsis?: string | null;
  coverUrl?: string | null;
};

export type ClassificationPayload = {
  deweyCode?: string | null;
  deweyHierarchy: string[];
  deweyExplanation?: string | null;
  lcCode?: string | null;
  lcHierarchy: string[];
  lcExplanation?: string | null;
  customTags: string[];
  suggestedGenre?: string | null;
  suggestedSubgenre?: string | null;
  genreConfidence?: "alta" | "media" | "baja" | null;
  genreReason?: string | null;
  genreId?: string | null;
  subgenreId?: string | null;
};

export type DuplicateMatch = {
  book: Book;
  matchType: "ISBN" | "FUZZY";
  score: number;
  reason: string;
};

export type ReorganizationMove = {
  bookId: string;
  title: string;
  authors: string[];
  fromShelfId?: string | null;
  fromShelfName?: string | null;
  fromSectionId?: string | null;
  fromSectionName?: string | null;
  toShelfId: string;
  toShelfName: string;
  toSectionId?: string | null;
  toSectionName?: string | null;
  confirmed?: boolean;
};

export type ReorganizationSuggestion = {
  id: string;
  title: string;
  summary: string;
  reason: string;
  confidence: "alta" | "media" | "baja";
  moves: ReorganizationMove[];
};

export type ReorganizationReport = {
  source: "claude" | "local";
  generatedAt: string;
  overview: string;
  suggestions: ReorganizationSuggestion[];
};
