import cors from "cors";
import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { Prisma, type LibraryRole } from "@prisma/client";
import { prisma } from "./db.js";
import { AppError, errorHandler, notFound } from "./errors.js";
import {
  bookPayloadSchema,
  classificationInputSchema,
  classificationPayloadSchema,
  deweyGenreSuggestionSchema,
  genreSchema,
  genreUpdateSchema,
  loginSchema,
  loanSchema,
  memberSchema,
  memberUpdateSchema,
  registerSchema,
  shelfSchema,
  shelfSectionSchema,
  shelfSectionUpdateSchema,
  shelfUpdateSchema,
  subgenreSchema,
  subgenreUpdateSchema,
  switchLibrarySchema
} from "./validation.js";
import { cleanNullable, normalizeName, slugify } from "./utils.js";

const app = express();
const port = Number(process.env.API_PORT ?? 4000);
const jwtSecret = process.env.JWT_SECRET ?? "cambia-esta-clave-local";

type AuthContext = {
  userId: string;
  email: string;
  name: string;
  libraryId: string;
  libraryName: string;
  role: LibraryRole;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

const bookInclude = {
  publisher: true,
  genreRef: true,
  subgenre: true,
  shelf: true,
  shelfSection: { include: { genreRef: true, genres: { include: { genre: true } } } },
  authors: {
    orderBy: { authorOrder: "asc" as const },
    include: { author: true }
  },
  loans: {
    orderBy: { loanedAt: "desc" as const }
  }
};

const shelfInclude = {
  genres: {
    include: { genre: true }
  },
  sections: {
    include: {
      genreRef: true,
      genres: { include: { genre: true } }
    },
    orderBy: { position: "asc" as const }
  },
  _count: { select: { books: true } }
};

const baseGenres = [
  {
    name: "Novela",
    color: "#7c3aed",
    icon: "ti-book-2",
    subgenres: ["Novela clasica", "Novela contemporanea", "Novela historica", "Novela negra", "Ciencia ficcion", "Fantasia", "Romance", "Terror", "Aventura"]
  },
  {
    name: "Cuento",
    color: "#db2777",
    icon: "ti-feather",
    subgenres: ["Cuento clasico", "Cuento contemporaneo", "Microcuento", "Cuento infantil", "Antologia"]
  },
  {
    name: "Poesia",
    color: "#c026d3",
    icon: "ti-writing",
    subgenres: ["Poesia clasica", "Poesia contemporanea", "Poesia latinoamericana", "Haiku", "Antologia poetica"]
  },
  {
    name: "Teatro",
    color: "#ea580c",
    icon: "ti-masks-theater",
    subgenres: ["Tragedia", "Comedia", "Drama", "Teatro clasico", "Teatro contemporaneo"]
  },
  {
    name: "Ensayo",
    color: "#0f766e",
    icon: "ti-notes",
    subgenres: ["Ensayo literario", "Ensayo politico", "Ensayo filosofico", "Cronica", "Critica cultural"]
  },
  {
    name: "Filosofia",
    color: "#2563eb",
    icon: "ti-brain",
    subgenres: ["Filosofia antigua", "Filosofia moderna", "Etica", "Logica", "Metafisica", "Filosofia politica", "Estetica"]
  },
  {
    name: "Historia",
    color: "#b45309",
    icon: "ti-building-bank",
    subgenres: ["Historia universal", "Historia antigua", "Historia moderna", "Historia contemporanea", "Historia de Colombia", "Historia de America Latina"]
  },
  {
    name: "Ciencias sociales",
    color: "#047857",
    icon: "ti-users",
    subgenres: ["Sociologia", "Antropologia", "Politica", "Economia", "Comunicacion", "Estudios culturales"]
  },
  {
    name: "Psicologia",
    color: "#0891b2",
    icon: "ti-mood-smile",
    subgenres: ["Psicologia general", "Psicoanalisis", "Desarrollo personal", "Neuropsicologia", "Terapia", "Educacion emocional"]
  },
  {
    name: "Ciencia",
    color: "#16a34a",
    icon: "ti-flask",
    subgenres: ["Matematicas", "Fisica", "Quimica", "Biologia", "Astronomia", "Medio ambiente", "Divulgacion cientifica"]
  },
  {
    name: "Tecnologia",
    color: "#4f46e5",
    icon: "ti-device-laptop",
    subgenres: ["Programacion", "Inteligencia artificial", "Ingenieria", "Internet", "Ciberseguridad", "Diseno digital"]
  },
  {
    name: "Arte",
    color: "#dc2626",
    icon: "ti-palette",
    subgenres: ["Historia del arte", "Pintura", "Fotografia", "Arquitectura", "Diseno", "Musica", "Cine"]
  },
  {
    name: "Religion y espiritualidad",
    color: "#9333ea",
    icon: "ti-candle",
    subgenres: ["Cristianismo", "Budismo", "Mitologia", "Espiritualidad", "Teologia", "Textos sagrados"]
  },
  {
    name: "Infantil y juvenil",
    color: "#f59e0b",
    icon: "ti-balloon",
    subgenres: ["Libro album", "Primeros lectores", "Juvenil", "Fantasia juvenil", "Aventura juvenil", "Cuentos infantiles"]
  },
  {
    name: "Biografia y memorias",
    color: "#64748b",
    icon: "ti-user-star",
    subgenres: ["Biografia", "Autobiografia", "Memorias", "Diarios", "Correspondencia", "Testimonio"]
  },
  {
    name: "Referencia",
    color: "#334155",
    icon: "ti-books",
    subgenres: ["Diccionarios", "Enciclopedias", "Manuales", "Atlas", "Guias", "Almanaques"]
  },
  {
    name: "Educacion",
    color: "#0d9488",
    icon: "ti-school",
    subgenres: ["Pedagogia", "Didactica", "Texto escolar", "Lenguas", "Investigacion educativa", "Curriculo"]
  },
  {
    name: "Negocios y finanzas",
    color: "#15803d",
    icon: "ti-briefcase",
    subgenres: ["Emprendimiento", "Administracion", "Marketing", "Finanzas personales", "Liderazgo", "Productividad"]
  },
  {
    name: "Salud y bienestar",
    color: "#e11d48",
    icon: "ti-heartbeat",
    subgenres: ["Medicina", "Nutricion", "Ejercicio", "Bienestar", "Salud mental", "Cuidado personal"]
  },
  {
    name: "Hogar y ocio",
    color: "#ca8a04",
    icon: "ti-home",
    subgenres: ["Cocina", "Jardineria", "Manualidades", "Viajes", "Deportes", "Mascotas"]
  },
  {
    name: "Comics y novela grafica",
    color: "#f97316",
    icon: "ti-bubble",
    subgenres: ["Comic", "Manga", "Novela grafica", "Superheroes", "Humor grafico", "Historieta latinoamericana"]
  }
];

function serializeBook(book: any) {
  return {
    ...book,
    shelfSection: book.shelfSection
      ? {
          ...book.shelfSection,
          genres: book.shelfSection.genres?.map((entry: any) => entry.genre) ?? []
        }
      : null,
    authors: book.authors?.map((entry: any) => entry.author) ?? [],
    activeLoan: book.loans?.find((loan: any) => loan.status === "ACTIVO") ?? null
  };
}

function serializeShelf(shelf: any) {
  return {
    ...shelf,
    genres: shelf.genres?.map((entry: any) => entry.genre) ?? [],
    sections: shelf.sections?.map((section: any) => ({
      ...section,
      genres: section.genres?.map((entry: any) => entry.genre) ?? []
    })) ?? []
  };
}

function serializeSection(section: any) {
  return {
    ...section,
    genres: section.genres?.map((entry: any) => entry.genre) ?? []
  };
}

function serializeClassificationPayload(payload: any) {
  return {
    deweyCode: payload.deweyCode ?? null,
    deweyHierarchy: payload.deweyHierarchy ?? [],
    deweyExplanation: payload.deweyExplanation ?? null,
    lcCode: payload.lcCode ?? null,
    lcHierarchy: payload.lcHierarchy ?? [],
    lcExplanation: payload.lcExplanation ?? null,
    customTags: payload.customTags ?? []
  };
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  return timingSafeEqual(hashPassword(password, salt), stored);
}

function signToken(payload: Record<string, unknown>) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14 }));
  const signature = crypto.createHmac("sha256", jwtSecret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string) {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) throw new AppError(401, "INVALID_TOKEN", "Sesion invalida");

  const expected = crypto.createHmac("sha256", jwtSecret).update(`${header}.${body}`).digest("base64url");
  if (!timingSafeEqual(signature, expected)) throw new AppError(401, "INVALID_TOKEN", "Sesion invalida");

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new AppError(401, "TOKEN_EXPIRED", "La sesion expiro");
  }
  return payload as { sub: string; libraryId: string };
}

function serializeSession(auth: AuthContext) {
  return {
    user: { id: auth.userId, email: auth.email, name: auth.name },
    library: { id: auth.libraryId, name: auth.libraryName, role: auth.role }
  };
}

async function buildAuthContext(userId: string, requestedLibraryId?: string): Promise<AuthContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { library: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!user || user.memberships.length === 0) {
    throw new AppError(401, "USER_WITHOUT_LIBRARY", "No hay biblioteca asociada a esta cuenta");
  }

  const membership = requestedLibraryId
    ? user.memberships.find((item) => item.libraryId === requestedLibraryId)
    : user.memberships[0];

  if (!membership) throw new AppError(403, "LIBRARY_FORBIDDEN", "No tienes acceso a esta biblioteca");

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    libraryId: membership.libraryId,
    libraryName: membership.library.name,
    role: membership.role
  };
}

function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next(new AppError(401, "AUTH_REQUIRED", "Inicia sesion para continuar"));

  Promise.resolve()
    .then(async () => {
      const payload = verifyToken(token);
      req.auth = await buildAuthContext(payload.sub, payload.libraryId);
      next();
    })
    .catch(next);
}

function requireRole(...roles: LibraryRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new AppError(401, "AUTH_REQUIRED", "Inicia sesion para continuar"));
    if (!roles.includes(req.auth.role)) {
      return next(new AppError(403, "ROLE_FORBIDDEN", "No tienes permisos para esta accion"));
    }
    next();
  };
}

function currentLibraryId(req: Request) {
  if (!req.auth?.libraryId) throw new AppError(401, "AUTH_REQUIRED", "Inicia sesion para continuar");
  return req.auth.libraryId;
}

async function resolvePublisher(name?: string | null) {
  const trimmed = name?.trim();
  if (!trimmed) {
    return null;
  }

  return prisma.publisher.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed }
  });
}

async function resolveAuthors(names: string[]) {
  return Promise.all(
    names.map((name, index) =>
      prisma.author
        .upsert({
          where: { normalizedName: normalizeName(name) },
          update: { fullName: name.trim() },
          create: { fullName: name.trim(), normalizedName: normalizeName(name) }
        })
        .then((author) => ({ author, authorOrder: index + 1 }))
    )
  );
}

async function seedBaseGenres(libraryId: string) {
  for (const item of baseGenres) {
    const genre = await prisma.genre.upsert({
      where: { libraryId_slug: { libraryId, slug: slugify(item.name) } },
      update: {},
      create: {
        libraryId,
        name: item.name,
        slug: slugify(item.name),
        color: item.color,
        icon: item.icon
      }
    });

    for (const subgenreName of item.subgenres) {
      await prisma.subgenre.upsert({
        where: {
          genreId_slug: {
            genreId: genre.id,
            slug: slugify(subgenreName)
          }
        },
        update: {},
        create: {
          genreId: genre.id,
          name: subgenreName,
          slug: slugify(subgenreName)
        }
      });
    }
  }
}

async function ensureInitialLibrary() {
  const existing = await prisma.library.findFirst({ orderBy: { createdAt: "asc" } });
  const library = existing ?? await prisma.library.create({ data: { name: process.env.INITIAL_LIBRARY_NAME ?? "Biblioteca inicial" } });

  await prisma.$transaction([
    prisma.genre.updateMany({ where: { libraryId: null }, data: { libraryId: library.id } }),
    prisma.shelf.updateMany({ where: { libraryId: null }, data: { libraryId: library.id } }),
    prisma.book.updateMany({ where: { libraryId: null }, data: { libraryId: library.id } })
  ]);

  await seedBaseGenres(library.id);
  return library;
}

function cleanIsbn(value: string) {
  return value.replace(/[^0-9X]/gi, "").toUpperCase();
}

function isValidIsbn10(isbn: string) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = isbn.split("").reduce((total, character, index) => {
    const value = character === "X" ? 10 : Number(character);
    return total + value * (10 - index);
  }, 0);
  return sum % 11 === 0;
}

function isValidIsbn13(isbn: string) {
  if (!/^\d{13}$/.test(isbn)) return false;
  const sum = isbn.split("").reduce((total, character, index) => total + Number(character) * (index % 2 === 0 ? 1 : 3), 0);
  return sum % 10 === 0;
}

function isbn10To13(isbn10: string) {
  if (!isValidIsbn10(isbn10)) return null;
  const base = `978${isbn10.slice(0, 9)}`;
  const sum = base.split("").reduce((total, character, index) => total + Number(character) * (index % 2 === 0 ? 1 : 3), 0);
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${base}${checkDigit}`;
}

function isbn13To10(isbn13: string) {
  if (!isValidIsbn13(isbn13) || !isbn13.startsWith("978")) return null;
  const base = isbn13.slice(3, 12);
  const sum = base.split("").reduce((total, character, index) => total + Number(character) * (10 - index), 0);
  const checkValue = (11 - (sum % 11)) % 11;
  const checkDigit = checkValue === 10 ? "X" : String(checkValue);
  return `${base}${checkDigit}`;
}

function isbnVariants(isbn: string) {
  const cleaned = cleanIsbn(isbn);
  const variants = new Set<string>();
  if (isValidIsbn10(cleaned) || isValidIsbn13(cleaned)) {
    variants.add(cleaned);
  }
  const converted = cleaned.length === 10 ? isbn10To13(cleaned) : isbn13To10(cleaned);
  if (converted) variants.add(converted);
  return [...variants];
}

function normalizeForMatch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function similarity(a: string, b: string) {
  const left = normalizeForMatch(a);
  const right = normalizeForMatch(b);
  if (!left || !right) return 0;
  const maxLength = Math.max(left.length, right.length);
  return maxLength === 0 ? 1 : 1 - levenshtein(left, right) / maxLength;
}

function bookMatchText(title: string, authors: string[]) {
  return `${title} ${authors.join(" ")}`;
}

function bookSearchText(book: any) {
  return normalizeForMatch(
    [
      book.title,
      book.subtitle,
      book.isbn10,
      book.isbn13,
      book.publisher?.name,
      book.genre,
      book.genreRef?.name,
      book.subgenre?.name,
      book.publicationYear ? String(book.publicationYear) : "",
      ...(book.authors ?? []).map((entry: any) => entry.author?.fullName ?? entry.fullName ?? "")
    ].filter(Boolean).join(" ")
  );
}

function generatedSerialForSort(book: any) {
  const author = book.authors?.[0]?.author?.fullName ?? book.authors?.[0]?.fullName ?? "";
  const lastName = author.trim().split(/\s+/).pop() ?? "AUT";
  const authorCode = normalizeForMatch(lastName).replace(/[^a-z0-9]/g, "").toUpperCase().slice(0, 3).padEnd(3, "X");
  const titleCode = book.publicationYear ? String(book.publicationYear) : normalizeForMatch(book.title ?? "").replace(/[^a-z0-9]/g, "").toUpperCase().slice(0, 4);
  const classification = book.labelSerial?.split(/\n/)[0] || book.deweyCode || book.lcCode || book.customTags?.[0] || book.genre || "";
  return [classification, authorCode, titleCode].filter(Boolean).join("\n");
}

function shelfOrderKey(book: any) {
  const serial = generatedSerialForSort(book);
  const compact = serial.replace(/\n/g, " ").trim();
  const numberMatch = compact.match(/\d+(?:\.\d+)?/);
  const numeric = numberMatch ? Number(numberMatch[0]) : Number.POSITIVE_INFINITY;
  const prefix = compact.slice(0, numberMatch?.index ?? 0).toUpperCase();
  const suffix = compact.slice((numberMatch?.index ?? 0) + (numberMatch?.[0]?.length ?? 0)).toUpperCase();
  return { numeric, prefix, suffix, serial: compact.toUpperCase() };
}

function shelfVisualOrder(left: any, right: any) {
  const leftKey = shelfOrderKey(left);
  const rightKey = shelfOrderKey(right);
  return (
    leftKey.prefix.localeCompare(rightKey.prefix) ||
    leftKey.numeric - rightKey.numeric ||
    leftKey.suffix.localeCompare(rightKey.suffix) ||
    leftKey.serial.localeCompare(rightKey.serial) ||
    (left.shelfSortOrder ?? 0) - (right.shelfSortOrder ?? 0) ||
    left.title.localeCompare(right.title)
  );
}

function parseYear(value?: string) {
  const match = value?.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function firstText(value: unknown) {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function authorNamesFromStatement(value?: string | null) {
  if (!value) return [];
  return value
    .replace(/^by\s+/i, "")
    .split(/\s+(?:and|&)\s+|,\s*/)
    .map((name) => name.trim())
    .filter((name) => name.length > 1)
    .slice(0, 6);
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

async function getOpenLibraryAuthorName(authorKey?: string) {
  if (!authorKey) {
    return null;
  }

  const author = await fetchJson(`https://openlibrary.org${authorKey}.json`);
  return typeof author?.name === "string" ? author.name : null;
}

async function resolveOpenLibraryAuthors(book: any, work: any) {
  const bookAuthorNames = await Promise.all(
    (book.authors ?? []).slice(0, 6).map((author: { key?: string; name?: string }) =>
      typeof author.name === "string" ? author.name : getOpenLibraryAuthorName(author.key)
    )
  );
  const workAuthorNames = await Promise.all(
    (work?.authors ?? []).slice(0, 6).map((entry: { author?: { key?: string; name?: string } }) =>
      typeof entry.author?.name === "string" ? entry.author.name : getOpenLibraryAuthorName(entry.author?.key)
    )
  );
  return [...bookAuthorNames, ...workAuthorNames, ...authorNamesFromStatement(book.by_statement)]
    .filter((name): name is string => Boolean(name))
    .filter((name, index, names) => names.indexOf(name) === index)
    .slice(0, 6);
}

async function lookupOpenLibrary(isbn: string) {
  const book = await fetchJson(`https://openlibrary.org/isbn/${isbn}.json`);
  if (!book?.title) {
    return null;
  }

  const workKey = Array.isArray(book.works) ? book.works[0]?.key : null;
  const work = workKey ? await fetchJson(`https://openlibrary.org${workKey}.json`) : null;
  const authorNames = await resolveOpenLibraryAuthors(book, work);
  const description =
    typeof work?.description === "string"
      ? work.description
      : typeof work?.description?.value === "string"
        ? work.description.value
        : null;

  const coverId = Array.isArray(book.covers) ? book.covers[0] : null;

  return {
    source: "open_library",
    isbn10: isbn.length === 10 ? isbn : null,
    isbn13: isbn.length === 13 ? isbn : null,
    title: book.title,
    authors: authorNames,
    publisher: firstText(book.publishers),
    publicationYear: parseYear(book.publish_date),
    pageCount: typeof book.number_of_pages === "number" ? book.number_of_pages : null,
    genre: firstText(work?.subjects) ?? firstText(book.subjects),
    subjects: [...stringList(work?.subjects), ...stringList(book.subjects)].filter((subject, index, subjects) => subjects.indexOf(subject) === index),
    deweyCode: firstText(book.dewey_decimal_class) ?? firstText(work?.dewey_number),
    languageCode: Array.isArray(book.languages) ? String(book.languages[0]?.key ?? "").split("/").pop() : null,
    synopsis: description,
    coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
  };
}

async function lookupOpenLibraryBooksApi(isbn: string) {
  const params = new URLSearchParams({
    bibkeys: `ISBN:${isbn}`,
    format: "json",
    jscmd: "data"
  });
  const payload = await fetchJson(`https://openlibrary.org/api/books?${params.toString()}`);
  const book = payload?.[`ISBN:${isbn}`];
  if (!book?.title) return null;

  return {
    source: "open_library",
    isbn10: isbn.length === 10 ? isbn : null,
    isbn13: isbn.length === 13 ? isbn : null,
    title: book.title,
    authors: stringList(book.authors?.map((author: any) => author?.name)).slice(0, 6),
    publisher: firstText(book.publishers?.map((publisher: any) => publisher?.name)),
    publicationYear: parseYear(book.publish_date),
    pageCount: typeof book.number_of_pages === "number" ? book.number_of_pages : null,
    genre: firstText(book.subjects?.map((subject: any) => subject?.name)),
    subjects: stringList(book.subjects?.map((subject: any) => subject?.name)).slice(0, 12),
    deweyCode: firstText(book.classifications?.dewey_decimal_class),
    languageCode: null,
    synopsis: book.notes ?? null,
    coverUrl: book.cover?.large ?? book.cover?.medium ?? book.cover?.small ?? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
  };
}

async function lookupGoogleBooks(isbn: string) {
  const payload = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  const volume = payload?.items?.[0]?.volumeInfo;
  if (!volume?.title) {
    return null;
  }

  return {
    source: "google_books",
    isbn10: volume.industryIdentifiers?.find((entry: any) => entry.type === "ISBN_10")?.identifier ?? (isbn.length === 10 ? isbn : null),
    isbn13: volume.industryIdentifiers?.find((entry: any) => entry.type === "ISBN_13")?.identifier ?? (isbn.length === 13 ? isbn : null),
    title: volume.title,
    authors: Array.isArray(volume.authors) ? volume.authors : [],
    publisher: volume.publisher ?? null,
    publicationYear: parseYear(volume.publishedDate),
    pageCount: typeof volume.pageCount === "number" ? volume.pageCount : null,
    genre: Array.isArray(volume.categories) ? volume.categories[0] : null,
    subjects: Array.isArray(volume.categories) ? volume.categories : [],
    deweyCode: volume.industryIdentifiers?.find((entry: any) => entry.type === "OTHER" && String(entry.identifier ?? "").match(/^\d{3}/))?.identifier ?? null,
    languageCode: volume.language ?? null,
    synopsis: volume.description ?? null,
    coverUrl: volume.imageLinks?.thumbnail?.replace(/^http:/, "https:") ?? null
  };
}

async function searchOpenLibraryByText(query: string, author?: string) {
  const searches = [
    new URLSearchParams({ title: query, limit: "12", ...(author ? { author } : {}) }),
    new URLSearchParams({ q: [query, author].filter(Boolean).join(" "), limit: "12" }),
    new URLSearchParams({ q: query, limit: "12" })
  ];
  const payloads = await Promise.all(searches.map((params) => fetchJson(`https://openlibrary.org/search.json?${params.toString()}`)));
  const docs = payloads.flatMap((payload) => (Array.isArray(payload?.docs) ? payload.docs : []));

  return docs
    .filter((doc: any) => doc?.title)
    .map((doc: any) => ({
      source: "open_library",
      isbn10: firstText(doc.isbn?.filter((isbn: string) => isbn.length === 10)),
      isbn13: firstText(doc.isbn?.filter((isbn: string) => isbn.length === 13)),
      title: doc.title,
      authors: stringList(doc.author_name).slice(0, 6),
      publisher: firstText(doc.publisher),
      publicationYear: typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
      pageCount: null,
      genre: firstText(doc.subject),
      subjects: stringList(doc.subject).slice(0, 12),
      deweyCode: firstText(doc.ddc),
      languageCode: firstText(doc.language),
      synopsis: null,
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null
    }));
}

async function searchGoogleBooksByText(query: string, author?: string, publisher?: string) {
  const searches = [
    [`intitle:${query}`, author ? `inauthor:${author}` : "", publisher ? `inpublisher:${publisher}` : ""].filter(Boolean).join(" "),
    [query, author, publisher].filter(Boolean).join(" "),
    query
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  const payloads = await Promise.all(
    searches.map((search) => fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(search)}&maxResults=12&printType=books`))
  );
  const items = payloads.flatMap((payload) => (Array.isArray(payload?.items) ? payload.items : []));

  return items
    .map((item: any) => item.volumeInfo)
    .filter((volume: any) => volume?.title)
    .map((volume: any) => ({
      source: "google_books",
      isbn10: volume.industryIdentifiers?.find((entry: any) => entry.type === "ISBN_10")?.identifier ?? null,
      isbn13: volume.industryIdentifiers?.find((entry: any) => entry.type === "ISBN_13")?.identifier ?? null,
      title: volume.title,
      authors: Array.isArray(volume.authors) ? volume.authors : [],
      publisher: volume.publisher ?? null,
      publicationYear: parseYear(volume.publishedDate),
      pageCount: typeof volume.pageCount === "number" ? volume.pageCount : null,
      genre: Array.isArray(volume.categories) ? volume.categories[0] : null,
      subjects: Array.isArray(volume.categories) ? volume.categories : [],
      deweyCode: null,
      languageCode: volume.language ?? null,
      synopsis: volume.description ?? null,
      coverUrl: volume.imageLinks?.thumbnail?.replace(/^http:/, "https:") ?? null
    }));
}

function scoreExternalBookMatch(book: any, filters: { title?: string; author?: string; publisher?: string; year?: number | null }) {
  let score = 0;
  if (filters.title) {
    score += similarity(filters.title, book.title ?? "") * 8;
    if (normalizeForMatch(book.title ?? "").includes(normalizeForMatch(filters.title))) score += 2;
  }
  if (filters.author && book.authors?.length) {
    const authorScore = Math.max(...book.authors.map((author: string) => similarity(filters.author ?? "", author)));
    score += authorScore * 4;
  }
  if (filters.publisher && book.publisher && normalizeName(book.publisher).includes(normalizeName(filters.publisher))) {
    score += 2;
  }
  if (filters.year && book.publicationYear) {
    const distance = Math.abs(Number(book.publicationYear) - filters.year);
    if (distance === 0) score += 3;
    else if (distance <= 1) score += 2;
    else if (distance <= 3) score += 1;
  }
  if (book.isbn10 || book.isbn13) score += 0.75;
  if (book.coverUrl) score += 0.5;
  if (book.synopsis) score += 0.35;
  return score;
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AppError(502, "INVALID_AI_RESPONSE", "La IA no devolvio una respuesta JSON valida");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function getAnthropicModelsToTry() {
  const configured = process.env.ANTHROPIC_MODEL?.trim();
  return [
    configured,
    "claude-sonnet-4-20250514",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-5"
  ].filter((model, index, models): model is string => Boolean(model) && models.indexOf(model) === index);
}

function isModelError(message: string) {
  return /model|not found|not available|invalid|permission|access/i.test(message);
}

function findGenreMatch(genres: any[], name?: string | null) {
  const normalized = name ? normalizeName(name) : "";
  if (!normalized) return null;
  return genres.find((genre) => normalizeName(genre.name) === normalized) ?? null;
}

function findSubgenreMatch(genre: any | null, name?: string | null) {
  const normalized = name ? normalizeName(name) : "";
  if (!genre || !normalized) return null;
  return genre.subgenres?.find((subgenre: any) => normalizeName(subgenre.name) === normalized) ?? null;
}

function uniqueGenreIds(genreIds?: string[]) {
  return [...new Set(genreIds ?? [])];
}

async function ensureGenreIdsBelongToLibrary(libraryId: string, genreIds: string[]) {
  if (genreIds.length === 0) return;
  const count = await prisma.genre.count({ where: { libraryId, id: { in: genreIds } } });
  if (count !== genreIds.length) {
    throw new AppError(400, "INVALID_GENRE_SCOPE", "Uno o mas generos no pertenecen a esta biblioteca");
  }
}

async function ensureBookReferencesBelongToLibrary(
  libraryId: string,
  payload: { genreId?: string | null; subgenreId?: string | null; shelfId?: string | null; shelfSectionId?: string | null }
) {
  const genreId = cleanNullable(payload.genreId) as string | null;
  const subgenreId = cleanNullable(payload.subgenreId) as string | null;
  const shelfId = cleanNullable(payload.shelfId) as string | null;
  const shelfSectionId = cleanNullable(payload.shelfSectionId) as string | null;

  if (genreId && !(await prisma.genre.findFirst({ where: { id: genreId, libraryId } }))) {
    throw new AppError(400, "INVALID_GENRE_SCOPE", "El genero no pertenece a esta biblioteca");
  }
  if (subgenreId && !(await prisma.subgenre.findFirst({ where: { id: subgenreId, genre: { libraryId } } }))) {
    throw new AppError(400, "INVALID_SUBGENRE_SCOPE", "El subgenero no pertenece a esta biblioteca");
  }
  if (shelfId && !(await prisma.shelf.findFirst({ where: { id: shelfId, libraryId } }))) {
    throw new AppError(400, "INVALID_SHELF_SCOPE", "La estanteria no pertenece a esta biblioteca");
  }
  if (shelfSectionId && !(await prisma.shelfSection.findFirst({ where: { id: shelfSectionId, shelf: { libraryId } } }))) {
    throw new AppError(400, "INVALID_SECTION_SCOPE", "La repisa no pertenece a esta biblioteca");
  }
}

function sectionAcceptsGenre(section: any, genreId?: string | null) {
  if (!genreId) return false;
  return section.genreId === genreId || section.genres?.some((entry: any) => entry.genreId === genreId || entry.genre?.id === genreId);
}

async function ensureShelfSectionCapacity(libraryId: string, shelfSectionId?: string | null, currentBookId?: string) {
  const sectionId = cleanNullable(shelfSectionId) as string | null;
  if (!sectionId) return;

  const section = await prisma.shelfSection.findFirst({
    where: { id: sectionId, shelf: { libraryId } }
  });

  if (!section) {
    throw new AppError(404, "SHELF_SECTION_NOT_FOUND", "No se encontro la repisa seleccionada");
  }

  const bookCount = await prisma.book.count({
    where: {
      shelfSectionId: sectionId,
      libraryId,
      deletedAt: null,
      id: currentBookId ? { not: currentBookId } : undefined
    }
  });

  if (bookCount >= section.capacity) {
    throw new AppError(409, "SHELF_SECTION_FULL", `La repisa "${section.name}" ya llego a su limite de ${section.capacity} libros`);
  }
}

function genreNameForBook(book: any) {
  return book.genreRef?.name || book.genre || book.subgenre?.name || "Sin genero";
}

function dominantShelfSectionForGenre(shelf: any, genreId?: string | null) {
  if (!genreId) return null;
  return shelf.sections?.find((section: any) => sectionAcceptsGenre(section, genreId)) ?? null;
}

function makeMove(book: any, targetShelf: any, targetSection?: any | null) {
  return {
    bookId: book.id,
    title: book.title,
    authors: (book.authors ?? []).map((entry: any) => entry.author?.fullName ?? entry.fullName).filter(Boolean),
    fromShelfId: book.shelfId,
    fromShelfName: book.shelf?.name ?? null,
    fromSectionId: book.shelfSectionId,
    fromSectionName: book.shelfSection?.name ?? null,
    toShelfId: targetShelf.id,
    toShelfName: targetShelf.name,
    toSectionId: targetSection?.id ?? null,
    toSectionName: targetSection?.name ?? null
  };
}

function localReorganizationSuggestions(books: any[], shelves: any[]) {
  const suggestions: any[] = [];
  const locatedShelves = shelves.filter((shelf) => (shelf._count?.books ?? 0) > 0);
  const defaultShelf = locatedShelves[0] ?? shelves[0];

  const unassigned = books.filter((book) => !book.shelfId);
  if (unassigned.length > 0 && defaultShelf) {
    suggestions.push({
      id: "unassigned-books",
      title: "Asignar libros sin ubicacion",
      summary: `Hay ${unassigned.length} libros sin estanteria asignada. Sugiero ubicarlos temporalmente en ${defaultShelf.name}.`,
      reason: "Tener una estanteria temporal evita que el catalogo pierda trazabilidad fisica mientras decides su lugar definitivo.",
      confidence: "media",
      moves: unassigned.slice(0, 40).map((book) => makeMove(book, defaultShelf, dominantShelfSectionForGenre(defaultShelf, book.genreId)))
    });
  }

  const byGenre = new Map<string, any[]>();
  for (const book of books.filter((item) => item.shelfId)) {
    const key = book.genreId || normalizeName(genreNameForBook(book));
    if (!key || key === "sin genero") continue;
    byGenre.set(key, [...(byGenre.get(key) ?? []), book]);
  }

  for (const [key, genreBooks] of byGenre) {
    const shelfGroups = new Map<string, any[]>();
    for (const book of genreBooks) {
      shelfGroups.set(book.shelfId, [...(shelfGroups.get(book.shelfId) ?? []), book]);
    }
    if (genreBooks.length < 3 || shelfGroups.size < 2) continue;
    const targetShelfId = [...shelfGroups.entries()].sort((a, b) => b[1].length - a[1].length)[0][0];
    const targetShelf = shelves.find((shelf) => shelf.id === targetShelfId);
    if (!targetShelf) continue;
    const movingBooks = genreBooks.filter((book) => book.shelfId !== targetShelfId).slice(0, 30);
    const genreName = genreNameForBook(genreBooks[0]);
    suggestions.push({
      id: `genre-${key}`,
      title: `Agrupar ${genreName}`,
      summary: `Tienes ${genreBooks.length} libros de ${genreName} dispersos en ${shelfGroups.size} estanterias. Te sugiero agruparlos en ${targetShelf.name}.`,
      reason: "Agrupar por genero reduce busquedas repetidas y hace mas natural revisar una seccion completa.",
      confidence: shelfGroups.size > 2 ? "alta" : "media",
      moves: movingBooks.map((book) => makeMove(book, targetShelf, dominantShelfSectionForGenre(targetShelf, book.genreId)))
    });
    if (suggestions.length >= 6) break;
  }

  const byAuthor = new Map<string, any[]>();
  for (const book of books.filter((item) => item.shelfId && item.authors?.[0]?.author?.fullName)) {
    const key = normalizeName(book.authors[0].author.fullName);
    byAuthor.set(key, [...(byAuthor.get(key) ?? []), book]);
  }

  for (const [, authorBooks] of byAuthor) {
    const shelfIds = new Set(authorBooks.map((book) => book.shelfId));
    if (authorBooks.length < 3 || shelfIds.size < 2) continue;
    const targetShelfId = [...shelfIds].map((id) => ({
      id,
      count: authorBooks.filter((book) => book.shelfId === id).length
    })).sort((a, b) => b.count - a.count)[0].id;
    const targetShelf = shelves.find((shelf) => shelf.id === targetShelfId);
    if (!targetShelf) continue;
    const author = authorBooks[0].authors[0].author.fullName;
    suggestions.push({
      id: `author-${normalizeName(author)}`,
      title: `Reunir a ${author}`,
      summary: `Hay ${authorBooks.length} libros de ${author} en ${shelfIds.size} estanterias. Conviene reunirlos en ${targetShelf.name}.`,
      reason: "Las obras de un mismo autor suelen consultarse juntas y se detectan mejor las colecciones incompletas.",
      confidence: "media",
      moves: authorBooks.filter((book) => book.shelfId !== targetShelfId).slice(0, 24).map((book) => makeMove(book, targetShelf, dominantShelfSectionForGenre(targetShelf, book.genreId)))
    });
    if (suggestions.length >= 8) break;
  }

  return suggestions.filter((suggestion) => suggestion.moves.length > 0).slice(0, 8);
}

async function suggestReorganizationWithClaude(books: any[], shelves: any[], localSuggestions: any[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const compactBooks = books.slice(0, 350).map((book) => ({
    id: book.id,
    title: book.title,
    authors: (book.authors ?? []).map((entry: any) => entry.author?.fullName ?? entry.fullName).filter(Boolean),
    genre: genreNameForBook(book),
    genreId: book.genreId,
    shelfId: book.shelfId,
    shelf: book.shelf?.name ?? null,
    sectionId: book.shelfSectionId,
    section: book.shelfSection?.name ?? null
  }));
  const compactShelves = shelves.map((shelf) => ({
    id: shelf.id,
    name: shelf.name,
    homeLocation: shelf.homeLocation,
    capacity: shelf.capacity,
    books: shelf._count?.books ?? 0,
    sections: shelf.sections.map((section: any) => ({
      id: section.id,
      name: section.name,
      capacity: section.capacity,
      genreId: section.genreId,
      genre: section.genreRef?.name ?? null,
      genres: section.genres?.map((entry: any) => entry.genre?.name).filter(Boolean) ?? []
    }))
  }));

  const prompt = `Analiza esta biblioteca personal y devuelve sugerencias de reorganizacion fisica.
Usa SOLO ids existentes de libros, estanterias y repisas. Puedes apoyarte en las sugerencias locales, pero mejora el lenguaje y priorizacion.

Estanterias:
${JSON.stringify(compactShelves)}

Libros:
${JSON.stringify(compactBooks)}

Sugerencias locales:
${JSON.stringify(localSuggestions)}

Devuelve solo JSON valido con esta forma:
{
  "overview": "informe breve en espanol",
  "suggestions": [
    {
      "id": "string estable",
      "title": "titulo corto",
      "summary": "sugerencia en lenguaje natural",
      "reason": "por que conviene",
      "confidence": "alta" | "media" | "baja",
      "moves": [
        { "bookId": "id", "toShelfId": "id", "toSectionId": "id opcional o null" }
      ]
    }
  ]
}`;

  for (const model of getAnthropicModelsToTry()) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 1800,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message ?? "No se pudo consultar Claude";
      if (isModelError(message)) continue;
      return null;
    }
    const text = payload?.content?.map((part: any) => (part.type === "text" ? part.text : "")).join("\n") ?? "";
    const parsed = extractJsonObject(text);
    const bookById = new Map(books.map((book) => [book.id, book]));
    const shelfById = new Map(shelves.map((shelf) => [shelf.id, shelf]));
    return {
      overview: typeof parsed.overview === "string" ? parsed.overview : "Claude analizo la distribucion actual y encontro oportunidades de agrupacion.",
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.map((suggestion: any, index: number) => ({
            id: String(suggestion.id || `claude-${index}`),
            title: String(suggestion.title || "Reorganizacion sugerida"),
            summary: String(suggestion.summary || "Mover libros relacionados para mejorar la coherencia."),
            reason: String(suggestion.reason || "La agrupacion hace mas facil encontrar y revisar libros relacionados."),
            confidence: ["alta", "media", "baja"].includes(suggestion.confidence) ? suggestion.confidence : "media",
            moves: (Array.isArray(suggestion.moves) ? suggestion.moves : [])
              .map((move: any) => {
                const book = bookById.get(move.bookId);
                const shelf = shelfById.get(move.toShelfId);
                const section = shelf?.sections.find((item: any) => item.id === move.toSectionId) ?? null;
                return book && shelf ? makeMove(book, shelf, section) : null;
              })
              .filter(Boolean)
          })).filter((suggestion: any) => suggestion.moves.length > 0)
        : []
    };
  }

  return null;
}

async function translateDeweyGenre(input: {
  libraryId: string;
  title: string;
  authors: string[];
  deweyCode?: string | null;
  subjects?: string[];
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || (!input.deweyCode && !input.subjects?.length)) {
    return null;
  }

  const genres = await prisma.genre.findMany({
    where: { libraryId: input.libraryId },
    include: { subgenres: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" }
  });

  const existingGenres = genres.map((genre) => ({
    id: genre.id,
    name: genre.name,
    subgenres: genre.subgenres.map((subgenre) => subgenre.name)
  }));

  const systemPrompt = `Eres un bibliotecario experto. Dado el código Dewey, los subjects y el título de un libro,
responde SOLO con un JSON con este formato exacto, sin texto adicional:
{
  "genero_principal": "string — uno de los géneros de la lista proporcionada, o sugerir uno nuevo si ninguno aplica",
  "subgenero": "string — subgénero específico, puede ser nuevo",
  "confianza": "alta" | "media" | "baja",
  "razon": "string — explicación breve en español de por qué ese género"
}
La lista de géneros existentes del usuario se provee en el contexto.
Prioriza siempre los géneros ya existentes en la biblioteca del usuario.
Si el género Dewey es demasiado técnico o académico, tradúcelo al lenguaje
cotidiano que usaría un lector, no un bibliotecólogo.`;

  const userPrompt = `Generos existentes:
${JSON.stringify(existingGenres, null, 2)}

Libro:
- Titulo: ${input.title}
- Autores: ${input.authors.join(", ") || "Sin autores"}
- Dewey: ${input.deweyCode || "No indicado"}
- Subjects: ${input.subjects?.join("; ") || "No indicados"}`;

  let lastError = "No se pudo traducir el genero Dewey";

  for (const model of getAnthropicModelsToTry()) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    });

    const payload = await response.json().catch(() => null);
    if (response.ok) {
      const text = payload?.content?.map((part: any) => (part.type === "text" ? part.text : "")).join("\n") ?? "";
      const suggestion = deweyGenreSuggestionSchema.parse(extractJsonObject(text));
      const matchedGenre = findGenreMatch(genres, suggestion.genero_principal);
      const matchedSubgenre = findSubgenreMatch(matchedGenre, suggestion.subgenero);
      return {
        ...suggestion,
        genreId: matchedGenre?.id ?? null,
        subgenreId: matchedSubgenre?.id ?? null,
        isExistingGenre: Boolean(matchedGenre),
        isExistingSubgenre: Boolean(matchedSubgenre)
      };
    }

    lastError = payload?.error?.message ?? lastError;
    if (!isModelError(lastError)) {
      return null;
    }
  }

  return null;
}

async function enrichWithDeweyGenreSuggestion(metadata: any, libraryId: string) {
  const suggestion = await translateDeweyGenre({
    libraryId,
    title: metadata.title,
    authors: metadata.authors ?? [],
    deweyCode: metadata.deweyCode,
    subjects: metadata.subjects ?? []
  });

  return { ...metadata, genreSuggestion: suggestion };
}

async function suggestClassification(input: { title: string; authors: string[]; genre?: string | null; synopsis?: string | null }, libraryId: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AppError(503, "ANTHROPIC_API_KEY_MISSING", "Configura ANTHROPIC_API_KEY para usar el asistente de clasificacion");
  }

  const genres = await prisma.genre.findMany({
    where: { libraryId },
    include: { subgenres: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" }
  });
  const existingGenres = genres.map((genre) => ({
    name: genre.name,
    subgenres: genre.subgenres.map((subgenre) => subgenre.name)
  }));

  const prompt = `Eres bibliotecologo experto. Sugiere clasificacion bibliotecaria y genero literario para este libro.

Datos:
- Titulo: ${input.title}
- Autores: ${input.authors.join(", ") || "Sin autores"}
- Genero: ${input.genre || "No indicado"}
- Sinopsis: ${input.synopsis || "No indicada"}
- Generos existentes del usuario: ${JSON.stringify(existingGenres)}

Prioriza un genero existente si aplica. Si no aplica ninguno, sugiere uno nuevo en lenguaje cotidiano.

Devuelve solo JSON valido con esta forma exacta:
{
  "deweyCode": "codigo DDC especifico, idealmente con subdivision",
  "deweyHierarchy": ["000 categoria general", "subcategoria", "subdivision"],
  "deweyExplanation": "explicacion breve en espanol",
  "lcCode": "signatura LC/LCC sugerida",
  "lcHierarchy": ["clase principal", "subclase", "rango o autor si aplica"],
  "lcExplanation": "explicacion breve en espanol",
  "customTags": ["etiqueta libre 1", "etiqueta libre 2", "etiqueta libre 3"],
  "suggestedGenre": "genero principal sugerido",
  "suggestedSubgenre": "subgenero sugerido o null",
  "genreConfidence": "alta" | "media" | "baja",
  "genreReason": "explicacion breve en espanol"
}`;

  let lastError = "No se pudo consultar la IA";

  for (const model of getAnthropicModelsToTry()) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const payload = await response.json().catch(() => null);
    if (response.ok) {
      const text = payload?.content?.map((part: any) => (part.type === "text" ? part.text : "")).join("\n") ?? "";
      const suggestion = classificationPayloadSchema.parse(extractJsonObject(text));
      const matchedGenre = findGenreMatch(genres, suggestion.suggestedGenre);
      const matchedSubgenre = findSubgenreMatch(matchedGenre, suggestion.suggestedSubgenre);
      return {
        ...suggestion,
        genreId: matchedGenre?.id ?? null,
        subgenreId: matchedSubgenre?.id ?? null
      };
    }

    lastError = payload?.error?.message ?? lastError;
    if (!isModelError(lastError)) {
      throw new AppError(response.status, "ANTHROPIC_ERROR", lastError);
    }
  }

  throw new AppError(
    400,
    "ANTHROPIC_MODEL_UNAVAILABLE",
    `${lastError}. Prueba cambiar ANTHROPIC_MODEL a claude-sonnet-4-6 o claude-haiku-4-5-20251001.`
  );
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "biblioteca-api" });
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existingUser) throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "Ese correo ya tiene una cuenta");

    const initialLibrary = await ensureInitialLibrary();
    const hasInitialOwner = await prisma.libraryMember.count({ where: { libraryId: initialLibrary.id } });

    let createdNewLibrary = false;
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: payload.email,
          name: payload.name,
          passwordHash: hashPassword(payload.password)
        }
      });

      const library = hasInitialOwner === 0
        ? initialLibrary
        : await tx.library.create({ data: { name: payload.libraryName ?? `Biblioteca de ${payload.name}` } });
      createdNewLibrary = hasInitialOwner !== 0;

      const membership = await tx.libraryMember.create({
        data: {
          userId: user.id,
          libraryId: library.id,
          role: "OWNER"
        },
        include: { library: true }
      });

      return { user, membership };
    });

    if (createdNewLibrary) {
      await seedBaseGenres(result.membership.libraryId);
    }

    const auth: AuthContext = {
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      libraryId: result.membership.libraryId,
      libraryName: result.membership.library.name,
      role: result.membership.role
    };
    res.status(201).json({ token: signToken({ sub: auth.userId, libraryId: auth.libraryId }), ...serializeSession(auth) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user || !verifyPassword(payload.password, user.passwordHash)) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Correo o contrasena incorrectos");
    }

    const auth = await buildAuthContext(user.id);
    res.json({ token: signToken({ sub: auth.userId, libraryId: auth.libraryId }), ...serializeSession(auth) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json(serializeSession(req.auth!));
});

app.get("/api/libraries", requireAuth, async (req, res, next) => {
  try {
    const memberships = await prisma.libraryMember.findMany({
      where: { userId: req.auth!.userId },
      include: { library: true },
      orderBy: { createdAt: "asc" }
    });

    res.json({
      items: memberships.map((membership) => ({
        id: membership.libraryId,
        name: membership.library.name,
        role: membership.role
      }))
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/switch-library", requireAuth, async (req, res, next) => {
  try {
    const payload = switchLibrarySchema.parse(req.body);
    const auth = await buildAuthContext(req.auth!.userId, payload.libraryId);
    res.json({ token: signToken({ sub: auth.userId, libraryId: auth.libraryId }), ...serializeSession(auth) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/members", requireAuth, async (req, res, next) => {
  try {
    const members = await prisma.libraryMember.findMany({
      where: { libraryId: currentLibraryId(req) },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    });
    res.json({
      items: members.map((member) => ({
        id: member.id,
        role: member.role,
        createdAt: member.createdAt,
        user: member.user
      }))
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/members", requireAuth, requireRole("OWNER"), async (req, res, next) => {
  try {
    const payload = memberSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "Ese usuario debe crear una cuenta primero");

    const member = await prisma.libraryMember.upsert({
      where: { userId_libraryId: { userId: user.id, libraryId: currentLibraryId(req) } },
      update: { role: payload.role },
      create: { userId: user.id, libraryId: currentLibraryId(req), role: payload.role },
      include: { user: { select: { id: true, email: true, name: true } } }
    });

    res.status(201).json({ id: member.id, role: member.role, createdAt: member.createdAt, user: member.user });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/members/:id", requireAuth, requireRole("OWNER"), async (req, res, next) => {
  try {
    const payload = memberUpdateSchema.parse(req.body);
    const memberId = String(req.params.id);
    const existing = await prisma.libraryMember.findFirst({ where: { id: memberId, libraryId: currentLibraryId(req) } });
    if (!existing) throw new AppError(404, "MEMBER_NOT_FOUND", "No se encontro el miembro");

    const ownerCount = await prisma.libraryMember.count({ where: { libraryId: currentLibraryId(req), role: "OWNER" } });
    if (existing.role === "OWNER" && payload.role !== "OWNER" && ownerCount <= 1) {
      throw new AppError(400, "LAST_OWNER", "La biblioteca debe conservar al menos un propietario");
    }

    const member = await prisma.libraryMember.update({
      where: { id: memberId },
      data: { role: payload.role },
      include: { user: { select: { id: true, email: true, name: true } } }
    });
    res.json({ id: member.id, role: member.role, createdAt: member.createdAt, user: member.user });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/members/:id", requireAuth, requireRole("OWNER"), async (req, res, next) => {
  try {
    const memberId = String(req.params.id);
    const existing = await prisma.libraryMember.findFirst({ where: { id: memberId, libraryId: currentLibraryId(req) } });
    if (!existing) throw new AppError(404, "MEMBER_NOT_FOUND", "No se encontro el miembro");

    const ownerCount = await prisma.libraryMember.count({ where: { libraryId: currentLibraryId(req), role: "OWNER" } });
    if (existing.role === "OWNER" && ownerCount <= 1) {
      throw new AppError(400, "LAST_OWNER", "La biblioteca debe conservar al menos un propietario");
    }

    await prisma.libraryMember.delete({ where: { id: memberId } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use("/api", (req, res, next) => {
  if (req.path === "/health" || req.path.startsWith("/auth/")) return next();
  return requireAuth(req, res, next);
});

app.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  return requireRole("OWNER", "EDITOR")(req, res, next);
});

app.get("/api/genres", async (req, res, next) => {
  try {
    const genres = await prisma.genre.findMany({
      where: { libraryId: currentLibraryId(req) },
      include: { subgenres: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" }
    });
    res.json({ items: genres });
  } catch (error) {
    next(error);
  }
});

app.post("/api/genres", async (req, res, next) => {
  try {
    const payload = genreSchema.parse(req.body);
    const genre = await prisma.genre.create({
      data: { ...payload, libraryId: currentLibraryId(req), slug: slugify(payload.name) },
      include: { subgenres: { orderBy: { name: "asc" } } }
    });
    res.status(201).json(genre);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/genres/:id", async (req, res, next) => {
  try {
    const payload = genreUpdateSchema.parse(req.body);
    const existing = await prisma.genre.findFirst({ where: { id: req.params.id, libraryId: currentLibraryId(req) } });
    if (!existing) throw new AppError(404, "GENRE_NOT_FOUND", "No se encontro el genero");
    const genre = await prisma.genre.update({
      where: { id: req.params.id },
      data: {
        ...payload,
        slug: payload.name ? slugify(payload.name) : undefined
      },
      include: { subgenres: { orderBy: { name: "asc" } } }
    });
    res.json(genre);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/genres/:id", async (req, res, next) => {
  try {
    const existing = await prisma.genre.findFirst({ where: { id: req.params.id, libraryId: currentLibraryId(req) } });
    if (!existing) throw new AppError(404, "GENRE_NOT_FOUND", "No se encontro el genero");
    await prisma.genre.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/genres/:id/subgenres", async (req, res, next) => {
  try {
    const payload = subgenreSchema.parse(req.body);
    const genre = await prisma.genre.findFirst({ where: { id: req.params.id, libraryId: currentLibraryId(req) } });
    if (!genre) throw new AppError(404, "GENRE_NOT_FOUND", "No se encontro el genero");
    const subgenre = await prisma.subgenre.create({
      data: {
        genreId: req.params.id,
        name: payload.name,
        slug: slugify(payload.name)
      }
    });
    res.status(201).json(subgenre);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/subgenres/:id", async (req, res, next) => {
  try {
    const payload = subgenreUpdateSchema.parse(req.body);
    const existing = await prisma.subgenre.findFirst({ where: { id: req.params.id, genre: { libraryId: currentLibraryId(req) } } });
    if (!existing) throw new AppError(404, "SUBGENRE_NOT_FOUND", "No se encontro el subgenero");
    const subgenre = await prisma.subgenre.update({
      where: { id: req.params.id },
      data: {
        ...payload,
        slug: payload.name ? slugify(payload.name) : undefined
      }
    });
    res.json(subgenre);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/subgenres/:id", async (req, res, next) => {
  try {
    const existing = await prisma.subgenre.findFirst({ where: { id: req.params.id, genre: { libraryId: currentLibraryId(req) } } });
    if (!existing) throw new AppError(404, "SUBGENRE_NOT_FOUND", "No se encontro el subgenero");
    await prisma.subgenre.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/external-books/isbn/:isbn", async (req, res, next) => {
  try {
    const isbn = cleanIsbn(req.params.isbn);
    const variants = isbnVariants(isbn);
    if (variants.length === 0) {
      throw new AppError(400, "INVALID_ISBN", "El ISBN no supera la validacion. Revisa que el codigo se haya escaneado completo.");
    }

    const lookups = variants.flatMap((variant) => [
      () => lookupOpenLibrary(variant),
      () => lookupOpenLibraryBooksApi(variant),
      () => lookupGoogleBooks(variant)
    ]);

    let result = null;
    for (const lookup of lookups) {
      result = await lookup().catch(() => null);
      if (result?.title) break;
    }

    if (!result) {
      throw new AppError(
        404,
        "BOOK_METADATA_NOT_FOUND",
        `No encontre metadatos publicos para ${variants.join(" / ")}. Puedes buscar por titulo y autor o guardar el ISBN manualmente.`
      );
    }

    result = {
      ...result,
      isbn10: result.isbn10 ?? variants.find((variant) => variant.length === 10) ?? null,
      isbn13: result.isbn13 ?? variants.find((variant) => variant.length === 13) ?? null
    };
    res.json(await enrichWithDeweyGenreSuggestion(result, currentLibraryId(req)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/external-books/search", async (req, res, next) => {
  try {
    const title = String(req.query.title ?? "").trim();
    const author = String(req.query.author ?? "").trim();
    const publisher = String(req.query.publisher ?? "").trim();
    const year = req.query.year ? Number(req.query.year) : null;
    if (title.length < 2) {
      throw new AppError(400, "INVALID_BOOK_SEARCH", "Escribe al menos 2 caracteres del titulo");
    }

    const [openLibraryResults, googleBooksResults] = await Promise.all([
      searchOpenLibraryByText(title, author),
      searchGoogleBooksByText(title, author, publisher)
    ]);

    const seen = new Set<string>();
    const results = [...openLibraryResults, ...googleBooksResults]
      .sort((left, right) => scoreExternalBookMatch(right, { title, author, publisher, year }) - scoreExternalBookMatch(left, { title, author, publisher, year }))
      .filter((book) => {
        const key = normalizeForMatch(`${book.title} ${book.authors?.[0] ?? ""} ${book.publicationYear ?? ""}`);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);

    const enriched = await Promise.all(results.map((book) => enrichWithDeweyGenreSuggestion(book, currentLibraryId(req))));
    res.json({ items: enriched });
  } catch (error) {
    next(error);
  }
});

app.get("/api/books", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const availabilityStatus = String(req.query.availabilityStatus ?? "");
    const readingStatus = String(req.query.readingStatus ?? "");
    const shelfId = String(req.query.shelfId ?? "");
    const genreId = String(req.query.genreId ?? "");
    const subgenreId = String(req.query.subgenreId ?? "");
    const sort = String(req.query.sort ?? "updated");
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 30), 1), 100);

    const where: Prisma.BookWhereInput = { deletedAt: null, libraryId: currentLibraryId(req) };

    if (availabilityStatus) where.availabilityStatus = availabilityStatus as any;
    if (readingStatus) where.readingStatus = readingStatus as any;
    if (shelfId) where.shelfId = shelfId;
    if (genreId) where.genreId = genreId;
    if (subgenreId) where.subgenreId = subgenreId;

    const rawItems = await prisma.book.findMany({
      where,
      include: bookInclude
    });

    const normalizedQuery = normalizeForMatch(q);
    const filteredItems = normalizedQuery
      ? rawItems.filter((book) => bookSearchText(book).includes(normalizedQuery))
      : rawItems;

    const sortedItems = [...filteredItems].sort((left, right) => {
      if (sort === "shelfOrder") {
        if (left.shelfSectionId && right.shelfSectionId && left.shelfSectionId === right.shelfSectionId) {
          return shelfVisualOrder(left, right);
        }
        const leftKey = shelfOrderKey(left);
        const rightKey = shelfOrderKey(right);
        return (
          leftKey.prefix.localeCompare(rightKey.prefix) ||
          leftKey.numeric - rightKey.numeric ||
          leftKey.suffix.localeCompare(rightKey.suffix) ||
          leftKey.serial.localeCompare(rightKey.serial)
        );
      }
      if (sort === "title") return left.title.localeCompare(right.title);
      if (sort === "author") {
        const leftAuthor = left.authors?.[0]?.author?.fullName ?? "";
        const rightAuthor = right.authors?.[0]?.author?.fullName ?? "";
        return leftAuthor.localeCompare(rightAuthor) || left.title.localeCompare(right.title);
      }
      return right.updatedAt.getTime() - left.updatedAt.getTime();
    });

    const total = sortedItems.length;
    const items = sortedItems.slice((page - 1) * pageSize, page * pageSize);

    res.json({ items: items.map(serializeBook), total, page, pageSize });
  } catch (error) {
    next(error);
  }
});

app.get("/api/books/:id", async (req, res, next) => {
  try {
    const book = await prisma.book.findFirst({
      where: { id: req.params.id, deletedAt: null, libraryId: currentLibraryId(req) },
      include: bookInclude
    });

    if (!book) throw new AppError(404, "BOOK_NOT_FOUND", "No se encontro el libro");
    res.json(serializeBook(book));
  } catch (error) {
    next(error);
  }
});

app.post("/api/books/duplicates", async (req, res, next) => {
  try {
    const payload = bookPayloadSchema.pick({ title: true, authors: true, isbn10: true, isbn13: true }).parse(req.body);
    const isbn10 = cleanNullable(payload.isbn10) as string | null;
    const isbn13 = cleanNullable(payload.isbn13) as string | null;
    const isbnCandidates = [...new Set([...(isbn10 ? isbnVariants(isbn10) : []), ...(isbn13 ? isbnVariants(isbn13) : [])])];
    const candidateFilters: Prisma.BookWhereInput[] = [];
    if (isbnCandidates.length > 0) {
      candidateFilters.push({ OR: [{ isbn10: { in: isbnCandidates } }, { isbn13: { in: isbnCandidates } }] });
    }
    if (payload.title.trim()) {
      const titleWords = normalizeForMatch(payload.title).split(" ").filter((word) => word.length > 3).slice(0, 4);
      for (const word of titleWords) {
        candidateFilters.push({ title: { contains: word, mode: "insensitive" } });
      }
    }
    if (payload.authors[0]) {
      candidateFilters.push({
        authors: { some: { author: { fullName: { contains: payload.authors[0], mode: "insensitive" } } } }
      });
    }

    const candidates = await prisma.book.findMany({
      where: {
        deletedAt: null,
        libraryId: currentLibraryId(req),
        OR: candidateFilters.length > 0 ? candidateFilters : undefined
      },
      include: bookInclude,
      take: 30
    });

    const incomingText = bookMatchText(payload.title, payload.authors);
    const incomingTitle = normalizeForMatch(payload.title);
    const matches = candidates
      .map((book: any) => {
        const serialized = serializeBook(book);
        const isbnMatch =
          Boolean(book.isbn10 && isbnCandidates.includes(book.isbn10)) ||
          Boolean(book.isbn13 && isbnCandidates.includes(book.isbn13));
        const fuzzyScore = similarity(incomingText, bookMatchText(book.title, serialized.authors.map((author: any) => author.fullName)));
        const titleScore = similarity(incomingTitle, normalizeForMatch(book.title));
        const score = Math.max(fuzzyScore, titleScore);
        return {
          book: serialized,
          matchType: isbnMatch ? "ISBN" : "FUZZY",
          score: isbnMatch ? 1 : Number(score.toFixed(2)),
          reason: isbnMatch ? "Coincidencia por ISBN equivalente" : titleScore >= fuzzyScore ? "Titulo similar" : "Titulo y autor similares"
        };
      })
      .filter((match) => match.matchType === "ISBN" || match.score >= 0.68)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    res.json({ matches });
  } catch (error) {
    next(error);
  }
});

app.post("/api/books", async (req, res, next) => {
  try {
    const payload = bookPayloadSchema.parse(req.body);
    const libraryId = currentLibraryId(req);
    const publisher = await resolvePublisher(payload.publisher);
    const authors = await resolveAuthors(payload.authors);
    await ensureBookReferencesBelongToLibrary(libraryId, payload);
    await ensureShelfSectionCapacity(libraryId, payload.shelfSectionId);

    const book = await prisma.book.create({
      data: {
        libraryId,
        title: payload.title,
        subtitle: cleanNullable(payload.subtitle) as string | null,
        isbn10: cleanNullable(payload.isbn10) as string | null,
        isbn13: cleanNullable(payload.isbn13) as string | null,
        publisherId: publisher?.id,
        publicationYear: payload.publicationYear ?? null,
        pageCount: payload.pageCount ?? null,
        genre: cleanNullable(payload.genre) as string | null,
        genreId: cleanNullable(payload.genreId) as string | null,
        subgenreId: cleanNullable(payload.subgenreId) as string | null,
        deweyGenreRaw: cleanNullable(payload.deweyGenreRaw) as string | null,
        languageCode: cleanNullable(payload.languageCode) as string | null,
        synopsis: cleanNullable(payload.synopsis) as string | null,
        edition: cleanNullable(payload.edition) as string | null,
        coverUrl: cleanNullable(payload.coverUrl) as string | null,
        deweyCode: cleanNullable(payload.deweyCode) as string | null,
        deweyHierarchy: payload.deweyHierarchy ?? [],
        deweyExplanation: cleanNullable(payload.deweyExplanation) as string | null,
        lcCode: cleanNullable(payload.lcCode) as string | null,
        lcHierarchy: payload.lcHierarchy ?? [],
        lcExplanation: cleanNullable(payload.lcExplanation) as string | null,
        customTags: payload.customTags ?? [],
        classificationUpdatedAt: payload.deweyCode || payload.lcCode || payload.customTags?.length ? new Date() : null,
        labelSerial: cleanNullable(payload.labelSerial) as string | null,
        labelSystem: cleanNullable(payload.labelSystem) as string | null,
        labelSize: cleanNullable(payload.labelSize) as string | null,
        availabilityStatus: payload.availabilityStatus ?? "EN_MI_BIBLIOTECA",
        readingStatus: payload.readingStatus ?? "SIN_ESTADO",
        isReference: payload.isReference ?? false,
        shelfId: cleanNullable(payload.shelfId) as string | null,
        shelfSectionId: cleanNullable(payload.shelfSectionId) as string | null,
        authors: {
          create: authors.map(({ author, authorOrder }) => ({
            authorId: author.id,
            authorOrder
          }))
        }
      },
      include: bookInclude
    });

    res.status(201).json(serializeBook(book));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/books/:id", async (req, res, next) => {
  try {
    const payload = bookPayloadSchema.partial().parse(req.body);
    const libraryId = currentLibraryId(req);
    const existing = await prisma.book.findFirst({ where: { id: req.params.id, deletedAt: null, libraryId } });
    if (!existing) throw new AppError(404, "BOOK_NOT_FOUND", "No se encontro el libro");

    const publisher = payload.publisher !== undefined ? await resolvePublisher(payload.publisher) : undefined;
    const authors = payload.authors ? await resolveAuthors(payload.authors) : null;
    await ensureBookReferencesBelongToLibrary(libraryId, payload);
    if (payload.shelfSectionId !== undefined) {
      await ensureShelfSectionCapacity(libraryId, payload.shelfSectionId, req.params.id);
    }

    const book = await prisma.$transaction(async (tx) => {
      if (authors) {
        await tx.bookAuthor.deleteMany({ where: { bookId: req.params.id } });
      }

      return tx.book.update({
        where: { id: req.params.id },
        data: {
          title: payload.title,
          subtitle: payload.subtitle === undefined ? undefined : (cleanNullable(payload.subtitle) as string | null),
          isbn10: payload.isbn10 === undefined ? undefined : (cleanNullable(payload.isbn10) as string | null),
          isbn13: payload.isbn13 === undefined ? undefined : (cleanNullable(payload.isbn13) as string | null),
          publisherId: publisher === undefined ? undefined : publisher?.id ?? null,
          publicationYear: payload.publicationYear === undefined ? undefined : payload.publicationYear,
          pageCount: payload.pageCount === undefined ? undefined : payload.pageCount,
          genre: payload.genre === undefined ? undefined : (cleanNullable(payload.genre) as string | null),
          genreId: payload.genreId === undefined ? undefined : (cleanNullable(payload.genreId) as string | null),
          subgenreId: payload.subgenreId === undefined ? undefined : (cleanNullable(payload.subgenreId) as string | null),
          deweyGenreRaw:
            payload.deweyGenreRaw === undefined ? undefined : (cleanNullable(payload.deweyGenreRaw) as string | null),
          languageCode: payload.languageCode === undefined ? undefined : (cleanNullable(payload.languageCode) as string | null),
          synopsis: payload.synopsis === undefined ? undefined : (cleanNullable(payload.synopsis) as string | null),
          edition: payload.edition === undefined ? undefined : (cleanNullable(payload.edition) as string | null),
          coverUrl: payload.coverUrl === undefined ? undefined : (cleanNullable(payload.coverUrl) as string | null),
          deweyCode: payload.deweyCode === undefined ? undefined : (cleanNullable(payload.deweyCode) as string | null),
          deweyHierarchy: payload.deweyHierarchy,
          deweyExplanation:
            payload.deweyExplanation === undefined ? undefined : (cleanNullable(payload.deweyExplanation) as string | null),
          lcCode: payload.lcCode === undefined ? undefined : (cleanNullable(payload.lcCode) as string | null),
          lcHierarchy: payload.lcHierarchy,
          lcExplanation: payload.lcExplanation === undefined ? undefined : (cleanNullable(payload.lcExplanation) as string | null),
          customTags: payload.customTags,
          labelSerial: payload.labelSerial === undefined ? undefined : (cleanNullable(payload.labelSerial) as string | null),
          labelSystem: payload.labelSystem === undefined ? undefined : (cleanNullable(payload.labelSystem) as string | null),
          labelSize: payload.labelSize === undefined ? undefined : (cleanNullable(payload.labelSize) as string | null),
          classificationUpdatedAt:
            payload.deweyCode !== undefined ||
            payload.lcCode !== undefined ||
            payload.customTags !== undefined ||
            payload.deweyHierarchy !== undefined ||
            payload.lcHierarchy !== undefined
              ? new Date()
              : undefined,
          availabilityStatus: payload.availabilityStatus,
          readingStatus: payload.readingStatus,
          isReference: payload.isReference,
          shelfId: payload.shelfId === undefined ? undefined : (cleanNullable(payload.shelfId) as string | null),
          shelfSectionId:
            payload.shelfSectionId === undefined ? undefined : (cleanNullable(payload.shelfSectionId) as string | null),
          authors: authors
            ? {
                create: authors.map(({ author, authorOrder }) => ({
                  authorId: author.id,
                  authorOrder
                }))
              }
            : undefined
        },
        include: bookInclude
      });
    });

    res.json(serializeBook(book));
  } catch (error) {
    next(error);
  }
});

app.post("/api/classifications/suggest", async (req, res, next) => {
  try {
    const payload = classificationInputSchema.parse(req.body);
    const suggestion = await suggestClassification(payload, currentLibraryId(req));
    res.json(suggestion);
  } catch (error) {
    next(error);
  }
});

app.post("/api/reorganization/suggest", async (_req, res, next) => {
  try {
    const libraryId = currentLibraryId(_req);
    const [books, shelves] = await Promise.all([
      prisma.book.findMany({ where: { deletedAt: null, libraryId }, include: bookInclude }),
      prisma.shelf.findMany({ where: { libraryId }, include: shelfInclude, orderBy: [{ homeLocation: "asc" }, { name: "asc" }] })
    ]);
    const localSuggestions = localReorganizationSuggestions(books, shelves);
    const claude = await suggestReorganizationWithClaude(books, shelves, localSuggestions);
    res.json({
      source: claude?.suggestions?.length ? "claude" : "local",
      generatedAt: new Date().toISOString(),
      overview:
        claude?.overview ??
        (localSuggestions.length
          ? `Analice ${books.length} libros y encontre ${localSuggestions.length} oportunidades de reorganizacion.`
          : "La distribucion actual no muestra dispersion fuerte por genero o autor. Revisa libros sin ubicacion cuando agregues nuevos ejemplares."),
      suggestions: claude?.suggestions?.length ? claude.suggestions : localSuggestions
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/books/:id/classification", async (req, res, next) => {
  try {
    const payload = classificationPayloadSchema.parse(req.body);
    const existing = await prisma.book.findFirst({ where: { id: req.params.id, deletedAt: null, libraryId: currentLibraryId(req) } });
    if (!existing) throw new AppError(404, "BOOK_NOT_FOUND", "No se encontro el libro");

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: {
        ...serializeClassificationPayload(payload),
        classificationUpdatedAt: new Date()
      },
      include: bookInclude
    });

    res.json(serializeBook(book));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/books/:id", async (req, res, next) => {
  try {
    const existing = await prisma.book.findFirst({ where: { id: req.params.id, deletedAt: null, libraryId: currentLibraryId(req) } });
    if (!existing) throw new AppError(404, "BOOK_NOT_FOUND", "No se encontro el libro");
    await prisma.book.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/shelves", async (req, res, next) => {
  try {
    const shelves = await prisma.shelf.findMany({
      where: { libraryId: currentLibraryId(req) },
      include: shelfInclude,
      orderBy: [{ homeLocation: "asc" }, { name: "asc" }]
    });
    res.json({ items: shelves.map(serializeShelf) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/shelves", async (req, res, next) => {
  try {
    const payload = shelfSchema.parse(req.body);
    const libraryId = currentLibraryId(req);
    const genreIds = uniqueGenreIds(payload.genreIds);
    await ensureGenreIdsBelongToLibrary(libraryId, genreIds);
    const shelf = await prisma.shelf.create({
      data: {
        libraryId,
        name: payload.name,
        description: payload.description,
        homeLocation: payload.homeLocation,
        mapX: payload.mapX,
        mapY: payload.mapY,
        mapWidth: payload.mapWidth,
        mapHeight: payload.mapHeight,
        capacity: payload.capacity,
        genres: {
          create: genreIds.map((genreId) => ({ genreId }))
        }
      },
      include: shelfInclude
    });
    res.status(201).json(serializeShelf(shelf));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/shelves/:id", async (req, res, next) => {
  try {
    const payload = shelfUpdateSchema.parse(req.body);
    const libraryId = currentLibraryId(req);
    const existing = await prisma.shelf.findFirst({ where: { id: req.params.id, libraryId } });
    if (!existing) throw new AppError(404, "SHELF_NOT_FOUND", "No se encontro la estanteria");
    const shelf = await prisma.$transaction(async (tx) => {
      const updated = await tx.shelf.update({
        where: { id: req.params.id },
        data: {
          name: payload.name,
          description: payload.description,
          homeLocation: payload.homeLocation,
          mapX: payload.mapX,
          mapY: payload.mapY,
          mapWidth: payload.mapWidth,
          mapHeight: payload.mapHeight,
          capacity: payload.capacity
        }
      });

      if (payload.genreIds !== undefined) {
        await tx.shelfGenre.deleteMany({ where: { shelfId: req.params.id } });
        const genreIds = uniqueGenreIds(payload.genreIds);
        await ensureGenreIdsBelongToLibrary(libraryId, genreIds);
        if (genreIds.length > 0) {
          await tx.shelfGenre.createMany({
            data: genreIds.map((genreId) => ({ shelfId: req.params.id, genreId }))
          });
        }
      }

      return tx.shelf.findUniqueOrThrow({
        where: { id: updated.id },
        include: shelfInclude
      });
    });
    res.json(serializeShelf(shelf));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/shelves/:id", async (req, res, next) => {
  try {
    const existing = await prisma.shelf.findFirst({ where: { id: req.params.id, libraryId: currentLibraryId(req) } });
    if (!existing) throw new AppError(404, "SHELF_NOT_FOUND", "No se encontro la estanteria");
    await prisma.shelf.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/shelves/:id/sections", async (req, res, next) => {
  try {
    const payload = shelfSectionSchema.parse(req.body);
    const shelf = await prisma.shelf.findFirst({ where: { id: req.params.id, libraryId: currentLibraryId(req) } });
    if (!shelf) throw new AppError(404, "SHELF_NOT_FOUND", "No se encontro la estanteria");
    const genreIds = uniqueGenreIds(payload.genreIds ?? (payload.genreId ? [payload.genreId] : []));
    await ensureGenreIdsBelongToLibrary(currentLibraryId(req), genreIds);
    const section = await prisma.shelfSection.create({
      data: {
        name: payload.name,
        position: payload.position,
        description: payload.description,
        genreId: cleanNullable(payload.genreId) as string | null,
        capacity: payload.capacity,
        shelfId: req.params.id,
        genres: {
          create: genreIds.map((genreId) => ({ genreId }))
        }
      },
      include: { genreRef: true, genres: { include: { genre: true } } }
    });
    res.status(201).json(serializeSection(section));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/shelf-sections/:id", async (req, res, next) => {
  try {
    const payload = shelfSectionUpdateSchema.parse(req.body);
    const libraryId = currentLibraryId(req);
    const existing = await prisma.shelfSection.findFirst({ where: { id: req.params.id, shelf: { libraryId } } });
    if (!existing) throw new AppError(404, "SHELF_SECTION_NOT_FOUND", "No se encontro la repisa");
    await ensureGenreIdsBelongToLibrary(libraryId, uniqueGenreIds(payload.genreIds ?? (payload.genreId ? [payload.genreId] : [])));
    const section = await prisma.$transaction(async (tx) => {
      const updated = await tx.shelfSection.update({
        where: { id: req.params.id },
        data: {
          name: payload.name,
          position: payload.position,
          description: payload.description,
          genreId: payload.genreId === undefined ? undefined : (cleanNullable(payload.genreId) as string | null),
          capacity: payload.capacity
        }
      });

      if (payload.genreIds !== undefined) {
        await tx.shelfSectionGenre.deleteMany({ where: { shelfSectionId: req.params.id } });
        const genreIds = uniqueGenreIds(payload.genreIds);
        await ensureGenreIdsBelongToLibrary(libraryId, genreIds);
        if (genreIds.length > 0) {
          await tx.shelfSectionGenre.createMany({
            data: genreIds.map((genreId) => ({ shelfSectionId: req.params.id, genreId }))
          });
        }
      }

      return tx.shelfSection.findUniqueOrThrow({
        where: { id: updated.id },
        include: { genreRef: true, genres: { include: { genre: true } } }
      });
    });
    res.json(serializeSection(section));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/shelves/:shelfId/repisas/:sectionId/books/reorder", async (req, res, next) => {
  try {
    const bookIds: string[] = Array.isArray(req.body?.bookIds) ? req.body.bookIds.filter((id: unknown): id is string => typeof id === "string") : [];
    if (bookIds.length === 0) {
      throw new AppError(400, "INVALID_REORDER_PAYLOAD", "Envia la lista de libros en el nuevo orden");
    }

    const existingBooks = await prisma.book.findMany({
      where: {
        id: { in: bookIds },
        libraryId: currentLibraryId(req),
        shelfId: req.params.shelfId,
        shelfSectionId: req.params.sectionId,
        deletedAt: null
      },
      select: { id: true }
    });
    const existingIds = new Set(existingBooks.map((book) => book.id));
    if (existingIds.size !== bookIds.length) {
      throw new AppError(400, "INVALID_REORDER_SCOPE", "Todos los libros deben pertenecer a la misma estanteria y repisa");
    }

    await prisma.$transaction(
      bookIds.map((bookId, index) =>
        prisma.book.update({
          where: { id: bookId },
          data: { shelfSortOrder: index + 1 }
        })
      )
    );

    res.json({ ok: true, bookIds });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/shelf-sections/:id", async (req, res, next) => {
  try {
    const existing = await prisma.shelfSection.findFirst({ where: { id: req.params.id, shelf: { libraryId: currentLibraryId(req) } } });
    if (!existing) throw new AppError(404, "SHELF_SECTION_NOT_FOUND", "No se encontro la repisa");
    await prisma.shelfSection.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/books/:id/loans", async (req, res, next) => {
  try {
    const payload = loanSchema.parse(req.body);
    const book = await prisma.book.findFirst({ where: { id: req.params.id, deletedAt: null, libraryId: currentLibraryId(req) } });
    if (!book) throw new AppError(404, "BOOK_NOT_FOUND", "No se encontro el libro");

    const activeLoan = await prisma.loan.findFirst({ where: { bookId: req.params.id, status: "ACTIVO", book: { libraryId: currentLibraryId(req) } } });
    if (activeLoan) throw new AppError(409, "ACTIVE_LOAN_EXISTS", "Este libro ya esta prestado");

    const loan = await prisma.$transaction(async (tx) => {
      const created = await tx.loan.create({
        data: {
          bookId: req.params.id,
          borrowerName: payload.borrowerName,
          borrowerContact: payload.borrowerContact,
          loanedAt: payload.loanedAt ?? new Date(),
          dueAt: payload.dueAt,
          notes: payload.notes
        }
      });
      await tx.book.update({ where: { id: req.params.id }, data: { availabilityStatus: "PRESTADO" } });
      return created;
    });

    res.status(201).json(loan);
  } catch (error) {
    next(error);
  }
});

app.get("/api/loans", async (req, res, next) => {
  try {
    const status = String(req.query.status ?? "");
    const loans = await prisma.loan.findMany({
      where: { book: { libraryId: currentLibraryId(req) }, ...(status ? { status: status as any } : {}) },
      include: { book: true },
      orderBy: [{ status: "asc" }, { loanedAt: "desc" }]
    });
    res.json({ items: loans });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/loans/:id/return", async (req, res, next) => {
  try {
    const loan = await prisma.loan.findFirst({ where: { id: req.params.id, book: { libraryId: currentLibraryId(req) } } });
    if (!loan) throw new AppError(404, "LOAN_NOT_FOUND", "No se encontro el prestamo");

    const returned = await prisma.$transaction(async (tx) => {
      const updated = await tx.loan.update({
        where: { id: req.params.id },
        data: { status: "DEVUELTO", returnedAt: new Date() }
      });
      await tx.book.update({
        where: { id: loan.bookId },
        data: { availabilityStatus: "EN_MI_BIBLIOTECA" }
      });
      return updated;
    });

    res.json(returned);
  } catch (error) {
    next(error);
  }
});

app.use(notFound);
app.use(errorHandler);

ensureInitialLibrary()
  .then(() => {
    app.listen(port, () => {
      console.log(`API lista en http://localhost:${port}/api`);
    });
  })
  .catch((error) => {
    console.error("No se pudieron precargar los generos base", error);
    process.exit(1);
  });
