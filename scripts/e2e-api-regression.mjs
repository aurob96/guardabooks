#!/usr/bin/env node

const baseUrl = (process.env.E2E_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
const runId = process.env.E2E_RUN_ID || new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

let passed = 0;
let failed = 0;

function log(status, name, detail = "") {
  const marker = status ? "PASS" : "FAIL";
  console.log(`${marker} ${name}${detail ? ` - ${detail}` : ""}`);
  if (status) passed += 1;
  else failed += 1;
}

async function request(path, { token, method = "GET", body, expected = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (response.status !== expected) {
    throw new Error(`${method} ${path} expected ${expected}, got ${response.status}: ${text}`);
  }
  return payload;
}

async function test(name, fn) {
  try {
    await fn();
    log(true, name);
  } catch (error) {
    log(false, name, error instanceof Error ? error.message : String(error));
  }
}

const owner = {
  name: `QA Owner ${runId}`,
  email: `qa-owner-${runId}@guardabooks.test`,
  password: `QaOwner-${runId}!`,
  libraryName: `QA Biblioteca ${runId}`
};
const reader = {
  name: `QA Reader ${runId}`,
  email: `qa-reader-${runId}@guardabooks.test`,
  password: `QaReader-${runId}!`,
  libraryName: `QA Biblioteca aislada ${runId}`
};

let ownerSession;
let readerSession;
let readerInOwnerLibrarySession;
let genre;
let subgenre;
let shelf;
let section;
let book;
let loan;

await test("health publico", async () => {
  const health = await request("/health");
  if (!health.ok) throw new Error("health no respondio ok");
});

await test("rutas privadas rechazan anonimos", async () => {
  await request("/books?page=1&pageSize=10", { expected: 401 });
});

await test("registro owner", async () => {
  ownerSession = await request("/auth/register", { method: "POST", body: owner, expected: 201 });
  if (!ownerSession.token || ownerSession.library.role !== "OWNER") throw new Error("sesion owner invalida");
});

await test("login owner", async () => {
  const login = await request("/auth/login", { method: "POST", body: { email: owner.email, password: owner.password } });
  if (!login.token) throw new Error("login sin token");
});

await test("login con clave incorrecta falla", async () => {
  await request("/auth/login", { method: "POST", body: { email: owner.email, password: "incorrecta" }, expected: 401 });
});

await test("crear genero y subgenero", async () => {
  genre = await request("/genres", {
    token: ownerSession.token,
    method: "POST",
    body: { name: `QA Genero ${runId}`, color: "#0f766e", icon: "ti-test" },
    expected: 201
  });
  subgenre = await request(`/genres/${genre.id}/subgenres`, {
    token: ownerSession.token,
    method: "POST",
    body: { name: `QA Subgenero ${runId}` },
    expected: 201
  });
});

await test("crear estanteria y repisa", async () => {
  shelf = await request("/shelves", {
    token: ownerSession.token,
    method: "POST",
    body: { name: `QA Estanteria ${runId}`, homeLocation: "QA", capacity: 20, genreIds: [genre.id] },
    expected: 201
  });
  section = await request(`/shelves/${shelf.id}/sections`, {
    token: ownerSession.token,
    method: "POST",
    body: { name: `QA Repisa ${runId}`, position: 1, capacity: 5, genreIds: [genre.id] },
    expected: 201
  });
});

await test("crear libro", async () => {
  book = await request("/books", {
    token: ownerSession.token,
    method: "POST",
    body: {
      title: `QA Libro ${runId}`,
      authors: [`Autora QA ${runId}`],
      isbn13: "",
      genre: "QA",
      genreId: genre.id,
      subgenreId: subgenre.id,
      publisher: "QA Editorial",
      publicationYear: 2026,
      pageCount: 123,
      languageCode: "es",
      shelfId: shelf.id,
      shelfSectionId: section.id,
      availabilityStatus: "EN_MI_BIBLIOTECA",
      readingStatus: "POR_LEER",
      isReference: false
    },
    expected: 201
  });
  if (book.title !== `QA Libro ${runId}`) throw new Error("titulo creado no coincide");
});

await test("listar, buscar y detectar duplicado", async () => {
  const params = new URLSearchParams({ page: "1", pageSize: "100", q: `QA Libro ${runId}` });
  const list = await request(`/books?${params.toString()}`, { token: ownerSession.token });
  if (!list.items.some((item) => item.id === book.id)) throw new Error("libro no aparece en busqueda");

  const duplicates = await request("/books/duplicates", {
    token: ownerSession.token,
    method: "POST",
    body: { title: book.title, authors: [`Autora QA ${runId}`], isbn10: "", isbn13: "" }
  });
  if (!duplicates.matches.length) throw new Error("no detecto duplicado");
});

await test("editar libro", async () => {
  book = await request(`/books/${book.id}`, {
    token: ownerSession.token,
    method: "PATCH",
    body: { readingStatus: "LEIDO", labelSerial: `QA-${runId}` }
  });
  if (book.readingStatus !== "LEIDO") throw new Error("estado de lectura no cambio");
});

await test("prestar y devolver libro", async () => {
  loan = await request(`/books/${book.id}/loans`, {
    token: ownerSession.token,
    method: "POST",
    body: { borrowerName: "QA Prestamo", borrowerContact: "qa@example.test", notes: "prestamo de prueba" },
    expected: 201
  });
  if (!loan.id) throw new Error("prestamo sin id");
  const returned = await request(`/loans/${loan.id}/return`, { token: ownerSession.token, method: "PATCH" });
  if (returned.status !== "DEVUELTO") throw new Error("prestamo no quedo devuelto");
});

await test("reordenar repisa", async () => {
  const reorder = await request(`/shelves/${shelf.id}/repisas/${section.id}/books/reorder`, {
    token: ownerSession.token,
    method: "PATCH",
    body: { bookIds: [book.id] }
  });
  if (!reorder.ok) throw new Error("reorden no respondio ok");
});

await test("registro usuario aislado", async () => {
  readerSession = await request("/auth/register", { method: "POST", body: reader, expected: 201 });
  const params = new URLSearchParams({ page: "1", pageSize: "100", q: `QA Libro ${runId}` });
  const list = await request(`/books?${params.toString()}`, { token: readerSession.token });
  if (list.items.length !== 0) throw new Error("usuario aislado ve libros de otra biblioteca");
});

await test("usuario aislado no puede modificar libro ajeno", async () => {
  await request(`/books/${book.id}`, { token: readerSession.token, method: "PATCH", body: { readingStatus: "POR_LEER" }, expected: 404 });
});

await test("owner agrega reader a su biblioteca", async () => {
  const member = await request("/members", {
    token: ownerSession.token,
    method: "POST",
    body: { email: reader.email, role: "READER" },
    expected: 201
  });
  if (member.role !== "READER") throw new Error("rol no quedo como READER");
});

await test("usuario cambia a biblioteca compartida", async () => {
  const libraries = await request("/libraries", { token: readerSession.token });
  const ownerLibrary = libraries.items.find((item) => item.id === ownerSession.library.id);
  if (!ownerLibrary) throw new Error("biblioteca compartida no aparece");
  readerInOwnerLibrarySession = await request("/auth/switch-library", {
    token: readerSession.token,
    method: "POST",
    body: { libraryId: ownerLibrary.id }
  });
  if (readerInOwnerLibrarySession.library.role !== "READER") throw new Error("rol compartido incorrecto");
});

await test("reader puede consultar pero no crear", async () => {
  const params = new URLSearchParams({ page: "1", pageSize: "100", q: `QA Libro ${runId}` });
  const list = await request(`/books?${params.toString()}`, { token: readerInOwnerLibrarySession.token });
  if (!list.items.some((item) => item.id === book.id)) throw new Error("reader no ve libro compartido");
  await request("/books", {
    token: readerInOwnerLibrarySession.token,
    method: "POST",
    body: { title: "No permitido", authors: ["QA"], availabilityStatus: "EN_MI_BIBLIOTECA", readingStatus: "SIN_ESTADO", isReference: false },
    expected: 403
  });
});

await test("limpieza de datos principales", async () => {
  await request(`/books/${book.id}`, { token: ownerSession.token, method: "DELETE", expected: 204 });
  await request(`/shelf-sections/${section.id}`, { token: ownerSession.token, method: "DELETE", expected: 204 });
  await request(`/shelves/${shelf.id}`, { token: ownerSession.token, method: "DELETE", expected: 204 });
  await request(`/subgenres/${subgenre.id}`, { token: ownerSession.token, method: "DELETE", expected: 204 });
  await request(`/genres/${genre.id}`, { token: ownerSession.token, method: "DELETE", expected: 204 });
});

console.log(`\nResultado: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
