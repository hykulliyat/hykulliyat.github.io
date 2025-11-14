// sesli-oynatici.js (Minimal Güncellenmiş Versiyon - Tam Sessiz Fallback)
// Bu script, HTML içeriği yüklendikten sonra çalışacaktır (defer sayesinde).
// Yeni Özellik: Ana kaynak erişilemezse sessizce alternatiften devam eder.
// Tüm hatalar console'a yazılır (kullanıcı görmez); oynatma ve auto-next etkilenmez.

var ses = document.getElementById("audio");
var liste = document.querySelectorAll("#sesli-kitaplar li"); // Değişiklik: #liste → #sesli-kitaplar
var index = liste.length;
// Liste boşsa veya ses oynatıcı yoksa (hata oluşmaması için kontrol)
if (liste.length === 0 || !ses) {
    console.warn("Ses oynatıcı veya çalma listesi öğeleri bulunamadı. Script çalışmıyor.");
} else {
    // İlk satırı mavi yap
    liste[0].style.color = "blue";
    var y = 0;
    // Tüm liste öğelerine tıklama olayını ekle
    [].forEach.call(liste, function(el, i) {
        el.onclick = function() {
            // Tüm satırların rengini sıfırla
            for (var j = 0; j <= index - 1; j++) {
                liste[j].style.color = "";
            }
            // Tıklanan satırı mavi yap
            el.style.color = "blue";
            // Tıklanan satırın mp3 linkini al ve oynat
            var x = el.getAttribute("data-src");
            var altX = el.getAttribute("data-alt-src"); // Alternatif kaynak
            y = i;
            
            // Ana kaynağı yükle ve sessiz fallback uygula
            function yukleKaynak(src, altSrc, isAlt = false) {
                ses.src = src;
                ses.load();
                
                var hataHandler = function(e) {
                    console.log((isAlt ? 'Alt kaynak hatası:' : 'Ana kaynak hatası:'), src);
                    if (!isAlt && altSrc && ses.src !== altSrc) {
                        // Sessizce alternatife geç ve devam et
                        yukleKaynak(altSrc, null, true);
                    } else {
                        console.warn('Tüm kaynaklar başarısız:', src);
                        // Sessiz dur; auto-next etkilenmez
                    }
                    ses.removeEventListener('error', hataHandler);
                };
                ses.addEventListener('error', hataHandler, { once: true });
                
                // Her zaman oynatmaya çalış (sessiz)
                ses.play().catch(function(e) {
                    console.log('Oynatma hatası:', e);
                });
            }
            
            yukleKaynak(x, altX);
        }
    });
    // Ses bittiğinde otomatik sonraki parçaya geç
    ses.addEventListener("ended", function() {
        // Mevcut error listener'ı temizle
        ses.removeEventListener('error', ses._currentFallbackHandler || function(){});
        
        // Şu anki satırın rengini sıfırla
        liste[y].style.color = "";
        y++;
        if (index === y) {
            y = 0;
        }
        // Yeni satırı mavi yap ve sessiz yükle
        liste[y].style.color = "blue";
        var ad = liste[y].getAttribute("data-src");
        var altAd = liste[y].getAttribute("data-alt-src");
        
        // Aynı sessiz fallback mantığı (yeniden kullanılabilir)
        function yukleSonraki(src, altSrc, isAlt = false) {
            ses.src = src;
            ses.load();
            
            var hataHandler = function(e) {
                console.log((isAlt ? 'Alt kaynak hatası (next):' : 'Ana kaynak hatası (next):'), src);
                if (!isAlt && altSrc && ses.src !== altSrc) {
                    yukleSonraki(altSrc, null, true);
                } else {
                    console.warn('Tüm kaynaklar başarısız (next):', src);
                }
                ses.removeEventListener('error', hataHandler);
            };
            ses.addEventListener('error', hataHandler, { once: true });
            
            ses.play().catch(function(e) {
                console.log('Oynatma hatası (next):', e);
            });
        }
        
        yukleSonraki(ad, altAd);
    });
    
    // Global error handling (sessiz)
    ses.addEventListener('error', function(e) {
        console.error('Genel hata:', e);
    });
}