(function () {
  "use strict";

  var yearEl = document.getElementById("y");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* Nav au scroll */
  var nav = document.querySelector(".nav");
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle("is-scrolled", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Révélation au scroll */
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    var revealObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    revealEls.forEach(function (el) {
      revealObs.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* Aperçu hero : rotation des vues */
  var previewRoot = document.querySelector("[data-hero-preview]");
  if (previewRoot) {
    var panes = previewRoot.querySelectorAll(".preview-pane");
    var navItems = previewRoot.querySelectorAll(".preview-nav-item[data-preview-tab]");
    var dots = previewRoot.querySelectorAll(".preview-tabs-dots button");
    var current = 0;
    var timer = null;

    function goTo(index) {
      if (!panes.length) return;
      current = ((index % panes.length) + panes.length) % panes.length;
      panes.forEach(function (pane, i) {
        pane.classList.toggle("is-active", i === current);
      });
      navItems.forEach(function (item, i) {
        item.classList.toggle("is-active", i === current);
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === current);
        dot.setAttribute("aria-selected", i === current ? "true" : "false");
      });
    }

    function startAuto() {
      if (timer) clearInterval(timer);
      timer = setInterval(function () {
        goTo(current + 1);
      }, 4500);
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () {
        goTo(i);
        startAuto();
      });
    });

    navItems.forEach(function (item, i) {
      item.addEventListener("click", function (e) {
        e.preventDefault();
        goTo(i);
        startAuto();
      });
    });

    goTo(0);
    startAuto();
  }

  /* Animation cyclique des lignes actives dans les mocks features */
  document.querySelectorAll("[data-mock-cycle]").forEach(function (block) {
    var rows = block.querySelectorAll(".mock-row");
    if (rows.length < 2) return;
    var idx = 0;
    rows.forEach(function (r, i) {
      if (i === 0) r.classList.add("active");
    });
    setInterval(function () {
      rows[idx].classList.remove("active");
      idx = (idx + 1) % rows.length;
      rows[idx].classList.add("active");
    }, 2800);
  });
})();
