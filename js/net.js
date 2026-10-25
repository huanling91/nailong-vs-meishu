/* ============================================================
   联机：同机标签页用 BroadcastChannel；跨设备走 PeerJS 云信令 + WebRTC
   ============================================================ */
(function (NV) {
  "use strict";

  function rid() {
    const s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let o = "";
    for (let i = 0; i < 4; i++) o += s.charAt((Math.random() * s.length) | 0);
    return o;
  }

  function loadPeerJs() {
    return new Promise(function (resolve) {
      if (window.Peer) { resolve(true); return; }
      const s = document.createElement("script");
      s.src = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
      s.onload = function () { resolve(!!window.Peer); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  function Net() {
    this.role = null;
    this.ready = false;
    this.room = "";
    this.selfId = "p" + Math.random().toString(36).slice(2, 8);
    this._bc = null;
    this._peer = null;
    this._conn = null;
    this._seq = 0;
    this.onReady = null;
    this.onMsg = null;
    this.onLost = null;
    this.onLog = null;
  }

  Net.prototype.log = function (m) {
    if (this.onLog) this.onLog(m);
  };

  Net.prototype._in = function (data) {
    if (!data || data.from === this.selfId) return;
    if (data.t === "hello" || data.t === "join") {
      if (data.name) this.peerName = data.name;
      if (this.role === "host" && !this.ready) this._markReady();
      return;
    }
    if (data.t === "ok" && this.role === "guest" && !this.ready) {
      if (data.name) this.peerName = data.name;
      this._markReady();
      return;
    }
    if (data.t === "ping") { this.send({ t: "pong", ts: data.ts }); return; }
    if (data.t === "pong") {
      this.rtt = Math.max(0, Math.round(performance.now() - data.ts));
      if (this.onPing) this.onPing(this.rtt);
      return;
    }
    if (this.onMsg) this.onMsg(data);
  };

  Net.prototype._markReady = function () {
    if (this.ready) return;
    this.ready = true;
    this.log("已连接");
    this.send({ t: this.role === "host" ? "ok" : "join", name: NV.Settings ? NV.Settings.data.name : "" });
    if (this.role === "host") this.send({ t: "ok" });
    /* 心跳测延迟 */
    const self = this;
    this._pingT = setInterval(function () {
      if (!self.ready) return;
      self.send({ t: "ping", ts: performance.now() });
    }, 2000);
    if (this.onReady) this.onReady();
  };

  Net.prototype.send = function (obj) {
    obj.from = this.selfId;
    obj.n = ++this._seq;
    if (this._bc) {
      try { this._bc.postMessage(obj); } catch (e) {}
    }
    if (this._conn && this._conn.open) {
      try { this._conn.send(obj); } catch (e) {}
    }
  };

  Net.prototype._wireBc = function (room) {
    if (typeof BroadcastChannel === "undefined") return;
    this._bc = new BroadcastChannel("vinyl-arena-" + room);
    const self = this;
    this._bc.onmessage = function (ev) { self._in(ev.data); };
  };

  Net.prototype._wireConn = function (conn) {
    const self = this;
    this._conn = conn;
    conn.on("data", function (d) { self._in(d); });
    conn.on("open", function () {
      self.send({ t: self.role === "host" ? "ok" : "join" });
      if (self.role === "guest") self._markReady();
    });
    conn.on("close", function () {
      self.ready = false;
      if (self.onLost) self.onLost();
    });
  };

  Net.prototype.host = function (room) {
    const self = this;
    this.role = "host";
    this.room = room || rid();
    this._wireBc(this.room);
    this.send({ t: "hello" });
    this.log("房间 " + this.room + " · 等待对手（可开第二个标签页加入）");
    loadPeerJs().then(function (ok) {
      if (!ok) { self.log("跨设备联机库未加载，同机双开仍可用"); return; }
      try {
        self._peer = new window.Peer("vinyl" + self.room, { debug: 0 });
        self._peer.on("open", function () { self.log("房间 " + self.room + " · 可跨设备加入"); });
        self._peer.on("connection", function (conn) { self._wireConn(conn); });
        self._peer.on("error", function (err) { self.log("信令：" + (err && err.type ? err.type : err)); });
      } catch (e) {
        self.log("WebRTC 启动失败，仅同机频道可用");
      }
    });
    return this.room;
  };

  Net.prototype.join = function (room) {
    const self = this;
    this.role = "guest";
    this.room = String(room || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (this.room.length < 4) { this.log("房间码无效"); return Promise.reject(new Error("bad room")); }
    this._wireBc(this.room);
    this.send({ t: "join" });
    this.log("正在加入 " + this.room + " …");
    setTimeout(function () {
      if (!self.ready) self.log("同机未找到主机，尝试跨设备…");
    }, 500);
    return loadPeerJs().then(function (ok) {
      if (!ok || self.ready) return;
      return new Promise(function (resolve) {
        try {
          self._peer = new window.Peer({ debug: 0 });
          self._peer.on("open", function () {
            const conn = self._peer.connect("vinyl" + self.room, { reliable: true });
            self._wireConn(conn);
            resolve();
          });
          self._peer.on("error", function (err) {
            self.log("加入失败：" + (err && err.type ? err.type : err));
            resolve();
          });
        } catch (e) { resolve(); }
      });
    });
  };

  Net.prototype.close = function () {
    this.ready = false;
    clearInterval(this._pingT);
    try { if (this._bc) this._bc.close(); } catch (e) {}
    try { if (this._conn) this._conn.close(); } catch (e) {}
    try { if (this._peer) this._peer.destroy(); } catch (e) {}
    this._bc = this._conn = this._peer = null;
  };

  NV.Net = Net;
  NV.netRoomId = rid;
})(window.NV);
