// DOCX Viewer
const fileInput = document.getElementById('file-input');
const openBtn = document.getElementById('open-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const docxPreview = document.getElementById('docx-preview');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const errorMessage = error.querySelector('.error-message');

// Dosya açma butonu
openBtn.addEventListener('click', () => {
    fileInput.click();
});

// Dosya seçildiğinde
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    loadDocx(file);
});

// Sürükle-bırak desteği
document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.docx')) {
        loadDocx(file);
    }
});

// Tam ekran
fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});

// DOCX yükle
async function loadDocx(file) {
    console.log('DOCX yükleniyor:', file.name, file.size, 'bytes');
    
    // UI güncelle
    docxPreview.innerHTML = '';
    error.classList.add('hidden');
    loading.classList.remove('hidden');
    
    try {
        console.log('ArrayBuffer okunuyor...');
        const arrayBuffer = await file.arrayBuffer();
        console.log('ArrayBuffer boyutu:', arrayBuffer.byteLength, 'bytes');
        
        // docx-preview kütüphanesinin yüklü olup olmadığını kontrol et
        if (typeof window.docxpreview === 'undefined') {
            throw new Error('docx-preview kütüphanesi yüklenmedi');
        }
        
        console.log('docx-preview.renderAsync çağrılıyor...');
        console.log('docx-preview methods:', Object.keys(window.docxpreview));
        
        // docx-preview ile render
        const docx = await window.docxpreview.renderAsync(arrayBuffer, docxPreview, null, {
            className: 'docx-content',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            useBase64URL: true,
            renderChanges: false,
            experimental: false
        });
        
        console.log('Render başarılı');
        loading.classList.add('hidden');
        
    } catch (err) {
        console.error('DOCX yükleme hatası:', err);
        console.error('Hata detayları:', err.stack);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        errorMessage.textContent = `Dosya yüklenemedi: ${err.message}`;
    }
}

// URL parametresi ile dosya yükle
function loadFromUrlParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const fileUrl = urlParams.get('url');
    
    if (fileUrl) {
        console.log('URL parametresi ile dosya yükleniyor:', fileUrl);
        loadDocxFromUrl(fileUrl);
    }
}

// URL'den DOCX yükle
async function loadDocxFromUrl(fileUrl) {
    console.log('URL\'den DOCX yükleniyor:', fileUrl);
    
    // UI güncelle
    docxPreview.innerHTML = '';
    error.classList.add('hidden');
    loading.classList.remove('hidden');
    
    try {
        console.log('Fetch ile dosya indiriliyor...');
        const response = await fetch(fileUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log('ArrayBuffer\'a çevriliyor...');
        const arrayBuffer = await response.arrayBuffer();
        console.log('ArrayBuffer boyutu:', arrayBuffer.byteLength, 'bytes');
        
        // docx-preview kütüphanesinin yüklü olup olmadığını kontrol et
        if (typeof window.docxpreview === 'undefined') {
            throw new Error('docx-preview kütüphanesi yüklenmedi');
        }
        
        console.log('docx-preview.renderAsync çağrılıyor...');
        
        // docx-preview ile render
        const docx = await window.docxpreview.renderAsync(arrayBuffer, docxPreview, null, {
            className: 'docx-content',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            useBase64URL: true,
            renderChanges: false,
            experimental: false
        });
        
        console.log('Render başarılı');
        loading.classList.add('hidden');
        
    } catch (err) {
        console.error('DOCX yükleme hatası:', err);
        console.error('Hata detayları:', err.stack);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        errorMessage.textContent = `Dosya yüklenemedi: ${err.message}`;
    }
}

// Başlangıçta URL parametresini kontrol et
loadFromUrlParam();

// Başlangıçta örnek dosya aç
console.log('DOCX Viewer hazır');
