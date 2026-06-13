import http from "node:http";

const now = new Date().toISOString();

const genres = [
  {
    id: "genre-literatura",
    name: "Literatura",
    slug: "literatura",
    color: "#8a2d3b",
    icon: "ti-book",
    createdAt: now,
    subgenres: [
      { id: "sub-novela", genreId: "genre-literatura", name: "Novela", slug: "novela" },
      { id: "sub-cuento", genreId: "genre-literatura", name: "Cuento", slug: "cuento" }
    ]
  },
  {
    id: "genre-filosofia",
    name: "Filosofia",
    slug: "filosofia",
    color: "#2f6f73",
    icon: "ti-book",
    createdAt: now,
    subgenres: [
      { id: "sub-etica", genreId: "genre-filosofia", name: "Etica", slug: "etica" },
      { id: "sub-politica", genreId: "genre-filosofia", name: "Politica", slug: "politica" }
    ]
  },
  {
    id: "genre-historia",
    name: "Historia",
    slug: "historia",
    color: "#80642d",
    icon: "ti-book",
    createdAt: now,
    subgenres: [
      { id: "sub-america-latina", genreId: "genre-historia", name: "America Latina", slug: "america-latina" }
    ]
  }
];

const shelves = [
  {
    id: "shelf-sala",
    name: "Estanteria sala",
    description: "Mueble principal de la sala",
    homeLocation: "Sala",
    _count: { books: 4 },
    sections: [
      {
        id: "section-literatura",
        shelfId: "shelf-sala",
        name: "Repisa 1",
        position: 1,
        genreId: "genre-literatura",
        genreRef: genres[0]
      },
      {
        id: "section-filosofia",
        shelfId: "shelf-sala",
        name: "Repisa 2",
        position: 2,
        genreId: "genre-filosofia",
        genreRef: genres[1]
      }
    ]
  },
  {
    id: "shelf-estudio",
    name: "Biblioteca estudio",
    description: "Libros de consulta",
    homeLocation: "Estudio",
    _count: { books: 2 },
    sections: [
      {
        id: "section-historia",
        shelfId: "shelf-estudio",
        name: "Repisa historia",
        position: 1,
        genreId: "genre-historia",
        genreRef: genres[2]
      }
    ]
  }
];

let books = [
  makeBook({
    id: "book-cien-anos",
    title: "Cien anos de soledad",
    authors: ["Gabriel Garcia Marquez"],
    publisher: "Sudamericana",
    year: 1967,
    genreIndex: 0,
    subgenreIndex: 0,
    shelfIndex: 0,
    sectionIndex: 0,
    deweyCode: "863.64",
    lcCode: "PQ8180.17.A73",
    labelSerial: "863.64\nGAR\nCIE",
    readingStatus: "LEIDO"
  }),
  makeBook({
    id: "book-republica",
    title: "La republica",
    authors: ["Platon"],
    publisher: "Gredos",
    year: 2003,
    genreIndex: 1,
    subgenreIndex: 1,
    shelfIndex: 0,
    sectionIndex: 1,
    deweyCode: "321.07",
    lcCode: "JC71",
    labelSerial: "321.07\nPLA\nREP",
    readingStatus: "POR_LEER"
  }),
  makeBook({
    id: "book-venas",
    title: "Las venas abiertas de America Latina",
    authors: ["Eduardo Galeano"],
    publisher: "Siglo XXI",
    year: 1971,
    genreIndex: 2,
    subgenreIndex: 0,
    shelfIndex: 1,
    sectionIndex: 0,
    deweyCode: "980",
    lcCode: "F1414",
    labelSerial: "980\nGAL\nVEN",
    readingStatus: "SIN_ESTADO"
  }),
  makeBook({
    id: "book-sombra",
    title: "La sombra del viento",
    authors: ["Carlos Ruiz Zafon"],
    publisher: "Planeta",
    year: 2001,
    genreIndex: 0,
    subgenreIndex: 0,
    shelfIndex: 0,
    sectionIndex: 0,
    deweyCode: "863.7",
    lcCode: "PQ6668.U49",
    labelSerial: "863.7\nRUI\nSOM",
    readingStatus: "POR_LEER",
    activeLoan: {
      id: "loan-sombra",
      bookId: "book-sombra",
      borrowerName: "Laura",
      borrowerContact: "laura@example.com",
      loanedAt: now,
      dueAt: "2026-06-22T00:00:00.000Z",
      returnedAt: null,
      notes: "Prestado para vacaciones",
      status: "ACTIVO"
    }
  })
];

function makeBook(input) {
  const genre = genres[input.genreIndex];
  const subgenre = genre.subgenres[input.subgenreIndex];
  const shelf = shelves[input.shelfIndex];
  const section = shelf.sections[input.sectionIndex];
  const activeLoan = input.activeLoan ?? null;

  return {
    id: input.id,
    title: input.title,
    subtitle: null,
    isbn10: null,
    isbn13: null,
    publisher: { id: `publisher-${input.id}`, name: input.publisher },
    publicationYear: input.year,
    pageCount: null,
    genre: genre.name,
    genreId: genre.id,
    subgenreId: subgenre.id,
    deweyGenreRaw: genre.name,
    genreRef: genre,
    subgenre,
    languageCode: "es",
    synopsis: "Registro de demostracion para mostrar el flujo de la biblioteca personal.",
    edition: null,
    coverUrl: null,
    deweyCode: input.deweyCode,
    deweyHierarchy: [genre.name, subgenre.name],
    deweyExplanation: "Clasificacion sugerida para ordenar el libro dentro de la coleccion.",
    lcCode: input.lcCode,
    lcHierarchy: [genre.name],
    lcExplanation: "Signatura LC de apoyo para colecciones mixtas.",
    customTags: ["demo", genre.slug],
    classificationUpdatedAt: now,
    labelSerial: input.labelSerial,
    labelSystem: "DEWEY",
    labelSize: "MEDIANO",
    availabilityStatus: activeLoan ? "PRESTADO" : "EN_MI_BIBLIOTECA",
    readingStatus: input.readingStatus,
    isReference: false,
    shelf,
    shelfSection: section,
    authors: input.authors.map((fullName, index) => ({ id: `${input.id}-author-${index}`, fullName })),
    loans: activeLoan ? [activeLoan] : [],
    activeLoan,
    createdAt: now,
    updatedAt: now
  };
}

function json(res, status, body) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Content-Type": "application/json"
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      resolve(body ? JSON.parse(body) : {});
    });
  });
}

function filterBooks(url) {
  const query = normalize(url.searchParams.get("q") ?? "");
  const genreId = url.searchParams.get("genreId") ?? "";
  const shelfId = url.searchParams.get("shelfId") ?? "";

  return books.filter((book) => {
    const haystack = normalize([
      book.title,
      book.authors.map((author) => author.fullName).join(" "),
      book.publisher?.name,
      book.genre,
      book.publicationYear
    ].join(" "));
    return (!query || haystack.includes(query)) && (!genreId || book.genreId === genreId) && (!shelfId || book.shelf?.id === shelfId);
  });
}

function normalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:4000");

  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  if (url.pathname === "/api/health") return json(res, 200, { ok: true, service: "biblioteca-demo-api" });
  if (url.pathname === "/api/genres" && req.method === "GET") return json(res, 200, { items: genres });
  if (url.pathname === "/api/shelves" && req.method === "GET") return json(res, 200, { items: shelves });
  if (url.pathname === "/api/books" && req.method === "GET") {
    const items = filterBooks(url);
    return json(res, 200, { items, total: items.length, page: 1, pageSize: 100 });
  }
  if (url.pathname === "/api/books/duplicates" && req.method === "POST") return json(res, 200, { matches: [] });
  if (url.pathname === "/api/classifications/suggest" && req.method === "POST") {
    return json(res, 200, {
      deweyCode: "863",
      deweyHierarchy: ["Literatura", "Narrativa en espanol"],
      deweyExplanation: "La obra puede ubicarse dentro de narrativa literaria en lengua espanola.",
      lcCode: "PQ",
      lcHierarchy: ["Literatura", "Literatura hispanica"],
      lcExplanation: "Signatura general sugerida para literatura hispanica.",
      customTags: ["narrativa", "demo"],
      suggestedGenre: "Literatura",
      suggestedSubgenre: "Novela",
      genreConfidence: "media",
      genreReason: "El titulo y el contexto corresponden a una obra narrativa."
    });
  }
  if (url.pathname === "/api/external-books/search" && req.method === "GET") {
    return json(res, 200, {
      items: [
        {
          source: "google_books",
          title: url.searchParams.get("title") || "El libro buscado",
          authors: [url.searchParams.get("author") || "Autor de ejemplo"],
          publisher: "Editorial Demo",
          publicationYear: 2020,
          pageCount: 240,
          genre: "Literatura",
          subjects: ["Fiction"],
          deweyCode: "863",
          languageCode: "es",
          synopsis: "Resultado de demostracion importado desde una busqueda publica.",
          coverUrl: null
        }
      ]
    });
  }
  if (url.pathname.startsWith("/api/external-books/isbn/") && req.method === "GET") {
    return json(res, 200, {
      source: "open_library",
      isbn13: url.pathname.split("/").pop(),
      title: "Libro encontrado por ISBN",
      authors: ["Autora Demo"],
      publisher: "Editorial Demo",
      publicationYear: 2024,
      pageCount: 312,
      genre: "Literatura",
      subjects: ["Fiction"],
      deweyCode: "863",
      languageCode: "es",
      synopsis: "Datos importados automaticamente para evitar digitacion manual.",
      coverUrl: null,
      genreSuggestion: {
        genero_principal: "Literatura",
        subgenero: "Novela",
        confianza: "alta",
        razon: "El codigo Dewey y los temas publicos coinciden con narrativa.",
        genreId: "genre-literatura",
        subgenreId: "sub-novela",
        isExistingGenre: true,
        isExistingSubgenre: true
      }
    });
  }
  if (url.pathname === "/api/books" && req.method === "POST") {
    const payload = await readJson(req);
    const book = makeBook({
      id: `book-${Date.now()}`,
      title: payload.title || "Libro nuevo",
      authors: payload.authors?.length ? payload.authors : ["Autor sin registrar"],
      publisher: payload.publisher || "Editorial pendiente",
      year: payload.publicationYear || 2026,
      genreIndex: 0,
      subgenreIndex: 0,
      shelfIndex: 0,
      sectionIndex: 0,
      deweyCode: payload.deweyCode || "863",
      lcCode: payload.lcCode || "PQ",
      labelSerial: payload.labelSerial || "863\nAUT\nLIB",
      readingStatus: payload.readingStatus || "SIN_ESTADO"
    });
    books = [book, ...books];
    return json(res, 201, book);
  }

  return json(res, 404, { error: { message: "Ruta de demo no encontrada" } });
});

server.listen(4000, "127.0.0.1", () => {
  console.log("Demo API lista en http://127.0.0.1:4000/api/health");
});
