/**
 * EPUB 3.3 Parser - ePub.js'e eklenti
 * EPUB 3.3 manifest/spine yapısını ePub.js formatına dönüştürür
 */

class EPUB33Parser {
    /**
     * EPUB 3.3 container'ı kontrol et
     */
    static isEPUB33(packageXml) {
        const pkg = packageXml.querySelector('package');
        const version = pkg?.getAttribute('version');
        return version === '3.3';
    }

    /**
     * EPUB 3.3 manifest'i ePub.js formatına dönüştür
     */
    static convertManifest(packageXml) {
        const manifest = packageXml.querySelector('manifest');
        const spine = packageXml.querySelector('spine');
        
        // EPUB 3.3: <link> elementleri de olabilir
        const links = packageXml.querySelectorAll('link[href]');
        const items = manifest.querySelectorAll('item[href]');
        
        const convertedManifest = [];
        
        // Geleneksel <item> elementleri
        items.forEach(item => {
            convertedManifest.push({
                id: item.getAttribute('id'),
                href: item.getAttribute('href'),
                mediaType: item.getAttribute('media-type'),
                properties: item.getAttribute('properties') || ''
            });
        });
        
        // EPUB 3.3 <link> elementleri (varsa)
        links.forEach(link => {
            if (!link.getAttribute('rel')) return;
            
            convertedManifest.push({
                id: link.getAttribute('id') || `link-${convertedManifest.length}`,
                href: link.getAttribute('href'),
                mediaType: link.getAttribute('media-type') || 'application/xhtml+xml',
                properties: link.getAttribute('rel') || ''
            });
        });
        
        return convertedManifest;
    }

    /**
     * EPUB 3.3 spine'i dönüştür
     */
    static convertSpine(packageXml) {
        const spine = packageXml.querySelector('spine');
        const itemrefs = spine.querySelectorAll('itemref');
        
        if (itemrefs.length === 0) {
            // EPUB 3.3: <item> yerine <spine> içinde <itemref> olmayabilir
            const manifest = packageXml.querySelector('manifest');
            const items = manifest.querySelectorAll('item[media-type="application/xhtml+xml"]');
            
            return Array.from(items).map(item => ({
                idref: item.getAttribute('id'),
                linear: item.getAttribute('linear') || 'yes'
            }));
        }
        
        return Array.from(itemrefs).map(itemref => ({
            idref: itemref.getAttribute('idref'),
            linear: itemref.getAttribute('linear') || 'yes'
        }));
    }

    /**
     * ePub.js'e uyumlu package objesi oluştur
     */
    static createCompatiblePackage(packageXml) {
        if (!this.isEPUB33(packageXml)) {
            return null; // Dönüştürme gerekmiyor
        }

        const convertedManifest = this.convertManifest(packageXml);
        const convertedSpine = this.convertSpine(packageXml);
        
        // ePub.js beklenen format
        return {
            manifest: convertedManifest,
            spine: convertedSpine,
            metadata: this.extractMetadata(packageXml),
            nav: this.extractNavigation(packageXml)
        };
    }

    /**
     * Metadata çıkar
     */
    static extractMetadata(packageXml) {
        const metadata = packageXml.querySelector('metadata');
        const result = {};
        
        ['title', 'creator', 'language', 'identifier', 'date'].forEach(tag => {
            const element = metadata.querySelector(tag);
            if (element) result[tag] = element.textContent;
        });
        
        return result;
    }

    /**
     * Navigation çıkar
     */
    static extractNavigation(packageXml) {
        const manifest = packageXml.querySelector('manifest');
        const navItem = manifest.querySelector('item[properties="nav"]');
        return navItem ? navItem.getAttribute('href') : null;
    }
}

// ePub.js'e entegrasyon
if (typeof ePub !== 'undefined') {
    const originalBook = ePub.Book;
    
    ePub.Book = function(url, options) {
        const book = new originalBook(url, options);
        
        // Package yüklendiğinde EPUB 3.3 kontrolü yap
        const originalReady = book.ready;
        book.ready = book.ready.then(() => {
            const packageXml = book.package;
            
            if (EPUB33Parser.isEPUB33(packageXml.document)) {
                console.log('[EPUB33] Converting EPUB 3.3 to ePub.js format');
                const converted = EPUB33Parser.createCompatiblePackage(packageXml.document);
                
                if (converted) {
                    // ePub.js iç yapısını güncelle
                    book.spine.spineItems = converted.spine.map(item => ({
                        id: item.idref,
                        href: book.manifest[item.idref]?.href,
                        linear: item.linear === 'yes'
                    }));
                    
                    console.log('[EPUB33] Conversion successful');
                }
            }
            
            return book;
        });
        
        return book;
    };
}

// Make available globally
if (typeof window !== 'undefined') {
    window.EPUB33Parser = EPUB33Parser;
}
