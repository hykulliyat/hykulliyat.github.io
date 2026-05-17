// Dynamically generate book table from CSV
async function loadBooksTable() {
    try {
        const response = await fetch('/assets/Harun-Yahya-Kitaplar/kitap.csv');
        const csvText = await response.text();
        const rows = parseCSV(csvText);
        
        const tbody = document.querySelector('#myTable tbody');
        tbody.innerHTML = '';
        
        rows.forEach((row, index) => {
            if (index === 0) return; // Skip header row
            
            const tr = document.createElement('tr');
            
            // Sıra No
            const tdNo = document.createElement('td');
            tdNo.textContent = row[0];
            tr.appendChild(tdNo);
            
            // Kitap Adı
            const tdName = document.createElement('td');
            tdName.textContent = row[1];
            tr.appendChild(tdName);
            
            // Extract paths from CSV links
            const pdfMatch = row[2].match(/file=([^"]+)/);
            const epubMatch = row[3].match(/file=([^"]+)/);
            const docMatch = row[4].match(/file=([^"]+)/);
            
            // PDF Link
            const tdPdf = document.createElement('td');
            if (pdfMatch) {
                const pdfPath = pdfMatch[1].replace('kuranvebilim.github.io', 'hykulliyat.github.io');
                tdPdf.innerHTML = `<a href="https://hykulliyat.github.io/pdf-viewer/?file=${pdfPath}" rel="alternate bookmark nofollow" hreflang=tr type=application/pdf target="_blank"><img src="/assets/img/pdf.png" alt="indir" title="İNDİR PDF"></a>`;
            }
            tr.appendChild(tdPdf);
            
            // EPUB Link
            const tdEpub = document.createElement('td');
            if (epubMatch) {
                const epubPath = epubMatch[1].replace('kuranvebilim.github.io', 'hykulliyat.github.io');
                tdEpub.innerHTML = `<a href="https://hykulliyat.github.io/viewer/ePubViewer3/?file=${epubPath}" rel="alternate bookmark nofollow" hreflang=tr type=application/epub+zip target="_blank"><img src="/assets/img/epub.png" alt="oku" title="OKU EPUB"></a>`;
            }
            tr.appendChild(tdEpub);
            
            // DOCX Link (changed from ODT to DOCX)
            const tdDocx = document.createElement('td');
            if (docMatch) {
                let docPath = docMatch[1].replace('kuranvebilim.github.io', 'hykulliyat.github.io');
                // Change /doc/ to /doc/ and ensure .docx extension
                docPath = docPath.replace(/\.doc$/, '.docx');
                tdDocx.innerHTML = `<a href="https://hykulliyat.github.io/docx-viewer/?file=${docPath}" rel="alternate bookmark nofollow" hreflang=tr type=application/vnd.openxmlformats-officedocument.wordprocessingml.document target="_blank"><img src="/assets/img/odt.png" alt="indir" title="YAZDIR DOCX"></a>`;
            }
            tr.appendChild(tdDocx);
            
            tbody.appendChild(tr);
        });
        
        // Update count
        const count = rows.length - 1;
        document.querySelector('#harun-yahya h2').innerHTML = `<strong>Adnan Harun Yahya Külliyatı - Oku veya İndir</strong>- ${count} Adet Eser`;
        
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
    }).filter(row => row.length > 1);
}

// Load table when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadBooksTable);
} else {
    loadBooksTable();
}
