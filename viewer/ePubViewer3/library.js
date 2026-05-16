// Library Module - IndexedDB + Book Library UI
// Handles book storage, retrieval, cover extraction, and library view

const DB_NAME = 'BookLibrary';
const DB_VERSION = 1;
const STORE_NAME = 'books';

class BookLibrary {
    #db = null;
    #containerEl = null;
    #onBookOpen = null;

    constructor(containerSelector, onBookOpen) {
        this.#containerEl = document.querySelector(containerSelector);
        this.#onBookOpen = onBookOpen;
    }

    async init() {
        await this.#openDB();
        this.#setupLibraryUI();
        await this.renderLibrary();
    }

    #openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.#db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('title', 'title', { unique: false });
                    store.createIndex('addedAt', 'addedAt', { unique: false });
                }
            };
        });
    }

    #setupLibraryUI() {
        if (!this.#containerEl) return;

        this.#containerEl.innerHTML = `
            <div class="library-header">
                <h1 class="library-title">Kitaplık</h1>
                <button class="library-add-btn" id="library-add-btn">
                    <i class="material-icons-outlined">add</i>
                    <span>Kitap Ekle</span>
                </button>
            </div>
            <div class="library-grid" id="library-grid"></div>
            <div class="library-empty" id="library-empty">
                <i class="material-icons-outlined">menu_book</i>
                <p>Kitaplık boş. Kitap eklemek için yukarıdaki butona tıklayın.</p>
            </div>
        `;

        const addBtn = this.#containerEl.querySelector('#library-add-btn');
        addBtn?.addEventListener('click', () => this.#handleAddBook());
    }

    async #handleAddBook() {
        // Use Electron file dialog if available
        if (window.electronAPI?.openBookDialog) {
            try {
                const filePaths = await window.electronAPI.openBookDialog();
                if (!filePaths || filePaths.length === 0) return;

                for (const filePath of filePaths) {
                    try {
                        const buffer = await window.electronAPI.readFile(filePath);
                        const fileName = filePath.split(/[\\/]/).pop();
                        await this.#processAndSaveBookFromBuffer(buffer, fileName);
                    } catch (err) {
                        console.error('Error processing book:', filePath, err);
                        alert(`"${filePath}" işlenirken hata oluştu: ${err.message}`);
                    }
                }
                await this.renderLibrary();
            } catch (err) {
                console.error('Dialog error:', err);
            }
            return;
        }

        // Fallback to HTML file input for web
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.epub,.pdf,application/epub+zip,application/pdf';
        input.multiple = true;

        input.onchange = async () => {
            const files = Array.from(input.files);
            if (files.length === 0) return;

            for (const file of files) {
                try {
                    await this.#processAndSaveBook(file);
                } catch (err) {
                    console.error('Error processing book:', file.name, err);
                    alert(`"${file.name}" işlenirken hata oluştu: ${err.message}`);
                }
            }
            await this.renderLibrary();
        };

        input.click();
    }

    async #processAndSaveBook(file) {
        const buffer = await file.arrayBuffer();
        return this.#processAndSaveBookFromBuffer(buffer, file.name);
    }

    async #processAndSaveBookFromBuffer(buffer, fileName) {
        // CRITICAL: Clone buffer immediately for IndexedDB storage
        // EPUB.js and PDF.js may detach the original buffer during metadata extraction
        const dataForStorage = buffer.slice(0);

        const header = new Uint8Array(buffer.slice(0, 8));
        const magicBytes = Array.from(header.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');

        let format, metadata, coverBlob;

        // Detect format by magic bytes
        if (magicBytes.startsWith('504b')) {
            format = 'epub';
            const result = await this.#extractEpubMetadata(buffer);
            metadata = result.metadata;
            coverBlob = result.coverBlob;
        } else if (magicBytes.startsWith('25504446')) {
            format = 'pdf';
            const result = await this.#extractPdfMetadata(buffer);
            metadata = result.metadata;
            coverBlob = result.coverBlob;
        } else {
            throw new Error('Desteklenmeyen dosya formatı. Sadece EPUB ve PDF dosyaları kabul edilir.');
        }

        const book = {
            title: metadata.title || fileName.replace(/\.[^/.]+$/, ''),
            author: metadata.author || 'Bilinmeyen Yazar',
            format: format,
            coverBlob: coverBlob,
            data: dataForStorage,
            fileSize: dataForStorage.byteLength,
            addedAt: Date.now(),
            lastReadAt: null,
            lastPosition: null,
            totalPages: metadata.totalPages || 0
        };

        const bookId = await this.#saveBook(book);
        book.id = bookId;
        
        // Save metadata to TOML
        await this.#saveMetadataToToml(book);
    }

    async #saveMetadataToToml(book) {
        try {
            if (window.electronAPI?.saveBookMetadata) {
                const tomlData = {
                    id: String(book.id),
                    title: book.title,
                    author: book.author,
                    format: book.format,
                    total_pages: book.totalPages || 0,
                    last_page: book.lastPosition?.page || 1,
                    added_at: new Date(book.addedAt).toISOString(),
                    last_read_at: book.lastReadAt ? new Date(book.lastReadAt).toISOString() : ''
                };
                
                const result = await window.electronAPI.saveBookMetadata(tomlData);
                if (result.success) {
                    console.log('[Library] Metadata saved to TOML:', result.filePath);
                } else {
                    console.error('[Library] Failed to save metadata:', result.error);
                }
            }
        } catch (error) {
            console.error('[Library] Error saving metadata to TOML:', error);
        }
    }

    async #extractEpubMetadata(buffer) {
        return new Promise((resolve, reject) => {
            try {
                const book = ePub(buffer, { encoding: 'binary' });
                let metadata = {};
                let coverBlob = null;

                Promise.all([
                    book.loaded.metadata.then(meta => {
                        metadata = {
                            title: meta.title,
                            author: meta.creator
                        };
                    }).catch(() => {}),
                    book.loaded.cover.then(url => {
                        if (url) {
                            // Fetch cover as blob
                            return fetch(url)
                                .then(r => r.blob())
                                .then(blob => { coverBlob = blob; })
                                .catch(() => {});
                        }
                    }).catch(() => {})
                ]).then(() => {
                    book.destroy?.() || (book.archive = null);
                    resolve({ metadata, coverBlob });
                }).catch(reject);
            } catch (err) {
                reject(err);
            }
        });
    }

    async #extractPdfMetadata(buffer) {
        // Use correct path - go up from src/renderer/ to app root, then to libs/
        const baseUrl = window.location.href.replace(/\/[^\/]*$/, ''); // Remove filename
        const rendererUrl = baseUrl.replace(/\/[^\/]*$/, ''); // Go up from renderer/
        const srcUrl = rendererUrl.replace(/\/[^\/]*$/, ''); // Go up from src/
        const workerUrl = srcUrl + '/libs/pdf.worker.mjs';
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        console.log('[Library] PDF worker path:', workerUrl);

        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

        const metadata = await pdf.getMetadata().catch(() => ({}));
        const info = metadata.info || {};
        
        // Get total pages from PDF
        const totalPages = pdf.numPages || 0;
        console.log('[Library] PDF total pages:', totalPages);

        // Render first page as cover
        let coverBlob = null;
        try {
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            await page.render({ canvasContext: ctx, viewport }).promise;

            coverBlob = await new Promise((resolve) => {
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
            });

            page.cleanup();
        } catch (e) {
            console.warn('Could not render PDF cover:', e);
        }

        pdf.destroy();

        return {
            metadata: {
                title: info.Title,
                author: info.Author,
                totalPages: totalPages
            },
            coverBlob
        };
    }

    #saveBook(book) {
        return new Promise((resolve, reject) => {
            // Ensure buffer is a fresh copy for IndexedDB
            if (book.data instanceof ArrayBuffer) {
                // Use structuredClone if available (best method)
                if (typeof structuredClone === 'function') {
                    try {
                        book.data = structuredClone(book.data);
                    } catch (e) {
                        // Fallback to manual copy
                        book.data = new Uint8Array(book.data).slice().buffer;
                    }
                } else {
                    // Manual copy through Uint8Array
                    book.data = new Uint8Array(book.data).slice().buffer;
                }
            }

            const transaction = this.#db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(book);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllBooks() {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('addedAt');
            const request = index.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getBook(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateBookPosition(id, position) {
        const book = await this.getBook(id);
        if (!book) return;

        book.lastPosition = position;
        book.lastReadAt = Date.now();

        // Update IndexedDB
        await new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(book);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        // Also update TOML metadata
        await this.#saveMetadataToToml(book);
    }

    async loadBookPositionFromToml(bookId) {
        try {
            if (window.electronAPI?.loadBookMetadata) {
                const result = await window.electronAPI.loadBookMetadata(String(bookId));
                if (result.success && result.book) {
                    console.log('[Library] Loaded position from TOML:', result.book.last_page);
                    return { page: result.book.last_page || 1 };
                }
            }
        } catch (error) {
            console.error('[Library] Error loading position from TOML:', error);
        }
        return null;
    }

    async deleteBook(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.#db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async renderLibrary() {
        const grid = this.#containerEl?.querySelector('#library-grid');
        const empty = this.#containerEl?.querySelector('#library-empty');
        if (!grid) return;

        const books = await this.getAllBooks();

        if (books.length === 0) {
            grid.innerHTML = '';
            empty?.classList.remove('hidden');
            return;
        }

        empty?.classList.add('hidden');
        grid.innerHTML = books.map(book => this.#createBookCard(book)).join('');

        // Add click handlers
        grid.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.dataset.id);
                this.#openBook(id);
            });
        });

        // Add delete handlers
        grid.querySelectorAll('.book-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                if (confirm('Bu kitabı silmek istediğinize emin misiniz?')) {
                    await this.deleteBook(id);
                    await this.renderLibrary();
                }
            });
        });
    }

    #createBookCard(book) {
        const coverUrl = book.coverBlob
            ? URL.createObjectURL(book.coverBlob)
            : '';

        const formatIcon = book.format === 'epub' ? 'menu_book' : 'picture_as_pdf';
        const lastRead = book.lastReadAt
            ? new Date(book.lastReadAt).toLocaleDateString('tr-TR')
            : 'Hiç okunmadı';

        return `
            <div class="book-card" data-id="${book.id}">
                <div class="book-cover">
                    ${coverUrl
                        ? `<img src="${coverUrl}" alt="${book.title}" loading="lazy">`
                        : `<div class="book-cover-placeholder"><i class="material-icons-outlined">${formatIcon}</i></div>`
                    }
                    <div class="book-format-badge">${book.format.toUpperCase()}</div>
                    <button class="book-delete" data-id="${book.id}" title="Sil">
                        <i class="material-icons-outlined">delete</i>
                    </button>
                </div>
                <div class="book-info">
                    <div class="book-title" title="${book.title}">${book.title}</div>
                    <div class="book-author" title="${book.author}">${book.author}</div>
                    <div class="book-meta">${lastRead}</div>
                </div>
            </div>
        `;
    }

    async #openBook(id) {
        const book = await this.getBook(id);
        if (!book) return;

        if (this.#onBookOpen) {
            this.#onBookOpen(book);
        }
    }

    show() {
        this.#containerEl?.classList.remove('hidden');
    }

    hide() {
        this.#containerEl?.classList.add('hidden');
    }
}

// Make available globally
window.BookLibrary = BookLibrary;
