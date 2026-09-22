(function () {
    var html = document.documentElement;
    var revealed = false;
    function reveal() {
        if (revealed) return;
        revealed = true;
        html.classList.add('fonts-ready');
    }
    var fallback = setTimeout(reveal, 1500);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
            clearTimeout(fallback);
            requestAnimationFrame(function () { requestAnimationFrame(reveal); });
        });
    } else {
        clearTimeout(fallback);
        reveal();
    }
})();