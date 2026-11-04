// GMT 展示页交互
(function () {
  'use strict';

  // 移动端菜单
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('show');
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') links.classList.remove('show');
    });
  }

  // 滚动入场动画
  var targets = document.querySelectorAll(
    '.card, .stat, .model, .param, .step, .panel, .q, .cta'
  );
  targets.forEach(function (el, i) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(18px)';
    el.style.transition = 'opacity .5s ease, transform .5s ease';
    el.style.transitionDelay = (i % 8) * 40 + 'ms';
  });

  function inView(el) {
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight - 60 && r.bottom > 0;
  }

  function reveal() {
    targets.forEach(function (el) {
      if (el.dataset.shown) return;
      if (inView(el)) {
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.dataset.shown = '1';
      }
    });
  }

  reveal();
  window.addEventListener('scroll', reveal, { passive: true });
  window.addEventListener('resize', reveal);

  // 下载按钮：本地文件不存在时给出提示（外链直接放行，避免跨域 HEAD 被 CORS 拦掉）
  document.querySelectorAll('a[href$=".apk"]').forEach(function (a) {
    var href = a.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      return;
    }
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var href = a.getAttribute('href');
      fetch(href, { method: 'HEAD' })
        .then(function (r) {
          if (r.ok) window.location.href = href;
          else alert('安装包暂未上传，请将客户端放到：\n' + href);
        })
        .catch(function () {
          alert('安装包暂未上传，请将客户端放到：\n' + href);
        });
    });
  });
  // ============ 产品切换栏 ============
  // 新增软件：HTML 里加一个 .ptab[data-p=key] + 一个 [data-panel=key] 即可，无需改这里
  var tabs = document.querySelectorAll('.ptab');
  var panels = document.querySelectorAll('[data-panel]');
  var pLinks = document.querySelectorAll('[data-p]');

  function showPanel(key, scrollTop) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-p') === key;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(function (p) {
      if (p.getAttribute('data-panel') === key) {
        p.hidden = false;
        p.style.animation = 'none';
        void p.offsetWidth;      // 重放入场动画
        p.style.animation = '';
      } else {
        p.hidden = true;
      }
    });
    // 导航 / 页脚里的链接按归属显示：只显示属于当前软件的链接，
    // 其余隐藏（.ptab 切换按钮没有 href，不受影响，永远常驻）
    pLinks.forEach(function (a) {
      if (!a.hasAttribute('href')) return;
      a.classList.toggle('p-hidden', a.getAttribute('data-p') !== key);
    });
    // 切换后立刻补一次入场动画（否则滚动前卡片会是透明的）
    if (typeof reveal === 'function') {
      reveal();
      setTimeout(reveal, 120);
    }
    if (scrollTop) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      showPanel(t.getAttribute('data-p'), true);
    });
  });

  // 首次加载：按默认选中的图标同步一次导航/页脚链接显隐
  (function () {
    var cur = document.querySelector('.ptab.active');
    if (cur) showPanel(cur.getAttribute('data-p'), false);
  })();

  // ============ 鼠标彗星拖尾（彩色） ============
  // 1) 系统开了「减少动态效果」才关掉；
  // 2) 触屏只在首次 touchstart 之后才关掉（这样手机/平板不会被画一堆尾巴，
  //    但普通带鼠标的电脑、以及触摸本 + 鼠标的场景都会正常出效果）；
  // 3) 别用 (pointer:fine) 之类去卡启用条件——很多内置预览 / WebView 里那个值是 false，
  //    卡住就整个特效不启动，看着像"没做完"。
  (function () {
    var c = document.getElementById('fx');
    if (!c) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var enabled = true;
    window.addEventListener('touchstart', function () { enabled = false; },
      { passive: true, once: true });

    var ctx = null;
    try { ctx = c.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, parts = [], hue = 0, running = false, lastT = 0;
    var LIFE = 70, MAX = 70;                     // 尾巴长度（帧）与粒子上限

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      c.style.width = W + 'px'; c.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function spawn(x, y) {
      parts.push({
        x: x, y: y,
        r: 6 + Math.random() * 5,
        h: (hue + Math.random() * 70) % 360,
        life: LIFE, max: LIFE
      });
      if (parts.length > MAX) parts.splice(0, parts.length - MAX);
    }

    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      hue = (hue + 1.3) % 360;                    // 整体色相缓慢流转 → 彩色渐变尾

      // 彗尾：相邻粒子连成一条越来越细的彩线
      for (var i = 0; i < parts.length - 1; i++) {
        var a = parts[i], b = parts[i + 1];
        var k = (a.life / a.max + b.life / b.max) / 2;
        ctx.globalAlpha = k * k * 0.4;
        ctx.strokeStyle = 'hsl(' + a.h + ', 96%, 66%)';
        ctx.lineWidth = 0.8 + k * 2.4;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      // 亮斑（带发光）
      ctx.shadowBlur = 16;
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j];
        p.life -= 1;
        if (p.life <= 0) { parts.splice(j, 1); j--; continue; }
        var t = p.life / p.max;
        ctx.globalAlpha = Math.min(1, t * t * 1.15);
        ctx.shadowColor = 'hsl(' + p.h + ', 96%, 60%)';
        ctx.fillStyle = 'hsl(' + p.h + ', 96%, 62%)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.25 + t * 0.75), 0, 6.2832); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      running = parts.length > 0;
      // 尾巴散完就停掉动画循环（别让 rAF 白转）
      if (running || Date.now() - lastT < 500) requestAnimationFrame(draw);
    }

    var pending = false;
    function onMove(x, y) {
      if (!enabled || pending) return;            // 每帧最多生成一粒，别刷爆
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        lastT = Date.now();
        spawn(x, y);
        if (!running) { running = true; requestAnimationFrame(draw); }
      });
    }

    // mousemove 兜底：不管 pointer 事件支不支持，鼠标一动就有尾巴
    window.addEventListener('mousemove', function (e) {
      onMove(e.clientX, e.clientY);
    }, { passive: true });
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;   // 笔/触屏不画
      onMove(e.clientX, e.clientY);
    }, { passive: true });

    // 鼠标移出窗口就把尾巴收掉
    document.addEventListener('mouseleave', function () { parts.length = 0; });
    window.addEventListener('pointerout', function (e) {
      if (!e.relatedTarget) parts.length = 0;
    }, { passive: true });

    // 自检标记：初始化成功会在 <html> 上写 data-fx="on"，方便排查
    document.documentElement.setAttribute('data-fx', 'on');
  })();

  // 导航 / 页脚锚点：若目标属于别的软件，先切过去再滚动
  pLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      var key = a.getAttribute('data-p');
      var id = a.getAttribute('href');
      if (!key || !id || id.charAt(0) !== '#') return;
      e.preventDefault();
      var needSwitch = !document.querySelector('[data-panel="' + key + '"]:not([hidden])');
      if (needSwitch) showPanel(key, false);
      setTimeout(function () {
        var el = document.querySelector(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, needSwitch ? 80 : 0);
    });
  });
})();