// Yeni Scroll to Top (Yukarı Çık) İşlevi

// Pencere kaydırıldığında butonu göster/gizle
$(window).on('scroll', function() {
    // Sayfa 100 pikselden fazla aşağı kaydırıldığında göster
    if ($(this).scrollTop() > 100) {
        $('#scrollToTopBtn').fadeIn();
    } else {
        $('#scrollToTopBtn').fadeOut();
    }
});

// Butona tıklandığında sayfayı animasyonlu olarak yukarı kaydır
$('#scrollToTopBtn').on('click', function() {
    // 600 milisaniyede yumuşak kaydırma
    $('html, body').animate({scrollTop: 0}, 600); 
    return false; // Varsayılan tıklama olayını engelle
});