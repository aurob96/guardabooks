import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import {
  Barcode,
  BookOpen,
  Camera,
  Check,
  FileText,
  Grid2X2,
  Image as ImageIcon,
  Download,
  Library,
  List,
  LogIn,
  LogOut,
  Menu,
  Map as MapIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  Save,
  Search,
  Send,
  Sparkles,
  Square,
  Tags,
  Trash2,
  Undo2,
  UserPlus,
  X
} from "lucide-react";
import { api, getAuthToken, setAuthToken } from "./api";
import type {
  AvailabilityStatus,
  AuthSession,
  Book,
  BookPayload,
  ClassificationPayload,
  DuplicateMatch,
  DeweyGenreSuggestion,
  ExternalBookMetadata,
  Genre,
  LibraryAccess,
  LibraryMember,
  LibraryRole,
  ReadingStatus,
  ReorganizationReport,
  ReorganizationSuggestion,
  Shelf
} from "./types";

const guardaLogo = "/guarda-logo.svg";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const initialBookForm: BookPayload = {
  title: "",
  authors: [""],
  subtitle: "",
  isbn10: "",
  isbn13: "",
  publisher: "",
  publicationYear: "",
  pageCount: "",
  genre: "",
  genreId: "",
  subgenreId: "",
  deweyGenreRaw: "",
  languageCode: "es",
  synopsis: "",
  edition: "",
  coverUrl: "",
  deweyCode: "",
  deweyHierarchy: [],
  deweyExplanation: "",
  lcCode: "",
  lcHierarchy: [],
  lcExplanation: "",
  customTags: [],
  labelSerial: "",
  labelSystem: "DEWEY",
  labelSize: "MEDIANO",
  availabilityStatus: "EN_MI_BIBLIOTECA",
  readingStatus: "SIN_ESTADO",
  isReference: false,
  shelfId: "",
  shelfSectionId: ""
};

const emptyClassification: ClassificationPayload = {
  deweyCode: "",
  deweyHierarchy: [],
  deweyExplanation: "",
  lcCode: "",
  lcHierarchy: [],
  lcExplanation: "",
  customTags: []
};

function formatAvailability(value: AvailabilityStatus) {
  return value === "PRESTADO" ? "Prestado" : "En mi biblioteca";
}

function formatReading(value: ReadingStatus) {
  if (value === "LEIDO") return "Leido";
  if (value === "POR_LEER") return "Por leer";
  return "Sin estado";
}

function authorsLine(book: Book) {
  return book.authors.map((author) => author.fullName).join(", ");
}

export function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [subgenreFilter, setSubgenreFilter] = useState("");
  const [shelfFilter, setShelfFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("updated");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [drawerMode, setDrawerMode] = useState<"menu" | "book" | "classification" | "labels" | "loan">("menu");
  const [activeView, setActiveView] = useState<"catalog" | "book-flow" | "management" | "map" | "assistant">("catalog");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(Boolean(getAuthToken()));
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", libraryName: "" });
  const [members, setMembers] = useState<LibraryMember[]>([]);
  const [libraries, setLibraries] = useState<LibraryAccess[]>([]);
  const [memberForm, setMemberForm] = useState<{ email: string; role: LibraryRole }>({ email: "", role: "READER" });
  const [bookFlowStep, setBookFlowStep] = useState(1);
  const [bookEntryMethod, setBookEntryMethod] = useState<"scan" | "isbn" | "search" | "manual" | "">("");
  const [openBookMenuId, setOpenBookMenuId] = useState("");
  const [openToolSections, setOpenToolSections] = useState(["scan", "book"]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [bookForm, setBookForm] = useState<BookPayload>(initialBookForm);
  const [deweyGenreSuggestion, setDeweyGenreSuggestion] = useState<DeweyGenreSuggestion | null>(null);
  const [pendingBookPayload, setPendingBookPayload] = useState<BookPayload | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [editingBookId, setEditingBookId] = useState("");
  const [isbnLookup, setIsbnLookup] = useState("");
  const [isbnLookupNotice, setIsbnLookupNotice] = useState<{ type: "error" | "warning" | "success"; text: string } | null>(null);
  const [bookSearchForm, setBookSearchForm] = useState({ title: "", author: "", publisher: "", year: "" });
  const [bookSearchResults, setBookSearchResults] = useState<ExternalBookMetadata[]>([]);
  const [scanStatus, setScanStatus] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isBookSearching, setIsBookSearching] = useState(false);
  const [classificationBook, setClassificationBook] = useState<Book | null>(null);
  const [classificationDraft, setClassificationDraft] = useState<ClassificationPayload>(emptyClassification);
  const [isClassifying, setIsClassifying] = useState(false);
  const [genreForm, setGenreForm] = useState({ name: "", color: "#461e60", icon: "ti-book" });
  const [subgenreForm, setSubgenreForm] = useState({ genreId: "", name: "" });
  const [editingGenreId, setEditingGenreId] = useState("");
  const [editingSubgenreId, setEditingSubgenreId] = useState("");
  const initialShelfForm = { name: "", homeLocation: "", description: "", mapX: 80, mapY: 80, mapWidth: 130, mapHeight: 72, capacity: 40, genreIds: [] as string[] };
  const [shelfForm, setShelfForm] = useState(initialShelfForm);
  const initialSectionForm = { shelfId: "", name: "", position: 1, genreId: "", genreIds: [] as string[], capacity: 12 };
  const [sectionForm, setSectionForm] = useState(initialSectionForm);
  const [editingShelfId, setEditingShelfId] = useState("");
  const [editingSectionId, setEditingSectionId] = useState("");
  const [isShelfEditorOpen, setIsShelfEditorOpen] = useState(false);
  const [openShelfMenuId, setOpenShelfMenuId] = useState("");
  const [loanForm, setLoanForm] = useState({ bookId: "", borrowerName: "", borrowerContact: "", dueAt: "", notes: "" });
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [labelBookId, setLabelBookId] = useState("");
  const [labelSystem, setLabelSystem] = useState<"DEWEY" | "LC" | "PROPIA">("DEWEY");
  const [labelSize, setLabelSize] = useState<"PEQUENO" | "MEDIANO" | "PERSONALIZADO">("MEDIANO");
  const [labelWidth, setLabelWidth] = useState(3);
  const [labelHeight, setLabelHeight] = useState(4);
  const [labelPageSize, setLabelPageSize] = useState<"letter" | "A4">("letter");
  const [labelColumns, setLabelColumns] = useState(4);
  const [includeShelfOnLabel, setIncludeShelfOnLabel] = useState(true);
  const [labelSerialDraft, setLabelSerialDraft] = useState("");
  const [selectedMapShelfId, setSelectedMapShelfId] = useState("");
  const [highlightedShelfId, setHighlightedShelfId] = useState("");
  const [highlightedBookId, setHighlightedBookId] = useState("");
  const [activeSpineBookId, setActiveSpineBookId] = useState("");
  const [draggedBookId, setDraggedBookId] = useState("");
  const [reorganizationReport, setReorganizationReport] = useState<ReorganizationReport | null>(null);
  const [acceptedSuggestionId, setAcceptedSuggestionId] = useState("");
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);
  const [isReorganizing, setIsReorganizing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);

  const selectedShelf = useMemo(
    () => shelves.find((shelf) => shelf.id === bookForm.shelfId),
    [bookForm.shelfId, shelves]
  );
  const selectedShelfSection = useMemo(
    () => selectedShelf?.sections.find((section) => section.id === bookForm.shelfSectionId),
    [bookForm.shelfSectionId, selectedShelf]
  );
  const selectedBookGenre = useMemo(
    () => genres.find((genre) => genre.id === bookForm.genreId),
    [bookForm.genreId, genres]
  );
  const selectedBookSubgenres = selectedBookGenre?.subgenres ?? [];
  const filterSubgenres = genreFilter
    ? genres.find((genre) => genre.id === genreFilter)?.subgenres ?? []
    : genres.flatMap((genre) => genre.subgenres);
  const selectedSectionGenreMismatch = Boolean(
    selectedShelfSection &&
      bookForm.genreId &&
      (selectedShelfSection.genres?.length
        ? !selectedShelfSection.genres.some((genre) => genre.id === bookForm.genreId)
        : selectedShelfSection.genreId && selectedShelfSection.genreId !== bookForm.genreId)
  );
  const selectedShelfGenreMismatch = Boolean(
    selectedShelf?.genres?.length && bookForm.genreId && !selectedShelf.genres.some((genre) => genre.id === bookForm.genreId)
  );
  const labelBook = useMemo(() => books.find((book) => book.id === labelBookId) ?? null, [books, labelBookId]);
  const selectedBooks = useMemo(
    () => books.filter((book) => selectedBookIds.includes(book.id)),
    [books, selectedBookIds]
  );
  const selectedMapShelf = useMemo(
    () => shelves.find((shelf) => shelf.id === selectedMapShelfId) ?? null,
    [selectedMapShelfId, shelves]
  );
  const selectedMapShelfBooks = useMemo(
    () => books.filter((book) => book.shelf?.id === selectedMapShelfId),
    [books, selectedMapShelfId]
  );
  const booksBySection = useMemo(() => {
    const groups = new Map<string, Book[]>();
    for (const book of selectedMapShelfBooks) {
      const key = book.shelfSection?.id ?? "sin-repisa";
      groups.set(key, [...(groups.get(key) ?? []), book]);
    }
    return groups;
  }, [selectedMapShelfBooks]);
  const acceptedSuggestion = useMemo(
    () => reorganizationReport?.suggestions.find((suggestion) => suggestion.id === acceptedSuggestionId) ?? null,
    [acceptedSuggestionId, reorganizationReport]
  );

  async function loadData() {
    if (!getAuthToken()) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100"
      });
      if (query.trim()) params.set("q", query.trim());
      if (genreFilter) params.set("genreId", genreFilter);
      if (subgenreFilter) params.set("subgenreId", subgenreFilter);
      if (shelfFilter) params.set("shelfId", shelfFilter);
      params.set("sort", sortOrder);

      const [bookResult, shelfResult, genreResult, memberResult, libraryResult] = await Promise.all([
        api.listBooks(params),
        api.listShelves(),
        api.listGenres(),
        session?.library.role === "OWNER" ? api.listMembers() : Promise.resolve({ items: [] }),
        api.listLibraries()
      ]);
      setBooks(bookResult.items);
      setTotal(bookResult.total);
      setShelves(shelfResult.items);
      setGenres(genreResult.items);
      setMembers(memberResult.items);
      setLibraries(libraryResult.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la biblioteca");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!session) return undefined;
    const id = window.setTimeout(loadData, 250);
    return () => window.clearTimeout(id);
  }, [session, query, genreFilter, subgenreFilter, shelfFilter, sortOrder]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setIsSessionLoading(false);
      setIsLoading(false);
      return;
    }

    api.me()
      .then((current) => {
        setSession({ token, ...current });
      })
      .catch(() => {
        setAuthToken("");
        setSession(null);
      })
      .finally(() => {
        setIsSessionLoading(false);
      });
  }, []);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    return () => stopScanner();
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const videoDevices = devices.filter((device) => device.kind === "videoinput");
        setCameraDevices(videoDevices);
        if (!selectedCameraId && videoDevices.length > 0) {
          const rearCamera = videoDevices.find((device) => /back|rear|environment|trasera|posterior/i.test(device.label));
          setSelectedCameraId((rearCamera ?? videoDevices[0]).deviceId);
        }
      })
      .catch(() => undefined);
  }, [isScanning, selectedCameraId]);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome !== "dismissed") {
      setInstallPrompt(null);
    }
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const nextSession = authMode === "register"
        ? await api.register({
            name: authForm.name,
            email: authForm.email,
            password: authForm.password,
            libraryName: authForm.libraryName || undefined
          })
        : await api.login({ email: authForm.email, password: authForm.password });

      setAuthToken(nextSession.token);
      setSession(nextSession);
      setAuthForm({ name: "", email: "", password: "", libraryName: "" });
      setMessage(`Sesion iniciada en ${nextSession.library.name}`);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "No se pudo iniciar sesion");
    }
  }

  function logout() {
    setAuthToken("");
    setSession(null);
    setLibraries([]);
    setBooks([]);
    setShelves([]);
    setGenres([]);
    setTotal(0);
    setMessage("");
    setError("");
  }

  async function switchLibrary(libraryId: string) {
    if (!libraryId || libraryId === session?.library.id) return;
    setError("");
    setMessage("");
    try {
      const nextSession = await api.switchLibrary(libraryId);
      setAuthToken(nextSession.token);
      setSession(nextSession);
      setSelectedBookIds([]);
      setShelfFilter("");
      setGenreFilter("");
      setSubgenreFilter("");
      setActiveView("catalog");
      setMessage(`Biblioteca activa: ${nextSession.library.name}`);
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "No se pudo cambiar de biblioteca");
    }
  }

  useEffect(() => {
    if (activeView !== "map" || selectedMapShelfId || !query.trim()) return;
    const shelfWithMatch = shelves.find((shelf) => shelfHasSearchMatch(shelf));
    if (!shelfWithMatch) return;
    setHighlightedShelfId(shelfWithMatch.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`shelf-card-${shelfWithMatch.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [activeView, books, query, selectedMapShelfId, shelves]);

  function cleanIsbn(value: string) {
    return value.replace(/[^0-9X]/gi, "").toUpperCase();
  }

  function applyExternalBook(metadata: ExternalBookMetadata) {
    const suggestion = metadata.genreSuggestion ?? null;
    setDeweyGenreSuggestion(suggestion);
    setBookForm((current) => ({
      ...current,
      title: metadata.title ?? current.title,
      authors: metadata.authors?.length ? metadata.authors : current.authors,
      isbn10: metadata.isbn10 ?? current.isbn10,
      isbn13: metadata.isbn13 ?? current.isbn13,
      publisher: metadata.publisher ?? current.publisher,
      publicationYear: metadata.publicationYear ?? current.publicationYear,
      pageCount: metadata.pageCount ?? current.pageCount,
      genre: metadata.genre ?? current.genre,
      genreId: suggestion?.confianza === "alta" && suggestion.genreId ? suggestion.genreId : current.genreId,
      subgenreId: suggestion?.confianza === "alta" && suggestion.subgenreId ? suggestion.subgenreId : current.subgenreId,
      deweyGenreRaw: [metadata.deweyCode, ...(metadata.subjects ?? [])].filter(Boolean).join(" | ") || metadata.genre || current.deweyGenreRaw,
      deweyCode: metadata.deweyCode ?? current.deweyCode,
      languageCode: metadata.languageCode ?? current.languageCode,
      synopsis: metadata.synopsis ?? current.synopsis,
      coverUrl: metadata.coverUrl ?? current.coverUrl
    }));
  }

  function applyDeweyGenreSuggestion() {
    if (!deweyGenreSuggestion) return;
    setBookForm((current) => ({
      ...current,
      genre: deweyGenreSuggestion.genero_principal,
      genreId: deweyGenreSuggestion.genreId ?? current.genreId,
      subgenreId: deweyGenreSuggestion.subgenreId ?? "",
      deweyGenreRaw: current.deweyGenreRaw || deweyGenreSuggestion.razon
    }));
    setMessage("Genero sugerido aplicado. Puedes ajustarlo antes de guardar.");
  }

  function splitLines(value: string) {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function splitTags(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function classificationFromBook(book: Book): ClassificationPayload {
    return {
      deweyCode: book.deweyCode ?? "",
      deweyHierarchy: book.deweyHierarchy ?? [],
      deweyExplanation: book.deweyExplanation ?? "",
      lcCode: book.lcCode ?? "",
      lcHierarchy: book.lcHierarchy ?? [],
      lcExplanation: book.lcExplanation ?? "",
      customTags: book.customTags ?? []
    };
  }

  function classificationFromForm(): ClassificationPayload {
    return {
      deweyCode: bookForm.deweyCode ?? "",
      deweyHierarchy: bookForm.deweyHierarchy ?? [],
      deweyExplanation: bookForm.deweyExplanation ?? "",
      lcCode: bookForm.lcCode ?? "",
      lcHierarchy: bookForm.lcHierarchy ?? [],
      lcExplanation: bookForm.lcExplanation ?? "",
      customTags: bookForm.customTags ?? []
    };
  }

  function openClassificationAssistant(book?: Book) {
    setClassificationBook(book ?? null);
    if (book) {
      setEditingBookId(book.id);
      setBookForm(bookToForm(book));
      setActiveView("catalog");
      setIsToolsOpen(true);
      setDrawerMode("classification");
      setOpenToolSections(["classification"]);
      setOpenBookMenuId("");
    }
    setClassificationDraft(book ? classificationFromBook(book) : classificationFromForm());
    setMessage(book ? `Clasificando "${book.title}"` : "Clasificando el libro del formulario");
    setError("");
  }

  function applyClassificationToForm(payload: ClassificationPayload) {
    setBookForm((current) => ({
      ...current,
      deweyCode: payload.deweyCode ?? "",
      deweyHierarchy: payload.deweyHierarchy,
      deweyExplanation: payload.deweyExplanation ?? "",
      lcCode: payload.lcCode ?? "",
      lcHierarchy: payload.lcHierarchy,
      lcExplanation: payload.lcExplanation ?? "",
      customTags: payload.customTags,
      genre: payload.suggestedGenre ?? current.genre,
      genreId: payload.genreId ?? current.genreId,
      subgenreId: payload.subgenreId ?? current.subgenreId
    }));
  }

  async function suggestClassification() {
    const source = classificationBook;
    const title = source?.title ?? bookForm.title;
    const authors = source?.authors.map((author) => author.fullName) ?? bookForm.authors.filter(Boolean);
    const genre = source?.genre ?? bookForm.genre;
    const synopsis = source?.synopsis ?? bookForm.synopsis;

    if (!title.trim()) {
      setError("Agrega un titulo antes de pedir una clasificacion");
      return;
    }

    setError("");
    setMessage("");
    setIsClassifying(true);
    try {
      const suggestion = await api.suggestClassification({ title, authors, genre, synopsis });
      setClassificationDraft(suggestion);
      setMessage("Sugerencia generada. Puedes editarla antes de aceptar.");
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : "No se pudo generar la clasificacion");
    } finally {
      setIsClassifying(false);
    }
  }

  async function classifyFormBook() {
    const title = bookForm.title.trim();
    if (!title) return;
    setIsClassifying(true);
    setError("");
    try {
      const suggestion = await api.suggestClassification({
        title,
        authors: bookForm.authors.filter(Boolean),
        genre: bookForm.genre,
        synopsis: bookForm.synopsis
      });
      setClassificationDraft(suggestion);
      applyClassificationToForm(suggestion);
      setMessage("Clasificacion y genero sugeridos aplicados. Puedes ajustar antes de guardar.");
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : "No se pudo generar la clasificacion");
    } finally {
      setIsClassifying(false);
    }
  }

  async function startBookClassification(book: Book) {
    openClassificationAssistant(book);
    setIsClassifying(true);
    setError("");
    try {
      const suggestion = await api.suggestClassification({
        title: book.title,
        authors: book.authors.map((author) => author.fullName),
        genre: book.genre ?? undefined,
        synopsis: book.synopsis ?? undefined
      });
      setClassificationDraft(suggestion);
      setMessage("Sugerencia generada. Puedes editarla antes de continuar.");
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : "No se pudo generar la clasificacion");
    } finally {
      setIsClassifying(false);
    }
  }

  async function acceptClassification() {
    setError("");
    setMessage("");
    try {
      if (classificationBook) {
        const updated = await api.saveClassification(classificationBook.id, classificationDraft);
        setClassificationBook(updated);
        setMessage("Clasificacion guardada en el libro");
        await loadData();
      } else {
        applyClassificationToForm(classificationDraft);
        setMessage("Clasificacion aplicada al formulario. Revisa y guarda el libro.");
      }
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : "No se pudo guardar la clasificacion");
    }
  }

  async function lookupIsbn(isbnValue: string) {
    const isbn = cleanIsbn(isbnValue);
    if (!/^(?:\d{13}|\d{9}[\dX])$/.test(isbn)) {
      setIsbnLookupNotice({ type: "error", text: "El ISBN debe tener 10 o 13 caracteres validos." });
      return;
    }

    setError("");
    setMessage("");
    setIsbnLookupNotice(null);
    setIsLookupLoading(true);
    try {
      const metadata = await api.lookupIsbn(isbn);
      applyExternalBook(metadata);
      setIsbnLookup(isbn);
      setBookFlowStep(2);
      void checkDuplicates({
        ...bookForm,
        title: metadata.title,
        authors: metadata.authors?.length ? metadata.authors : bookForm.authors,
        isbn10: metadata.isbn10 ?? bookForm.isbn10,
        isbn13: metadata.isbn13 ?? bookForm.isbn13
      } as BookPayload);
      setIsbnLookupNotice({ type: "success", text: `Datos importados desde ${metadata.source === "open_library" ? "Open Library" : "Google Books"}.` });
      setMessage(`Datos importados desde ${metadata.source === "open_library" ? "Open Library" : "Google Books"}. Revisa el formulario antes de guardar.`);
    } catch (lookupError) {
      setIsbnLookupNotice({
        type: "warning",
        text: lookupError instanceof Error ? lookupError.message : "No se encontraron datos para ese ISBN."
      });
      setBookForm((current) => ({
        ...current,
        isbn10: isbn.length === 10 ? isbn : current.isbn10,
        isbn13: isbn.length === 13 ? isbn : current.isbn13
      }));
      setBookEntryMethod("search");
    } finally {
      setIsLookupLoading(false);
    }
  }

  async function searchBooksWithoutIsbn() {
    const title = bookSearchForm.title.trim();
    if (title.length < 2) {
      setError("Escribe al menos 2 caracteres del titulo");
      return;
    }

    setError("");
    setMessage("");
    setIsBookSearching(true);
    try {
      const result = await api.searchExternalBooks({
        title,
        author: bookSearchForm.author,
        publisher: bookSearchForm.publisher,
        year: bookSearchForm.year
      });
      setBookSearchResults(result.items);
      setMessage(result.items.length ? "Elige una opcion para completar el formulario." : "No encontre resultados publicos para esa busqueda.");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "No se pudo buscar el libro");
    } finally {
      setIsBookSearching(false);
    }
  }

  function useExternalBookResult(metadata: ExternalBookMetadata) {
    applyExternalBook(metadata);
    setBookSearchResults([]);
    setBookFlowStep(2);
    void checkDuplicates({
      ...bookForm,
      title: metadata.title,
      authors: metadata.authors?.length ? metadata.authors : bookForm.authors,
      isbn10: metadata.isbn10 ?? bookForm.isbn10,
      isbn13: metadata.isbn13 ?? bookForm.isbn13
    } as BookPayload);
    setMessage(`Datos importados desde ${metadata.source === "open_library" ? "Open Library" : "Google Books"}. Revisa el formulario antes de guardar.`);
  }

  async function startScanner() {
    if (!videoRef.current) {
      return;
    }

    stopScanner();
    setError("");
    setMessage("");
    setScanStatus("Solicitando acceso a la camara...");
    setIsScanning(true);

    try {
      const reader = new BrowserMultiFormatReader();
      const rearCameraConstraints = {
        deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
        facingMode: selectedCameraId ? undefined : { exact: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        focusMode: "continuous"
      } as MediaTrackConstraints;
      const constraints: MediaStreamConstraints[] = [
        selectedCameraId
          ? { video: rearCameraConstraints }
          : { video: rearCameraConstraints },
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        { video: true }
      ];

      let lastScanError: unknown = null;
      for (const constraint of constraints) {
        try {
          scannerControlsRef.current = await reader.decodeFromConstraints(
            constraint,
            videoRef.current,
            (result, _error, controls) => {
              const text = result?.getText();
              if (!text) {
                return;
              }

              const isbn = cleanIsbn(text);
              if (!/^(?:\d{13}|\d{9}[\dX])$/.test(isbn)) {
                setScanStatus(`Codigo detectado, pero no parece ISBN: ${text}`);
                return;
              }

              controls.stop();
              scannerControlsRef.current = null;
              setIsScanning(false);
              setScanStatus(`ISBN detectado: ${isbn}`);
              void lookupIsbn(isbn);
            }
          );
          setScanStatus("Apunta la camara trasera al codigo ISBN. Acerca o aleja hasta que el codigo quede nitido.");
          return;
        } catch (scanAttemptError) {
          lastScanError = scanAttemptError;
        }
      }

      throw lastScanError;
    } catch (scanError) {
      setIsScanning(false);
      scannerControlsRef.current = null;
      const message = scanError instanceof Error ? scanError.message : "No se pudo iniciar la camara";
      setError(`${message}. Si estas en celular, abre la app por HTTPS y revisa permisos de camara. Tambien puedes escribir el ISBN manualmente.`);
      setScanStatus("No se pudo usar la camara. Escribe el ISBN manualmente o cambia la camara.");
    }
  }

  function stopScanner() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setIsScanning(false);
    setScanStatus("");
  }

  function normalizedBookPayload(): BookPayload {
    const draft = {
      ...bookForm,
      authors: bookForm.authors.map((author) => author.trim()).filter(Boolean),
      publicationYear: bookForm.publicationYear === "" ? undefined : Number(bookForm.publicationYear),
      pageCount: bookForm.pageCount === "" ? undefined : Number(bookForm.pageCount)
    };
    return {
      ...draft,
      labelSerial: draft.labelSerial || generateLabelSerialFromForm()
    };
  }

  async function checkDuplicates(payload: BookPayload) {
    if (!payload.title.trim() || payload.authors.length === 0 || editingBookId) {
      return [];
    }

    const result = await api.findDuplicates({
      title: payload.title,
      authors: payload.authors,
      isbn10: payload.isbn10,
      isbn13: payload.isbn13
    });

    if (result.matches.length > 0) {
      setDuplicateMatches(result.matches);
      setPendingBookPayload(payload);
      return result.matches;
    }

    return [];
  }

  async function saveBookPayload(payload: BookPayload, forceCreate = false) {
    setError("");
    setMessage("");
    try {
      if (!editingBookId && !forceCreate) {
        const matches = await checkDuplicates(payload);
        if (matches.length > 0) {
          setMessage("Encontramos posibles duplicados antes de guardar");
          return;
        }
      }

      if (editingBookId) {
        await api.updateBook(editingBookId, payload);
      } else {
        await api.createBook(payload);
      }
      setBookForm(initialBookForm);
      setDeweyGenreSuggestion(null);
      setEditingBookId("");
      setIsbnLookup("");
      setIsbnLookupNotice(null);
      setPendingBookPayload(null);
      setDuplicateMatches([]);
      setActiveView("catalog");
      setIsToolsOpen(false);
      setDrawerMode("menu");
      setBookFlowStep(1);
      setBookEntryMethod("");
      setMessage(editingBookId ? "Libro actualizado" : "Libro agregado al catalogo");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el libro");
    }
  }

  async function submitBook(event: FormEvent) {
    event.preventDefault();
    await saveBookPayload(normalizedBookPayload());
  }

  function startNewBookFlow() {
    stopScanner();
    setEditingBookId("");
    setBookForm(initialBookForm);
    setDeweyGenreSuggestion(null);
    setDuplicateMatches([]);
    setPendingBookPayload(null);
    setBookSearchResults([]);
    setIsbnLookup("");
    setIsbnLookupNotice(null);
    setBookEntryMethod("");
    setBookFlowStep(1);
    setActiveView("catalog");
    setIsToolsOpen(true);
    setDrawerMode("book");
    setOpenToolSections(["scan", "book"]);
    setMessage("");
    setError("");
  }

  function cancelBookFlow() {
    stopScanner();
    setEditingBookId("");
    setBookForm(initialBookForm);
    setDeweyGenreSuggestion(null);
    setDuplicateMatches([]);
    setPendingBookPayload(null);
    setBookSearchResults([]);
    setIsbnLookupNotice(null);
    setBookFlowStep(1);
    setBookEntryMethod("");
    setActiveView("catalog");
    setIsToolsOpen(false);
    setDrawerMode("menu");
    setMessage("");
    setError("");
  }

  function chooseBookEntryMethod(method: "scan" | "isbn" | "search" | "manual") {
    setBookEntryMethod(method);
    setIsbnLookupNotice(null);
    if (method === "manual") {
      setBookFlowStep(2);
    }
  }

  async function addDuplicateAnyway() {
    if (!pendingBookPayload) return;
    await saveBookPayload(pendingBookPayload, true);
  }

  async function updateDuplicateExisting(match: DuplicateMatch) {
    if (!pendingBookPayload) return;
    setError("");
    setMessage("");
    try {
      await api.updateBook(match.book.id, pendingBookPayload);
      setBookForm(initialBookForm);
      setDeweyGenreSuggestion(null);
      setPendingBookPayload(null);
      setDuplicateMatches([]);
      setMessage("Libro existente actualizado con la informacion nueva");
      await loadData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo actualizar el libro existente");
    }
  }

  function cancelDuplicateSave() {
    setPendingBookPayload(null);
    setDuplicateMatches([]);
    setMessage("Guardado cancelado");
  }

  async function submitShelf(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (editingShelfId) {
        await api.updateShelf(editingShelfId, shelfForm);
      } else {
        await api.createShelf(shelfForm);
      }
      setShelfForm(initialShelfForm);
      setEditingShelfId("");
      setIsShelfEditorOpen(false);
      setMessage(editingShelfId ? "Estanteria actualizada" : "Estanteria creada");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear la estanteria");
    }
  }

  async function submitGenre(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (editingGenreId) {
        await api.updateGenre(editingGenreId, genreForm);
      } else {
        await api.createGenre(genreForm);
      }
      setGenreForm({ name: "", color: "#461e60", icon: "ti-book" });
      setEditingGenreId("");
      setMessage(editingGenreId ? "Genero actualizado" : "Genero creado");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el genero");
    }
  }

  async function submitSubgenre(event: FormEvent) {
    event.preventDefault();
    if (!subgenreForm.genreId) return;
    setError("");
    setMessage("");
    try {
      if (editingSubgenreId) {
        await api.updateSubgenre(editingSubgenreId, { name: subgenreForm.name });
      } else {
        await api.createSubgenre(subgenreForm.genreId, { name: subgenreForm.name });
      }
      setSubgenreForm({ genreId: "", name: "" });
      setEditingSubgenreId("");
      setMessage(editingSubgenreId ? "Subgenero actualizado" : "Subgenero creado");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el subgenero");
    }
  }

  async function submitSection(event: FormEvent) {
    event.preventDefault();
    if (!sectionForm.shelfId) return;
    setError("");
    setMessage("");
    try {
      if (editingSectionId) {
        await api.updateSection(editingSectionId, {
          name: sectionForm.name,
          position: Number(sectionForm.position),
          genreId: sectionForm.genreIds[0] ?? sectionForm.genreId,
          genreIds: sectionForm.genreIds,
          capacity: Number(sectionForm.capacity)
        });
      } else {
        await api.createSection(sectionForm.shelfId, {
          name: sectionForm.name,
          position: Number(sectionForm.position),
          genreId: sectionForm.genreIds[0] ?? sectionForm.genreId,
          genreIds: sectionForm.genreIds,
          capacity: Number(sectionForm.capacity)
        });
      }
      setSectionForm(initialSectionForm);
      setEditingSectionId("");
      setMessage(editingSectionId ? "Repisa actualizada" : "Repisa creada");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear la repisa");
    }
  }

  async function submitLoan(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.createLoan(loanForm.bookId, {
        borrowerName: loanForm.borrowerName,
        borrowerContact: loanForm.borrowerContact,
        dueAt: loanForm.dueAt || undefined,
        notes: loanForm.notes
      });
      setLoanForm({ bookId: "", borrowerName: "", borrowerContact: "", dueAt: "", notes: "" });
      setMessage("Prestamo registrado");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el prestamo");
    }
  }

  async function deleteBook(book: Book) {
    if (!window.confirm(`Eliminar "${book.title}" del catalogo?`)) return;
    await api.deleteBook(book.id);
    setMessage("Libro eliminado");
    await loadData();
  }

  async function deleteShelf(shelf: Shelf) {
    if (!window.confirm(`Eliminar "${shelf.name}"? Los libros quedaran sin ubicacion.`)) return;
    await api.deleteShelf(shelf.id);
    setMessage("Estanteria eliminada");
    await loadData();
  }

  async function deleteSection(sectionId: string, name: string) {
    if (!window.confirm(`Eliminar la repisa "${name}"? Los libros quedaran sin repisa.`)) return;
    await api.deleteSection(sectionId);
    setMessage("Repisa eliminada");
    await loadData();
  }

  async function deleteGenre(genre: Genre) {
    if (!window.confirm(`Eliminar el genero "${genre.name}"? Se quitara de libros y estanterias.`)) return;
    await api.deleteGenre(genre.id);
    setMessage("Genero eliminado");
    await loadData();
  }

  async function submitMember(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.addMember(memberForm);
      setMemberForm({ email: "", role: "READER" });
      setMessage("Miembro actualizado");
      await loadData();
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : "No se pudo agregar el miembro");
    }
  }

  async function updateMemberRole(member: LibraryMember, role: LibraryRole) {
    setError("");
    try {
      await api.updateMember(member.id, { role });
      await loadData();
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : "No se pudo cambiar el rol");
    }
  }

  async function deleteMember(member: LibraryMember) {
    if (!window.confirm(`Quitar a ${member.user.name} de esta biblioteca?`)) return;
    setError("");
    try {
      await api.deleteMember(member.id);
      await loadData();
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : "No se pudo quitar el miembro");
    }
  }

  function toggleShelfGenre(genreId: string) {
    setShelfForm((current) => ({
      ...current,
      genreIds: current.genreIds.includes(genreId)
        ? current.genreIds.filter((id) => id !== genreId)
        : [...current.genreIds, genreId]
    }));
  }

  function shelfGenresLine(shelf: Shelf) {
    return shelf.genres?.length ? shelf.genres.map((genre) => genre.name).join(", ") : "Sin generos asignados";
  }

  function sectionGenresLine(section: Shelf["sections"][number]) {
    if (section.genres?.length) return section.genres.map((genre) => genre.name).join(", ");
    return section.genreRef?.name ?? "Sin generos asignados";
  }

  function toggleSectionGenre(genreId: string) {
    setSectionForm((current) => ({
      ...current,
      genreIds: current.genreIds.includes(genreId)
        ? current.genreIds.filter((id) => id !== genreId)
        : [...current.genreIds, genreId]
    }));
  }

  function shelfGenrePicker() {
    return (
      <div className="genre-checkbox-grid">
        {genres.map((genre) => (
          <label key={genre.id} className="genre-check">
            <input type="checkbox" checked={shelfForm.genreIds.includes(genre.id)} onChange={() => toggleShelfGenre(genre.id)} />
            <span className="genre-color" style={{ background: genre.color }} />
            {genre.name}
          </label>
        ))}
      </div>
    );
  }

  function sectionGenrePicker() {
    return (
      <div className="genre-checkbox-grid">
        {genres.map((genre) => (
          <label key={genre.id} className="genre-check">
            <input type="checkbox" checked={sectionForm.genreIds.includes(genre.id)} onChange={() => toggleSectionGenre(genre.id)} />
            <span className="genre-color" style={{ background: genre.color }} />
            {genre.name}
          </label>
        ))}
      </div>
    );
  }

  function shelfOccupancy(shelf: Shelf) {
    const count = shelf._count?.books ?? books.filter((book) => book.shelf?.id === shelf.id).length;
    const capacity = shelf.capacity || 40;
    return { count, capacity, percent: Math.min(100, Math.round((count / capacity) * 100)) };
  }

  function sectionBookCount(sectionId: string) {
    return books.filter((book) => book.shelfSection?.id === sectionId).length;
  }

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  function seededNumber(seed: string) {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
    }
    return hash / 9973;
  }

  function spineHeight(book: Book, isDetail = false) {
    const min = isDetail ? 44 : 36;
    const max = isDetail ? 76 : 58;
    if (book.pageCount) return clamp(book.pageCount / 6, min, max);
    return clamp((isDetail ? 44 : 36) + seededNumber(book.id) * (isDetail ? 22 : 18), min, max);
  }

  function spineWidth(book: Book, isDetail = false) {
    const min = isDetail ? 22 : 18;
    const max = isDetail ? 34 : 28;
    return clamp(book.title.length * 1.2, min, max);
  }

  function genreColorForBook(book: Book) {
    return book.genreRef?.color ?? genres.find((genre) => genre.id === book.genreId)?.color ?? "#607068";
  }

  function bookSearchValue(book: Book) {
    return [book.title, authorsLine(book), book.genreRef?.name, book.genre, book.publisher?.name, book.publicationYear]
      .filter(Boolean)
      .join(" ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function matchesMapSearch(book: Book) {
    const term = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return term ? bookSearchValue(book).includes(term) : false;
  }

  function sortedSectionBooks(shelfId: string, sectionId: string) {
    return books
      .filter((book) => book.shelf?.id === shelfId && book.shelfSection?.id === sectionId)
      .sort(compareLabelNomenclature);
  }

  function unassignedShelfBooks(shelfId: string) {
    return books
      .filter((book) => book.shelf?.id === shelfId && !book.shelfSection)
      .sort(compareLabelNomenclature);
  }

  function shelfHasSearchMatch(shelf: Shelf) {
    return Boolean(query.trim()) && books.some((book) => book.shelf?.id === shelf.id && matchesMapSearch(book));
  }

  function readingLabel(book: Book) {
    if (book.availabilityStatus === "PRESTADO") return "Prestado";
    if (book.readingStatus === "LEIDO") return "Leido";
    if (book.readingStatus === "POR_LEER") return "Por leer";
    return "Sin estado";
  }

  function capacityTone(percent: number) {
    if (percent >= 95) return "red";
    if (percent >= 80) return "orange";
    if (percent >= 60) return "yellow";
    return "green";
  }

  function initials(title: string) {
    return title.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "L";
  }

  function spineDisplayTitle(title: string) {
    return title.length > 14 ? `${title.slice(0, 12)}...` : title;
  }

  function editShelfFromMap(shelf: Shelf) {
    setIsShelfEditorOpen(true);
    setEditingShelfId(shelf.id);
    setShelfForm({
      name: shelf.name,
      homeLocation: shelf.homeLocation,
      description: shelf.description ?? "",
      mapX: shelf.mapX,
      mapY: shelf.mapY,
      mapWidth: shelf.mapWidth,
      mapHeight: shelf.mapHeight,
      capacity: shelf.capacity,
      genreIds: shelf.genres?.map((genre) => genre.id) ?? []
    });
  }

  function addShelfFromMap() {
    setIsShelfEditorOpen(true);
    setEditingShelfId("");
    setShelfForm({
      ...initialShelfForm,
      mapX: 80 + shelves.length * 26,
      mapY: 80 + shelves.length * 18
    });
  }

  function openBookOnMap(book: Book) {
    if (!book.shelf?.id) {
      setMessage("Este libro aun no tiene estanteria asignada");
      return;
    }
    setSelectedMapShelfId(book.shelf.id);
    setHighlightedShelfId(book.shelf.id);
    setHighlightedBookId(book.id);
    setActiveView("map");
    window.setTimeout(() => {
      setHighlightedShelfId("");
      setHighlightedBookId("");
    }, 2600);
  }

  function visibleShelfGenres() {
    const genreMap = new Map<string, Genre>();
    const visibleShelfIds = selectedMapShelf ? [selectedMapShelf.id] : shelves.map((shelf) => shelf.id);
    shelves
      .filter((shelf) => visibleShelfIds.includes(shelf.id))
      .forEach((shelf) => shelf.genres.forEach((genre) => genreMap.set(genre.id, genre)));
    books
      .filter((book) => book.shelf?.id && visibleShelfIds.includes(book.shelf.id) && book.genreRef)
      .forEach((book) => {
        if (book.genreRef) genreMap.set(book.genreRef.id, book.genreRef);
      });
    return [...genreMap.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  function openBookFromSpine(book: Book) {
    if (window.matchMedia("(max-width: 640px)").matches && activeSpineBookId !== book.id) {
      setActiveSpineBookId(book.id);
      return;
    }
    setActiveSpineBookId("");
    startEditBook(book);
  }

  async function reorderSectionBook(shelf: Shelf, sectionId: string, targetBookId: string) {
    if (!draggedBookId || draggedBookId === targetBookId) return;
    const sectionBooks = sortedSectionBooks(shelf.id, sectionId);
    const draggedIndex = sectionBooks.findIndex((book) => book.id === draggedBookId);
    const targetIndex = sectionBooks.findIndex((book) => book.id === targetBookId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const nextBooks = [...sectionBooks];
    const [draggedBook] = nextBooks.splice(draggedIndex, 1);
    nextBooks.splice(targetIndex, 0, draggedBook);

    setDraggedBookId("");
    try {
      await api.reorderSectionBooks(shelf.id, sectionId, nextBooks.map((book) => book.id));
      setBooks((current) =>
        current.map((book) => {
          const nextIndex = nextBooks.findIndex((item) => item.id === book.id);
          return nextIndex >= 0 ? { ...book, shelfSortOrder: nextIndex + 1 } : book;
        })
      );
      setMessage("Orden de repisa actualizado");
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : "No se pudo reordenar la repisa");
      await loadData();
    }
  }

  async function loadReorganizationReport() {
    setIsReorganizing(true);
    setError("");
    setMessage("");
    try {
      const report = await api.suggestReorganization();
      setReorganizationReport(report);
      setAcceptedSuggestionId("");
      setDismissedSuggestionIds([]);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "No se pudo analizar la biblioteca");
    } finally {
      setIsReorganizing(false);
    }
  }

  function acceptSuggestion(suggestion: ReorganizationSuggestion) {
    setAcceptedSuggestionId(suggestion.id);
    setMessage("Plan de movimiento generado. Confirma cada traslado cuando lo hagas fisicamente.");
  }

  function dismissSuggestion(suggestionId: string) {
    setDismissedSuggestionIds((current) => [...new Set([...current, suggestionId])]);
    if (acceptedSuggestionId === suggestionId) setAcceptedSuggestionId("");
  }

  async function confirmMove(bookId: string) {
    if (!acceptedSuggestion) return;
    const move = acceptedSuggestion.moves.find((item) => item.bookId === bookId);
    if (!move) return;
    try {
      await api.updateBook(bookId, {
        shelfId: move.toShelfId,
        shelfSectionId: move.toSectionId ?? ""
      });
      setReorganizationReport((current) =>
        current
          ? {
              ...current,
              suggestions: current.suggestions.map((suggestion) =>
                suggestion.id === acceptedSuggestion.id
                  ? {
                      ...suggestion,
                      moves: suggestion.moves.map((item) => (item.bookId === bookId ? { ...item, confirmed: true } : item))
                    }
                  : suggestion
              )
            }
          : current
      );
      setMessage("Movimiento confirmado y ubicacion actualizada");
      await loadData();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "No se pudo confirmar el movimiento");
    }
  }

  function printMovementPlan() {
    if (!acceptedSuggestion) return;
    const page = window.open("", "_blank", "width=900,height=700");
    if (!page) return;
    const rows = acceptedSuggestion.moves
      .map((move, index) => `<tr><td>${index + 1}</td><td>${move.title}</td><td>${move.fromShelfName || "Sin ubicacion"}${move.fromSectionName ? ` / ${move.fromSectionName}` : ""}</td><td>${move.toShelfName}${move.toSectionName ? ` / ${move.toSectionName}` : ""}</td></tr>`)
      .join("");
    page.document.write(`<!doctype html><html><head><title>Plan de movimiento</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#222}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}h1{font-size:22px}</style></head><body><h1>${acceptedSuggestion.title}</h1><p>${acceptedSuggestion.summary}</p><table><thead><tr><th>#</th><th>Libro</th><th>Desde</th><th>Hacia</th></tr></thead><tbody>${rows}</tbody></table><script>window.print()</script></body></html>`);
    page.document.close();
  }

  async function deleteSubgenre(subgenreId: string, name: string) {
    if (!window.confirm(`Eliminar el subgenero "${name}"?`)) return;
    await api.deleteSubgenre(subgenreId);
    setMessage("Subgenero eliminado");
    await loadData();
  }

  async function returnLoan(book: Book) {
    if (!book.activeLoan) return;
    await api.returnLoan(book.activeLoan.id);
    setMessage("Libro marcado como devuelto");
    await loadData();
  }

  function updateAuthor(index: number, value: string) {
    setBookForm((current) => ({
      ...current,
      authors: current.authors.map((author, authorIndex) => (authorIndex === index ? value : author))
    }));
  }

  function bookToForm(book: Book): BookPayload {
    return {
      title: book.title,
      authors: book.authors.map((author) => author.fullName),
      subtitle: book.subtitle ?? "",
      isbn10: book.isbn10 ?? "",
      isbn13: book.isbn13 ?? "",
      publisher: book.publisher?.name ?? "",
      publicationYear: book.publicationYear ?? "",
      pageCount: book.pageCount ?? "",
      genre: book.genre ?? "",
      genreId: book.genreId ?? "",
      subgenreId: book.subgenreId ?? "",
      deweyGenreRaw: book.deweyGenreRaw ?? "",
      languageCode: book.languageCode ?? "es",
      synopsis: book.synopsis ?? "",
      edition: book.edition ?? "",
      coverUrl: book.coverUrl ?? "",
      deweyCode: book.deweyCode ?? "",
      deweyHierarchy: book.deweyHierarchy ?? [],
      deweyExplanation: book.deweyExplanation ?? "",
      lcCode: book.lcCode ?? "",
      lcHierarchy: book.lcHierarchy ?? [],
      lcExplanation: book.lcExplanation ?? "",
      customTags: book.customTags ?? [],
      labelSerial: book.labelSerial ?? "",
      labelSystem: book.labelSystem ?? "DEWEY",
      labelSize: book.labelSize ?? "MEDIANO",
      availabilityStatus: book.availabilityStatus,
      readingStatus: book.readingStatus,
      isReference: book.isReference,
      shelfId: book.shelf?.id ?? "",
      shelfSectionId: book.shelfSection?.id ?? ""
    };
  }

  function startEditBook(book: Book) {
    setEditingBookId(book.id);
    setBookForm(bookToForm(book));
    setDeweyGenreSuggestion(null);
    setMessage(`Editando "${book.title}"`);
    setActiveView("catalog");
    setIsToolsOpen(true);
    setDrawerMode("book");
    setOpenToolSections(["scan", "book"]);
    setBookFlowStep(2);
    setBookEntryMethod("manual");
    setOpenBookMenuId("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditBook() {
    setEditingBookId("");
    setBookForm(initialBookForm);
    setDeweyGenreSuggestion(null);
    setMessage("");
    setActiveView("catalog");
    setIsToolsOpen(false);
    setDrawerMode("menu");
    setBookFlowStep(1);
    setBookEntryMethod("");
  }

  function normalizeCode(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
  }

  function authorKey(book: Book) {
    const author = book.authors[0]?.fullName ?? "";
    const lastName = author.trim().split(/\s+/).pop() ?? "AUT";
    return normalizeCode(lastName).slice(0, 3).padEnd(3, "X");
  }

  function titleKey(book: Book) {
    return book.publicationYear ? String(book.publicationYear) : normalizeCode(book.title).slice(0, 4);
  }

  function shelfKey(book: Book) {
    return includeShelfOnLabel && book.shelf?.name ? normalizeCode(book.shelf.name).slice(0, 8) : "";
  }

  function generateLabelSerial(book: Book, system = labelSystem) {
    const classification =
      system === "DEWEY" ? book.deweyCode : system === "LC" ? book.lcCode : book.customTags?.[0] ?? book.genre;
    return [classification || "SIN-CLAS", authorKey(book), titleKey(book), shelfKey(book)].filter(Boolean).join("\n");
  }

  function tejueloNumber(book: Book) {
    const serial = book.labelSerial || generateLabelSerial(book, book.labelSystem ?? "DEWEY");
    return serial.split("\n").map((line) => line.trim()).find(Boolean) || "SIN-CLAS";
  }

  function labelSerialForSort(book: Book) {
    return (book.labelSerial || generateLabelSerial(book, book.labelSystem ?? "DEWEY")).replace(/\n/g, " ").trim();
  }

  function labelSortKey(book: Book) {
    const serial = labelSerialForSort(book);
    const numberMatch = serial.match(/\d+(?:\.\d+)?/);
    const numeric = numberMatch ? Number(numberMatch[0]) : Number.POSITIVE_INFINITY;
    const numberStart = numberMatch?.index ?? 0;
    const numberEnd = numberStart + (numberMatch?.[0]?.length ?? 0);
    return {
      numeric,
      prefix: serial.slice(0, numberStart).toUpperCase(),
      suffix: serial.slice(numberEnd).toUpperCase(),
      serial: serial.toUpperCase()
    };
  }

  function compareLabelNomenclature(left: Book, right: Book) {
    const leftKey = labelSortKey(left);
    const rightKey = labelSortKey(right);
    return (
      leftKey.prefix.localeCompare(rightKey.prefix) ||
      leftKey.numeric - rightKey.numeric ||
      leftKey.suffix.localeCompare(rightKey.suffix) ||
      leftKey.serial.localeCompare(rightKey.serial) ||
      (left.shelfSortOrder ?? 0) - (right.shelfSortOrder ?? 0) ||
      left.title.localeCompare(right.title)
    );
  }

  function openLabelPanel(book: Book) {
    setEditingBookId(book.id);
    setBookForm(bookToForm(book));
    setActiveView("catalog");
    setIsToolsOpen(true);
    setDrawerMode("labels");
    setOpenToolSections(["labels"]);
    setBookFlowStep(5);
    setOpenBookMenuId("");
    setLabelBookId(book.id);
    const system = book.labelSystem ?? (book.deweyCode ? "DEWEY" : book.lcCode ? "LC" : "PROPIA");
    setLabelSystem(system);
    setLabelSize(book.labelSize ?? "MEDIANO");
    setLabelSerialDraft(book.labelSerial || generateLabelSerial(book, system));
  }

  function toggleSelectedBook(bookId: string) {
    setSelectedBookIds((current) =>
      current.includes(bookId) ? current.filter((id) => id !== bookId) : [...current, bookId]
    );
  }

  function labelDimensions() {
    if (labelSize === "PEQUENO") return { width: 2, height: 3 };
    if (labelSize === "MEDIANO") return { width: 3, height: 4 };
    return { width: labelWidth, height: labelHeight };
  }

  function labelHtml(book: Book, serial = book.labelSerial || generateLabelSerial(book)) {
    const { width, height } = labelDimensions();
    return `<div class="label" style="width:${width}cm;height:${height}cm"><pre>${serial}</pre></div>`;
  }

  function generateLabelSerialFromForm(system = labelSystem) {
    const classification =
      system === "DEWEY" ? bookForm.deweyCode : system === "LC" ? bookForm.lcCode : bookForm.customTags?.[0] ?? bookForm.genre;
    const author = bookForm.authors[0] ?? "";
    const lastName = author.trim().split(/\s+/).pop() ?? "AUT";
    const authorCode = normalizeCode(lastName).slice(0, 3).padEnd(3, "X");
    const titleCode = bookForm.publicationYear ? String(bookForm.publicationYear) : normalizeCode(bookForm.title).slice(0, 4);
    return [classification || "SIN-CLAS", authorCode, titleCode || "TIT"].filter(Boolean).join("\n");
  }

  async function saveLabel(book = labelBook) {
    if (!book) return;
    await api.updateBook(book.id, {
      labelSerial: labelSerialDraft,
      labelSystem,
      labelSize
    });
    setMessage("Tejuelo guardado");
    await loadData();
  }

  function printLabels(labelBooks: Book[]) {
    if (labelBooks.length === 0) {
      setError("Selecciona al menos un libro para imprimir");
      return;
    }
    const page = window.open("", "_blank", "width=900,height=700");
    if (!page) return;
    const labels = labelBooks.map((book) => labelHtml(book, book.id === labelBookId ? labelSerialDraft : undefined)).join("");
    page.document.write(`<!doctype html><html><head><title>Tejuelos</title><style>
      @page { size: ${labelPageSize}; margin: 1cm; }
      body { margin: 0; font-family: Arial, sans-serif; }
      .sheet { display: grid; grid-template-columns: repeat(${labelColumns}, max-content); gap: 0.25cm; align-content: start; }
      .label { border: 1px solid #222; display: grid; place-items: center; page-break-inside: avoid; }
      pre { margin: 0; text-align: center; font-weight: 700; font-size: 10pt; line-height: 1.25; white-space: pre-wrap; }
    </style></head><body><main class="sheet">${labels}</main><script>window.print()</script></body></html>`);
    page.document.close();
  }

  function downloadLabelPng(book = labelBook) {
    if (!book) return;
    const { width, height } = labelDimensions();
    const scale = 96 / 2.54;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#222222";
    context.strokeRect(0, 0, canvas.width - 1, canvas.height - 1);
    context.fillStyle = "#111111";
    context.font = "bold 16px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    const lines = (labelSerialDraft || generateLabelSerial(book)).split("\n");
    lines.forEach((line, index) => {
      context.fillText(line, canvas.width / 2, canvas.height / 2 + (index - (lines.length - 1) / 2) * 22);
    });
    const link = document.createElement("a");
    link.download = `tejuelo-${book.title}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function setToolSection(section: string, isOpen: boolean) {
    setOpenToolSections((current) =>
      isOpen ? [...new Set([...current, section])] : current.filter((item) => item !== section)
    );
  }

  function goHome() {
    setActiveView("catalog");
    setIsToolsOpen(false);
    setDrawerMode("menu");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function CapacityMeter({ count, capacity }: { count: number; capacity: number }) {
    const percent = Math.min(100, Math.round((count / Math.max(capacity, 1)) * 100));
    return (
      <div className={`bookshelf-capacity ${capacityTone(percent)}`}>
        <span><i style={{ width: `${percent}%` }} /></span>
        <small>{percent}% de capacidad</small>
      </div>
    );
  }

  function BookSpine({ book, detail, shelf, sectionId }: { book: Book; detail?: boolean; shelf?: Shelf; sectionId?: string }) {
    const isMatch = matchesMapSearch(book);
    const hasSearch = Boolean(query.trim());
    const isHighlighted = highlightedBookId === book.id || isMatch;
    return (
      <button
        type="button"
        className={`book-spine ${detail ? "detail" : ""} ${isHighlighted ? "highlighted" : ""} ${hasSearch && !isMatch ? "dimmed" : ""} ${activeSpineBookId === book.id ? "active" : ""}`}
        style={{
          background: genreColorForBook(book),
          height: `${spineHeight(book, detail)}px`,
          width: `${spineWidth(book, detail)}px`
        }}
        draggable={Boolean(detail && shelf && sectionId)}
        onDragStart={() => setDraggedBookId(book.id)}
        onDragOver={(event) => {
          if (detail && shelf && sectionId) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (detail && shelf && sectionId) void reorderSectionBook(shelf, sectionId, book.id);
        }}
        onClick={(event) => {
          event.stopPropagation();
          openBookFromSpine(book);
        }}
        title={`${book.title} · ${authorsLine(book) || "Autor sin registrar"}`}
      >
        <span>{spineDisplayTitle(book.title)}</span>
        <div className="spine-tooltip">
          <div className="tooltip-cover">
            {book.coverUrl ? <img src={book.coverUrl} alt={`Portada de ${book.title}`} /> : <strong>{initials(book.title)}</strong>}
          </div>
          <div>
            <strong>{book.title}</strong>
            <p>{authorsLine(book) || "Autor sin registrar"}</p>
            <small>{[book.publicationYear, book.publisher?.name].filter(Boolean).join(" · ") || "Sin datos editoriales"}</small>
            <span style={{ borderColor: genreColorForBook(book), color: genreColorForBook(book) }}>{book.genreRef?.name ?? book.genre ?? "Sin genero"}</span>
            <em>{readingLabel(book)}</em>
          </div>
        </div>
      </button>
    );
  }

  function ShelfFurniture({ shelf, detail = false }: { shelf: Shelf; detail?: boolean }) {
    const shelfBooks = books.filter((book) => book.shelf?.id === shelf.id);
    const unassignedBooks = unassignedShelfBooks(shelf.id);
    const occupancy = shelfOccupancy(shelf);
    const hasRows = shelf.sections.length > 0 || unassignedBooks.length > 0;
    return (
      <article
        id={`shelf-card-${shelf.id}`}
        className={`bookshelf-card ${detail ? "detail" : ""} ${highlightedShelfId === shelf.id || shelfHasSearchMatch(shelf) ? "highlighted" : ""}`}
        onClick={() => !detail && setSelectedMapShelfId(shelf.id)}
      >
        <div className="bookshelf-card-header">
          <div>
            <h2>{shelf.name}</h2>
            <p>{shelf.homeLocation}</p>
            <div className="shelf-genre-chips">
              {shelf.genres.length ? shelf.genres.map((genre) => (
                <span key={genre.id} style={{ backgroundColor: `${genre.color}18`, color: genre.color }}>{genre.name}</span>
              )) : <span>Sin generos</span>}
            </div>
          </div>
          <strong className="bookshelf-count">{shelfBooks.length}/{occupancy.capacity}</strong>
        </div>
        <div className="shelf-furniture" aria-label={`Estanteria ${shelf.name}`}>
          {!hasRows && (
            <div className="empty-shelf-visual">
              <Library size={20} />
              <span>Sin repisas configuradas</span>
            </div>
          )}
          {shelf.sections.map((section) => {
            const sectionBooks = sortedSectionBooks(shelf.id, section.id);
            return (
              <div className="furniture-section" key={section.id}>
                <div className="section-label">
                  <strong>{section.name}</strong>
                  <small>{sectionGenresLine(section)} · {sectionBooks.length}/{section.capacity}</small>
                </div>
                <div className="wood-line" />
                <div className="book-spine-row">
                  {sectionBooks.map((book) => (
                    <BookSpine key={book.id} book={book} detail={detail} shelf={shelf} sectionId={section.id} />
                  ))}
                </div>
              </div>
            );
          })}
          {unassignedBooks.length > 0 && (
            <div className="furniture-section">
              <div className="section-label"><strong>Sin repisa</strong><small>{unassignedBooks.length} libros</small></div>
              <div className="wood-line" />
              <div className="book-spine-row">
                {unassignedBooks.map((book) => <BookSpine key={book.id} book={book} detail={detail} />)}
              </div>
            </div>
          )}
        </div>
        <CapacityMeter count={shelfBooks.length} capacity={occupancy.capacity} />
      </article>
    );
  }

  if (isSessionLoading) {
    return (
      <div className="app-shell auth-shell">
        <section className="auth-panel">
          <img src={guardaLogo} alt="GUARDA" />
          <p>Cargando sesion...</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-shell auth-shell">
        <section className="auth-panel">
          <img src={guardaLogo} alt="GUARDA" />
          <div>
            <p className="eyebrow dark">Biblioteca personal</p>
            <h1>{authMode === "register" ? "Crear cuenta" : "Iniciar sesion"}</h1>
          </div>
          <form onSubmit={submitAuth} className="stack-form">
            {authMode === "register" && (
              <>
                <input required placeholder="Nombre" value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} />
                <input placeholder="Nombre de biblioteca" value={authForm.libraryName} onChange={(event) => setAuthForm({ ...authForm, libraryName: event.target.value })} />
              </>
            )}
            <input required type="email" placeholder="Correo" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} />
            <input required type="password" placeholder="Contrasena" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} />
            {message && <div className="notice success">{message}</div>}
            {error && <div className="notice error">{error}</div>}
            <button className="primary" type="submit">
              {authMode === "register" ? <UserPlus size={18} /> : <LogIn size={18} />}
              {authMode === "register" ? "Crear cuenta" : "Entrar"}
            </button>
          </form>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setAuthMode(authMode === "register" ? "login" : "register");
              setError("");
              setMessage("");
            }}
          >
            {authMode === "register" ? "Ya tengo cuenta" : "Crear primera cuenta"}
          </button>
        </section>
      </div>
    );
  }

  if (activeView === "book-flow") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <button type="button" className="brand-mark" onClick={goHome} title="Volver al catalogo">
            <img src={guardaLogo} alt="GUARDA" />
            <div>
              <p className="eyebrow">Biblioteca personal</p>
              <h1>{editingBookId ? "Editar libro" : "Crear nuevo libro"}</h1>
            </div>
          </button>
          <div className="topbar-actions">
            <button className="ghost" onClick={cancelBookFlow}>
              <X size={17} /> Cancelar
            </button>
          </div>
        </header>

        <main className="flow-layout">
          <section className="flow-panel">
            <div className="form-intro">
              <h2>{editingBookId ? "Datos del libro" : "Nuevo libro"}</h2>
              <p>Completa o importa los datos, revisa la clasificacion, elige ubicacion y guarda cuando este listo.</p>
            </div>

            {message && <div className="notice success">{message}</div>}
            {error && <div className="notice error">{error}</div>}
            {duplicateMatches.length > 0 && (
              <div className="duplicate-alert">
                <div>
                  <h2>Posible duplicado detectado</h2>
                  <p>Ya existe un libro parecido. Puedes actualizarlo, agregar este de todas formas o cancelar.</p>
                </div>
                <div className="duplicate-list">
                  {duplicateMatches.map((match) => (
                    <article className="duplicate-card" key={match.book.id}>
                      <div className="cover mini">
                        {match.book.coverUrl ? <img src={match.book.coverUrl} alt={`Portada de ${match.book.title}`} /> : <BookOpen size={28} />}
                      </div>
                      <div>
                        <strong>{match.book.title}</strong>
                        <p>{authorsLine(match.book) || "Autor sin registrar"}</p>
                        <span>{match.reason} · {Math.round(match.score * 100)}%</span>
                        <div className="duplicate-actions">
                          <button type="button" className="primary" onClick={() => updateDuplicateExisting(match)}>Actualizar existente</button>
                          <button type="button" className="ghost" onClick={addDuplicateAnyway}>Agregar de todas formas</button>
                          <button type="button" className="danger-soft" onClick={cancelDuplicateSave}>Cancelar</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {!editingBookId && (
              <section className="flow-card">
                <h2>Metodo de ingreso</h2>
                <div className="method-grid">
                  <button className={bookEntryMethod === "scan" ? "active" : ""} onClick={() => chooseBookEntryMethod("scan")}><Barcode size={18} /> Escanear codigo de barras</button>
                  <button className={bookEntryMethod === "isbn" ? "active" : ""} onClick={() => chooseBookEntryMethod("isbn")}><Search size={18} /> Buscar por ISBN</button>
                  <button className={bookEntryMethod === "search" ? "active" : ""} onClick={() => chooseBookEntryMethod("search")}><BookOpen size={18} /> Buscar sin ISBN</button>
                  <button className={bookEntryMethod === "manual" ? "active" : ""} onClick={() => chooseBookEntryMethod("manual")}><Pencil size={18} /> Agregar manualmente</button>
                </div>

                {bookEntryMethod === "scan" && (
                  <div className="stack-form flow-tool">
                    <div className="scanner-frame">
                      <video ref={videoRef} muted playsInline />
                      {!isScanning && <div className="scanner-placeholder"><Camera size={28} /><span>Camara lista</span></div>}
                    </div>
                    {scanStatus && <p className="helper-text">{scanStatus}</p>}
                    {cameraDevices.length > 1 && (
                      <select value={selectedCameraId} onChange={(event) => setSelectedCameraId(event.target.value)} disabled={isScanning}>
                        {cameraDevices.map((device, index) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Camara ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="two-cols">
                      <button type="button" className="primary" onClick={startScanner} disabled={isScanning || isLookupLoading}><Camera size={17} /> Escanear</button>
                      <button type="button" className="ghost" onClick={stopScanner} disabled={!isScanning}><Square size={15} /> Detener</button>
                    </div>
                    <div className="isbn-lookup-row">
                      <input placeholder="ISBN manual" value={isbnLookup} onChange={(event) => setIsbnLookup(event.target.value)} />
                      <button type="button" className="ghost" onClick={() => lookupIsbn(isbnLookup)} disabled={isLookupLoading}>
                        <Search size={16} /> Buscar
                      </button>
                    </div>
                    {isbnLookupNotice && (
                      <div className={`inline-notice ${isbnLookupNotice.type}`}>
                        <p>{isbnLookupNotice.text}</p>
                        {isbnLookupNotice.type === "warning" && (
                          <button type="button" className="ghost" onClick={() => setBookEntryMethod("search")}>
                            <BookOpen size={16} /> Buscar por titulo
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {bookEntryMethod === "isbn" && (
                  <div className="flow-tool">
                    <div className="isbn-lookup-row">
                      <input placeholder="ISBN manual" value={isbnLookup} onChange={(event) => setIsbnLookup(event.target.value)} />
                      <button type="button" className="primary" onClick={() => lookupIsbn(isbnLookup)} disabled={isLookupLoading}><Search size={16} /> Buscar</button>
                    </div>
                    {isbnLookupNotice && (
                      <div className={`inline-notice ${isbnLookupNotice.type}`}>
                        <p>{isbnLookupNotice.text}</p>
                        {isbnLookupNotice.type === "warning" && (
                          <button type="button" className="ghost" onClick={() => setBookEntryMethod("search")}>
                            <BookOpen size={16} /> Buscar por titulo
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {bookEntryMethod === "search" && (
                  <div className="book-search-panel flow-tool">
                    {isbnLookupNotice && (
                      <div className={`inline-notice ${isbnLookupNotice.type}`}>
                        <p>{isbnLookupNotice.text}</p>
                      </div>
                    )}
                    <div className="two-cols">
                      <input placeholder="Titulo sin ISBN" value={bookSearchForm.title} onChange={(event) => setBookSearchForm({ ...bookSearchForm, title: event.target.value })} />
                      <input placeholder="Autor opcional" value={bookSearchForm.author} onChange={(event) => setBookSearchForm({ ...bookSearchForm, author: event.target.value })} />
                    </div>
                    <div className="two-cols">
                      <input placeholder="Editorial opcional" value={bookSearchForm.publisher} onChange={(event) => setBookSearchForm({ ...bookSearchForm, publisher: event.target.value })} />
                      <input placeholder="Año opcional" type="number" value={bookSearchForm.year} onChange={(event) => setBookSearchForm({ ...bookSearchForm, year: event.target.value })} />
                    </div>
                    <button type="button" className="primary" onClick={searchBooksWithoutIsbn} disabled={isBookSearching}><BookOpen size={16} /> Buscar sin ISBN</button>
                    {bookSearchResults.length > 0 && (
                      <div className="external-results">
                        {bookSearchResults.map((book, index) => (
                          <button type="button" key={`${book.source}-${book.title}-${index}`} onClick={() => useExternalBookResult(book)}>
                            {book.coverUrl ? <img src={book.coverUrl} alt={`Portada de ${book.title}`} /> : <BookOpen size={22} />}
                            <span>
                              <strong>{book.title}</strong>
                              <small>{[book.authors?.join(", "), book.publicationYear, book.publisher].filter(Boolean).join(" · ") || "Datos publicos"}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {true && (
              <section className="flow-card">
                <h2>Edicion de datos</h2>
                <div className="stack-form">
                  <input required placeholder="Titulo" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
                  {bookForm.authors.map((author, index) => (
                    <input required={index === 0} key={index} placeholder={index === 0 ? "Autor principal" : "Otro autor"} value={author} onChange={(e) => updateAuthor(index, e.target.value)} />
                  ))}
                  <button type="button" className="ghost" onClick={() => setBookForm({ ...bookForm, authors: [...bookForm.authors, ""] })}><Plus size={16} /> Otro autor</button>
                  <div className="two-cols">
                    <input placeholder="ISBN 13" value={bookForm.isbn13} onChange={(e) => setBookForm({ ...bookForm, isbn13: e.target.value })} />
                    <input placeholder="Año" type="number" value={bookForm.publicationYear} onChange={(e) => setBookForm({ ...bookForm, publicationYear: e.target.value ? Number(e.target.value) : "" })} />
                  </div>
                  <input placeholder="Editorial" value={bookForm.publisher} onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })} />
                  <div className="two-cols">
                    <input placeholder="Genero libre" value={bookForm.genre} onChange={(e) => setBookForm({ ...bookForm, genre: e.target.value })} />
                    <input placeholder="Paginas" type="number" value={bookForm.pageCount} onChange={(e) => setBookForm({ ...bookForm, pageCount: e.target.value ? Number(e.target.value) : "" })} />
                  </div>
                  <div className="two-cols">
                    <select value={bookForm.genreId} onChange={(e) => setBookForm({ ...bookForm, genreId: e.target.value, subgenreId: "" })}>
                      <option value="">Genero principal</option>
                      {genres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
                    </select>
                    <select value={bookForm.subgenreId} onChange={(e) => setBookForm({ ...bookForm, subgenreId: e.target.value })} disabled={!bookForm.genreId}>
                      <option value="">Subgenero</option>
                      {selectedBookSubgenres.map((subgenre) => <option key={subgenre.id} value={subgenre.id}>{subgenre.name}</option>)}
                    </select>
                  </div>
                  {deweyGenreSuggestion && (
                    <div className={`ai-genre-suggestion ${deweyGenreSuggestion.confianza}`}>
                      <div><span className="suggestion-badge">{deweyGenreSuggestion.confianza === "alta" ? "Alta" : deweyGenreSuggestion.confianza === "media" ? "Sugerido" : "Confirmar"}</span><strong>{deweyGenreSuggestion.genero_principal}{deweyGenreSuggestion.subgenero ? ` / ${deweyGenreSuggestion.subgenero}` : ""}</strong></div>
                      <p>{deweyGenreSuggestion.razon}</p>
                      <button type="button" className="ghost" onClick={applyDeweyGenreSuggestion}><Check size={15} /> Usar sugerencia</button>
                    </div>
                  )}
                  <input placeholder="Genero Dewey/API sin procesar" value={bookForm.deweyGenreRaw} onChange={(e) => setBookForm({ ...bookForm, deweyGenreRaw: e.target.value })} />
                  <input placeholder="URL de portada" value={bookForm.coverUrl} onChange={(e) => setBookForm({ ...bookForm, coverUrl: e.target.value })} />
                  <textarea placeholder="Sinopsis" value={bookForm.synopsis} onChange={(e) => setBookForm({ ...bookForm, synopsis: e.target.value })} />
                  <button className="ghost" type="button" onClick={suggestClassification}><Sparkles size={17} /> Sugerir clasificacion</button>
                </div>
              </section>
            )}

            {true && (
              <section className="flow-card">
                <h2>Clasificacion por IA</h2>
                <div className="stack-form">
                  <button type="button" className="primary" onClick={suggestClassification} disabled={isClassifying}><Sparkles size={17} /> {isClassifying ? "Consultando..." : "Sugerir con IA"}</button>
                  <div className="two-cols">
                    <input placeholder="Codigo Dewey" value={classificationDraft.deweyCode ?? ""} onChange={(event) => setClassificationDraft({ ...classificationDraft, deweyCode: event.target.value })} />
                    <input placeholder="Signatura LC" value={classificationDraft.lcCode ?? ""} onChange={(event) => setClassificationDraft({ ...classificationDraft, lcCode: event.target.value })} />
                  </div>
                  <textarea placeholder="Jerarquia Dewey, una linea por nivel" value={classificationDraft.deweyHierarchy.join("\n")} onChange={(event) => setClassificationDraft({ ...classificationDraft, deweyHierarchy: splitLines(event.target.value) })} />
                  <textarea placeholder="Explicacion Dewey" value={classificationDraft.deweyExplanation ?? ""} onChange={(event) => setClassificationDraft({ ...classificationDraft, deweyExplanation: event.target.value })} />
                  <textarea placeholder="Jerarquia LC, una linea por nivel" value={classificationDraft.lcHierarchy.join("\n")} onChange={(event) => setClassificationDraft({ ...classificationDraft, lcHierarchy: splitLines(event.target.value) })} />
                  <textarea placeholder="Explicacion LC" value={classificationDraft.lcExplanation ?? ""} onChange={(event) => setClassificationDraft({ ...classificationDraft, lcExplanation: event.target.value })} />
                  <label className="tag-input"><Tags size={16} /><input placeholder="Etiquetas separadas por coma" value={classificationDraft.customTags.join(", ")} onChange={(event) => setClassificationDraft({ ...classificationDraft, customTags: splitTags(event.target.value) })} /></label>
                  <button type="button" className="primary" onClick={() => applyClassificationToForm(classificationDraft)}><Check size={17} /> Aplicar clasificacion</button>
                </div>
              </section>
            )}

            {true && (
              <section className="flow-card">
                <h2>Ubicacion en estanteria</h2>
                <div className="stack-form">
                  <select value={bookForm.shelfId} onChange={(e) => setBookForm({ ...bookForm, shelfId: e.target.value, shelfSectionId: "" })}>
                    <option value="">Sin estanteria</option>
                    {shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.name}</option>)}
                  </select>
                  <select value={bookForm.shelfSectionId} onChange={(e) => setBookForm({ ...bookForm, shelfSectionId: e.target.value })}>
                    <option value="">Sin repisa</option>
                    {selectedShelf?.sections.map((section) => <option key={section.id} value={section.id}>{section.name} · {sectionGenresLine(section)} · {sectionBookCount(section.id)}/{section.capacity} libros</option>)}
                  </select>
                  {selectedShelfGenreMismatch && <div className="notice warning">Esta estanteria esta marcada para {selectedShelf?.genres.map((genre) => genre.name).join(", ")}, pero el libro esta marcado como {selectedBookGenre?.name}. Puedes guardarlo igual.</div>}
                  {selectedSectionGenreMismatch && selectedShelfSection && <div className="notice warning">Esta repisa esta marcada para {sectionGenresLine(selectedShelfSection)}, pero el libro esta marcado como {selectedBookGenre?.name}. Puedes guardarlo igual.</div>}
                  <button type="button" className="ghost" onClick={() => setLabelSerialDraft(bookForm.labelSerial || generateLabelSerialFromForm())}><Printer size={17} /> Actualizar tejuelo</button>
                </div>
              </section>
            )}

            {true && (
              <section className="flow-card">
                <h2>Generacion del tejuelo</h2>
                <div className="stack-form">
                  <div className="two-cols">
                    <select value={labelSystem} onChange={(event) => { const system = event.target.value as "DEWEY" | "LC" | "PROPIA"; setLabelSystem(system); setLabelSerialDraft(generateLabelSerialFromForm(system)); }}>
                      <option value="DEWEY">Dewey</option>
                      <option value="LC">LC</option>
                      <option value="PROPIA">Propia</option>
                    </select>
                    <select value={labelSize} onChange={(event) => setLabelSize(event.target.value as any)}>
                      <option value="PEQUENO">Pequeno 2 x 3 cm</option>
                      <option value="MEDIANO">Mediano 3 x 4 cm</option>
                      <option value="PERSONALIZADO">Personalizado</option>
                    </select>
                  </div>
                  <textarea placeholder="Seriado del tejuelo" value={labelSerialDraft} onChange={(event) => setLabelSerialDraft(event.target.value)} />
                  <div className="label-preview">{labelSerialDraft || generateLabelSerialFromForm()}</div>
                  <button type="button" className="primary" onClick={() => saveBookPayload({ ...normalizedBookPayload(), labelSerial: labelSerialDraft || generateLabelSerialFromForm(), labelSystem, labelSize })}><Check size={17} /> Guardar libro</button>
                </div>
              </section>
            )}
          </section>
        </main>
      </div>
    );
  }

  if (activeView === "map") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <button type="button" className="brand-mark" onClick={goHome} title="Volver al catalogo">
            <img src={guardaLogo} alt="GUARDA" />
            <div>
              <p className="eyebrow">Biblioteca personal</p>
              <h1>Estanterias</h1>
            </div>
          </button>
          <div className="topbar-actions">
            <button className="ghost" onClick={addShelfFromMap}><Plus size={17} /> Estanteria</button>
            <button className="ghost" onClick={() => setActiveView("catalog")}><X size={17} /> Volver</button>
          </div>
        </header>
        <main className="bookshelf-layout">
          {message && <div className="notice success">{message}</div>}
          {error && <div className="notice error">{error}</div>}
          <section className="bookshelf-view-panel">
            <div className="bookshelf-toolbar">
              <div>
                <p className="eyebrow dark">{selectedMapShelf ? "Vista detalle" : "Vista general"}</p>
                <h2>{selectedMapShelf ? selectedMapShelf.name : "Vista de biblioteca"}</h2>
                {selectedMapShelf && <p>{selectedMapShelf.homeLocation} · {shelfGenresLine(selectedMapShelf)}</p>}
              </div>
              <div className="bookshelf-toolbar-actions">
                <button className={!selectedMapShelf ? "active" : ""} onClick={() => setSelectedMapShelfId("")}>Vista general</button>
                <button
                  className={selectedMapShelf ? "active" : ""}
                  onClick={() => setSelectedMapShelfId(selectedMapShelfId || shelves[0]?.id || "")}
                  disabled={shelves.length === 0}
                >
                  Detalle estanteria
                </button>
                <button className="icon-menu" onClick={addShelfFromMap} title="Agregar estanteria"><MoreHorizontal size={18} /></button>
              </div>
            </div>
            <label className="bookshelf-search search-box">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar libro para resaltarlo..."
              />
            </label>
            {selectedMapShelf ? (
              <ShelfFurniture shelf={selectedMapShelf} detail />
            ) : (
              <div className="bookshelf-grid">
                {shelves.map((shelf) => <ShelfFurniture key={shelf.id} shelf={shelf} />)}
              </div>
            )}
            {visibleShelfGenres().length > 0 && (
              <div className="bookshelf-legend">
                {visibleShelfGenres().map((genre) => (
                  <span key={genre.id}><i style={{ background: genre.color }} /> {genre.name}</span>
                ))}
              </div>
            )}
          </section>
          <details className="bookshelf-admin panel-section" open={isShelfEditorOpen} onToggle={(event) => setIsShelfEditorOpen(event.currentTarget.open)}>
            <summary className="bookshelf-admin-header">
              <h2>{editingShelfId ? "Editar estanteria" : "Agregar estanteria"}</h2>
              {selectedMapShelf && <button type="button" className="ghost" onClick={() => editShelfFromMap(selectedMapShelf)}><Pencil size={16} /> Editar seleccionada</button>}
            </summary>
            <form onSubmit={submitShelf} className="stack-form compact">
              <div className="two-cols">
                <input required placeholder="Nombre" value={shelfForm.name} onChange={(e) => setShelfForm({ ...shelfForm, name: e.target.value })} />
                <input required placeholder="Lugar de la casa" value={shelfForm.homeLocation} onChange={(e) => setShelfForm({ ...shelfForm, homeLocation: e.target.value })} />
              </div>
              <input type="number" min="1" placeholder="Capacidad total" value={shelfForm.capacity} onChange={(e) => setShelfForm({ ...shelfForm, capacity: Number(e.target.value) })} />
              <div className="form-field">
                <span>Generos de la estanteria</span>
                {shelfGenrePicker()}
              </div>
              <textarea placeholder="Descripcion" value={shelfForm.description} onChange={(e) => setShelfForm({ ...shelfForm, description: e.target.value })} />
              <div className="map-side-actions">
                <button className="primary" type="submit">{editingShelfId ? "Guardar cambios" : "Crear estanteria"}</button>
                {editingShelfId && <button type="button" className="ghost" onClick={() => { setEditingShelfId(""); setShelfForm(initialShelfForm); setIsShelfEditorOpen(false); }}>Cancelar</button>}
                {editingShelfId && selectedMapShelf && <button type="button" className="danger-soft" onClick={() => deleteShelf(selectedMapShelf)}><Trash2 size={16} /> Eliminar</button>}
              </div>
            </form>
          </details>
        </main>
      </div>
    );
  }

  if (activeView === "assistant") {
    const visibleSuggestions = reorganizationReport?.suggestions.filter((suggestion) => !dismissedSuggestionIds.includes(suggestion.id)) ?? [];
    return (
      <div className="app-shell">
        <header className="topbar">
          <button type="button" className="brand-mark" onClick={goHome} title="Volver al catalogo">
            <img src={guardaLogo} alt="GUARDA" />
            <div>
              <p className="eyebrow">Biblioteca personal</p>
              <h1>Asistente de reorganizacion</h1>
            </div>
          </button>
          <div className="topbar-actions">
            <button className="primary" onClick={loadReorganizationReport} disabled={isReorganizing}><Sparkles size={17} /> Analizar</button>
            <button className="ghost" onClick={() => setActiveView("catalog")}><X size={17} /> Volver</button>
          </div>
        </header>
        <main className="assistant-layout">
          {message && <div className="notice success">{message}</div>}
          {error && <div className="notice error">{error}</div>}
          <section className="assistant-summary">
            <div>
              <p className="eyebrow dark">{reorganizationReport?.source === "claude" ? "Claude" : "Analisis local"}</p>
              <h2>{reorganizationReport ? reorganizationReport.overview : "Analiza la distribucion actual de tu biblioteca"}</h2>
            </div>
            <button className="primary" onClick={loadReorganizationReport} disabled={isReorganizing}><Sparkles size={17} /> {isReorganizing ? "Analizando..." : "Generar informe"}</button>
          </section>
          <section className="assistant-grid">
            <div className="suggestion-list">
              {visibleSuggestions.map((suggestion) => (
                <article className={`suggestion-card ${acceptedSuggestionId === suggestion.id ? "accepted" : ""}`} key={suggestion.id}>
                  <div>
                    <span className={`confidence ${suggestion.confidence}`}>{suggestion.confidence}</span>
                    <h2>{suggestion.title}</h2>
                    <p>{suggestion.summary}</p>
                    <small>{suggestion.reason}</small>
                  </div>
                  <div className="suggestion-actions">
                    <button className="primary" onClick={() => acceptSuggestion(suggestion)}><Check size={16} /> Aceptar</button>
                    <button className="ghost" onClick={() => dismissSuggestion(suggestion.id)}><X size={16} /> Descartar</button>
                  </div>
                </article>
              ))}
              {reorganizationReport && visibleSuggestions.length === 0 && <div className="empty-state"><Sparkles size={32} /><p>No quedan sugerencias pendientes.</p></div>}
            </div>
            <aside className="movement-plan panel-section">
              <h2>{acceptedSuggestion ? acceptedSuggestion.title : "Plan de movimiento"}</h2>
              {acceptedSuggestion ? (
                <>
                  <p className="helper-text">{acceptedSuggestion.moves.length} movimientos propuestos.</p>
                  <button className="ghost" onClick={printMovementPlan}><Printer size={16} /> Imprimir o guardar</button>
                  <div className="move-list">
                    {acceptedSuggestion.moves.map((move, index) => (
                      <div key={move.bookId} className={move.confirmed ? "move-row done" : "move-row"}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>{move.title}</strong>
                          <small>{move.fromShelfName || "Sin ubicacion"}{move.fromSectionName ? ` / ${move.fromSectionName}` : ""} {"->"} {move.toShelfName}{move.toSectionName ? ` / ${move.toSectionName}` : ""}</small>
                        </div>
                        <button className="ghost" onClick={() => confirmMove(move.bookId)} disabled={move.confirmed}>{move.confirmed ? "Listo" : "Confirmar"}</button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="helper-text">Acepta una sugerencia para ver la lista ordenada de libros que debes mover.</p>
              )}
            </aside>
          </section>
        </main>
      </div>
    );
  }

  if (activeView === "management") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <button type="button" className="brand-mark" onClick={goHome} title="Volver al catalogo">
            <img src={guardaLogo} alt="GUARDA" />
            <div>
              <p className="eyebrow">Biblioteca personal</p>
              <h1>Gestion de estanterias</h1>
            </div>
          </button>
          <div className="topbar-actions">
            <button className="ghost" onClick={() => setActiveView("catalog")}><X size={17} /> Volver</button>
          </div>
        </header>
        <main className="management-layout">
          {message && <div className="notice success">{message}</div>}
          {error && <div className="notice error">{error}</div>}
          <section className="management-intro">
            <div>
              <p className="eyebrow dark">Organizacion</p>
              <h2>Gestion de estanterias y catalogos</h2>
            </div>
            <p>Administra la estructura fisica de tu biblioteca y las categorias que ayudan a ubicar cada libro.</p>
          </section>
          <section className="management-grid">
            <details open className="management-section">
              <summary><Library size={18} /> Estanterias</summary>
              <form onSubmit={submitShelf} className="stack-form compact">
                <input required placeholder="Nombre" value={shelfForm.name} onChange={(e) => setShelfForm({ ...shelfForm, name: e.target.value })} />
                <input required placeholder="Lugar de la casa" value={shelfForm.homeLocation} onChange={(e) => setShelfForm({ ...shelfForm, homeLocation: e.target.value })} />
                <input type="number" min="1" placeholder="Capacidad de libros" value={shelfForm.capacity} onChange={(e) => setShelfForm({ ...shelfForm, capacity: Number(e.target.value) })} />
                <div className="form-field">
                  <span>Generos de la estanteria</span>
                  {shelfGenrePicker()}
                </div>
                <button className="primary" type="submit">{editingShelfId ? "Actualizar estanteria" : "Crear estanteria"}</button>
                {editingShelfId && <button type="button" className="ghost" onClick={() => { setEditingShelfId(""); setShelfForm(initialShelfForm); }}>Cancelar</button>}
              </form>
              <div className="shelf-list">
                {shelves.map((shelf) => (
                  <div key={shelf.id} className="shelf-row">
                    <div className="shelf-row-header">
                      <div><strong>{shelf.name}</strong><span>{shelf.homeLocation} · {shelf._count?.books ?? 0} libros · {shelfGenresLine(shelf)}</span></div>
                      <div className="genre-actions">
                        <button type="button" onClick={() => editShelfFromMap(shelf)}><Pencil size={14} /></button>
                        <button type="button" className="danger-soft" onClick={() => deleteShelf(shelf)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <details open className="management-section">
              <summary><Library size={18} /> Repisas</summary>
              <form onSubmit={submitSection} className="stack-form compact">
                <select required value={sectionForm.shelfId} onChange={(e) => setSectionForm({ ...sectionForm, shelfId: e.target.value })}>
                  <option value="">Elegir estanteria</option>
                  {shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.name}</option>)}
                </select>
                <div className="two-cols">
                  <input required placeholder="Repisa" value={sectionForm.name} onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })} />
                  <input required type="number" min="1" value={sectionForm.position} onChange={(e) => setSectionForm({ ...sectionForm, position: Number(e.target.value) })} />
                </div>
                <input type="number" min="1" placeholder="Limite de libros" value={sectionForm.capacity} onChange={(e) => setSectionForm({ ...sectionForm, capacity: Number(e.target.value) })} />
                <div className="form-field">
                  <span>Generos de la repisa</span>
                  {sectionGenrePicker()}
                </div>
                <button className="primary" type="submit">{editingSectionId ? "Actualizar repisa" : "Crear repisa"}</button>
                {editingSectionId && <button type="button" className="ghost" onClick={() => { setEditingSectionId(""); setSectionForm(initialSectionForm); }}>Cancelar</button>}
              </form>
              <div className="shelf-list">
                {shelves.map((shelf) => shelf.sections.map((section) => (
                  <div key={section.id} className="section-row">
                    <span>{shelf.name} · {section.name} · {sectionGenresLine(section)} · {sectionBookCount(section.id)}/{section.capacity} libros</span>
                    <div>
                      <button type="button" onClick={() => { setEditingSectionId(section.id); setSectionForm({ shelfId: shelf.id, name: section.name, position: section.position, genreId: section.genreId ?? "", genreIds: section.genres?.length ? section.genres.map((genre) => genre.id) : section.genreId ? [section.genreId] : [], capacity: section.capacity ?? 12 }); }}><Pencil size={14} /></button>
                      <button type="button" className="danger-soft" onClick={() => deleteSection(section.id, section.name)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                )))}
              </div>
            </details>

            <details open className="management-section">
              <summary><Tags size={18} /> Generos</summary>
              <form onSubmit={submitGenre} className="stack-form compact">
                <div className="two-cols">
                  <input required placeholder="Genero" value={genreForm.name} onChange={(e) => setGenreForm({ ...genreForm, name: e.target.value })} />
                  <input type="color" value={genreForm.color} onChange={(e) => setGenreForm({ ...genreForm, color: e.target.value })} />
                </div>
                <input placeholder="Icono Tabler (ej. ti-book)" value={genreForm.icon} onChange={(e) => setGenreForm({ ...genreForm, icon: e.target.value })} />
                <button className="primary" type="submit">{editingGenreId ? "Actualizar genero" : "Crear genero"}</button>
                {editingGenreId && <button type="button" className="ghost" onClick={() => { setEditingGenreId(""); setGenreForm({ name: "", color: "#461e60", icon: "ti-book" }); }}>Cancelar</button>}
              </form>
              <div className="genre-list">
                {genres.map((genre) => (
                  <div key={genre.id} className="genre-row">
                    <div className="genre-title"><span className="genre-color" style={{ background: genre.color }} /><strong>{genre.name}</strong><small>{genre.icon}</small></div>
                    <div className="genre-actions">
                      <button type="button" onClick={() => { setEditingGenreId(genre.id); setGenreForm({ name: genre.name, color: genre.color, icon: genre.icon }); }}><Pencil size={14} /></button>
                      <button type="button" className="danger-soft" onClick={() => deleteGenre(genre)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <details open className="management-section">
              <summary><Tags size={18} /> Subgeneros</summary>
              <form onSubmit={submitSubgenre} className="stack-form compact">
                <select required value={subgenreForm.genreId} onChange={(e) => setSubgenreForm({ ...subgenreForm, genreId: e.target.value })}>
                  <option value="">Genero para subgenero</option>
                  {genres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
                </select>
                <input required placeholder="Subgenero" value={subgenreForm.name} onChange={(e) => setSubgenreForm({ ...subgenreForm, name: e.target.value })} />
                <button className="primary" type="submit">{editingSubgenreId ? "Actualizar subgenero" : "Crear subgenero"}</button>
              </form>
              <div className="genre-list">
                {genres.map((genre) => genre.subgenres.map((subgenre) => (
                  <span key={subgenre.id} className="subgenre-pill">
                    {genre.name} · {subgenre.name}
                    <button type="button" onClick={() => { setEditingSubgenreId(subgenre.id); setSubgenreForm({ genreId: genre.id, name: subgenre.name }); }}><Pencil size={12} /></button>
                    <button type="button" onClick={() => deleteSubgenre(subgenre.id, subgenre.name)}><X size={12} /></button>
                  </span>
                )))}
              </div>
            </details>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="brand-mark" onClick={goHome} title="Volver al catalogo">
          <img src={guardaLogo} alt="GUARDA" />
          <div>
            <p className="eyebrow">Biblioteca personal</p>
            <h1>Catalogo de casa</h1>
          </div>
        </button>
        <div className="topbar-actions">
          {libraries.length > 1 ? (
            <label className="library-switcher">
              <select value={session.library.id} onChange={(event) => switchLibrary(event.target.value)}>
                {libraries.map((library) => (
                  <option key={library.id} value={library.id}>
                    {library.name} · {library.role}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="session-chip">{session.library.name} · {session.library.role}</span>
          )}
          {installPrompt && (
            <button className="install-button" onClick={installApp}>
              <Download size={18} /> Instalar
            </button>
          )}
          <button className="tools-button" onClick={() => { setDrawerMode("menu"); setIsToolsOpen(true); }}>
            <Menu size={18} /> Herramientas
          </button>
          <button className="icon-button" onClick={() => setActiveView("map")} title="Estanterias">
            <MapIcon size={18} />
          </button>
          <button className="icon-button" onClick={loadData} title="Actualizar">
            <RefreshCcw size={18} />
          </button>
          <button className="icon-button" onClick={logout} title="Cerrar sesion">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <button className="floating-add-button" onClick={startNewBookFlow} title="Agregar libro" aria-label="Agregar libro">
        <Plus size={28} />
      </button>

      <main className="layout">
        <section className="catalog-panel">
          <div className="toolbar">
            <label className="search-box">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por titulo, autor, ISBN, editorial, genero o año"
              />
            </label>
            <select
              value={genreFilter}
              onChange={(event) => {
                setGenreFilter(event.target.value);
                setSubgenreFilter("");
              }}
            >
              <option value="">Todos los generos</option>
              {genres.map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.name}
                </option>
              ))}
            </select>
            <select value={subgenreFilter} onChange={(event) => setSubgenreFilter(event.target.value)}>
              <option value="">Todos los subgeneros</option>
              {filterSubgenres.map((subgenre) => (
                <option key={subgenre.id} value={subgenre.id}>
                  {subgenre.name}
                </option>
              ))}
            </select>
            <select
              value={shelfFilter}
              onChange={(event) => {
                setShelfFilter(event.target.value);
                if (event.target.value) setSortOrder("shelfOrder");
              }}
            >
              <option value="">Todas las estanterias</option>
              {shelves.map((shelf) => (
                <option key={shelf.id} value={shelf.id}>
                  {shelf.name}
                </option>
              ))}
            </select>
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
              <option value="updated">Recientes</option>
              <option value="title">Titulo</option>
              <option value="author">Autor</option>
              <option value="shelfOrder">Orden de estanteria</option>
            </select>
            <div className="segmented" aria-label="Cambiar vista">
              <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} title="Cuadricula">
                <Grid2X2 size={17} />
              </button>
              <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} title="Lista">
                <List size={17} />
              </button>
            </div>
          </div>

          {message && <div className="notice success">{message}</div>}
          {error && <div className="notice error">{error}</div>}
          {duplicateMatches.length > 0 && (
            <div className="duplicate-alert">
              <div>
                <h2>Posible duplicado detectado</h2>
                <p>Ya existe un libro parecido en tu biblioteca. Puedes cancelar, agregarlo como otra edicion o actualizar el existente.</p>
              </div>
              <div className="duplicate-list">
                {duplicateMatches.map((match) => (
                  <article className="duplicate-card" key={match.book.id}>
                    <div className="cover mini">
                      {match.book.coverUrl ? (
                        <img src={match.book.coverUrl} alt={`Portada de ${match.book.title}`} />
                      ) : (
                        <BookOpen size={28} />
                      )}
                    </div>
                    <div>
                      <strong>{match.book.title}</strong>
                      <p>{authorsLine(match.book) || "Autor sin registrar"}</p>
                      <span>
                        {match.reason} · {Math.round(match.score * 100)}%
                      </span>
                      <div className="duplicate-actions">
                        <button type="button" className="primary" onClick={() => updateDuplicateExisting(match)}>
                          Actualizar existente
                        </button>
                        <button type="button" className="ghost" onClick={addDuplicateAnyway}>
                          Agregar de todas formas
                        </button>
                        <button type="button" className="danger-soft" onClick={cancelDuplicateSave}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="catalog-heading">
            <h2>{total} libros</h2>
            {isLoading && <span>Cargando...</span>}
          </div>

          <div className={view === "grid" ? "book-grid" : "book-list"}>
            {books.map((book) => (
              <article className="book-card" key={book.id}>
                <div className="cover">
                  <label className="select-book">
                    <input
                      type="checkbox"
                      checked={selectedBookIds.includes(book.id)}
                      onChange={() => toggleSelectedBook(book.id)}
                    />
                  </label>
                  {book.coverUrl ? <img src={book.coverUrl} alt={`Portada de ${book.title}`} /> : <BookOpen size={42} />}
                </div>
                <div className="book-content">
                  <div>
                    <h3>{book.title}</h3>
                    <p>{authorsLine(book) || "Autor sin registrar"}</p>
                  </div>
                  <div className="meta-line">
                    {book.publisher?.name && <span>{book.publisher.name}</span>}
                    {book.publicationYear && <span>{book.publicationYear}</span>}
                    {book.genre && <span>{book.genre}</span>}
                  </div>
                  <div className="chips">
                    <span>{formatAvailability(book.availabilityStatus)}</span>
                    <span>{formatReading(book.readingStatus)}</span>
                    {book.genreRef && (
                      <span style={{ borderColor: book.genreRef.color, color: book.genreRef.color }}>
                        {book.genreRef.name}
                      </span>
                    )}
                    {book.deweyCode && <span>DDC {book.deweyCode}</span>}
                    {book.lcCode && <span>LC {book.lcCode}</span>}
                    <span className="label-chip">Tejuelo {tejueloNumber(book)}</span>
                    {book.isReference && <span>Referencia</span>}
                  </div>
                  {book.customTags?.length > 0 && <p className="tag-line">{book.customTags.join(", ")}</p>}
                  <p className="location">
                    <Library size={15} />
                    {book.shelf?.name ?? "Sin ubicacion"}
                    {book.shelfSection ? ` · ${book.shelfSection.name}` : ""}
                  </p>
                  {book.activeLoan && <p className="loan">Prestado a {book.activeLoan.borrowerName}</p>}
                  <div className="card-actions">
                    {book.activeLoan ? (
                      <button onClick={() => returnLoan(book)}>
                        <Undo2 size={16} /> Devolver
                      </button>
                    ) : (
                      <button onClick={() => { setLoanForm((current) => ({ ...current, bookId: book.id })); setIsToolsOpen(true); }}>
                        <Send size={16} /> Prestar
                      </button>
                    )}
                    <button onClick={() => startEditBook(book)} title="Editar">
                      <Pencil size={16} /> Editar
                    </button>
                    <button onClick={() => openBookOnMap(book)} title="Ver en estanteria">
                      <MapIcon size={16} /> Ver en estanteria
                    </button>
                    <button className="danger-soft" onClick={() => deleteBook(book)} title="Eliminar">
                      <Trash2 size={16} /> Eliminar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!isLoading && books.length === 0 && (
            <div className="empty-state">
              <BookOpen size={36} />
              <p>No hay libros con esos criterios.</p>
            </div>
          )}
        </section>

        {isToolsOpen && <button className="drawer-overlay" aria-label="Cerrar herramientas" onClick={() => { setIsToolsOpen(false); setDrawerMode("menu"); }} />}
        <aside className={`side-panel ${isToolsOpen ? "open" : ""} drawer-mode-${drawerMode}`}>
          <div className="drawer-header">
            <div>
              <p className="eyebrow dark">Herramientas</p>
              <h2>Gestion de biblioteca</h2>
            </div>
            <button
              className="icon-menu"
              onClick={() => {
                setIsToolsOpen(false);
                setDrawerMode("menu");
                if (drawerMode === "book") cancelEditBook();
              }}
              title="Cerrar"
            >
              <X size={17} />
            </button>
          </div>
          {drawerMode === "menu" && (
            <div className="global-menu-actions">
              <button type="button" className="primary" onClick={startNewBookFlow}>
                <Plus size={18} /> Crear nuevo libro
              </button>
              <button type="button" className="ghost" onClick={() => { setActiveView("management"); setIsToolsOpen(false); }}>
                <Library size={18} /> Gestion de estanterias
              </button>
              <button type="button" className="ghost" onClick={() => { setActiveView("map"); setIsToolsOpen(false); }}>
                <MapIcon size={18} /> Estanterias
              </button>
              <button type="button" className="ghost" onClick={() => { setActiveView("assistant"); setIsToolsOpen(false); void loadReorganizationReport(); }}>
                <Sparkles size={18} /> Asistente de reorganizacion
              </button>
              {session.library.role === "OWNER" && (
                <section className="members-panel">
                  <div>
                    <p className="eyebrow dark">Equipo</p>
                    <h3>Usuarios de la biblioteca</h3>
                  </div>
                  <form onSubmit={submitMember} className="stack-form compact">
                    <input
                      required
                      type="email"
                      placeholder="Correo del usuario"
                      value={memberForm.email}
                      onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })}
                    />
                    <select value={memberForm.role} onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value as LibraryRole })}>
                      <option value="READER">Lector</option>
                      <option value="EDITOR">Editor</option>
                      <option value="OWNER">Propietario</option>
                    </select>
                    <button type="submit" className="ghost">
                      <UserPlus size={16} /> Agregar
                    </button>
                  </form>
                  <div className="member-list">
                    {members.map((member) => (
                      <div className="member-row" key={member.id}>
                        <div>
                          <strong>{member.user.name}</strong>
                          <small>{member.user.email}</small>
                        </div>
                        <select value={member.role} onChange={(event) => updateMemberRole(member, event.target.value as LibraryRole)}>
                          <option value="READER">Lector</option>
                          <option value="EDITOR">Editor</option>
                          <option value="OWNER">Propietario</option>
                        </select>
                        <button type="button" className="danger-soft" onClick={() => deleteMember(member)}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
          <details
            className="panel-section scanner-panel drawer-section"
            open={openToolSections.includes("scan")}
            onToggle={(event) => setToolSection("scan", event.currentTarget.open)}
          >
            <summary>
              <Barcode size={18} /> Escanear ISBN
            </summary>
            <div className="stack-form">
              <div className="scanner-frame">
                <video ref={videoRef} muted playsInline />
                {!isScanning && (
                  <div className="scanner-placeholder">
                    <Camera size={28} />
                    <span>Camara lista</span>
                  </div>
                )}
              </div>
              {scanStatus && <p className="helper-text">{scanStatus}</p>}
              {cameraDevices.length > 1 && (
                <select value={selectedCameraId} onChange={(event) => setSelectedCameraId(event.target.value)} disabled={isScanning}>
                  {cameraDevices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camara ${index + 1}`}
                    </option>
                  ))}
                </select>
              )}
              <div className="two-cols">
                <button type="button" className="primary" onClick={startScanner} disabled={isScanning || isLookupLoading}>
                  <Camera size={17} /> Escanear
                </button>
                <button type="button" className="ghost" onClick={stopScanner} disabled={!isScanning}>
                  <Square size={15} /> Detener
                </button>
              </div>
              <div className="isbn-lookup-row">
                <input
                  placeholder="ISBN manual"
                  value={isbnLookup}
                  onChange={(event) => setIsbnLookup(event.target.value)}
                />
                <button type="button" className="ghost" onClick={() => lookupIsbn(isbnLookup)} disabled={isLookupLoading}>
                  <Search size={16} /> Buscar
                </button>
              </div>
              {isbnLookupNotice && (
                <div className={`inline-notice ${isbnLookupNotice.type}`}>
                  <p>{isbnLookupNotice.text}</p>
                  {isbnLookupNotice.type === "warning" && (
                    <button type="button" className="ghost" onClick={() => setDrawerMode("book")}>
                      <BookOpen size={16} /> Buscar por titulo
                    </button>
                  )}
                </div>
              )}
              <div className="book-search-panel">
                <div className="two-cols">
                  <input
                    placeholder="Titulo sin ISBN"
                    value={bookSearchForm.title}
                    onChange={(event) => setBookSearchForm({ ...bookSearchForm, title: event.target.value })}
                  />
                  <input
                    placeholder="Autor opcional"
                    value={bookSearchForm.author}
                    onChange={(event) => setBookSearchForm({ ...bookSearchForm, author: event.target.value })}
                  />
                </div>
                <div className="two-cols">
                  <input
                    placeholder="Editorial opcional"
                    value={bookSearchForm.publisher}
                    onChange={(event) => setBookSearchForm({ ...bookSearchForm, publisher: event.target.value })}
                  />
                  <input
                    placeholder="Año opcional"
                    type="number"
                    value={bookSearchForm.year}
                    onChange={(event) => setBookSearchForm({ ...bookSearchForm, year: event.target.value })}
                  />
                </div>
                <button type="button" className="ghost" onClick={searchBooksWithoutIsbn} disabled={isBookSearching}>
                  <BookOpen size={16} /> Buscar sin ISBN
                </button>
                {bookSearchResults.length > 0 && (
                  <div className="external-results">
                    {bookSearchResults.map((book, index) => (
                      <button type="button" key={`${book.source}-${book.title}-${index}`} onClick={() => useExternalBookResult(book)}>
                        {book.coverUrl ? <img src={book.coverUrl} alt={`Portada de ${book.title}`} /> : <BookOpen size={22} />}
                        <span>
                          <strong>{book.title}</strong>
                          <small>
                            {[book.authors?.join(", "), book.publicationYear, book.publisher].filter(Boolean).join(" · ") || "Datos publicos"}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </details>

          <details
            className="panel-section book-entry-panel drawer-section"
            open={openToolSections.includes("book")}
            onToggle={(event) => setToolSection("book", event.currentTarget.open)}
          >
            <summary>
              <Plus size={18} /> {editingBookId ? "Editar libro" : "Agregar libro"}
            </summary>
            <form onSubmit={submitBook} className="stack-form">
              <input required placeholder="Titulo" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
              {bookForm.authors.map((author, index) => (
                <input
                  required={index === 0}
                  key={index}
                  placeholder={index === 0 ? "Autor principal" : "Otro autor"}
                  value={author}
                  onChange={(e) => updateAuthor(index, e.target.value)}
                />
              ))}
              <button type="button" className="ghost" onClick={() => setBookForm({ ...bookForm, authors: [...bookForm.authors, ""] })}>
                <Plus size={16} /> Otro autor
              </button>
              <div className="two-cols">
                <input placeholder="ISBN 13" value={bookForm.isbn13} onChange={(e) => setBookForm({ ...bookForm, isbn13: e.target.value })} />
                <input placeholder="Año" type="number" value={bookForm.publicationYear} onChange={(e) => setBookForm({ ...bookForm, publicationYear: e.target.value ? Number(e.target.value) : "" })} />
              </div>
              <input placeholder="Editorial" value={bookForm.publisher} onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })} />
              <div className="two-cols">
                <input placeholder="Genero libre" value={bookForm.genre} onChange={(e) => setBookForm({ ...bookForm, genre: e.target.value })} />
                <input placeholder="Paginas" type="number" value={bookForm.pageCount} onChange={(e) => setBookForm({ ...bookForm, pageCount: e.target.value ? Number(e.target.value) : "" })} />
              </div>
              <div className="two-cols">
                <select
                  value={bookForm.genreId}
                  onChange={(e) => setBookForm({ ...bookForm, genreId: e.target.value, subgenreId: "" })}
                >
                  <option value="">Genero principal</option>
                  {genres.map((genre) => (
                    <option key={genre.id} value={genre.id}>
                      {genre.name}
                    </option>
                  ))}
                </select>
                <select
                  value={bookForm.subgenreId}
                  onChange={(e) => setBookForm({ ...bookForm, subgenreId: e.target.value })}
                  disabled={!bookForm.genreId}
                >
                  <option value="">Subgenero</option>
                  {selectedBookSubgenres.map((subgenre) => (
                    <option key={subgenre.id} value={subgenre.id}>
                      {subgenre.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="ghost" onClick={classifyFormBook} disabled={isClassifying || !bookForm.title.trim()}>
                <Sparkles size={16} /> {isClassifying ? "Clasificando..." : "Clasificar con IA"}
              </button>
              {(bookForm.deweyCode || bookForm.lcCode || bookForm.customTags?.length) && (
                <div className="classification-summary">
                  {bookForm.deweyCode && <span>DDC {bookForm.deweyCode}</span>}
                  {bookForm.lcCode && <span>LC {bookForm.lcCode}</span>}
                  {bookForm.customTags?.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              )}
              {classificationDraft.suggestedGenre && (
                <div className="ai-genre-suggestion media">
                  <div>
                    <span className="suggestion-badge">{classificationDraft.genreConfidence ?? "IA"}</span>
                    <strong>
                      {classificationDraft.suggestedGenre}
                      {classificationDraft.suggestedSubgenre ? ` / ${classificationDraft.suggestedSubgenre}` : ""}
                    </strong>
                  </div>
                  {classificationDraft.genreReason && <p>{classificationDraft.genreReason}</p>}
                </div>
              )}
              {deweyGenreSuggestion && (
                <div className={`ai-genre-suggestion ${deweyGenreSuggestion.confianza}`}>
                  <div>
                    <span className="suggestion-badge">
                      {deweyGenreSuggestion.confianza === "alta" ? "Alta" : deweyGenreSuggestion.confianza === "media" ? "Sugerido" : "Confirmar"}
                    </span>
                    <strong>
                      {deweyGenreSuggestion.genero_principal}
                      {deweyGenreSuggestion.subgenero ? ` / ${deweyGenreSuggestion.subgenero}` : ""}
                    </strong>
                  </div>
                  <p>{deweyGenreSuggestion.razon}</p>
                  {!deweyGenreSuggestion.genreId && (
                    <small>Este genero aun no existe en tu lista. Puedes crearlo en Estanterias o usarlo como genero libre.</small>
                  )}
                  <button type="button" className="ghost" onClick={applyDeweyGenreSuggestion}>
                    <Check size={15} /> Usar sugerencia
                  </button>
                </div>
              )}
              <input
                placeholder="Genero Dewey/API sin procesar"
                value={bookForm.deweyGenreRaw}
                onChange={(e) => setBookForm({ ...bookForm, deweyGenreRaw: e.target.value })}
              />
              <input placeholder="URL de portada" value={bookForm.coverUrl} onChange={(e) => setBookForm({ ...bookForm, coverUrl: e.target.value })} />
              <textarea placeholder="Sinopsis" value={bookForm.synopsis} onChange={(e) => setBookForm({ ...bookForm, synopsis: e.target.value })} />
              <div className="two-cols">
                <select value={bookForm.readingStatus} onChange={(e) => setBookForm({ ...bookForm, readingStatus: e.target.value as ReadingStatus })}>
                  <option value="SIN_ESTADO">Sin estado</option>
                  <option value="LEIDO">Leido</option>
                  <option value="POR_LEER">Por leer</option>
                </select>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={bookForm.isReference}
                    onChange={(e) => setBookForm({ ...bookForm, isReference: e.target.checked })}
                  />
                  Referencia
                </label>
              </div>
              <select value={bookForm.shelfId} onChange={(e) => setBookForm({ ...bookForm, shelfId: e.target.value, shelfSectionId: "" })}>
                <option value="">Sin estanteria</option>
                {shelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.id}>
                    {shelf.name}
                  </option>
                ))}
              </select>
              <select value={bookForm.shelfSectionId} onChange={(e) => setBookForm({ ...bookForm, shelfSectionId: e.target.value })}>
                <option value="">Sin repisa</option>
                {selectedShelf?.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name} · {sectionGenresLine(section)} · {sectionBookCount(section.id)}/{section.capacity} libros
                  </option>
                ))}
              </select>
                {selectedShelfGenreMismatch && (
                  <div className="notice warning">
                    Esta estanteria esta marcada para {selectedShelf?.genres.map((genre) => genre.name).join(", ")}, pero el libro esta marcado como {selectedBookGenre?.name}. Puedes guardarlo igual si quieres ubicarlo ahi.
                  </div>
                )}
                {selectedSectionGenreMismatch && selectedShelfSection && (
                  <div className="notice warning">
                    Esta repisa esta marcada para {sectionGenresLine(selectedShelfSection)}, pero el libro esta marcado como {selectedBookGenre?.name}. Puedes guardarlo igual si quieres ubicarlo ahi.
                  </div>
                )}
              <div className="inline-label-tools">
                <div className="two-cols">
                  <select
                    value={labelSystem}
                    onChange={(event) => {
                      const system = event.target.value as "DEWEY" | "LC" | "PROPIA";
                      const serial = generateLabelSerialFromForm(system);
                      setLabelSystem(system);
                      setLabelSerialDraft(serial);
                      setBookForm({ ...bookForm, labelSystem: system, labelSerial: serial });
                    }}
                  >
                    <option value="DEWEY">Tejuelo Dewey</option>
                    <option value="LC">Tejuelo LC</option>
                    <option value="PROPIA">Tejuelo propio</option>
                  </select>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      const serial = generateLabelSerialFromForm();
                      setLabelSerialDraft(serial);
                      setBookForm({ ...bookForm, labelSerial: serial, labelSystem });
                    }}
                  >
                    <Printer size={16} /> Generar tejuelo
                  </button>
                </div>
                <textarea
                  placeholder="Seriado del tejuelo"
                  value={labelSerialDraft || bookForm.labelSerial || ""}
                  onChange={(event) => {
                    setLabelSerialDraft(event.target.value);
                    setBookForm({ ...bookForm, labelSerial: event.target.value });
                  }}
                />
                <div className="label-preview">{labelSerialDraft || bookForm.labelSerial || generateLabelSerialFromForm()}</div>
              </div>
              <button className="primary" type="submit">
                <Check size={17} /> {editingBookId ? "Actualizar libro" : "Guardar libro"}
              </button>
              {editingBookId && (
                <button type="button" className="ghost" onClick={cancelEditBook}>
                  Cancelar edicion
                </button>
              )}
            </form>
          </details>

          <details
            className="panel-section classification-panel drawer-section"
            open={openToolSections.includes("classification")}
            onToggle={(event) => setToolSection("classification", event.currentTarget.open)}
          >
            <summary>
              <Sparkles size={18} /> Clasificacion con IA
            </summary>
            <div className="stack-form">
              <button type="button" className="ghost" onClick={() => openClassificationAssistant()}>
                <FileText size={16} /> Usar libro del formulario
              </button>
              <p className="helper-text">
                {classificationBook ? `Libro seleccionado: ${classificationBook.title}` : "Libro seleccionado: formulario de ingreso"}
              </p>
              <button type="button" className="primary" onClick={suggestClassification} disabled={isClassifying}>
                <Sparkles size={17} /> {isClassifying ? "Consultando..." : "Sugerir con IA"}
              </button>
              <div className="two-cols">
                <input
                  placeholder="Codigo Dewey"
                  value={classificationDraft.deweyCode ?? ""}
                  onChange={(event) => setClassificationDraft({ ...classificationDraft, deweyCode: event.target.value })}
                />
                <input
                  placeholder="Signatura LC"
                  value={classificationDraft.lcCode ?? ""}
                  onChange={(event) => setClassificationDraft({ ...classificationDraft, lcCode: event.target.value })}
                />
              </div>
              <textarea
                placeholder="Jerarquia Dewey, una linea por nivel"
                value={classificationDraft.deweyHierarchy.join("\n")}
                onChange={(event) => setClassificationDraft({ ...classificationDraft, deweyHierarchy: splitLines(event.target.value) })}
              />
              <textarea
                placeholder="Explicacion Dewey"
                value={classificationDraft.deweyExplanation ?? ""}
                onChange={(event) => setClassificationDraft({ ...classificationDraft, deweyExplanation: event.target.value })}
              />
              <textarea
                placeholder="Jerarquia LC, una linea por nivel"
                value={classificationDraft.lcHierarchy.join("\n")}
                onChange={(event) => setClassificationDraft({ ...classificationDraft, lcHierarchy: splitLines(event.target.value) })}
              />
              <textarea
                placeholder="Explicacion LC"
                value={classificationDraft.lcExplanation ?? ""}
                onChange={(event) => setClassificationDraft({ ...classificationDraft, lcExplanation: event.target.value })}
              />
              <label className="tag-input">
                <Tags size={16} />
                <input
                  placeholder="Etiquetas separadas por coma"
                  value={classificationDraft.customTags.join(", ")}
                  onChange={(event) => setClassificationDraft({ ...classificationDraft, customTags: splitTags(event.target.value) })}
                />
              </label>
              <button type="button" className="primary" onClick={acceptClassification}>
                <Save size={17} /> Aceptar y guardar
              </button>
            </div>
          </details>

          <details
            className="panel-section label-panel drawer-section"
            open={openToolSections.includes("labels")}
            onToggle={(event) => setToolSection("labels", event.currentTarget.open)}
          >
            <summary>
              <Printer size={18} /> Generacion de tejuelos
            </summary>
            <div className="stack-form">
              <select
                value={labelBookId}
                onChange={(event) => {
                  const book = books.find((item) => item.id === event.target.value);
                  if (book) openLabelPanel(book);
                }}
              >
                <option value="">Elegir libro</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
              <div className="two-cols">
                <select
                  value={labelSystem}
                  onChange={(event) => {
                    const system = event.target.value as "DEWEY" | "LC" | "PROPIA";
                    setLabelSystem(system);
                    if (labelBook) setLabelSerialDraft(generateLabelSerial(labelBook, system));
                  }}
                >
                  <option value="DEWEY">Dewey</option>
                  <option value="LC">LC</option>
                  <option value="PROPIA">Propia</option>
                </select>
                <select value={labelSize} onChange={(event) => setLabelSize(event.target.value as any)}>
                  <option value="PEQUENO">Pequeno 2 x 3 cm</option>
                  <option value="MEDIANO">Mediano 3 x 4 cm</option>
                  <option value="PERSONALIZADO">Personalizado</option>
                </select>
              </div>
              <div className="two-cols">
                <select value={labelPageSize} onChange={(event) => setLabelPageSize(event.target.value as "letter" | "A4")}>
                  <option value="letter">Carta</option>
                  <option value="A4">A4</option>
                </select>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={labelColumns}
                  onChange={(event) => setLabelColumns(Number(event.target.value))}
                  placeholder="Columnas"
                />
              </div>
              {labelSize === "PERSONALIZADO" && (
                <div className="two-cols">
                  <input type="number" min="1" step="0.1" value={labelWidth} onChange={(event) => setLabelWidth(Number(event.target.value))} />
                  <input type="number" min="1" step="0.1" value={labelHeight} onChange={(event) => setLabelHeight(Number(event.target.value))} />
                </div>
              )}
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={includeShelfOnLabel}
                  onChange={(event) => {
                    setIncludeShelfOnLabel(event.target.checked);
                    if (labelBook) setLabelSerialDraft(generateLabelSerial(labelBook));
                  }}
                />
                Mostrar estanteria
              </label>
              <textarea
                placeholder="Seriado del tejuelo"
                value={labelSerialDraft}
                onChange={(event) => setLabelSerialDraft(event.target.value)}
              />
              <div className="label-preview">{labelSerialDraft || "SIN-CLAS\nAUT\nTIT"}</div>
              <div className="two-cols">
                <button type="button" className="primary" onClick={() => saveLabel()}>
                  <Save size={17} /> Guardar
                </button>
                <button type="button" className="ghost" onClick={() => labelBook && printLabels([labelBook])}>
                  <Printer size={17} /> PDF
                </button>
              </div>
              <div className="two-cols">
                <button type="button" className="ghost" onClick={() => downloadLabelPng()}>
                  <ImageIcon size={17} /> PNG
                </button>
                <button type="button" className="ghost" onClick={() => printLabels(selectedBooks)}>
                  <Printer size={17} /> Lote ({selectedBooks.length})
                </button>
              </div>
            </div>
          </details>

          {loanForm.bookId && (
            <section className="panel-section accent">
              <h2>Registrar prestamo</h2>
              <form onSubmit={submitLoan} className="stack-form">
                <input required placeholder="Prestado a" value={loanForm.borrowerName} onChange={(e) => setLoanForm({ ...loanForm, borrowerName: e.target.value })} />
                <input placeholder="Contacto" value={loanForm.borrowerContact} onChange={(e) => setLoanForm({ ...loanForm, borrowerContact: e.target.value })} />
                <input type="date" value={loanForm.dueAt} onChange={(e) => setLoanForm({ ...loanForm, dueAt: e.target.value })} />
                <textarea placeholder="Notas" value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })} />
                <button className="primary" type="submit">
                  <Send size={17} /> Registrar
                </button>
              </form>
            </section>
          )}

          <details
            className="panel-section drawer-section locations-panel"
            open={openToolSections.includes("locations")}
            onToggle={(event) => setToolSection("locations", event.currentTarget.open)}
          >
            <summary>
              <Library size={18} /> Estanterias
            </summary>
            <form onSubmit={submitGenre} className="stack-form compact">
              <div className="two-cols">
                <input required placeholder="Genero" value={genreForm.name} onChange={(e) => setGenreForm({ ...genreForm, name: e.target.value })} />
                <input type="color" value={genreForm.color} onChange={(e) => setGenreForm({ ...genreForm, color: e.target.value })} />
              </div>
              <input placeholder="Icono Tabler (ej. ti-book)" value={genreForm.icon} onChange={(e) => setGenreForm({ ...genreForm, icon: e.target.value })} />
              <button className="primary" type="submit">{editingGenreId ? "Actualizar genero" : "Crear genero"}</button>
              {editingGenreId && (
                <button type="button" className="ghost" onClick={() => { setEditingGenreId(""); setGenreForm({ name: "", color: "#461e60", icon: "ti-book" }); }}>
                  Cancelar
                </button>
              )}
            </form>
            <form onSubmit={submitSubgenre} className="stack-form compact">
              <select required value={subgenreForm.genreId} onChange={(e) => setSubgenreForm({ ...subgenreForm, genreId: e.target.value })}>
                <option value="">Genero para subgenero</option>
                {genres.map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.name}
                  </option>
                ))}
              </select>
              <input required placeholder="Subgenero" value={subgenreForm.name} onChange={(e) => setSubgenreForm({ ...subgenreForm, name: e.target.value })} />
              <button className="ghost" type="submit">{editingSubgenreId ? "Actualizar subgenero" : "Crear subgenero"}</button>
            </form>
            <div className="genre-list">
              {genres.map((genre) => (
                <div key={genre.id} className="genre-row">
                  <div className="genre-title">
                    <span className="genre-color" style={{ background: genre.color }} />
                    <strong>{genre.name}</strong>
                    <small>{genre.icon}</small>
                  </div>
                  <div className="genre-actions">
                    <button type="button" onClick={() => { setEditingGenreId(genre.id); setGenreForm({ name: genre.name, color: genre.color, icon: genre.icon }); }}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="danger-soft" onClick={() => deleteGenre(genre)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {genre.subgenres.length > 0 && (
                    <div className="subgenre-list">
                      {genre.subgenres.map((subgenre) => (
                        <span key={subgenre.id} className="subgenre-pill">
                          {subgenre.name}
                          <button type="button" onClick={() => { setEditingSubgenreId(subgenre.id); setSubgenreForm({ genreId: genre.id, name: subgenre.name }); }}>
                            <Pencil size={12} />
                          </button>
                          <button type="button" onClick={() => deleteSubgenre(subgenre.id, subgenre.name)}>
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={submitShelf} className="stack-form compact">
              <input required placeholder="Nombre" value={shelfForm.name} onChange={(e) => setShelfForm({ ...shelfForm, name: e.target.value })} />
              <input required placeholder="Lugar de la casa" value={shelfForm.homeLocation} onChange={(e) => setShelfForm({ ...shelfForm, homeLocation: e.target.value })} />
              <input type="number" min="1" placeholder="Capacidad de libros" value={shelfForm.capacity} onChange={(e) => setShelfForm({ ...shelfForm, capacity: Number(e.target.value) })} />
              <div className="form-field">
                <span>Generos de la estanteria</span>
                {shelfGenrePicker()}
              </div>
              <button className="primary" type="submit">{editingShelfId ? "Actualizar estanteria" : "Crear estanteria"}</button>
              {editingShelfId && (
                <button type="button" className="ghost" onClick={() => { setEditingShelfId(""); setShelfForm(initialShelfForm); }}>
                  Cancelar
                </button>
              )}
            </form>
            <form onSubmit={submitSection} className="stack-form compact">
              <select required value={sectionForm.shelfId} onChange={(e) => setSectionForm({ ...sectionForm, shelfId: e.target.value })}>
                <option value="">Elegir estanteria</option>
                {shelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.id}>
                    {shelf.name}
                  </option>
                ))}
              </select>
              <div className="two-cols">
                <input required placeholder="Repisa" value={sectionForm.name} onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })} />
                <input required type="number" min="1" value={sectionForm.position} onChange={(e) => setSectionForm({ ...sectionForm, position: Number(e.target.value) })} />
              </div>
              <input type="number" min="1" placeholder="Limite de libros" value={sectionForm.capacity} onChange={(e) => setSectionForm({ ...sectionForm, capacity: Number(e.target.value) })} />
              <div className="form-field">
                <span>Generos de la repisa</span>
                {sectionGenrePicker()}
              </div>
              <button className="ghost" type="submit">{editingSectionId ? "Actualizar repisa" : "Crear repisa"}</button>
              {editingSectionId && (
                <button type="button" className="ghost" onClick={() => { setEditingSectionId(""); setSectionForm(initialSectionForm); }}>
                  Cancelar
                </button>
              )}
            </form>
            <div className="shelf-list">
              {shelves.map((shelf) => (
                <div key={shelf.id} className="shelf-row">
                  <div className="shelf-row-header">
                    <div>
                      <strong>{shelf.name}</strong>
                      <span>{shelf.homeLocation} · {shelf._count?.books ?? 0} libros · {shelfGenresLine(shelf)}</span>
                    </div>
                    <button type="button" className="icon-menu" onClick={() => setOpenShelfMenuId(openShelfMenuId === shelf.id ? "" : shelf.id)} title="Menu">
                      <Menu size={17} />
                    </button>
                  </div>
                  {openShelfMenuId === shelf.id && (
                    <div className="shelf-actions">
                      <button type="button" onClick={() => editShelfFromMap(shelf)}>
                        <Pencil size={15} /> Editar
                      </button>
                      <button type="button" onClick={() => printLabels(books.filter((book) => book.shelf?.id === shelf.id))}>
                        <Printer size={15} /> Imprimir
                      </button>
                      <button type="button" className="danger-soft" onClick={() => deleteShelf(shelf)}>
                        <Trash2 size={15} /> Eliminar
                      </button>
                    </div>
                  )}
                  {shelf.sections.length > 0 && (
                    <div className="section-list">
                      {shelf.sections.map((section) => (
                        <div key={section.id} className="section-row">
                          <span>
                            {section.name}
                            {` · ${sectionGenresLine(section)} · ${sectionBookCount(section.id)}/${section.capacity} libros`}
                          </span>
                          <div>
                            <button type="button" onClick={() => { setEditingSectionId(section.id); setSectionForm({ shelfId: shelf.id, name: section.name, position: section.position, genreId: section.genreId ?? "", genreIds: section.genres?.length ? section.genres.map((genre) => genre.id) : section.genreId ? [section.genreId] : [], capacity: section.capacity ?? 12 }); }}>
                              <Pencil size={14} />
                            </button>
                            <button type="button" className="danger-soft" onClick={() => deleteSection(section.id, section.name)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        </aside>
      </main>
    </div>
  );
}
