// EPUB Viewer - Clean Version
const Logger = {
  enabled: true,
  epubEnabled: true, // Set to true to enable EPUB logs
  log: function (...a) {
    if (!this.enabled || !this.epubEnabled) return;
    console.log("[ePub]", ...a);
  },
  warn: (...a) => console.warn("[ePub]", ...a),
  error: (...a) => console.error("[ePub]", ...a),
};
const DOM = {
  clear: (e) => e && (e.innerHTML = ""),
  setText: (e, t) => e && (e.textContent = t),
};
const Storage = {
  get: (k, d = "") => {
    try {
      return localStorage.getItem(k) || d;
    } catch {
      return d;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

class ErrorBoundary {
  static handle(context, error) {
    let safeError = error || new Error("Unknown");
    if (!safeError.message) safeError.message = String(error);
    Logger.error(context, safeError);
    const errorEl = document.querySelector(".app .error");
    if (errorEl) {
      errorEl.classList.remove("hidden");
      const titleEl = errorEl.querySelector(".error-title");
      const infoEl = errorEl.querySelector(".error-info");
      if (titleEl) titleEl.textContent = "Hata Olustu";
      if (infoEl) infoEl.textContent = `${context}: ${safeError.message}`;
    }
  }
}

window.onerror = (msg, url, line, col, err) => {
  ErrorBoundary.handle("Beklenmeyen hata", err || new Error(String(msg)));
  return true;
};

// Polyfill for ReadableStream async iterator (required for PDF.js v5.7.284)
if (
  typeof ReadableStream !== "undefined" &&
  ReadableStream.prototype[Symbol.asyncIterator] === undefined
) {
  ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}

class EpubViewer {
  #rootEl;
  #state;
  #domCache = new Map();
  constructor(el) {
    this.#rootEl = el;
    this.#state = {};
    this.#init();
  }
  static instance = null;
  #init() {
    setTimeout(() => {
      this.#setupEvents();
      this.applyTheme();
    }, 100);
  }
  #getEl(s) {
    if (!this.#domCache.has(s)) {
      const e = this.#rootEl.querySelector(s);
      if (e) this.#domCache.set(s, e);
      return e;
    }
    return this.#domCache.get(s);
  }
  #getEls(s) {
    return Array.from(this.#rootEl.querySelectorAll(s));
  }

  #setupEvents() {
    const openBtn = this.#getEl("button.open");
    const initOpenBtn = this.#getEl("#init-open-book");
    Logger.log("Buttons:", { open: !!openBtn, initOpen: !!initOpenBtn });
    // Note: prev/next navigation is now handled by BookReaderApp for both EPUB and PDF
    openBtn?.addEventListener("click", () => this.doOpenBook());
    initOpenBtn?.addEventListener("click", () => this.doOpenBook());

    // Keyboard navigation - body level like original
    document.body.addEventListener("keyup", (e) => this.onKeyUp(e));

    // Tab switching
    this.#getEls(".tab-list .item").forEach((el) => {
      el.addEventListener("click", () => this.doTab(el.dataset.tab));
    });

    // Close sidebar when clicking outside (on wrapper) - like original
    const sidebarWrapper = this.#getEl(".sidebar-wrapper");
    if (sidebarWrapper) {
      sidebarWrapper.addEventListener("click", (event) => {
        if (event.target.classList.contains("sidebar-wrapper")) {
          sidebarWrapper.classList.add("out");
        }
      });
    }

    // Search
    const searchBox = this.#getEl(".sidebar .search-bar .search-box");
    const searchBtn = this.#getEl(".sidebar .search-bar .search-button");

    if (searchBox) {
      // Fix for Turkish characters - use composition events
      let isComposing = false;

      searchBox.addEventListener("compositionstart", () => {
        isComposing = true;
        Logger.log("Composition started");
      });

      searchBox.addEventListener("compositionend", (e) => {
        isComposing = false;
        Logger.log("Composition ended, data:", e.data);
      });

      // Use keyCode 13 like original code for Enter key
      searchBox.addEventListener("keydown", (e) => {
        Logger.log(
          "Search box keydown:",
          e.keyCode,
          "key:",
          e.key,
          "isComposing:",
          isComposing,
        );
        if (e.keyCode === 13 && !isComposing) {
          e.preventDefault();
          this.onSearchClick();
        }
      });

      // Log input changes for debugging Turkish characters
      searchBox.addEventListener("input", (e) => {
        Logger.log(
          "Search box input value:",
          searchBox.value,
          "isComposing:",
          e.isComposing,
        );
      });
    }

    searchBtn?.addEventListener("click", () => this.onSearchClick());

    // Location prompt
    const locEl = this.#getEl(".bar .loc");
    if (locEl) {
      locEl.style.cursor = "pointer";
      locEl.addEventListener("click", () => this.onLocationClick());
    }

    // Chip clicks - bind this correctly
    this.#getEls(".chips[data-chips]").forEach((el) => {
      el.querySelectorAll(".chip[data-value]").forEach((cel) => {
        cel.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.setChipActive(el.dataset.chips, cel.dataset.value);
        });
      });
    });

    // Load settings
    this.loadSettingsFromStorage();

    // Initial tab - TOC like original
    this.doTab("toc");
  }

  onKeyUp(event) {
    const kc = event.keyCode || event.which;
    let b = null;
    if (kc === 37) {
      // ArrowLeft
      if (this.#state.rendition) {
        this.#state.rendition.prev();
        b = this.#getEl(".bar button.prev");
      }
    } else if (kc === 39) {
      // ArrowRight
      if (this.#state.rendition) {
        this.#state.rendition.next();
        b = this.#getEl(".bar button.next");
      }
    }
    // Visual feedback like original
    if (b) {
      b.style.transform = "scale(1.15)";
      setTimeout(() => {
        b.style.transform = "";
      }, 100);
    }
  }

  doSearch(q) {
    if (!this.#state.book?.spine?.spineItems) {
      return Promise.reject(new Error("Book not loaded"));
    }

    Logger.log("doSearch:", q);

    return Promise.all(
      this.#state.book.spine.spineItems.map((item) => {
        return item
          .load(this.#state.book.load.bind(this.#state.book))
          .then((doc) => {
            let results = item.find(q);
            item.unload();
            return Promise.resolve(results);
          });
      }),
    ).then((results) => Promise.resolve([].concat.apply([], results)));
  }

  onResultClick(href, event) {
    Logger.log("Search result clicked:", href);
    if (this.#state.rendition) {
      this.#state.rendition.display(href);
    }
    event.stopPropagation();
    event.preventDefault();
  }

  onSearchClick() {
    const query = this.#getEl(
      ".sidebar .search-bar .search-box",
    )?.value?.trim();
    if (!query) return;

    Logger.log("onSearchClick, query:", query);

    this.doSearch(query)
      .then((results) => {
        Logger.log("Search results:", results.length);

        const resultsContainer = this.#getEl(".sidebar .search-results");
        if (!resultsContainer) return;

        resultsContainer.innerHTML = "";

        if (results.length === 0) {
          resultsContainer.innerHTML =
            "<div class='item'>Sonuç bulunamadı</div>";
          return;
        }

        let resultsEl = document.createDocumentFragment();
        results.slice(0, 200).forEach((result) => {
          let resultEl = document.createElement("a");
          resultEl.className = "item";
          resultEl.href = result.cfi;
          resultEl.addEventListener("click", (e) =>
            this.onResultClick(result.cfi, e),
          );

          let textEl = document.createElement("div");
          textEl.className = "text";
          textEl.innerText = result.excerpt.trim();
          resultEl.appendChild(textEl);

          let pbar = document.createElement("div");
          pbar.className = "pbar";
          let pbarInner = document.createElement("div");
          pbarInner.className = "pbar-inner";
          if (this.#state.book?.locations?.percentageFromCfi) {
            pbarInner.style.width =
              (
                this.#state.book.locations.percentageFromCfi(result.cfi) * 100
              ).toFixed(3) + "%";
          }
          pbar.appendChild(pbarInner);
          resultEl.appendChild(pbar);

          resultsEl.appendChild(resultEl);
        });

        resultsContainer.appendChild(resultsEl);
      })
      .catch((err) => {
        Logger.error("Search error:", err);
        ErrorBoundary.handle("Arama hatasi", err);
      });
  }

  onLocationClick() {
    try {
      const total = this.#state.book?.locations?.length() || 0;
      const current =
        this.#state.rendition?.currentLocation?.()?.start?.location || 0;
      const answer = prompt(`Konuma git (1-${total})?`, current);
      if (!answer) return;
      answer = answer.trim();
      if (answer === "") return;

      const parsed = parseInt(answer, 10);
      if (isNaN(parsed) || parsed < 1) throw new Error("Gecersiz konum");
      if (parsed > total) throw new Error("Konum cok buyuk");

      const cfi = this.#state.book.locations.cfiFromLocation(parsed);
      if (cfi === -1) throw new Error("Gecersiz konum");

      this.#state.rendition.display(cfi);
    } catch (err) {
      alert(err.toString());
    }
  }

  updatePageIndicator(event) {
    const locEl =
      document.getElementById("reader-loc") ||
      this.#getEl(".reader-nav-bar .loc") ||
      this.#getEl(".bar .loc");
    if (!locEl) {
      Logger.warn("Loc element not found");
      return;
    }

    const total = this.#state.book?.locations?.length() || 0;
    let current = event?.start?.location || 0;

    // If location is 0 but we have locations generated, calculate from CFI
    if (current === 0 && total > 0 && event?.start?.cfi) {
      try {
        current =
          this.#state.book.locations.locationFromCfi(event.start.cfi) || 0;
        Logger.log("Location calculated from CFI:", {
          cfi: event.start.cfi,
          current,
        });
      } catch (err) {
        Logger.warn("Failed to calculate location from CFI:", err);
      }
    }

    Logger.log("Page indicator update:", {
      total,
      current,
      eventLocation: event?.start?.location,
      cfi: event?.start?.cfi?.substring(0, 30),
    });

    if (total > 0 && current > 0) {
      locEl.textContent = `Sayfa ${current} / ${total}`;
      Logger.log("Page indicator set to:", locEl.textContent);
    } else if (total > 0) {
      locEl.textContent = `Sayfa 1 / ${total}`;
      Logger.log("Page indicator default to 1");
    } else {
      locEl.textContent = "Sayfa yukleniyor...";
    }
  }

  loadSettingsFromStorage() {
    const chips = [
      "theme",
      "font",
      "font-size",
      "line-spacing",
      "margin",
      "progress",
    ];
    chips.forEach((chip) => {
      const saved = Storage.get(chip);
      if (saved) this.setChipActive(chip, saved);
    });
  }

  getChipActive(container) {
    const chipContainer = this.#getEl(`.chips[data-chips='${container}']`);
    if (!chipContainer) return "";
    const active = chipContainer.querySelector(".chip.active[data-value]");
    if (active) return active.dataset.value ?? "";
    const defaultChip = chipContainer.querySelector(".chip[data-default]");
    if (defaultChip) return defaultChip.dataset.value ?? "";
    const firstChip = chipContainer.querySelector(".chip[data-value]");
    return firstChip ? (firstChip.dataset.value ?? "") : "";
  }

  setChipActive(container, value) {
    const chipContainer = this.#getEl(`.chips[data-chips='${container}']`);
    if (!chipContainer) return;
    chipContainer.querySelectorAll(".chip[data-value]").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.value === value);
    });
    Storage.set(container, value);
    this.applyTheme();
    Logger.log(`Chip ${container} set to:`, value);
  }

  applyTheme() {
    const theme = {
      bg: this.getChipActive("theme").split(";")[0] ?? "#fff",
      fg: this.getChipActive("theme").split(";")[1] ?? "#000",
      ff: this.getChipActive("font"),
      fs: this.getChipActive("font-size"),
      lh: this.getChipActive("line-spacing"),
    };
    this.#rootEl.style.background = theme.bg;
    const contents = this.#state.rendition?.getContents?.();
    if (!contents) return;
    contents.forEach((content) => {
      try {
        const doc = content.document;
        if (!doc) return;
        let style = doc.getElementById("epubviewer-theme");
        if (style) style.remove();
        style = doc.createElement("style");
        style.id = "epubviewer-theme";
        style.textContent = `body { background: ${theme.bg} !important; color: ${theme.fg} !important; ${theme.ff ? `font-family: ${theme.ff} !important;` : ""} ${theme.fs ? `font-size: ${theme.fs} !important;` : ""} line-height: ${theme.lh} !important; }`;
        doc.head?.appendChild(style);
      } catch (e) {}
    });

    this.#state.rendition?.on("rendered", (section) => {
      try {
        const doc = section.document;
        if (!doc) return;
        let style = doc.getElementById("epubviewer-theme");
        if (style) style.remove();
        style = doc.createElement("style");
        style.id = "epubviewer-theme";
        style.textContent = `body { background: ${theme.bg} !important; color: ${theme.fg} !important; ${theme.ff ? `font-family: ${theme.ff} !important;` : ""} ${theme.fs ? `font-size: ${theme.fs} !important;` : ""} line-height: ${theme.lh} !important; }`;
        doc.head?.appendChild(style);
      } catch (e) {}
    });
  }

  fixDoubleLSpacing(contents) {
    try {
      const doc = contents.document;
      if (!doc) return;

      // Walk through all text nodes and fix "l l" -> "ll"
      const walker = doc.createTreeWalker(
        doc.body,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );
      const nodesToFix = [];

      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.includes("l l")) {
          nodesToFix.push(node);
        }
      }

      nodesToFix.forEach((textNode) => {
        const originalText = textNode.textContent;
        const fixedText = originalText.replace(/l\s+l/g, "ll");
        if (fixedText !== originalText) {
          textNode.textContent = fixedText;
          Logger.log("Fixed double-l spacing:", originalText, "->", fixedText);
        }
      });
    } catch (e) {
      Logger.warn("Error fixing double-l spacing:", e);
    }
  }

  async doBook(url, opts = { encoding: "epub" }) {
    if (typeof ePub !== "function") {
      ErrorBoundary.handle(
        "Kutuphane hatasi",
        new Error("ePub.js yuklenemedi"),
      );
      return;
    }
    Logger.log("Loading book", opts);
    const bookEl =
      document.getElementById("epub-container") || this.#getEl(".book");
    DOM.setText(bookEl, "Yukleniyor...");
    this.doReset();

    try {
      if (ePub.Path) {
        const orig = ePub.Path;
        ePub.Path = function (p) {
          if (!p || typeof p !== "string") p = "";
          return new orig(p);
        };
        ePub.Path.prototype = orig.prototype;
      }
      this.#state.book = ePub(url, opts);

      // Load navigation (TOC), metadata, and cover like original
      this.#state.book.loaded.navigation
        .then((nav) => {
          Logger.log("Navigation loaded", nav);
          this.onNavigationLoaded(nav);
        })
        .catch((err) => Logger.warn("Error loading TOC:", err));

      this.#state.book.loaded.metadata
        .then((metadata) => {
          Logger.log("Metadata loaded", metadata);
          this.onBookMetadataLoaded(metadata);
        })
        .catch((err) => Logger.warn("Error loading metadata:", err));

      this.#state.book.loaded.cover
        .then((url) => {
          Logger.log("Cover loaded", url);
          this.onBookCoverLoaded(url);
        })
        .catch((err) => Logger.warn("Error loading cover:", err));

      await this.#state.book.ready;
      try {
        Logger.log("Book ready");
        Logger.log("Book archive:", this.#state.book.archive);
        Logger.log("Book resources:", this.#state.book.resources);
        Logger.log("Spine items:", this.#state.book.spine?.spineItems?.length);

        const hasSpine = this.#state.book.spine?.spineItems?.length > 0;
        if (!hasSpine) {
          ErrorBoundary.handle("EPUB hatasi", new Error("Spine bulunamadi"));
          return;
        }

        // Find first section with valid href (skip broken ones like cover without manifest entry)
        // Also skip nav.xhtml since it's navigation, not content
        let firstValidSection = null;
        for (let i = 0; i < this.#state.book.spine.spineItems.length; i++) {
          const s = this.#state.book.spine.spineItems[i];
          if (s.href && s.linear !== false) {
            // Skip nav and cover files - they are not readable content
            const hrefLower = s.href.toLowerCase();
            if (
              hrefLower.includes("nav.") ||
              hrefLower.includes("toc.") ||
              hrefLower === "nav.xhtml"
            ) {
              continue;
            }
            firstValidSection = s;
            Logger.log("First valid section at index:", i, "href:", s.href);
            break;
          }
        }

        if (!firstValidSection) {
          // Fallback: use any section with valid href
          for (let i = 0; i < this.#state.book.spine.spineItems.length; i++) {
            const s = this.#state.book.spine.spineItems[i];
            if (s.href) {
              firstValidSection = s;
              Logger.log("Fallback section at index:", i, "href:", s.href);
              break;
            }
          }
        }

        if (!firstValidSection) {
          ErrorBoundary.handle(
            "EPUB hatasi",
            new Error("Gecerli bolum bulunamadi"),
          );
          return;
        }

        // Generate page locations
        this.generateLocations(1600);

        DOM.clear(bookEl);
        Logger.log("Creating rendition...");
        Logger.log(
          "bookEl tag:",
          bookEl?.tagName,
          "id:",
          bookEl?.id,
          "innerHTML length:",
          bookEl?.innerHTML?.length,
        );
        try {
          this.#state.rendition = this.#state.book.renderTo(bookEl, {
            width: "100%",
            height: "100%",
          });
          Logger.log("renderTo returned:", !!this.#state.rendition);
          Logger.log(
            "bookEl innerHTML after renderTo:",
            bookEl?.innerHTML?.substring(0, 200),
          );
        } catch (renderErr) {
          Logger.error("renderTo error:", renderErr);
        }

        // Add error handler for display
        this.#state.rendition.on("displayError", (err) => {
          Logger.error("Rendition display error:", err);
          ErrorBoundary.handle("Goruntuleme hatasi", err);
        });

        this.#state.rendition.hooks.content.register((contents) => {
          this.applyTheme();
          this.fixDoubleLSpacing(contents);
        });

        // Keyboard navigation inside iframe
        this.#state.rendition.on("rendered", (section, view) => {
          Logger.log("Rendered event, section:", section?.href);
          try {
            const iframe =
              view?.iframe || view?.document?.defaultView?.frameElement;
            if (iframe && iframe.contentWindow) {
              const iframeDoc = iframe.contentWindow.document;
              if (iframeDoc) {
                iframeDoc.addEventListener("keydown", (e) => {
                  Logger.log("[iFrame keydown] key:", e.key);
                  switch (e.key) {
                    case "ArrowLeft":
                    case "PageUp":
                      this.#state.rendition.prev();
                      e.preventDefault();
                      break;
                    case "ArrowRight":
                    case " ":
                    case "PageDown":
                      this.#state.rendition.next();
                      e.preventDefault();
                      break;
                  }
                });
              }
            }
          } catch (err) {
            Logger.warn("iframe keyboard listener error:", err);
          }
        });

        // Update page indicator on page change
        this.#state.rendition.on("relocated", (location) => {
          Logger.log("Relocated event:", location);
          this.updatePageIndicator(location);

          // Update TOC active state like original
          if (location?.start?.href) {
            this.#getEls(".toc-list .item").forEach((el) => {
              el.classList.toggle(
                "active",
                el.dataset.href === location.start.href,
              );
            });
          }
        });

        // Keyboard navigation inside book
        this.#state.rendition.on("keyup", (e) => this.onKeyUp(e));

        // Close sidebar when clicking on book content - like original
        this.#state.rendition.on("click", () => {
          const sidebarWrapper = this.#getEl(".sidebar-wrapper");
          if (sidebarWrapper && !sidebarWrapper.classList.contains("out")) {
            sidebarWrapper.classList.add("out");
          }
        });

        this.#state.rendition
          .display(firstValidSection.href)
          .then(() => {
            Logger.log("Displayed from section:", firstValidSection?.href);
            this.onBookReady();
            this.applyTheme();
            const currentLoc = this.#state.rendition?.currentLocation?.();
            if (currentLoc) {
              this.updatePageIndicator(currentLoc);
            }
          })
          .catch((err) => {
            Logger.error("Display error:", err);
            // Try displaying from firstValidSection index as fallback
            const fallbackIndex = firstValidSection?.index || 2;
            Logger.log("Trying fallback display at index:", fallbackIndex);
            this.#state.rendition
              .display(fallbackIndex)
              .then(() => {
                Logger.log("Fallback display worked at index:", fallbackIndex);
                this.onBookReady();
                this.applyTheme();
              })
              .catch((err2) => {
                Logger.error("Fallback display also failed:", err2);
                ErrorBoundary.handle("Sayfa goruntulenirken hata", err2);
              });
          });
      } catch (err) {
        ErrorBoundary.handle("Kitap yuklenirken hata", err);
      }
    } catch (err) {
      ErrorBoundary.handle("doBook hatasi", err);
    }
  }

  generateLocations(chars = 1600) {
    if (!this.#state.book?.locations) return;
    if (this.#state.book.locations.length() > 0) {
      Logger.log(
        "Locations already generated:",
        this.#state.book.locations.length(),
      );
      return;
    }

    // Try to load from storage
    const saved = Storage.get(this.#state.book.key() + "_locations");
    if (saved) {
      try {
        this.#state.book.locations.load(saved);
        const count = this.#state.book.locations.length();
        Logger.log("Locations loaded from storage:", count);
        // Force update page indicator with current position
        const currentLoc = this.#state.rendition?.currentLocation?.();
        if (currentLoc) {
          this.updatePageIndicator(currentLoc);
        }
        return;
      } catch (err) {
        Logger.warn("Failed to load saved locations:", err);
      }
    }

    // Generate new locations
    Logger.log("Generating locations...");

    // Filter out sections with undefined href before generating
    const spineItems = this.#state.book.spine?.spineItems || [];
    const validItems = spineItems.filter((s) => s.href);
    Logger.log(
      `Spine items: ${spineItems.length}, valid: ${validItems.length}`,
    );

    if (validItems.length === 0) {
      Logger.warn("No valid spine items for location generation");
      return;
    }

    this.#state.book.locations
      .generate(chars)
      .then(() => {
        const count = this.#state.book.locations.length();
        Logger.log("Locations generated:", count);
        // Update page indicator with current position after generation
        const currentLoc = this.#state.rendition?.currentLocation?.();
        if (currentLoc) {
          this.updatePageIndicator(currentLoc);
        }
        try {
          Storage.set(
            this.#state.book.key() + "_locations",
            this.#state.book.locations.save(),
          );
        } catch (err) {}
      })
      .catch((err) => {
        Logger.warn("Could not generate locations:", err);
        // Try to generate with a higher chars value to skip problematic sections
        Logger.log("Retrying location generation with higher chars value...");
        this.#state.book.locations.generate(chars * 2).catch((err2) => {
          Logger.warn("Location generation failed again:", err2);
        });
      });
  }

  doReset() {
    this.#domCache.clear();

    // Hide navigation buttons like original
    const sidebarBtn = this.#getEl(".sidebar-button");
    const prevBtn = this.#getEl(".bar button.prev");
    const nextBtn = this.#getEl(".bar button.next");
    sidebarBtn?.classList.add("hidden");
    prevBtn?.classList.add("hidden");
    nextBtn?.classList.add("hidden");

    // Clear book info like original
    DOM.setText(this.#getEl(".bar .book-title"), "");
    DOM.setText(this.#getEl(".bar .book-author"), "");
    DOM.setText(this.#getEl(".bar .loc"), "");
    this.#getEl(".sidebar .search-results") &&
      (this.#getEl(".sidebar .search-results").innerHTML = "");
    const searchBox = this.#getEl(".sidebar .search-box");
    if (searchBox) searchBox.value = "";
    const tocList = this.#getEl(".toc-list");
    if (tocList) tocList.innerHTML = "";
    const cover = this.#getEl(".info .cover");
    if (cover) cover.src = "";
    DOM.setText(this.#getEl(".info .title"), "");
    DOM.setText(this.#getEl(".info .author"), "");
    DOM.setText(this.#getEl(".info .description"), "");

    // Cleanup EPUB - destroy() handles all event cleanup
    if (this.#state.rendition) {
      try {
        this.#state.rendition.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
      this.#state.rendition = null;
    }
    if (this.#state.book) {
      try {
        this.#state.book.destroy && this.#state.book.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
      this.#state.book = null;
    }
  }

  onNavigationLoaded(nav) {
    Logger.log("onNavigationLoaded", nav);
    const tocList = this.#getEl(".toc-list");
    if (!tocList) return;

    tocList.innerHTML = "";

    const handleItems = (items, indent) => {
      items.forEach((item) => {
        const a = document.createElement("a");
        a.className = "item";
        a.href = item.href;
        a.dataset.href = item.href;
        a.innerHTML = `${"&nbsp;".repeat(indent * 4)}${item.label.trim()}`;
        a.addEventListener("click", (e) => this.onTocItemClick(item.href, e));
        tocList.appendChild(a);

        // Handle subitems recursively
        if (item.subitems && item.subitems.length > 0) {
          handleItems(item.subitems, indent + 1);
        }
      });
    };

    handleItems(nav.toc, 0);
  }

  onTocItemClick(href, event) {
    event.preventDefault();
    event.stopPropagation();
    Logger.log("TOC item clicked:", href);
    if (this.#state.rendition) {
      this.#state.rendition.display(href);
    }
    // Update active state
    this.#getEls(".toc-list .item").forEach((el) => {
      el.classList.toggle("active", el.dataset.href === href);
    });
  }

  onBookMetadataLoaded(metadata) {
    Logger.log("onBookMetadataLoaded", metadata);

    // Update bar title and author
    DOM.setText(this.#getEl(".bar .book-title"), metadata.title?.trim() || "");
    DOM.setText(
      this.#getEl(".bar .book-author"),
      metadata.creator?.trim() || "",
    );

    // Update info section
    DOM.setText(this.#getEl(".info .title"), metadata.title?.trim() || "");
    DOM.setText(this.#getEl(".info .author"), metadata.creator?.trim() || "");

    // Series info
    const seriesInfo = this.#getEl(".info .series-info");
    if (seriesInfo) {
      if (metadata.series && metadata.series.trim() !== "") {
        seriesInfo.classList.remove("hidden");
        DOM.setText(this.#getEl(".info .series-name"), metadata.series.trim());
        DOM.setText(
          this.#getEl(".info .series-index"),
          metadata.seriesIndex?.trim() || "",
        );
      } else {
        seriesInfo.classList.add("hidden");
      }
    }

    // Description
    const descEl = this.#getEl(".info .description");
    if (descEl && metadata.description) {
      descEl.innerHTML = metadata.description;
    }
  }

  onBookCoverLoaded(url) {
    Logger.log("onBookCoverLoaded", url);
    if (!url) return;

    const cover = this.#getEl(".info .cover");
    if (!cover) return;

    if (!this.#state.book?.archived) {
      cover.src = url;
      return;
    }

    // For archived books, create blob URL
    this.#state.book.archive
      .createUrl(url)
      .then((blobUrl) => {
        cover.src = blobUrl;
      })
      .catch((err) => {
        Logger.warn("Error creating cover URL:", err);
      });
  }

  onBookReady() {
    Logger.log("Book ready - showing navigation buttons");

    // Show navigation buttons like original
    const sidebarBtn = this.#getEl(".sidebar-button");
    const prevBtn = this.#getEl(".bar button.prev");
    const nextBtn = this.#getEl(".bar button.next");

    Logger.log("Buttons found:", {
      sidebar: !!sidebarBtn,
      prev: !!prevBtn,
      next: !!nextBtn,
    });

    sidebarBtn?.classList.remove("hidden");
    prevBtn?.classList.remove("hidden");
    nextBtn?.classList.remove("hidden");

    // Store book key for localStorage
    const bookKey = this.#state.book?.key();
    Logger.log("Book key:", bookKey);
  }

  async doOpenBook() {
    if (window.electronAPI?.isElectron) {
      try {
        const filePaths = await window.electronAPI.openBookDialog();
        if (!filePaths || filePaths.length === 0) return;

        const filePath = filePaths[0];
        const fileName = filePath.split(/[\\/]/).pop();
        const ext = fileName.toLowerCase().split(".").pop();

        const arrayBuffer = await window.electronAPI.readFile(filePath);

        if (ext === "pdf") {
          if (window.bookReaderApp) {
            await window.bookReaderApp.loadBookFromBuffer(
              arrayBuffer,
              fileName,
              "pdf",
            );
          }
        } else if (ext === "epub") {
          await this.doBook(arrayBuffer, {
            encoding: "binary",
            name: fileName,
          });
        } else {
          ErrorBoundary.handle(
            "Gecersiz dosya",
            new Error("Desteklenmeyen format: " + ext),
          );
        }
      } catch (err) {
        console.error("[doOpenBook] Error:", err);
        ErrorBoundary.handle("Dosya acma hatasi", err);
      }
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".epub,application/epub+zip";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const buffer = await file.arrayBuffer();
        await this.doBook(buffer, { encoding: "binary", name: file.name });
      };
      input.click();
    }
  }

  doTab(tabName) {
    // Tab list items - active class
    this.#getEls(".tab-list .item").forEach((el) => {
      el.classList.toggle("active", el.dataset.tab === tabName);
    });
    // Tab containers - hidden class (like original)
    this.#getEls(".tab-container .tab").forEach((el) => {
      el.classList.toggle("hidden", el.dataset.tab !== tabName);
    });
    // Scroll to top like original
    const tabContainer = this.#getEl(".tab-container");
    if (tabContainer) tabContainer.scrollTop = 0;
  }

  doSidebar() {
    const wrapper = this.#getEl(".sidebar-wrapper");
    if (wrapper) {
      wrapper.classList.toggle("out");
      Logger.log("Sidebar toggled, out:", wrapper.classList.contains("out"));
    }
  }

  doFullscreen() {
    if (!document.fullscreenElement)
      document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  }

  // Public accessor for rendition (used by BookReaderApp)
  getRendition() {
    return this.#state?.rendition;
  }

  // Public accessor for book (used for position saving)
  getBook() {
    return this.#state?.book;
  }
}

// ============================================
// PDF Viewer Class
// ============================================

class PdfViewer {
  #container = null;
  #pdf = null;
  #currentPage = 1;
  #totalPages = 0;
  #scale = 1.0;
  #rotation = 0;
  #bookId = null;
  #onPositionChange = null;
  #pagesRendered = new Set();

  constructor(containerSelector, onPositionChange) {
    this.#container = document.querySelector(containerSelector);
    this.#onPositionChange = onPositionChange;
  }

  async loadBook(buffer, bookId, startPage = 1) {
    // Prevent duplicate loads
    if (this.#bookId === bookId && this.#pdf) {
      return;
    }

    // Complete reset to prevent previous PDF contamination
    this.#pdf = null;
    this.#totalPages = 0;
    this.#currentPage = 1;
    this.#pagesRendered.clear();

    // Clear UI immediately to prevent previous PDF showing
    if (this.#onPositionChange) {
      this.#onPositionChange({ page: 1, totalPages: 0 });
    }

    try {
      this.#bookId = bookId;
      this.#currentPage = startPage;

      // Use correct path - go up from src/renderer/ to app root, then to libs/
      const baseUrl = window.location.href.replace(/\/[^\/]*$/, ""); // Remove filename
      const rendererUrl = baseUrl.replace(/\/[^\/]*$/, ""); // Go up from renderer/
      const srcUrl = rendererUrl.replace(/\/[^\/]*$/, ""); // Go up from src/
      const workerUrl = srcUrl + "/libs/pdf.worker.mjs";
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      console.log("[PDFViewer] PDF worker path:", workerUrl);

      // Load PDF document
      const loadingTask = window.pdfjsLib.getDocument({ data: buffer });
      this.#pdf = await loadingTask.promise;
      this.#totalPages = this.#pdf.numPages;

      // Clear container
      this.#container.innerHTML =
        '<div class="pdf-loading">PDF yükleniyor...</div>';
      this.#pagesRendered.clear();

      // Setup container
      this.#container.innerHTML = "";
      this.#container.classList.add("pdf-container");

      // Create pages container
      const pagesWrapper = document.createElement("div");
      pagesWrapper.className = "pdf-pages-wrapper";
      pagesWrapper.style.cssText =
        "display: flex; flex-direction: column; align-items: center; gap: 20px; width: 100%;";
      this.#container.appendChild(pagesWrapper);

      // Render all pages (lazy rendering would be better but this is simpler)
      const pageContainers = [];
      for (let i = 1; i <= this.#totalPages; i++) {
        const pageContainer = document.createElement("div");
        pageContainer.className = "pdf-page-container";
        pageContainer.dataset.page = i;
        pageContainer.style.cssText =
          "min-height: 500px; display: flex; justify-content: center; width: 100%;";
        pagesWrapper.appendChild(pageContainer);
        pageContainers.push(pageContainer);
      }

      // Setup scroll handler for lazy rendering
      this.#container.addEventListener("scroll", () => this.#handleScroll());

      // Render all pages immediately (not lazy) for better reliability
      for (let i = 0; i < pageContainers.length; i++) {
        const pageNum = i + 1;
        const container = pageContainers[i];
        this.#pagesRendered.add(pageNum);
        await this.#renderPage(pageNum, container);
      }

      // Scroll to start page (last read position)
      this.#currentPage = startPage;
      if (startPage > 1) {
        // Scroll to the specific page container
        const targetContainer = pageContainers[startPage - 1];
        if (targetContainer) {
          targetContainer.scrollIntoView({
            behavior: "instant",
            block: "start",
          });
          console.log("[PDFViewer] Scrolled to page:", startPage);
        }
      } else {
        this.#container.scrollTop = 0;
      }

      // Notify position change
      if (this.#onPositionChange) {
        this.#onPositionChange({
          page: startPage,
          totalPages: this.#totalPages,
        });
      }

      return {
        title: "",
        author: "",
        totalPages: this.#totalPages,
      };
    } catch (err) {
      console.error("[PDF] Error details:", err.message);
      console.error("[PDF] Error stack:", err.stack);
      this.#container.innerHTML = `<div style="color: red; padding: 20px;">PDF yüklenemedi: ${err.message}</div>`;
    }
  }

  async #handleScroll() {
    await this.#renderVisiblePages();
    this.#updateCurrentPageFromScroll();
  }

  #updateCurrentPageFromScroll() {
    const containers = this.#container.querySelectorAll(".pdf-page-container");
    const containerRect = this.#container.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;

    let closestPage = 1;
    let closestDistance = Infinity;

    containers.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - containerCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = parseInt(el.dataset.page);
      }
    });

    if (closestPage !== this.#currentPage) {
      this.#currentPage = closestPage;
      if (this.#onPositionChange) {
        this.#onPositionChange({
          page: this.#currentPage,
          totalPages: this.#totalPages,
        });
      }
    }
  }

  async #renderVisiblePages() {
    const containers = this.#container.querySelectorAll(".pdf-page-container");
    const containerRect = this.#container.getBoundingClientRect();

    // Use for...of instead of forEach to handle async properly
    for (const el of containers) {
      const pageNum = parseInt(el.dataset.page);
      const rect = el.getBoundingClientRect();

      // Check if page is visible (with buffer)
      const isVisible =
        rect.top < containerRect.bottom + 500 &&
        rect.bottom > containerRect.top - 500;

      if (isVisible && !this.#pagesRendered.has(pageNum)) {
        this.#pagesRendered.add(pageNum);
        await this.#renderPage(pageNum, el);
      }
    }
  }

  async #renderPage(pageNum, container) {
    try {
      const page = await this.#pdf.getPage(pageNum);
      const viewport = page.getViewport({
        scale: this.#scale,
        rotation: this.#rotation,
      });

      // Wrapper for canvas and text layer
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position: relative; display: inline-block;";

      const canvas = document.createElement("canvas");
      canvas.className = "pdf-page";
      canvas.style.backgroundColor = "white"; // Ensure white background
      canvas.style.display = "block"; // Ensure visible
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      container.innerHTML = "";
      container.style.cssText = `height: ${viewport.height}px; width: 100%; display: flex; justify-content: center; position: relative;`;
      wrapper.appendChild(canvas);
      container.appendChild(wrapper);

      // Render page
      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;

      // Add text layer for text selection (non-blocking)
      this.#renderTextLayer(page, viewport, wrapper).catch((err) => {
        console.warn(
          `[PDF] Text layer failed for page ${pageNum}:`,
          err.message,
        );
      });

      page.cleanup();
    } catch (err) {
      console.error("Error rendering page", pageNum, err);
      container.innerHTML = `<div style="color: red; padding: 20px;">Sayfa ${pageNum} yüklenemedi</div>`;
    }
  }

  async #renderTextLayer(page, viewport, container) {
    try {
      const textContent = await page.getTextContent({
        includeMarkedContent: true, // Required for v5.7.284 legacy build
      });
      const textLayerDiv = document.createElement("div");
      textLayerDiv.className = "textLayer";
      textLayerDiv.style.cssText = `
                position: absolute;
                left: 0;
                top: 0;
                right: 0;
                bottom: 0;
                overflow: hidden;
                opacity: 0.001;
                line-height: 1;
                z-index: 2;
            `;

      // Process text items
      textContent.items.forEach((item) => {
        const tx = window.pdfjsLib.Util.transform(
          viewport.transform,
          item.transform,
        );

        const fontHeight = Math.hypot(tx[0], tx[1]);
        const fontWidth = Math.hypot(tx[2], tx[3]);

        const span = document.createElement("span");
        span.textContent = item.str;
        span.style.cssText = `
                    position: absolute;
                    left: ${tx[4]}px;
                    top: ${tx[5]}px;
                    font-size: ${fontHeight}px;
                    font-family: sans-serif;
                    transform: scaleX(${fontWidth / fontHeight});
                    transform-origin: 0 0;
                    white-space: pre;
                    cursor: text;
                    user-select: text;
                `;

        textLayerDiv.appendChild(span);
      });

      container.appendChild(textLayerDiv);
    } catch (err) {
      console.warn("Text layer rendering failed:", err);
    }
  }

  goToPage(pageNum) {
    if (pageNum < 1) pageNum = 1;
    if (pageNum > this.#totalPages) pageNum = this.#totalPages;

    const pageContainer = this.#container.querySelector(
      `.pdf-page-container[data-page="${pageNum}"]`,
    );
    if (pageContainer) {
      // For first page, align to top; for others, use center
      const align = pageNum === 1 ? "start" : "center";
      pageContainer.scrollIntoView({ behavior: "smooth", block: align });
    }

    this.#currentPage = pageNum;
    if (this.#onPositionChange) {
      this.#onPositionChange({
        page: this.#currentPage,
        totalPages: this.#totalPages,
      });
    }
  }

  /**
   * Scroll to a specific search result on a page
   * @param {number} pageNum - Page number
   * @param {string} searchText - Text to find and scroll to
   * @public
   */
  scrollToSearchResult(pageNum, searchText) {
    // First go to the page
    this.goToPage(pageNum);

    // Wait for render then scroll to the highlighted text
    setTimeout(() => {
      const pageContainer = this.#container.querySelector(
        `.pdf-page-container[data-page="${pageNum}"]`,
      );
      if (!pageContainer) return;

      const textLayer = pageContainer.querySelector(".textLayer");
      if (!textLayer) return;

      // Find the first highlighted element
      const highlight = textLayer.querySelector(".search-highlight");
      if (highlight) {
        // Scroll the highlight into view within the page
        highlight.scrollIntoView({ behavior: "smooth", block: "center" });

        // Add a brief flash effect to make it more visible
        highlight.style.transition = "background-color 0.3s";
        highlight.style.backgroundColor = "#ff6600";
        setTimeout(() => {
          highlight.style.backgroundColor = "yellow";
        }, 300);
      }
    }, 300);
  }

  nextPage() {
    this.goToPage(this.#currentPage + 1);
  }

  prevPage() {
    this.goToPage(this.#currentPage - 1);
  }

  zoomIn() {
    this.#scale = Math.min(this.#scale * 1.2, 3.0);
    this.#rerenderAllPages();
    this.#updateZoomDisplay();
  }

  zoomOut() {
    this.#scale = Math.max(this.#scale / 1.2, 0.5);
    this.#rerenderAllPages();
    this.#updateZoomDisplay();
  }

  fitToWidth() {
    if (!this.#pdf || !this.#container) return;

    const containerWidth = this.#container.clientWidth - 40; // Account for padding
    const firstPage = this.#pdf.getPage(1);
    firstPage.then((page) => {
      const viewport = page.getViewport({ scale: 1.0 });
      const pageWidth = viewport.width;
      this.#scale = (containerWidth / pageWidth) * 0.95; // 95% of container
      this.#rerenderAllPages();
      this.#updateZoomDisplay();
    });
  }

  resetZoom() {
    this.#scale = 1.0;
    this.#rerenderAllPages();
    this.#updateZoomDisplay();
  }

  #updateZoomDisplay() {
    const zoomLevelEl = document.getElementById("zoom-level");
    if (zoomLevelEl) {
      zoomLevelEl.textContent = `${Math.round(this.#scale * 100)}%`;
    }
  }

  #rerenderAllPages() {
    if (!this.#pdf) return;

    // Store current scroll position
    const scrollPosition = this.#container.scrollTop;

    // Re-render all pages
    const containers = this.#container.querySelectorAll(".pdf-page-container");
    containers.forEach((container, index) => {
      const pageNum = index + 1;
      this.#renderPage(pageNum, container);
    });

    // Restore scroll position
    setTimeout(() => {
      this.#container.scrollTop = scrollPosition;
    }, 100);
  }

  getScale() {
    return this.#scale;
  }

  async searchText(query, options = {}) {
    if (!query || !this.#pdf) return [];

    const results = [];
    const queryLower = query.toLowerCase().trim();
    const { wholeWord = false, validate = true, debug = false } = options;

    if (debug) console.log(`[PDFViewer] Searching for: "${query}"`);

    for (let pageNum = 1; pageNum <= this.#totalPages; pageNum++) {
      const page = await this.#pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Join with space to preserve word boundaries better
      const pageText = textContent.items.map((item) => item.str).join(" ");
      const matches = [];

      // Find all occurrences of the query in the page text
      let startIndex = 0;
      while (true) {
        const index = pageText.toLowerCase().indexOf(queryLower, startIndex);
        if (index === -1) break;

        const matchedText = pageText.substring(index, index + query.length);

        // Whole word check if requested
        if (wholeWord) {
          const charBefore = index > 0 ? pageText[index - 1] : " ";
          const charAfter =
            index + query.length < pageText.length
              ? pageText[index + query.length]
              : " ";
          const wordBoundary = /\s/.test(charBefore) && /\s/.test(charAfter);
          if (!wordBoundary) {
            startIndex = index + 1;
            continue;
          }
        }

        // Validate match consistency
        const consistency = validate
          ? this.#validateMatch(matchedText, query, pageNum, matches.length + 1)
          : { valid: true };

        // Skip invalid matches - they don't actually contain the query
        if (!consistency.valid) {
          if (debug) {
            console.warn(
              `[PDFViewer] Skipping invalid match on page ${pageNum}:`,
              consistency.issues,
            );
          }
          startIndex = index + 1;
          continue;
        }

        matches.push({
          index: index,
          text: matchedText,
          validation: consistency,
        });

        startIndex = index + 1;
      }

      if (matches.length > 0) {
        results.push({
          page: pageNum,
          matches: matches,
          pageText: pageText,
          totalMatches: matches.length,
        });
      }

      page.cleanup();
    }

    if (debug) {
      const totalMatches = results.reduce(
        (sum, r) => sum + r.matches.length,
        0,
      );
      console.log(
        `[PDFViewer] Found ${totalMatches} matches in ${results.length} pages`,
      );
    }

    return results;
  }

  /**
   * Validate search match consistency
   * @private
   */
  #validateMatch(matchedText, query, pageNum, matchIndex) {
    const issues = [];

    // Check 1: Case-insensitive match
    if (!matchedText.toLowerCase().includes(query.toLowerCase())) {
      issues.push(`Text mismatch: expected "${query}", got "${matchedText}"`);
    }

    // Check 2: Length consistency (allowing for case differences)
    if (Math.abs(matchedText.length - query.length) > 2) {
      issues.push(
        `Length mismatch: query=${query.length}, matched=${matchedText.length}`,
      );
    }

    // Check 3: Character similarity
    const similarity = this.#calculateSimilarity(
      matchedText.toLowerCase(),
      query.toLowerCase(),
    );
    if (similarity < 0.8) {
      issues.push(`Low similarity: ${(similarity * 100).toFixed(1)}%`);
    }

    return {
      valid: issues.length === 0,
      issues: issues,
      similarity: similarity,
      page: pageNum,
      matchIndex: matchIndex,
    };
  }

  /**
   * Calculate text similarity (0-1)
   * @private
   */
  #calculateSimilarity(str1, str2) {
    const len = Math.max(str1.length, str2.length);
    if (len === 0) return 1;

    let matches = 0;
    for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
      if (str1[i] === str2[i]) matches++;
    }

    return matches / len;
  }

  highlightSearchResults(results, query) {
    console.log(
      `[PDFViewer] Highlighting ${results.length} pages for query: "${query}"`,
    );

    // Clear previous highlights
    const containers = this.#container.querySelectorAll(".pdf-page-container");
    containers.forEach((container) => {
      const highlights = container.querySelectorAll(".search-highlight");
      highlights.forEach((highlight) => highlight.remove());
    });

    if (!results || results.length === 0) {
      console.warn("[PDFViewer] No results to highlight");
      return;
    }

    let totalHighlighted = 0;

    // Add new highlights
    results.forEach((result) => {
      const container = this.#container.querySelector(
        `.pdf-page-container[data-page="${result.page}"]`,
      );
      if (!container) {
        console.warn(`[PDFViewer] Page ${result.page} container not found`);
        return;
      }

      const textLayer = container.querySelector(".textLayer");
      if (!textLayer) {
        console.warn(`[PDFViewer] textLayer not found on page ${result.page}`);
        return;
      }

      // Get all text from textLayer for debugging
      const allText = Array.from(textLayer.querySelectorAll("span"))
        .map((s) => s.textContent)
        .join(" ");
      console.log(
        `[PDFViewer] Page ${result.page} textLayer has ${textLayer.querySelectorAll("span").length} spans`,
      );

      result.matches.forEach((match, matchIdx) => {
        // Handle match object structure - match.text might contain validation object
        const searchText =
          typeof match.text === "string"
            ? match.text
            : match.text && match.text.text
              ? match.text.text
              : String(match.text);

        if (!searchText || searchText.trim() === "") {
          console.warn(
            `[PDFViewer] Empty match text on page ${result.page}, match ${matchIdx}`,
          );
          return;
        }

        console.log(
          `[PDFViewer] Looking for: "${searchText}" on page ${result.page}`,
        );

        const highlight = document.createElement("span");
        highlight.className = "search-highlight";
        highlight.style.cssText = `
                    background-color: #ffeb3b !important;
                    color: #000 !important;
                    padding: 2px 1px !important;
                    border-radius: 2px !important;
                    font-weight: bold !important;
                    box-shadow: 0 0 0 1px #ffc107 !important;
                `;

        // Replace the text in the text layer with highlighted version
        const textSpans = textLayer.querySelectorAll("span");
        let found = false;

        textSpans.forEach((span) => {
          // Check for exact match or substring match
          if (
            span.textContent &&
            span.textContent.toLowerCase().includes(searchText.toLowerCase())
          ) {
            const originalText = span.textContent;
            console.log(
              `[PDFViewer] Found match in span: "${originalText.substring(0, 50)}..."`,
            );

            // Create highlighted version
            highlight.textContent = searchText;

            // Use case-insensitive replacement
            const regex = new RegExp(
              searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "gi",
            );
            const newHTML = originalText.replace(regex, highlight.outerHTML);

            if (newHTML !== originalText) {
              span.innerHTML = newHTML;
              found = true;
              totalHighlighted++;
              console.log(
                `[PDFViewer] Highlighted match #${totalHighlighted} on page ${result.page}`,
              );
            }
          }
        });

        if (!found) {
          console.warn(
            `[PDFViewer] Could not find "${searchText}" in textLayer on page ${result.page}`,
          );
        }
      });
    });

    console.log(`[PDFViewer] Total highlights created: ${totalHighlighted}`);
  }

  clearSearchHighlights() {
    const highlights = this.#container.querySelectorAll(".search-highlight");
    highlights.forEach((highlight) => highlight.remove());
  }

  async printPdf() {
    if (!this.#pdf) return;

    try {
      // Create a new window for printing
      const printWindow = window.open("", "_blank");

      for (let pageNum = 1; pageNum <= this.#totalPages; pageNum++) {
        const page = await this.#pdf.getPage(pageNum);
        const viewport = page.getViewport({
          scale: 1.5,
          rotation: this.#rotation || 0,
        }); // Higher scale for printing

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        // Create image and add to print window
        const img = document.createElement("img");
        img.style.cssText =
          "display: block; margin: 10px 0; page-break-after: always;";
        img.src = canvas.toDataURL();

        if (pageNum === 1) {
          printWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>PDF Yazdırma</title>
                            <style>
                                @media print {
                                    @page { margin: 0.5in; }
                                    body { margin: 0; }
                                    img { max-width:100%; }
                                }
                            </style>
                        </head>
                        <body>
                    `);
        }

        printWindow.document.body.appendChild(img);
        page.cleanup();
      }

      printWindow.document.write("</body></html>");
      printWindow.document.close();

      // Trigger print dialog
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    } catch (error) {
      console.error("Print error:", error);
      alert("Yazdırma hatası: " + error.message);
    }
  }

  rotateLeft() {
    if (!this.#pdf) return;
    this.#rotation = ((this.#rotation || 0) - 90) % 360;
    this.#rerenderAllPages();
  }

  rotateRight() {
    if (!this.#pdf) return;
    this.#rotation = ((this.#rotation || 0) + 90) % 360;
    this.#rerenderAllPages();
  }

  resetRotation() {
    if (!this.#pdf) return;
    this.#rotation = 0;
    this.#rerenderAllPages();
  }

  async performSearch() {
    const searchInput = document.getElementById("pdf-search-input");
    if (!searchInput) return;

    const query = searchInput.value.trim();
    if (!query) {
      this.clearSearchHighlights();
      return;
    }

    const results = await this.searchText(query);
    this.highlightSearchResults(results, query);

    // Navigate to first result
    if (results.length > 0) {
      this.goToPage(results[0].page);
    }
  }

  destroy() {
    this.#pdf?.destroy?.();
    this.#pdf = null;
    this.#pagesRendered.clear();
    if (this.#container) {
      this.#container.innerHTML = "";
      this.#container.classList.remove("pdf-container");
    }
  }

  getCurrentPage() {
    return this.#currentPage;
  }

  getTotalPages() {
    return this.#totalPages;
  }
}

// ============================================
// Main Application Class - Coordinates Library and Readers
// ============================================

class BookReaderApp {
  #library = null;
  #epubViewer = null;
  #pdfViewer = null;
  #pdfToolbar = null;
  #currentBook = null;
  #currentFormat = null;

  constructor() {
    this.#init();
  }

  async #init() {
    // Setup navigation buttons (must be done before URL check)
    const prevBtn = document.getElementById("reader-prev");
    const nextBtn = document.getElementById("reader-next");

    prevBtn?.addEventListener("click", () => {
      if (this.#currentFormat === "pdf" && this.#pdfViewer) {
        this.#pdfViewer.prevPage();
      } else if (this.#currentFormat === "epub") {
        const inst = EpubViewer.instance;
        if (inst && inst.getRendition) {
          inst.getRendition()?.prev();
        }
      }
    });

    nextBtn?.addEventListener("click", () => {
      if (this.#currentFormat === "pdf" && this.#pdfViewer) {
        this.#pdfViewer.nextPage();
      } else if (this.#currentFormat === "epub") {
        const inst = EpubViewer.instance;
        if (inst && inst.getRendition) {
          inst.getRendition()?.next();
        }
      }
    });

    // Setup back to library button
    const backBtn = document.getElementById("back-to-library");
    backBtn?.addEventListener("click", () => this.#showLibrary());

    // Check for ?file= URL parameter (direct book open from main page)
    const urlParams = new URLSearchParams(window.location.search);
    const fileUrl = urlParams.get("file");
    if (fileUrl) {
      await this.#openBookFromUrl(fileUrl);
      return;
    }

    // Initialize library
    this.#library = new BookLibrary("#library-view", (book) =>
      this.#openBookFromLibrary(book),
    );
    await this.#library.init();

    // Setup keyboard navigation for both PDF and EPUB
    document.body.addEventListener("keydown", (e) => {
      if (document.querySelector(".reader-view.hidden")) return;
      if (!this.#currentFormat) return;
      console.log("[Keyboard] format:", this.#currentFormat, "key:", e.key);

      if (this.#currentFormat === "pdf") {
        switch (e.key) {
          case "ArrowLeft":
          case "PageUp":
            this.#pdfViewer?.prevPage();
            e.preventDefault();
            break;
          case "ArrowRight":
          case " ":
          case "PageDown":
            this.#pdfViewer?.nextPage();
            e.preventDefault();
            break;
          case "Home":
            this.#pdfViewer?.goToPage(1);
            e.preventDefault();
            break;
          case "End":
            this.#pdfViewer?.goToPage(this.#pdfViewer.getTotalPages());
            e.preventDefault();
            break;
          case "+":
          case "=":
            this.#pdfViewer?.zoomIn();
            e.preventDefault();
            break;
          case "-":
          case "_":
            this.#pdfViewer?.zoomOut();
            e.preventDefault();
            break;
          case "0":
            this.#pdfViewer?.resetZoom();
            e.preventDefault();
            break;
          case "w":
            this.#pdfViewer?.fitToWidth();
            e.preventDefault();
            break;
          case "p":
          case "Control+P":
            this.#pdfViewer?.printPdf();
            e.preventDefault();
            break;
          case "r":
            this.#pdfViewer?.rotateRight();
            e.preventDefault();
            break;
          case "Shift+R":
            this.#pdfViewer?.rotateLeft();
            e.preventDefault();
            break;
        }
      } else if (this.#currentFormat === "epub") {
        const inst = EpubViewer.instance;
        if (!inst || !inst.getRendition) return;
        const rendition = inst.getRendition();
        if (!rendition) return;

        switch (e.key) {
          case "ArrowLeft":
          case "PageUp":
            rendition.prev();
            e.preventDefault();
            break;
          case "ArrowRight":
          case " ":
          case "PageDown":
            rendition.next();
            e.preventDefault();
            break;
          case "Home":
            rendition.display(0);
            e.preventDefault();
            break;
          case "End":
            rendition.display(-1);
            e.preventDefault();
            break;
        }
      }
    });

    // Initialize PDF viewer
    this.#pdfViewer = new PdfViewer("#pdf-container", (position) => {
      this.#updatePdfIndicator(position);
    });

    // Initialize PDF Toolbar (modern dropdown menus)
    this.#pdfToolbar = new PDFToolbar("#pdf-toolbar", this.#pdfViewer);

    // Show library initially
    this.#showLibrary();
  }

  async #openBookFromLibrary(book) {
    this.#currentBook = book;
    this.#currentFormat = book.format;

    // Load position from TOML if available (overrides IndexedDB)
    const tomlPosition = await this.#library.loadBookPositionFromToml(book.id);
    if (tomlPosition && tomlPosition.page) {
      console.log("[App] Loaded position from TOML:", tomlPosition.page);
      this.#currentBook.lastPosition = tomlPosition;
      book.lastPosition = tomlPosition;
    }

    // Update last read time
    await this.#library.updateBookPosition(book.id, book.lastPosition);

    // Hide library, show reader
    this.#showReader();

    // Load book based on format
    if (book.format === "epub") {
      await this.#loadEpub(book);
    } else if (book.format === "pdf") {
      await this.#loadPdf(book);
    }
  }

  // Open book directly from URL parameter (?file=...)
  async #openBookFromUrl(fileUrl) {
    console.log("[App] Opening book from URL:", fileUrl);

    // URL'deki yanlış dosya adını düzelt
    fileUrl = fileUrl.replace(
      "20soradaEvrimTeorisi_5b.epub",
      "20sorudaEvrimTeorisi_5b.epub",
    );

    // Show reader view immediately
    this.#showReader();

    // Determine format from URL
    const ext = fileUrl.split(".").pop().toLowerCase();
    this.#currentFormat = ext === "pdf" ? "pdf" : "epub";

    // Create EpubViewer instance if needed
    if (
      this.#currentFormat === "epub" &&
      !EpubViewer.instance &&
      typeof ePub === "function"
    ) {
      const readerView = document.getElementById("reader-view");
      if (readerView) {
        EpubViewer.instance = new EpubViewer(readerView);
      }
    }

    // Hide empty state and PDF container
    const emptyEl = document.getElementById("reader-empty");
    if (emptyEl) emptyEl.style.display = "none";

    const appEl = document.querySelector(".app");
    if (this.#currentFormat === "epub") {
      appEl?.classList.remove("mode-pdf");
      appEl?.classList.add("mode-epub");
      this.#pdfViewer?.destroy();
      this.#pdfToolbar?.hide();
    } else {
      appEl?.classList.remove("mode-epub");
      appEl?.classList.add("mode-pdf");
      EpubViewer.instance?.doReset?.();
      EpubViewer.instance = null;
      this.#pdfToolbar?.show();
    }

    // Fetch and load the book
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("HTTP " + response.status);
      const arrayBuffer = await response.arrayBuffer();
      const fileName = fileUrl.split("/").pop();

      if (this.#currentFormat === "epub" && EpubViewer.instance) {
        console.log(
          "[App] Calling doBook, EpubViewer.instance exists:",
          !!EpubViewer.instance,
        );
        console.log(
          "[App] epub-container innerHTML before doBook:",
          document
            .getElementById("epub-container")
            ?.innerHTML.substring(0, 100),
        );
        await EpubViewer.instance.doBook(arrayBuffer, {
          encoding: "binary",
          name: fileName,
        });
        console.log(
          "[App] epub-container innerHTML after doBook:",
          document
            .getElementById("epub-container")
            ?.innerHTML.substring(0, 200),
        );
      } else if (this.#currentFormat === "pdf") {
        const bookId = "url-" + Date.now();
        await this.#pdfViewer.loadBook(arrayBuffer, bookId, 1);
        const titleEl = document.querySelector(".reader-bar .book-title");
        if (titleEl) titleEl.textContent = fileName.replace(/\.[^/.]+$/, "");
      }
    } catch (err) {
      console.error("[App] Error loading book from URL:", err);
      ErrorBoundary.handle("Kitap yuklenirken hata", err);
    }
  }

  // Load book directly from buffer (used by file dialog)
  async loadBookFromBuffer(buffer, fileName, format) {
    const book = {
      id: "file-" + Date.now(),
      title: fileName.replace(/\.[^/.]+$/, ""),
      author: "",
      format: format,
      data: buffer,
      lastPosition: format === "pdf" ? { page: 1 } : null,
    };

    // Save to library
    await this.#library.addBook(book);

    // Load the book
    if (format === "epub") {
      await this.#loadEpub(book);
    } else if (format === "pdf") {
      await this.#loadPdf(book);
    }
  }

  async #loadEpub(book) {
    // Set app mode class for CSS-based switching
    const appEl = document.querySelector(".app");
    appEl?.classList.remove("mode-pdf");
    appEl?.classList.add("mode-epub");

    const emptyEl = document.getElementById("reader-empty");
    if (emptyEl) emptyEl.style.display = "none";

    // Lazily create the EpubViewer when the reader view is visible.
    if (!EpubViewer.instance && typeof ePub === "function") {
      const readerView = document.getElementById("reader-view");
      if (readerView) {
        EpubViewer.instance = new EpubViewer(readerView);
      }
    }

    // Clear PDF viewer if active
    this.#pdfViewer?.destroy();

    // Show EPUB controls, hide PDF-specific controls
    const prevBtn = document.getElementById("reader-prev");
    const nextBtn = document.getElementById("reader-next");
    prevBtn?.classList.remove("hidden");
    nextBtn?.classList.remove("hidden");

    // Hide modern PDF toolbar
    this.#pdfToolbar?.hide();

    // Use existing EpubViewer
    const bookContainer = document.getElementById("epub-container");
    bookContainer.innerHTML = "";

    if (EpubViewer.instance) {
      await EpubViewer.instance.doBook(book.data, {
        encoding: "binary",
        name: book.title,
      });

      // Restore position if available
      if (book.lastPosition && book.lastPosition.cfi) {
        setTimeout(() => {
          const inst = EpubViewer.instance;
          if (inst && inst.getRendition) {
            inst.getRendition()?.display(book.lastPosition.cfi);
          }
        }, 500);
      }
    }
  }

  async #loadPdf(book) {
    // Ensure reader view is actually visible (PDF rendering needs layout)
    const libraryView = document.getElementById("library-view");
    const readerView = document.getElementById("reader-view");
    libraryView?.classList.add("hidden");
    readerView?.classList.remove("hidden");

    // Set app mode class for CSS-based switching
    const appEl = document.querySelector(".app");
    appEl?.classList.remove("mode-epub");
    appEl?.classList.add("mode-pdf");

    // STOP EPUB completely first - destroy and remove iframe
    EpubViewer.instance?.doReset?.();
    const epubContainer = document.getElementById("epub-container");
    if (epubContainer) {
      epubContainer.innerHTML = ""; // Removes iframe completely
    }
    // Nullify instance to prevent any further EPUB operations
    EpubViewer.instance = null;

    const pdfContainer = document.getElementById("pdf-container");
    if (!pdfContainer) {
      console.error("[PDF] #pdf-container not found in DOM");
      return;
    }
    pdfContainer.innerHTML = "";

    const emptyEl = document.getElementById("reader-empty");
    if (emptyEl) emptyEl.style.display = "none";

    // Show navigation buttons
    const prevBtn = document.getElementById("reader-prev");
    const nextBtn = document.getElementById("reader-next");
    prevBtn?.classList.remove("hidden");
    nextBtn?.classList.remove("hidden");

    // Show modern PDF toolbar
    this.#pdfToolbar?.show();
    this.#pdfToolbar?.setPdfFileName(book.title);

    // Load PDF
    const startPage = book.lastPosition?.page || 1;
    // Important: wait for container to be visible/layouted; otherwise getBoundingClientRect() returns 0.
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const metadata = await this.#pdfViewer.loadBook(
      book.data,
      book.id,
      startPage,
    );

    // Update title bar
    const titleEl = document.querySelector(".reader-bar .book-title");
    const authorEl = document.querySelector(".reader-bar .book-author");
    if (titleEl) titleEl.textContent = book.title;
    if (authorEl) authorEl.textContent = book.author;

    // Update zoom level display
    this.#updateZoomLevel();
  }

  #updateZoomLevel() {
    const zoomLevelEl = document.getElementById("zoom-level");
    if (zoomLevelEl && this.#pdfViewer) {
      const scale = this.#pdfViewer.getScale();
      zoomLevelEl.textContent = `${Math.round(scale * 100)}%`;
    }
  }

  #updatePdfIndicator(position) {
    const locEl = document.getElementById("reader-loc");
    if (locEl) {
      if (position.totalPages === 0) {
        locEl.textContent = "Yükleniyor...";
      } else {
        locEl.textContent = `Sayfa ${position.page} / ${position.totalPages}`;
      }
    } else {
      console.log("[PDF] reader-loc element not found!");
    }

    // Auto-save position every 10 page changes
    if (this.#currentBook && this.#currentBook.id) {
      // Debounce the save
      clearTimeout(this._saveTimeout);
      this._saveTimeout = setTimeout(() => {
        this.#library?.updateBookPosition(this.#currentBook.id, {
          page: position.page,
        });
      }, 1000);
    }
  }

  #showLibrary() {
    // Reset readers
    EpubViewer.instance?.doReset?.();
    this.#pdfViewer?.destroy();
    this.#pdfToolbar?.hide();
    this.#currentBook = null;
    this.#currentFormat = null;

    // Hide reader, show library
    const libraryView = document.getElementById("library-view");
    const readerView = document.getElementById("reader-view");

    libraryView?.classList.remove("hidden");
    readerView?.classList.add("hidden");

    // Refresh library
    this.#library?.renderLibrary();
  }

  #showReader() {
    const libraryView = document.getElementById("library-view");
    const readerView = document.getElementById("reader-view");

    libraryView?.classList.add("hidden");
    readerView?.classList.remove("hidden");

    // Debug: reader-view görünürlüğünü kontrol et
    console.log(
      "[App] showReader called, reader-view hidden:",
      readerView?.classList.contains("hidden"),
    );
    console.log(
      "[App] reader-view display:",
      window.getComputedStyle(readerView).display,
    );
  }

  // Public accessor for library
  getLibrary() {
    return this.#library;
  }

  // Public accessor for PDF viewer
  getPdfViewer() {
    return this.#pdfViewer;
  }
}

// ============================================
// Initialize Application
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
  if (location.protocol === "file:" && !window.electronAPI?.isElectron) {
    const errorDiv = document.querySelector(".app .error");
    if (errorDiv) {
      errorDiv.classList.remove("hidden");
      const titleEl = errorDiv.querySelector(".error-title");
      const descEl = errorDiv.querySelector(".error-description");
      if (titleEl) titleEl.textContent = "file:// Protokolu Desteklenmiyor";
      if (descEl)
        descEl.innerHTML =
          "Bu uygulama file:// protokolu ile calismaz. HTTP sunucusu kullanin.";
    }
    return;
  }

  // Initialize main app with library
  window.bookReaderApp = new BookReaderApp();
});

// Global API
window.ePubViewer = {
  doOpenBook: () => EpubViewer.instance?.doOpenBook(),
  doSidebar: () => EpubViewer.instance?.doSidebar(),
  doFullscreen: () => EpubViewer.instance?.doFullscreen(),
};

window.debugEPUB = () => {
  console.log("=== Debug ===");
  console.log("EpubViewer Instance:", !!EpubViewer.instance);
  console.log("BookReader App:", !!window.bookReaderApp);
  console.log(
    "PDF Viewer:",
    !!(window.bookReaderApp && window.bookReaderApp.getPdfViewer),
  );
  console.log(
    "Library:",
    !!(window.bookReaderApp && window.bookReaderApp.getLibrary),
  );
  console.log("=============");
};
