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
            ses.src = x;
            y = i;
        }
    });

    // Ses bittiğinde otomatik sonraki parçaya geç
    ses.addEventListener("ended", function() {
        // Şu anki satırın rengini sıfırla
        liste[y].style.color = "";

        y++;

        if (index === y) {
            // Liste sonuna gelindi, başa dön
            y = 0;
        }

        // Yeni satırı mavi yap ve oynat
        liste[y].style.color = "blue";
        var ad = liste[y].getAttribute("data-src");
        ses.src = ad;
    });
}
