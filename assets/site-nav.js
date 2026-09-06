(function () {
  var toggle = document.querySelector(".mobile-menu-toggle");
  var navigation = document.getElementById("site-navigation");
  if (!navigation) return;

  function closeMenu() {
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      navigation.classList.toggle("is-open", !open);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeMenu();
        toggle.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 560) closeMenu();
    });
  }

  navigation.addEventListener("click", function (event) {
    if (event.target.closest("a")) closeMenu();
  });
})();
