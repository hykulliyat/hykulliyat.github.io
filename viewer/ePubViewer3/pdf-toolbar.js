/**
 * PDF Toolbar Component
 * Modern ES6+ implementation with dropdown menus
 * Features: Zoom, Search, Print, Rotate controls
 * 
 * @author BookReader Team
 * @version 1.0.0
 */

class PDFToolbar {
  // Private fields
  #container = null;
  #pdfViewer = null;
  #isVisible = false;
  #searchResults = [];
  #currentResultIndex = -1;
  #pdfFileName = 'unknown';
  
  // CSS Selectors
  static SELECTORS = {
    CONTAINER: '#pdf-toolbar',
    ZOOM_DROPDOWN: '#zoom-dropdown',
    SEARCH_DROPDOWN: '#search-dropdown',
    TOOLS_DROPDOWN: '#tools-dropdown',
    ZOOM_LEVEL: '#zoom-level-display',
    SEARCH_INPUT: '#toolbar-search-input'
  };

  // Icons using Material Design
  static ICONS = {
    ZOOM_IN: 'zoom_in',
    ZOOM_OUT: 'zoom_out',
    FIT_WIDTH: 'fit_screen',
    RESET: 'refresh',
    SEARCH: 'search',
    CLEAR: 'clear',
    PRINT: 'print',
    ROTATE_LEFT: 'rotate_left',
    ROTATE_RIGHT: 'rotate_right',
    MORE: 'more_vert',
    ARROW_DOWN: 'keyboard_arrow_down'
  };

  /**
   * @param {string} containerSelector - CSS selector for toolbar container
   * @param {PdfViewer} pdfViewer - PDF viewer instance
   */
  constructor(containerSelector, pdfViewer) {
    this.#container = document.querySelector(containerSelector);
    this.#pdfViewer = pdfViewer;
    
    if (!this.#container) {
      throw new Error(`Toolbar container not found: ${containerSelector}`);
    }
    
    this.#init();
  }

  /**
   * Initialize toolbar
   * @private
   */
  #init() {
    this.#render();
    this.#attachEventListeners();
    this.#setupKeyboardShortcuts();
  }

  /**
   * Render toolbar HTML structure - Direct buttons (no dropdown)
   * @private
   */
  #render() {
    const template = `
      <div class="pdf-toolbar__row">
        <!-- Zoom Controls -->
        <button class="pdf-toolbar__btn" data-action="zoom-in" title="Yakınlaştır (+)">
          <span class="material-icons-outlined">zoom_in</span>
        </button>
        <button class="pdf-toolbar__btn" data-action="zoom-out" title="Uzaklaştır (-)">
          <span class="material-icons-outlined">zoom_out</span>
        </button>
        <button class="pdf-toolbar__btn" data-action="fit-width" title="Genişliğe Sığdır (W)">
          <span class="material-icons-outlined">fit_screen</span>
        </button>
        <button class="pdf-toolbar__btn" data-action="reset-zoom" title="Sıfırla (0)">
          <span class="material-icons-outlined">refresh</span>
        </button>
        
        <span class="pdf-toolbar__divider"></span>
        
        <!-- Search -->
        <input type="text" 
               id="toolbar-search-input" 
               class="pdf-toolbar__input"
               placeholder="Ara..."
               autocomplete="off">
        <button class="pdf-toolbar__btn" data-action="perform-search" title="Ara">
          <span class="material-icons-outlined">search</span>
        </button>
        <button class="pdf-toolbar__btn" data-action="toggle-results-panel" title="Sonuçları Göster/Gizle">
          <span class="material-icons-outlined">list</span>
        </button>
        <button class="pdf-toolbar__btn" data-action="prev-result" title="Önceki Sonuç (↑)" id="btn-prev-result" disabled>
          <span class="material-icons-outlined">keyboard_arrow_up</span>
        </button>
        <button class="pdf-toolbar__btn" data-action="next-result" title="Sonraki Sonuç (↓)" id="btn-next-result" disabled>
          <span class="material-icons-outlined">keyboard_arrow_down</span>
        </button>
        <span id="search-result-counter" class="pdf-toolbar__counter">0/0</span>
        
        <span class="pdf-toolbar__divider"></span>
        
        <!-- Tools -->
        <button class="pdf-toolbar__btn" data-action="print" title="Yazdır (Ctrl+P)">
          <span class="material-icons-outlined">print</span>
        </button>
        <button class="pdf-toolbar__btn" data-action="rotate-left" title="Sola Döndür (Shift+R)">
          <span class="material-icons-outlined">rotate_left</span>
        </button>
        <button class="pdf-toolbar__btn" data-action="rotate-right" title="Sağa Döndür (R)">
          <span class="material-icons-outlined">rotate_right</span>
        </button>
        
        <span class="pdf-toolbar__divider"></span>
        
        <!-- Zoom Level -->
        <span id="zoom-level-display" class="pdf-toolbar__zoom-text">100%</span>
      </div>
      
      <!-- Search Results Panel -->
      <div id="search-results-panel" class="pdf-toolbar__results-panel" style="display: none;">
        <div class="pdf-toolbar__results-header">
          <span>Arama Sonuçları</span>
          <button class="pdf-toolbar__close-btn" data-action="close-results-panel">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
        <div id="search-results-list" class="pdf-toolbar__results-list">
          <!-- Results will be inserted here -->
        </div>
      </div>
    `;

    this.#container.innerHTML = template;
    this.#container.classList.add('pdf-toolbar');
  }

  /**
   * Attach event listeners - Direct button clicks
   * @private
   */
  #attachEventListeners() {
    // All buttons with data-action
    this.#container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = btn.dataset.action;
        console.log('[PDFToolbar] Button clicked:', action);
        this.#handleAction(action);
      });
    });
    
    // Search input - handle Enter and stop all other key propagation
    const searchInput = this.#container.querySelector('#toolbar-search-input');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          this.#handleAction('perform-search');
        } else {
          // Stop propagation for all other keys to prevent shortcuts
          e.stopPropagation();
        }
      }, true); // Use capture phase
    }
  }

  /**
   * Setup keyboard shortcuts
   * @private
   */
  #setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!this.#isVisible) return;
      
      // Don't trigger shortcuts when typing in any input, textarea, or contenteditable
      const isTyping = e.target.tagName === 'INPUT' || 
                       e.target.tagName === 'TEXTAREA' || 
                       e.target.isContentEditable ||
                       e.target.closest('#toolbar-search-input');
      
      if (isTyping) {
        // Only handle Enter key for search
        if (e.key === 'Enter' && (e.target.id === 'toolbar-search-input' || e.target.closest('#toolbar-search-input'))) {
          e.preventDefault();
          this.#handleAction('perform-search');
        }
        return;
      }

      const shortcuts = {
        '+': () => this.#handleAction('zoom-in'),
        '=': () => this.#handleAction('zoom-in'),
        '-': () => this.#handleAction('zoom-out'),
        '_': () => this.#handleAction('zoom-out'),
        '0': () => this.#handleAction('reset-zoom'),
        'w': () => this.#handleAction('fit-width'),
        'W': () => this.#handleAction('fit-width'),
        'p': () => {
          if (e.ctrlKey) {
            e.preventDefault();
            this.#handleAction('print');
          }
        },
        'r': () => this.#handleAction('rotate-right'),
        'R': () => {
          if (e.shiftKey) {
            this.#handleAction('rotate-left');
          } else {
            this.#handleAction('rotate-right');
          }
        },
        'ArrowUp': () => this.#handleAction('prev-result'),
        'ArrowDown': () => this.#handleAction('next-result')
      };

      const handler = shortcuts[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    });
  }

  /**
   * Handle toolbar actions
   * @param {string} action - Action name
   * @private
   */
  #handleAction(action) {
    if (!this.#pdfViewer) {
      console.warn('PDF viewer not available');
      return;
    }

    const actions = {
      'zoom-in': () => {
        this.#pdfViewer.zoomIn();
        this.#updateZoomDisplay();
      },
      'zoom-out': () => {
        this.#pdfViewer.zoomOut();
        this.#updateZoomDisplay();
      },
      'fit-width': () => {
        this.#pdfViewer.fitToWidth();
        this.#updateZoomDisplay();
      },
      'reset-zoom': () => {
        this.#pdfViewer.resetZoom();
        this.#updateZoomDisplay();
      },
      'print': () => this.#pdfViewer.printPdf(),
      'rotate-left': () => this.#pdfViewer.rotateLeft(),
      'rotate-right': () => this.#pdfViewer.rotateRight(),
      'perform-search': () => this.#performSearch(),
      'clear-search': () => this.#clearSearch(),
      'prev-result': () => this.#navigateResult(-1),
      'next-result': () => this.#navigateResult(1),
      'toggle-results-panel': () => this.#toggleResultsPanel(),
      'close-results-panel': () => this.#hideResultsPanel()
    };

    const handler = actions[action];
    if (handler) {
      handler();
    } else {
      console.warn(`Unknown action: ${action}`);
    }
  }

  /**
   * Perform search
   * @private
   */
  async #performSearch() {
    const input = this.#container.querySelector(PDFToolbar.SELECTORS.SEARCH_INPUT);
    const query = input?.value?.trim();
    
    if (!query) return;

    try {
      // Flatten results for navigation
      const pageResults = await this.#pdfViewer.searchText(query);
      this.#searchResults = [];
      
      pageResults.forEach(pageResult => {
        pageResult.matches.forEach((match, idx) => {
          this.#searchResults.push({
            page: pageResult.page,
            matchIndex: idx,
            text: match.text,
            pageText: pageResult.pageText
          });
        });
      });
      
      this.#pdfViewer.highlightSearchResults(pageResults, query);
      
      if (this.#searchResults.length > 0) {
        this.#currentResultIndex = 0;
        this.#goToCurrentResult();
        this.#updateSearchCounter();
        this.#populateResultsPanel(query);
        this.#showResultsPanel();
      } else {
        this.#updateSearchCounter();
        this.#populateResultsPanel(query);
        this.#showResultsPanel();
      }
      
      // Log search results to TOML
      this.#logSearchToToml(query);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }

  /**
   * Log search results to TOML file via main process
   * @param {string} query - Search query
   * @private
   */
  async #logSearchToToml(query) {
    try {
      if (window.electronAPI && window.electronAPI.logSearchResults) {
        const logData = {
          query: query,
          timestamp: new Date().toISOString(),
          totalResults: this.#searchResults.length,
          pdfFile: this.#pdfFileName,
          results: this.#searchResults.map(r => ({
            page: r.page,
            text: r.text
          }))
        };
        
        const result = await window.electronAPI.logSearchResults(logData);
        if (result.success) {
          console.log('[PDFToolbar] Search results logged to:', result.filePath);
        } else {
          console.error('[PDFToolbar] Failed to log search results:', result.error);
        }
      }
    } catch (error) {
      console.error('[PDFToolbar] Error logging search results:', error);
    }
  }

  /**
   * Navigate to search result
   * @param {number} direction - -1 for previous, 1 for next
   * @private
   */
  #navigateResult(direction) {
    if (this.#searchResults.length === 0) return;
    
    this.#currentResultIndex += direction;
    
    // Wrap around
    if (this.#currentResultIndex < 0) {
      this.#currentResultIndex = this.#searchResults.length - 1;
    } else if (this.#currentResultIndex >= this.#searchResults.length) {
      this.#currentResultIndex = 0;
    }
    
    this.#goToCurrentResult();
    this.#updateSearchCounter();
  }

  /**
   * Go to current search result
   * @private
   */
  #goToCurrentResult() {
    if (this.#currentResultIndex < 0 || this.#currentResultIndex >= this.#searchResults.length) return;
    
    const result = this.#searchResults[this.#currentResultIndex];
    // Use scrollToSearchResult to scroll to the specific word, not just the page
    this.#pdfViewer.scrollToSearchResult(result.page, result.text);
  }

  /**
   * Update search counter display
   * @private
   */
  #updateSearchCounter() {
    const counter = this.#container.querySelector('#search-result-counter');
    const prevBtn = this.#container.querySelector('#btn-prev-result');
    const nextBtn = this.#container.querySelector('#btn-next-result');
    
    if (counter) {
      if (this.#searchResults.length === 0) {
        counter.textContent = '0/0';
      } else {
        counter.textContent = `${this.#currentResultIndex + 1}/${this.#searchResults.length}`;
      }
    }
    
    // Enable/disable buttons
    const hasResults = this.#searchResults.length > 0;
    if (prevBtn) prevBtn.disabled = !hasResults;
    if (nextBtn) nextBtn.disabled = !hasResults;
  }

  /**
   * Clear search
   * @private
   */
  #clearSearch() {
    const input = this.#container.querySelector(PDFToolbar.SELECTORS.SEARCH_INPUT);
    if (input) input.value = '';
    this.#searchResults = [];
    this.#currentResultIndex = -1;
    this.#updateSearchCounter();
    this.#pdfViewer.clearSearchHighlights();
    this.#hideResultsPanel();
  }

  /**
   * Show search results panel
   * @private
   */
  #showResultsPanel() {
    const panel = this.#container.querySelector('#search-results-panel');
    if (panel) {
      panel.style.display = 'block';
    }
  }

  /**
   * Hide search results panel
   * @private
   */
  #hideResultsPanel() {
    const panel = this.#container.querySelector('#search-results-panel');
    if (panel) {
      panel.style.display = 'none';
    }
  }

  /**
   * Toggle search results panel
   * @private
   */
  #toggleResultsPanel() {
    const panel = this.#container.querySelector('#search-results-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  }

  /**
   * Extract sentence containing the search match
   * @param {string} text - Full text
   * @param {string} match - Matched text
   * @param {number} matchIndex - Index of match in text
   * @returns {object} - Before text, match, after text
   * @private
   */
  #extractSentence(text, match, matchIndex) {
    // Sentence delimiters: . ! ? 。 । newline
    const delimiters = /[.!?。।\n]/;
    
    // Find start of sentence (look backwards from match)
    let sentenceStart = 0;
    for (let i = matchIndex - 1; i >= 0; i--) {
      if (delimiters.test(text[i])) {
        sentenceStart = i + 1;
        break;
      }
    }
    
    // Find end of sentence (look forwards from match end)
    let sentenceEnd = text.length;
    const matchEndIndex = matchIndex + match.length;
    for (let i = matchEndIndex; i < text.length; i++) {
      if (delimiters.test(text[i])) {
        sentenceEnd = i + 1;
        break;
      }
    }
    
    // Extract sentence parts
    const beforeMatch = text.substring(sentenceStart, matchIndex).trimStart();
    const afterMatch = text.substring(matchEndIndex, sentenceEnd).trimEnd();
    
    return { beforeMatch, afterMatch };
  }

  /**
   * Populate search results panel
   * @param {string} query - Search query
   * @private
   */
  #populateResultsPanel(query) {
    const list = this.#container.querySelector('#search-results-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (this.#searchResults.length === 0) {
      list.innerHTML = `<div class="pdf-toolbar__no-results">"${query}" için sonuç bulunamadı</div>`;
      return;
    }
    
    this.#searchResults.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'pdf-toolbar__result-item';
      item.dataset.index = index;
      
      // Find match position in page text
      const matchIndex = result.pageText.indexOf(result.text);
      
      // Extract full sentence containing the match
      const { beforeMatch, afterMatch } = this.#extractSentence(
        result.pageText, 
        result.text, 
        matchIndex
      );
      
      item.innerHTML = `
        <div class="pdf-toolbar__result-page">Sayfa ${result.page}</div>
        <div class="pdf-toolbar__result-text">
          <span class="pdf-toolbar__result-context">${beforeMatch}</span>
          <span class="pdf-toolbar__result-match">${result.text}</span>
          <span class="pdf-toolbar__result-context">${afterMatch}</span>
        </div>
      `;
      
      item.addEventListener('click', () => {
        this.#currentResultIndex = index;
        this.#goToCurrentResult();
        this.#updateSearchCounter();
        // Highlight active item
        list.querySelectorAll('.pdf-toolbar__result-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      });
      
      list.appendChild(item);
    });
  }

  /**
   * Update zoom level display
   * @private
   */
  #updateZoomDisplay() {
    const display = this.#container.querySelector(PDFToolbar.SELECTORS.ZOOM_LEVEL);
    if (display && this.#pdfViewer) {
      const scale = this.#pdfViewer.getScale?.() ?? 1.0;
      display.textContent = `${Math.round(scale * 100)}%`;
    }
  }

  /**
   * Show toolbar
   * @public
   */
  show() {
    console.log('[PDFToolbar] Showing toolbar, container:', this.#container);
    this.#container.hidden = false;
    this.#isVisible = true;
    console.log('[PDFToolbar] Toolbar visibility:', this.#isVisible);
    
    // Debug: Check if button exists
    const btn = this.#container.querySelector('.pdf-toolbar__dropdown-trigger');
    console.log('[PDFToolbar] Menu button found:', btn);
    
    this.#container.classList.add('pdf-toolbar--visible');
  }

  /**
   * Hide toolbar
   * @public
   */
  hide() {
    this.#container.hidden = true;
    this.#isVisible = false;
    this.#container.classList.remove('pdf-toolbar--visible');
  }

  /**
   * Check if toolbar is visible
   * @returns {boolean}
   * @public
   */
  get isVisible() {
    return this.#isVisible;
  }

  /**
   * Destroy toolbar and cleanup
   * @public
   */
  destroy() {
    this.#container.innerHTML = '';
    this.#container.classList.remove('pdf-toolbar');
  }

  /**
   * Set PDF file name for logging
   * @param {string} fileName - PDF file name
   * @public
   */
  setPdfFileName(fileName) {
    this.#pdfFileName = fileName || 'unknown';
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PDFToolbar };
}
