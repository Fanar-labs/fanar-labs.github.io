/* hub.js — общий скрипт хаба. До 2026-08-10 лайтбокс был скопирован на каждой
   странице проекта, и правка расходилась по трём файлам. */
(function () {
  'use strict';

  /* ── Хронология открывается на СЕГОДНЯ ────────────────────────────────
     Решение автора 08-10: самое актуальное — в правом кадре, а лента уходит
     в прошлое влево. Разметка остаётся хронологической (старое → новое), это
     честный порядок для чтения и для доступности; сдвигаем только начальный
     взгляд, чтобы человек сперва видел, чем проект стал, а не с чего начинал. */
  document.querySelectorAll('.timeline:not(.ryad)').forEach(function (t) {
    t.scrollLeft = t.scrollWidth;
  });

  /* ── Отбор каталога по тегу (10-07) ──────────────────────────────────
     Тег живёт в адресе: #education открывает каталог уже отобранным, и такой
     адрес можно дать в отклике. Без скрипта видны все карточки. */
  var filter = document.querySelector('.filter');
  if (filter) {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.card[data-tags]'));
    var apply = function (jump) {
      var t = decodeURIComponent(location.hash.slice(1));
      if (!filter.querySelector('[data-tag="' + t + '"]')) t = '';
      cards.forEach(function (c) {
        c.hidden = !!t && (' ' + c.getAttribute('data-tags') + ' ').indexOf(' ' + t + ' ') < 0;
      });
      filter.querySelectorAll('a').forEach(function (a) {
        a.classList.toggle('on', a.getAttribute('data-tag') === t);
      });
      // тег нажат внизу карточки — вернуть взгляд к строке тегов
      if (jump && filter.getBoundingClientRect().top < 0) {
        window.scrollTo(0, filter.getBoundingClientRect().top + window.pageYOffset - 60);
      }
    };
    filter.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (a && a.getAttribute('data-tag') === '') {      // «Все» — без прыжка наверх
        e.preventDefault();
        history.pushState(null, '', location.pathname + location.search);
        apply(false);
      }
    });
    window.addEventListener('hashchange', function () { apply(true); });
    window.addEventListener('popstate', function () { apply(false); });
    apply(false);
  }

  /* ── Лупа ──────────────────────────────────────────────────────────── */
  var lb = document.getElementById('lb');
  if (!lb) return;
  var im = lb.querySelector('img'), last = null;

  document.querySelectorAll('[data-zoom]').forEach(function (el) {
    el.addEventListener('click', function () {
      last = el;
      im.src = el.getAttribute('data-zoom');
      im.alt = (el.querySelector('img') || {}).alt || '';
      lb.classList.add('on');
      lb.focus();
    });
    el.addEventListener('keydown', function (e) {      // с клавиатуры тоже
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    });
  });

  function close() {
    lb.classList.remove('on');
    im.src = '';
    if (last) last.focus();
  }
  lb.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
