(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var yearEl = document.getElementById("y");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  var header = document.querySelector(".site-header");
  if (header) {
    var updateHeader = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    };
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
  }

  var menuButton = document.querySelector(".menu-button");
  var mainNav = document.getElementById("main-nav");
  if (menuButton && mainNav) {
    menuButton.addEventListener("click", function () {
      var isOpen = document.body.classList.toggle("menu-open");
      menuButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        document.body.classList.remove("menu-open");
        menuButton.setAttribute("aria-expanded", "false");
      });
    });
  }

  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );

    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  var preview = document.querySelector("[data-panel-preview]");
  if (preview) {
    var tabs = Array.prototype.slice.call(preview.querySelectorAll("[data-panel-tab]"));
    var views = Array.prototype.slice.call(preview.querySelectorAll("[data-panel-view]"));
    var currentIndex = 0;
    var timer = null;

    function activate(index) {
      if (!tabs.length || !views.length) return;
      currentIndex = ((index % views.length) + views.length) % views.length;

      tabs.forEach(function (tab, i) {
        var active = i === currentIndex;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });

      views.forEach(function (view, i) {
        view.classList.toggle("is-active", i === currentIndex);
      });
    }

    function startRotation() {
      if (prefersReducedMotion || views.length < 2) return;
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(function () {
        activate(currentIndex + 1);
      }, 4800);
    }

    tabs.forEach(function (tab, index) {
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", index === 0 ? "true" : "false");
      tab.addEventListener("click", function () {
        activate(index);
        startRotation();
      });
    });

    activate(0);
    startRotation();
  }
})();
