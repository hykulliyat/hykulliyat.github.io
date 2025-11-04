$(document).ready(function() {
    var savedScrollPosition = 0;
    
    // EasyTabs'i başlatın. (Burada bırakıyoruz)
    $('#container').easyTabs({
        defaultContent: 1,
        fadeSpeed: 'fast',
        activeClass: 'active'
    });
    
    // !!! DİKKAT: KAYDIRMA KİLİTLEME MANTIĞI BURADAN KALDIRILDI !!!
    // Eğer buradaysa: $(window).on('scroll', function() { ... }) blokunu silin.
    
    // Sekme tıklamalarını yakala (Sadece pozisyonu düzeltmek için)
    $('#container .tabs a').on('click', function(e) {
        // Tıklamadan hemen önce mevcut pozisyonu kaydet
        savedScrollPosition = $(window).scrollTop();
        
        // EasyTabs'in kendi sekme değiştirme işini yapmasına izin ver.
        // Tıklama işlevi tamamlandıktan sonra, kısa bir gecikme ile
        // kaydırma pozisyonunu geri yükleyerek tarayıcının atlamasını düzeltiyoruz.
        setTimeout(function() {
             $(window).scrollTop(savedScrollPosition);
             
             // Bir öğeye otomatik odaklanmayı engellemek için:
             if(document.activeElement) {
                document.activeElement.blur();
             }
        }, 10); // 10 milisaniye gecikme ile düzeltme
        
    });
    
    // BONUS: Sayfa yüklendiğinde scroll pozisyonunu geri yükle
    if (sessionStorage.getItem('tabScrollPos')) {
        $(window).scrollTop(sessionStorage.getItem('tabScrollPos'));
    }
    
    // Sayfadan ayrılırken scroll pozisyonunu kaydet
    $(window).on('beforeunload', function() {
        sessionStorage.setItem('tabScrollPos', $(window).scrollTop());
    });
    
    // Ekstra koruma: Sayfa yüklendiğinde otomatik odaklanmayı kaldır
    $(window).on('load', function() {
        if(document.activeElement) {
            document.activeElement.blur();
        }
    });
});