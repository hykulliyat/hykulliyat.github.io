// PDFToolbar - Simple PDF toolbar management for ePubViewer
class PDFToolbar {
    constructor(selector, pdfViewer) {
        this.container = document.querySelector(selector);
        this.pdfViewer = pdfViewer;
        this.visible = false;
    }

    show() {
        if (this.container) {
            this.container.classList.remove('hidden');
            this.visible = true;
        }
    }

    hide() {
        if (this.container) {
            this.container.classList.add('hidden');
            this.visible = false;
        }
    }

    setPdfFileName(fileName) {
        // Update toolbar with file name if needed
        if (this.container) {
            const titleEl = this.container.querySelector('.pdf-title');
            if (titleEl) {
                titleEl.textContent = fileName || '';
            }
        }
    }
}

// Export for use in script.js
if (typeof window !== 'undefined') {
    window.PDFToolbar = PDFToolbar;
}
