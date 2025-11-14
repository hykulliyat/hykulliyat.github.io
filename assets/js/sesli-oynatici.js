// sesli-oynatici.js (Tam Sessiz Fallback - HTML Değişikliksiz, Multi-Kitap Desteği)
// Ana kaynak hata verirse sessizce alternatife geçer (varsa); UI etkilenmez. Tüm <li data-src>'leri kapsar.

var ses = document.getElementById("audio");
var liste = document.querySelectorAll("li[data-src]"); // Global: Tüm kitap listeleri
var index = liste.length;

if (liste.length === 0 || !ses) {
    console.warn("Ses oynatıcı veya çalma listesi bulunamadı.");
} else {
    liste[0].style.color = "blue"; // İlk item'ı highlight
    var y = 0;

    [].forEach.call(liste, function(el, i) {
        el.onclick = function() {
            // Tüm item'ların rengini sıfırla
            for (var j = 0; j < index; j++) {
                liste[j].style.color = "";
            }
            el.style.color = "blue";
            var x = el.getAttribute("data-src");
            var altX = el.getAttribute("data-alt-src"); // Varsa fallback
            y = i;

            function yukleKaynak(src, altSrc, isAlt = false) {
                ses.src = src;
                ses.load();

                var hataHandler = function(e) {
                    console.log((isAlt ? 'Alt hata:' : 'Ana hata:'), src);
                    if (!isAlt && altSrc && ses.src !== altSrc) {
                        // Sessizce alternatife geç
                        yukleKaynak(altSrc, null, true);
                    } else {
                        console.warn('Kaynaklar başarısız:', src);
                        // Sessiz dur; oynatma devamı manuel
                    }
                    ses.removeEventListener('error', hataHandler);
                };
                ses.addEventListener('error', hataHandler, { once: true });

                ses.play().catch(function(e) {
                    console.log('Oynatma hatası:', e);
                });
            }

            yukleKaynak(x, altX);
        }
    });

    ses.addEventListener("ended", function() {
        ses.removeEventListener('error', ses._currentFallbackHandler || function(){});

        liste[y].style.color = "";
        y = (y + 1) % index; // Döngüsel next (tüm listeler arası)
        liste[y].style.color = "blue";
        var ad = liste[y].getAttribute("data-src");
        var altAd = liste[y].getAttribute("data-alt-src");

        function yukleSonraki(src, altSrc, isAlt = false) {
            ses.src = src;
            ses.load();

            var hataHandler = function(e) {
                console.log((isAlt ? 'Alt hata (next):' : 'Ana hata (next):'), src);
                if (!isAlt && altSrc && ses.src !== altSrc) {
                    yukleSonraki(altSrc, null, true);
                } else {
                    console.warn('Kaynaklar başarısız (next):', src);
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

    ses.addEventListener('error', function(e) {
        console.error('Genel hata:', e);
    });
}