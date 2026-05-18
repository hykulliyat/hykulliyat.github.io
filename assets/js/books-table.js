// Dynamically generate book table from CSV
async function loadBooksTable() {
    try {
        const response = await fetch('/assets/Harun-Yahya-Kitaplar/kitap.csv');
        const csvText = await response.text();
        const rows = parseCSV(csvText);
        
        console.log('CSV rows loaded:', rows.length);
        console.log('First row:', rows[0]);
        
        const tbody = document.querySelector('#myTable tbody');
        if (!tbody) {
            console.error('Table body not found');
            return;
        }
        tbody.innerHTML = '';
        
        rows.forEach((row, index) => {
            if (index === 0) return; // Skip header row
            
            console.log(`Processing row ${index}:`, row);
            
            const tr = document.createElement('tr');
            
            // Sıra No
            const tdNo = document.createElement('td');
            tdNo.textContent = row[0];
            tr.appendChild(tdNo);
            
            // Kitap Adı
            const tdName = document.createElement('td');
            tdName.textContent = row[1];
            tr.appendChild(tdName);
            
            // Extract paths from CSV links - extract from HTML anchor tags
            let pdfPath = null, epubPath = null, docPath = null;
            
            if (row[2]) {
                // Match href attribute value (quoted or unquoted) and extract file parameter
                const hrefMatch = row[2].match(/href\s*=\s*(["'])(.*?)\1|href\s*=\s*([^\s>]+)/);
                if (hrefMatch) {
                    const hrefValue = hrefMatch[2] || hrefMatch[3];
                    const fileMatch = hrefValue.match(/file=([^&]+)/);
                    if (fileMatch) pdfPath = fileMatch[1];
                }
            }
            
            if (row[3]) {
                // Match href attribute value (quoted or unquoted) and extract URL after #
                const hrefMatch = row[3].match(/href\s*=\s*(["'])(.*?)\1|href\s*=\s*([^\s>]+)/);
                if (hrefMatch) {
                    const hrefValue = hrefMatch[2] || hrefMatch[3];
                    const hashMatch = hrefValue.match(/#(.+)/);
                    if (hashMatch) epubPath = hashMatch[1];
                }
            }
            
            if (row[4]) {
                // Match href attribute value (quoted or unquoted)
                const hrefMatch = row[4].match(/href\s*=\s*(["'])(.*?)\1|href\s*=\s*([^\s>]+)/);
                if (hrefMatch) {
                    docPath = hrefMatch[2] || hrefMatch[3];
                }
            }
            
            console.log(`Row ${index} - PDF path:`, pdfPath);
            console.log(`Row ${index} - EPUB path:`, epubPath);
            console.log(`Row ${index} - DOC path:`, docPath);
            
            // PDF Link
            const tdPdf = document.createElement('td');
            if (pdfPath) {
                let processedPdfPath = pdfPath.replace('kuranvebilim.github.io', 'hykulliyat.github.io');
                // Replace underscores with hyphens in directory name
                processedPdfPath = processedPdfPath.replace('Harun_Yahya_Kitaplar', 'Harun-Yahya-Kitaplar');
                // URL encode only the filename portion
                const urlParts = processedPdfPath.split('/');
                const filename = urlParts.pop();
                const encodedFilename = encodeURIComponent(filename);
                processedPdfPath = urlParts.join('/') + '/' + encodedFilename;
                tdPdf.innerHTML = `<a href="https://hykulliyat.github.io/pdf-viewer/?file=${processedPdfPath}" rel="alternate bookmark nofollow" hreflang=tr type=application/pdf target="_blank"><img src="/assets/img/pdf.png" alt="indir" title="İNDİR PDF"></a>`;
            }
            tr.appendChild(tdPdf);
            
            // EPUB Link
            const tdEpub = document.createElement('td');
            if (epubPath) {
                let processedEpubPath = epubPath.replace('kuranvebilim.github.io', 'hykulliyat.github.io');
                // Replace underscores with hyphens in directory name
                processedEpubPath = processedEpubPath.replace('Harun_Yahya_Kitaplar', 'Harun-Yahya-Kitaplar');
                // URL encode only the filename portion
                const urlParts = processedEpubPath.split('/');
                const filename = urlParts.pop();
                const encodedFilename = encodeURIComponent(filename);
                processedEpubPath = urlParts.join('/') + '/' + encodedFilename;
                tdEpub.innerHTML = `<a href="https://hykulliyat.github.io/epub-viewer/?file=${processedEpubPath}" rel="alternate bookmark nofollow" hreflang=tr type=application/epub+zip target="_blank"><img src="/assets/img/epub.png" alt="oku" title="OKU EPUB"></a>`;
            }
            tr.appendChild(tdEpub);
            
            // DOCX Link (changed from ODT to DOCX)
            const tdDocx = document.createElement('td');
            if (docPath) {
                let processedDocPath = docPath.replace('kuranvebilim.github.io', 'hykulliyat.github.io');
                // Replace underscores with hyphens in directory name
                processedDocPath = processedDocPath.replace('Harun_Yahya_Kitaplar', 'Harun-Yahya-Kitaplar');
                // Change /doc/ to /doc/ and ensure .docx extension
                processedDocPath = processedDocPath.replace(/\.doc$/, '.docx');
                // URL encode only the filename portion
                const urlParts = processedDocPath.split('/');
                const filename = urlParts.pop();
                const encodedFilename = encodeURIComponent(filename);
                processedDocPath = urlParts.join('/') + '/' + encodedFilename;
                tdDocx.innerHTML = `<a href="https://hykulliyat.github.io/docx-viewer/?file=${processedDocPath}" rel="alternate bookmark nofollow" hreflang=tr type=application/vnd.openxmlformats-officedocument.wordprocessingml.document target="_blank"><img src="/assets/img/odt.png" alt="indir" title="YAZDIR DOCX"></a>`;
            }
            tr.appendChild(tdDocx);
            
            tbody.appendChild(tr);
        });
        
        // Update count
        const count = rows.length - 1;
        const heading = document.querySelector('#harun-yahya h2');
        if (heading) {
            heading.innerHTML = `<strong>Adnan Harun Yahya Külliyatı - Oku veya İndir</strong>- ${count} Adet Eser`;
        }
        
    } catch (error) {
        console.error('Error loading books table:', error);
    }
}

function parseCSV(text) {
    const lines = text.split('\n');
    return lines.map(line => {
        const result = [];
        let current = '';
        let inQuotes = false;
        let inHtmlTag = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
                current += char;
            } else if (char === '<' && !inQuotes) {
                inHtmlTag = true;
                current += char;
            } else if (char === '>' && !inQuotes) {
                inHtmlTag = false;
                current += char;
            } else if (char === ',' && !inQuotes && !inHtmlTag) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }).filter(row => row.length > 1 && row[0].trim() !== '');
}

// Load table when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadBooksTable);
} else {
    loadBooksTable();
}
