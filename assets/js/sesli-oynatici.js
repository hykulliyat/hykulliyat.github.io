// sesli-oynatici.js
// Bu script, HTML içeriği yüklendikten sonra çalışacaktır (defer sayesinde).

var ses = document.getElementById("audio");
var liste = document.querySelectorAll("#liste li");
var index = liste.length;

// Liste boşsa veya ses oynatıcı yoksa (hata oluşmaması için kontrol)
if (liste.length === 0 || !ses) {
    console.warn("Ses oynatıcı veya çalma listesi öğeleri bulunamadı. Script çalışmıyor.");
} else {

    // İlk satırı mavi yap
    liste[0].style.color = "blue";
    var y = 0;

    // Alternatif kaynaklarla ses oynatma fonksiyonu
    function playWithAlternativeSources(sources, elementIndex) {
        var currentSourceIndex = 0;
        
        function tryNextSource() {
            if (currentSourceIndex >= sources.length) {
                console.error("Tüm kaynaklar başarısız oldu:", sources);
                alert("Ses dosyası yüklenemedi. Lütfen internet bağlantınızı kontrol edin.");
                return;
            }
            
            var sourceUrl = sources[currentSourceIndex].trim();
            console.log("Denenen kaynak:", sourceUrl);
            
            ses.src = sourceUrl;
            ses.load();
            
            ses.play().then(function() {
                console.log("Başarıyla oynatılıyor:", sourceUrl);
                y = elementIndex;
            }).catch(function(error) {
                console.warn("Kaynak başarısız:", sourceUrl, error);
                currentSourceIndex++;
                tryNextSource();
            });
        }
        
        tryNextSource();
    }

    // Tüm liste öğelerine tıklama olayını ekle
    [].forEach.call(liste, function(el, i) {
        el.onclick = function() {
            // Tüm satırların rengini sıfırla
            for (var j = 0; j <= index - 1; j++) {
                liste[j].style.color = "";
            }
            // Tıklanan satırı mavi yap
            el.style.color = "blue";

            // Tıklanan satırın mp3 linklerini al
            var sources = el.getAttribute("data-src").split(',');
            
            // Alternatif kaynaklarla oynat
            playWithAlternativeSources(sources, i);
        }
    });

    // İlk parçayı yükle
    var firstSources = liste[0].getAttribute("data-src").split(',');
    playWithAlternativeSources(firstSources, 0);

    // Ses bittiğinde otomatik sonraki parçaya geç
    ses.addEventListener("ended", function() {
        // Şu anki satırın rengini sıfırla
        if (liste[y]) {
            liste[y].style.color = "";
        }

        y++;

        if (index === y) {
            // Liste sonuna gelindi, başa dön
            y = 0;
        }

        // Yeni satırı mavi yap ve oynat
        if (liste[y]) {
            liste[y].style.color = "blue";
            var sources = liste[y].getAttribute("data-src").split(',');
            playWithAlternativeSources(sources, y);
        }
    });

    // Hata durumunda bir sonraki kaynağı deneyelim
    ses.addEventListener('error', function(e) {
        console.error('Ses yükleme hatası:', e);
        // Burada hata yönetimi yapabilirsiniz
    });
}