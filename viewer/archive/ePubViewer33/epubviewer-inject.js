function _isRavenDisabled() {
    try {
        if (typeof disableRaven !== 'undefined' && disableRaven) return true;
        return false;
    } catch (ex) {
        return false;
    }
}

// if (!_isRavenDisabled() && (window.location.hostname != "https://hy-kitap.github.io")) {
//     window.disableRaven = true;
//     console.log("If you are planning to make changes to your own copy of ePubViewer, it would be nice if you could remove the Sentry error reporting (all the Raven // stuff). Please also remove Google Analytics. Thanks!");
// }

// if (window.location.hostname == "hy-kitap.github.io") {
//     alert("Please remove Google Analytics from the code before re-using ePubViewer. Also, ensure the MIT license terms are being followed.");
//     window.location = "https://hy-kitap.github.io/viewer/ePubViewer3";
// }

// https://devnode.devtechnosys.tech/holyreads/
//if (window.location.toString().indexOf("/holyreads") > -1) {
//  window.location = "data:text/plain,Please remove Google Analytics and Sentry.js (Raven) from ePubViewer before re-using it. Also, ensure you follow the MIT licence terms.";

    // maybe this will be enough to get their attention...
//    window.setTimeout(function() {
//        document.body.appendChild(document.createElement("script")).innerText = "ePubViewer.doBook(\"https://hy-kitap.github.io/assets/Harun-Yahya-Kitaplar/20/epub/20sorudaEvrimTeorisi_5b.epub\")";
//    }, 6000);
//    document.querySelectorAll("#navbarDropdownMenuLink").forEach(function (el) { el.innerHTML = "ePubViewer User"; });
//    document.querySelectorAll(".nav-link").forEach(function (el) { el.href = "https://hy-kitap.github.io/viewer/ePubViewer3"; }); 
}

// if (window.location.hostname == "hy-kitap.github.io" || window.location.hostname.indexOf("https://hy-kitap.github.io/viewer/ePubViewer3") > -1) {
//     window.location = "data:text/plain,Please remove Google Analytics and Sentry.js (Raven) from ePubViewer before re-using it. Also, ensure you follow the MIT licence terms.";
// }

