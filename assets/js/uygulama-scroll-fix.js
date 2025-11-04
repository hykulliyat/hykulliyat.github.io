// uygulama-scroll-fix.js (Yeni ve Güvenilir Versiyon)

$(document).ready(function() {
    var savedScrollPosition = 0;
    
    // 1. EasyTabs'i Başlatın (Kendi mantığıyla çalışsın)
    $('#container').easyTabs({
        defaultContent: 1,
        fadeSpeed: 'fast',
        activeClass: 'active'
    });
    
    // 2. Sekme Tıklamalarını Yakala (Sadece pozisyonu düzeltmek için)
    $('#container .tabs a').on('click', function(e) {
        
        // Tıklamadan hemen önce mevcut pozisyonu kaydet
        savedScrollPosition = $(window).scrollTop();
        
        // EasyTabs'in kendi işini yapmasına izin ver
        
        // 3. Çok kısa bir gecikme ile pozisyonu geri yükle
        // Bu, EasyTabs'in içindeki veya tarayıcının varsayılan atlamasını düzeltir.
        setTimeout(function() {
             $(window).scrollTop(savedScrollPosition);
             
             // 4. Odaklanmayı Kaldırarak Tarayıcının Kaydırmasını Engelle
             // Sekme değiştikten sonra otomatik odaklanmayı engeller
             if(document.activeElement) {
                document.activeElement.blur(); 
             }
        }, 5); // Gecikmeyi çok kısa tutuyoruz (5 milisaniye)
        
    });
    
    // 5. Ekstra Koruma: Sayfa Yüklendiğinde Otomatik Odaklanmayı Kaldır
    $(window).on('load', function() {
        if(document.activeElement) {
            document.activeElement.blur();
        }
    });

    // 6. BONUS: Session Storage ile Scroll Pozisyonunu Kaydetme
    if (sessionStorage.getItem('tabScrollPos')) {
        $(window).scrollTop(sessionStorage.getItem('tabScrollPos'));
    }
    $(window).on('beforeunload', function() {
        sessionStorage.setItem('tabScrollPos', $(window).scrollTop());
    });
});