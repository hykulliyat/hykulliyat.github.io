// BookLibrary - Simple library management for ePubViewer
class BookLibrary {
    constructor(selector, onBookSelect) {
        this.container = document.querySelector(selector);
        this.onBookSelect = onBookSelect;
        this.books = [];
    }

    async init() {
        // Load books from localStorage or default list
        const storedBooks = localStorage.getItem('ePubViewer_library');
        if (storedBooks) {
            this.books = JSON.parse(storedBooks);
        }
        
        this.render();
    }

    addBook(book) {
        this.books.push(book);
        this.save();
        this.render();
    }

    removeBook(bookId) {
        this.books = this.books.filter(book => book.id !== bookId);
        this.save();
        this.render();
    }

    save() {
        localStorage.setItem('ePubViewer_library', JSON.stringify(this.books));
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = '';
        
        if (this.books.length === 0) {
            this.container.innerHTML = `
                <div class="empty">
                    <div class="app-name">BookReader</div>
                    <div class="message">
                        <p>Kitaplık boş. Kitap eklemek için dosya seçin.</p>
                    </div>
                </div>
            `;
            return;
        }

        this.books.forEach(book => {
            const bookEl = document.createElement('div');
            bookEl.className = 'book-item';
            bookEl.innerHTML = `
                <div class="book-cover">
                    ${book.cover ? `<img src="${book.cover}" alt="${book.title}">` : '<div class="placeholder">📚</div>'}
                </div>
                <div class="book-info">
                    <div class="book-title">${book.title}</div>
                    <div class="book-author">${book.author || ''}</div>
                </div>
            `;
            bookEl.addEventListener('click', () => this.onBookSelect(book));
            this.container.appendChild(bookEl);
        });
    }
}

// Export for use in script.js
if (typeof window !== 'undefined') {
    window.BookLibrary = BookLibrary;
}
