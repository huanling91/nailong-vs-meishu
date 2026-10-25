/* ============================================================
   Service Worker —— PWA 离线缓存
   · App Shell（html/css/js/vendor）：Cache-First
   · 大资源（glb/图片）：Stale-While-Revalidate
   · 版本号变更时清旧缓存
   ============================================================ */
var VER = "nv-v5-sfe10";
var SHELL = [
  "./",
  "./index.html",
  "./css/style.css?v=sfc1",
  "./vendor/three.min.js",
  "./vendor/GLTFLoader.js",
  "./js/sys.js?v=sfc1",
  "./js/sfx.js?v=sfc1",
  "./js/core.js?v=sfc1",
  "./js/models.js?v=sfc1",
  "./js/glb.js?v=sfc1",
  "./js/anims.js?v=sfc1",
  "./js/fx.js?v=sfc1",
  "./js/stage.js?v=sfc1",
  "./js/cinema.js?v=sfc1",
  "./js/net.js?v=sfc1",
  "./js/game.js?v=sfc1",
  "./manifest.json",
  "./assets/naiwa-webp.glb",
  "./assets/meishu-webp.glb",
  "./assets/naiwa-portrait.jpg?v=p2",
  "./assets/meishu-portrait.jpg?v=p2",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VER).then(function (c) {
      return c.addAll(SHELL).catch(function () { /* 单项失败不阻塞安装 */ });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== VER) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;           // 第三方（PeerJS）直连
  if (e.request.method !== "GET") return;
  /* 页面导航：Network-First —— 保证 HTML 更新永远生效，离线才回缓存 */
  if (e.request.mode === "navigate" || (e.request.destination === "document")) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        caches.open(VER).then(function (c) { c.put(e.request, res.clone()); });
        return res;
      }).catch(function () {
        return caches.match(e.request).then(function (hit) {
          return hit || caches.match("./index.html");
        });
      })
    );
    return;
  }
  var isBig = /\.(glb|jpg|png|webp)$/i.test(url.pathname);
  if (isBig) {
    /* Stale-While-Revalidate */
    e.respondWith(
      caches.open(VER).then(function (c) {
        return c.match(e.request).then(function (hit) {
          var fetching = fetch(e.request).then(function (res) {
            if (res && res.ok) c.put(e.request, res.clone());
            return res;
          }).catch(function () { return hit; });
          return hit || fetching;
        });
      })
    );
    return;
  }
  /* Cache-First */
  e.respondWith(
    caches.match(e.request, { ignoreSearch: url.pathname.indexOf(".js") >= 0 || url.pathname.indexOf(".css") >= 0 ? false : true }).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res && res.ok && url.pathname !== "/") {
          caches.open(VER).then(function (c) { c.put(e.request, res.clone()); });
        }
        return res;
      });
    })
  );
});
