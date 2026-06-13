import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio"),
  email: z.string().trim().email("El correo no es valido").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
  libraryName: z.string().trim().min(2).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email("El correo no es valido").transform((value) => value.toLowerCase()),
  password: z.string().min(1, "La contrasena es obligatoria")
});

export const memberSchema = z.object({
  email: z.string().trim().email("El correo no es valido").transform((value) => value.toLowerCase()),
  role: z.enum(["OWNER", "EDITOR", "READER"])
});

export const memberUpdateSchema = z.object({
  role: z.enum(["OWNER", "EDITOR", "READER"])
});

export const bookPayloadSchema = z.object({
  title: z.string().trim().min(1, "El titulo es obligatorio"),
  subtitle: z.string().trim().optional().nullable(),
  authors: z.array(z.string().trim().min(1)).min(1, "Agrega al menos un autor"),
  isbn10: z.string().trim().regex(/^[0-9X]{10}$/i).optional().nullable().or(z.literal("")),
  isbn13: z.string().trim().regex(/^[0-9]{13}$/).optional().nullable().or(z.literal("")),
  publisher: z.string().trim().optional().nullable(),
  publicationYear: z.coerce.number().int().min(0).max(3000).optional().nullable(),
  pageCount: z.coerce.number().int().positive().optional().nullable(),
  genre: z.string().trim().optional().nullable(),
  genreId: z.string().uuid().optional().nullable().or(z.literal("")),
  subgenreId: z.string().uuid().optional().nullable().or(z.literal("")),
  deweyGenreRaw: z.string().trim().optional().nullable(),
  languageCode: z.string().trim().optional().nullable(),
  synopsis: z.string().trim().optional().nullable(),
  edition: z.string().trim().optional().nullable(),
  coverUrl: z.string().trim().url().optional().nullable().or(z.literal("")),
  deweyCode: z.string().trim().optional().nullable(),
  deweyHierarchy: z.array(z.string().trim().min(1)).optional(),
  deweyExplanation: z.string().trim().optional().nullable(),
  lcCode: z.string().trim().optional().nullable(),
  lcHierarchy: z.array(z.string().trim().min(1)).optional(),
  lcExplanation: z.string().trim().optional().nullable(),
  customTags: z.array(z.string().trim().min(1)).optional(),
  labelSerial: z.string().trim().optional().nullable(),
  labelSystem: z.enum(["DEWEY", "LC", "PROPIA"]).optional().nullable(),
  labelSize: z.enum(["PEQUENO", "MEDIANO", "PERSONALIZADO"]).optional().nullable(),
  availabilityStatus: z.enum(["EN_MI_BIBLIOTECA", "PRESTADO"]).optional(),
  readingStatus: z.enum(["SIN_ESTADO", "LEIDO", "POR_LEER"]).optional(),
  isReference: z.coerce.boolean().optional(),
  shelfId: z.string().uuid().optional().nullable().or(z.literal("")),
  shelfSectionId: z.string().uuid().optional().nullable().or(z.literal(""))
});

export const shelfSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  description: z.string().trim().optional().nullable(),
  homeLocation: z.string().trim().min(1, "La ubicacion es obligatoria"),
  mapX: z.coerce.number().int().min(0).max(820).optional(),
  mapY: z.coerce.number().int().min(0).max(500).optional(),
  mapWidth: z.coerce.number().int().min(70).max(260).optional(),
  mapHeight: z.coerce.number().int().min(44).max(180).optional(),
  capacity: z.coerce.number().int().positive().max(2000).optional(),
  genreIds: z.array(z.string().uuid()).optional()
});

export const genreSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).default("#461e60"),
  icon: z.string().trim().min(1).default("ti-book")
});

export const subgenreSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio")
});

export const shelfSectionSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  position: z.coerce.number().int().positive(),
  description: z.string().trim().optional().nullable(),
  genreId: z.string().uuid().optional().nullable().or(z.literal("")),
  genreIds: z.array(z.string().uuid()).optional(),
  capacity: z.coerce.number().int().positive().max(2000).optional()
});

export const loanSchema = z.object({
  borrowerName: z.string().trim().min(1, "El nombre es obligatorio"),
  borrowerContact: z.string().trim().optional().nullable(),
  loanedAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().optional().nullable(),
  notes: z.string().trim().optional().nullable()
});

export const classificationInputSchema = z.object({
  title: z.string().trim().min(1, "El titulo es obligatorio"),
  authors: z.array(z.string().trim().min(1)).default([]),
  genre: z.string().trim().optional().nullable(),
  synopsis: z.string().trim().optional().nullable()
});

export const classificationPayloadSchema = z.object({
  deweyCode: z.string().trim().min(1).optional().nullable(),
  deweyHierarchy: z.array(z.string().trim().min(1)).default([]),
  deweyExplanation: z.string().trim().optional().nullable(),
  lcCode: z.string().trim().min(1).optional().nullable(),
  lcHierarchy: z.array(z.string().trim().min(1)).default([]),
  lcExplanation: z.string().trim().optional().nullable(),
  customTags: z.array(z.string().trim().min(1)).default([]),
  suggestedGenre: z.string().trim().optional().nullable(),
  suggestedSubgenre: z.string().trim().optional().nullable(),
  genreConfidence: z.enum(["alta", "media", "baja"]).optional().nullable(),
  genreReason: z.string().trim().optional().nullable(),
  genreId: z.string().uuid().optional().nullable(),
  subgenreId: z.string().uuid().optional().nullable()
});

export const deweyGenreSuggestionSchema = z.object({
  genero_principal: z.string().trim().min(1),
  subgenero: z.string().trim().min(1).optional().nullable(),
  confianza: z.enum(["alta", "media", "baja"]),
  razon: z.string().trim().min(1)
});

export const shelfUpdateSchema = shelfSchema.partial();
export const shelfSectionUpdateSchema = shelfSectionSchema.partial();
export const genreUpdateSchema = genreSchema.partial();
export const subgenreUpdateSchema = subgenreSchema.partial();
