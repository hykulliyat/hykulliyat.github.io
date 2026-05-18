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
            const pdfMatch = row[2] ? row[2].match(/file=([^&"]+)/) : null;
            const epubMatch = row[3] ? row[3].match(/#([^"]+)/) : null;
            const docMatch = row[4] ? row[4].match(/href=([^"]+)/) : null;
            
            console.log(`Row ${index} - PDF match:`, pdfMatch);
            console.log(`Row ${index} - EPUB match:`, epubMatch);
            console.log(`Row ${index} - DOC match:`, docMatch);
            
            // PDF Link
            const tdPdf = document.createElement('td');
            if (pdfMatch) {
                let pdfPath = pdfMatch[1].replace('kuranvebilim.github.io', 'hykulliyat.github.io');
                // Replace underscores with hyphens in directory name
                pdfPath = pdfPath.replace('Harun_Yahya_Kitaplar', 'Harun-Yahya-Kitaplar');
                // Remove any trailing HTML tag remnants
                pdfPath = pdfPath.replace(/\s+target.*/, '');
                // URL encode the path to handle spaces
                pdfPath = encodeURIComponent(pdfPath);
                tdPdf.innerHTML = `<a href="https://hykulliyat.github.io/pdf-viewer/?file=${pdfPath}" rel="alternate bookmark nofollow" hreflang=tr type=application/pdf target="_blank"><img src="/assets/img/pdf.png" alt="indir" title="İNDİR PDF"></a>`;
            }
            tr.appendChild(tdPdf);
            
            // EPUB Link
            const tdEpub = document.createElement('td');
            if (epubMatch) {
                let epubPath = epubMatch[1].replace('kuranvebilim.github.io', 'hykulliyat.github.io');
                // Replace underscores with hyphens in directory name
                epubPath = epubPath.replace('Harun_Yahya_Kitaplar', 'Harun-Yahya-Kitaplar');
                // Remove any trailing HTML tag remnants
                epubPath = epubPath.replace(/\s+target.*/, '');
                // URL encode the path to handle spaces
                epubPath = encodeURIComponent(epubPath);
                tdEpub.innerHTML = `<a href="https://hykulliyat.github.io/epub-viewer/?file=${epubPath}" rel="alternate bookmark nofollow" hreflang=tr type=application/epub+zip target="_blank"><img src="/assets/img/epub.png" alt="oku" title="OKU EPUB"></a>`;
            }
            tr.appendChild(tdEpub);
            
            // DOCX Link (changed from ODT to DOCX)
            const tdDocx = document.createElement('td');
            if (docMatch) {
                let docPath = docMatch[1].replace('kuranvebilim.github.io', 'hykulliyat.github.io');
                // Replace underscores with hyphens in directory name
                docPath = docPath.replace('Harun_Yahya_Kitaplar', 'Harun-Yahya-Kitaplar');
                // Remove any trailing HTML tag remnants
                docPath = docPath.replace(/\s+target.*/, '');
                // Change /doc/ to /doc/ and ensure .docx extension
                docPath = docPath.replace(/\.doc$/, '.docx');
                // URL encode the path to handle spaces
                docPath = encodeURIComponent(docPath);
                tdDocx.innerHTML = `<a href="https://hykulliyat.github.io/docx-viewer/?file=${docPath}" rel="alternate bookmark nofollow" hreflang=tr type=application/vnd.openxmlformats-officedocument.wordprocessingml.document target="_blank"><img src="/assets/img/odt.png" alt="indir" title="YAZDIR DOCX"></a>`;
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
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
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
