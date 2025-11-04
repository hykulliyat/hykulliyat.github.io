
$(document).ready(function() {
    var savedScrollPosition = 0;
    var isTabChanging = false;

    // EasyTabs'ı özelleştirerek başlat
    $('#container').easyTabs({
        defaultContent: 1,
            fadeSpeed: 'fast',
            activeClass: 'active'
    });

    // Scroll değişikliklerini dinle ve sekme değişimi sırasında engelle
    $(window).on('scroll', function() {
        if (isTabChanging) {
            $(window).scrollTop(savedScrollPosition);
        }
    });

    // Sekme tıklamalarını yakala
    $('#container .tabs a').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        // Mevcut pozisyonu kaydet ve kilitle
        savedScrollPosition = $(window).scrollTop();
        isTabChanging = true;

        // Sekme değişimini gerçekleştir
        var tabId = $(this).attr('href').substr(1);

        // Diğer sekmeleri pasif yap
        $('#container .tabs li').removeClass('active');
        $(this).closest('li').addClass('active');

        // İçerikleri değiştir
        $('#container .easytabs-tab-content').hide();
        $('#' + tabId).fadeIn('fast', function() {
            // Animasyon tamamlandığında kilidi aç
            setTimeout(function() {
                isTabChanging = false;
            }, 100);
        });

        // Pozisyonu koru
        $(window).scrollTop(savedScrollPosition);

        return false;
    });

    // BONUS: Sayfa yüklendiğinde scroll pozisyonunu geri yükle
    if (sessionStorage.getItem('tabScrollPos')) {
        $(window).scrollTop(sessionStorage.getItem('tabScrollPos'));
    }

    // Sayfadan ayrılırken scroll pozisyonunu kaydet
    $(window).on('beforeunload', function() {
        sessionStorage.setItem('tabScrollPos', $(window).scrollTop());
    });
});
