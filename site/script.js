/* ========================================
   Lead Management Consulting - Shared Scripts
   ======================================== */

(function () {
  'use strict';

  // ----------------------------
  // Navbar scroll shadow
  // ----------------------------
  var navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 10) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // ----------------------------
  // Mobile menu toggle
  // ----------------------------
  var toggle = document.querySelector('.navbar__toggle');
  var menu = document.querySelector('.navbar__menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      menu.classList.toggle('open');
      var spans = toggle.querySelectorAll('span');
      if (menu.classList.contains('open')) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      }
    });

    // Close menu on link click
    var links = menu.querySelectorAll('a');
    links.forEach(function (link) {
      link.addEventListener('click', function () {
        menu.classList.remove('open');
        var spans = toggle.querySelectorAll('span');
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      });
    });
  }

  // ----------------------------
  // Scroll fade-in animation
  // ----------------------------
  var fadeElements = document.querySelectorAll('.fade-in');

  if (fadeElements.length > 0) {
    var observerOptions = {
      root: null,
      rootMargin: '0px 0px -60px 0px',
      threshold: 0.1
    };

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    fadeElements.forEach(function (el) {
      observer.observe(el);
    });
  }

  // ----------------------------
  // Active nav link highlight
  // ----------------------------
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  var navLinks = document.querySelectorAll('.navbar__link');
  navLinks.forEach(function (link) {
    var href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

})();
