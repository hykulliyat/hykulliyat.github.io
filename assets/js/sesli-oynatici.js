// sesli-oynatici.js
// Bu script, HTML içeriği yüklendikten sonra çalışacaktır (defer sayesinde).

var ses = document.getElementById("audio");
var akordeonlar = document.querySelectorAll(".akerdion");

// Ses oynatıcı yoksa (hata oluşmaması için kontrol)
if (!ses) {
  console.warn("Ses oynatıcı bulunamadı. Script çalışmıyor.");
} else {
  var currentIndex = 0;
  var currentList = null;

  // Her akordeon için liste öğelerini dinle
  akordeonlar.forEach(function(akordeon) {
    var listeItems = akordeon.querySelectorAll("li");
    
    listeItems.forEach(function(item, index) {
      item.onclick = function() {
        // Tüm akordeonlardaki tüm öğelerin rengini sıfırla
        document.querySelectorAll(".akerdion li").forEach(function(li) {
          li.style.color = "";
        });
        
        // Tıklanan öğeyi mavi yap
        item.style.color = "blue";
        
        // Şu anki listeyi ve indexi kaydet
        currentList = listeItems;
        currentIndex = index;
        
        // Önce ana src'yi dene
        var src = item.getAttribute("data-src");
        var altSrc = item.getAttribute("data-alt-src");
        
        ses.src = src;
        ses.load();
        
        // Oynatmayı dene
        var playPromise = ses.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(function(error) {
            // Ana kaynak başarısız olursa alternatifi dene
            console.log("Ana kaynak yüklenemedi, alternatif deneniyor...");
            if (altSrc) {
              ses.src = altSrc;
              ses.load();
              ses.play().catch(function(err) {
                console.error("Her iki kaynak da yüklenemedi:", err);
              });
            }
          });
        }
      };
    });
  });

  // Ses bittiğinde otomatik sonraki parçaya geç
  ses.addEventListener("ended", function() {
    if (!currentList || currentList.length === 0) return;
    
    // Şu anki satırın rengini sıfırla
    currentList[currentIndex].style.color = "";
    
    currentIndex++;
    
    // Liste sonuna gelindiyse dur (başa dönme)
    if (currentIndex >= currentList.length) {
      currentIndex = 0;
      return;
    }
    
    // Yeni satırı mavi yap ve oynat
    currentList[currentIndex].style.color = "blue";
    
    var src = currentList[currentIndex].getAttribute("data-src");
    var altSrc = currentList[currentIndex].getAttribute("data-alt-src");
    
    ses.src = src;
    ses.load();
    
    var playPromise = ses.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(function(error) {
        console.log("Ana kaynak yüklenemedi, alternatif deneniyor...");
        if (altSrc) {
          ses.src = altSrc;
          ses.load();
          ses.play().catch(function(err) {
            console.error("Her iki kaynak da yüklenemedi:", err);
          });
        }
      });
    }
  });

  // Hata durumunda alternatif kaynağı dene
  ses.addEventListener("error", function() {
    if (!currentList || currentList.length === 0) return;
    
    var currentItem = currentList[currentIndex];
    var altSrc = currentItem.getAttribute("data-alt-src");
    
    if (altSrc && ses.src.indexOf(altSrc) === -1) {
      console.log("Hata oluştu, alternatif kaynak deneniyor...");
      ses.src = altSrc;
      ses.load();
      ses.play().catch(function(err) {
        console.error("Alternatif kaynak da yüklenemedi:", err);
      });
    }
  });
}