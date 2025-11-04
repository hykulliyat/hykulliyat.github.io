// Yaş hesaplama
        function calculateAge(birthDate) {
            const birth = new Date(birthDate);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            
            return age;
        }
        
        // Doğum tarihini al ve yaşı hesapla
        const birthDate = "1956-02-02";
        const age = calculateAge(birthDate);
        
        // Yaşı HTML'e ekle
        document.getElementById('yas').textContent = age + " yaşında";