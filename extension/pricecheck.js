// Đọc GIÁ YÊN + CÒN/HẾT HÀNG từ mã HTML của trang sản phẩm (Amazon.co.jp, Rakuten...).
// Dùng trong background.js (importScripts) và cũng chạy được bằng Node để thử.
// Nguyên tắc: đọc không chắc thì trả "unknown" (không đoán số) để khỏi báo sai giá.
(function (root) {
  var ALLOWED = [/(^|\.)amazon\.co\.jp$/i, /(^|\.)rakuten\.co\.jp$/i, /^amzn\.asia$/i, /^amzn\.to$/i];

  function allowedUrl(u) {
    try {
      var x = new URL(u);
      return x.protocol === "https:" && ALLOWED.some(function (r) { return r.test(x.hostname); });
    } catch (e) {
      return false;
    }
  }
  function isAmazonUrl(u) {
    try { return /(^|\.)amazon\.co\.jp$/i.test(new URL(u).hostname); } catch (e) { return false; }
  }
  function strip(s) {
    return String(s || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function toNum(s) {
    var n = parseInt(String(s).replace(/[^\d]/g, ""), 10);
    return n > 0 ? n : null;
  }

  // ---- JSON-LD (Rakuten và nhiều shop khác) ----
  function jsonLdProducts(html) {
    var out = [];
    var re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    var m;
    while ((m = re.exec(html))) {
      var data;
      try { data = JSON.parse(m[1].trim()); } catch (e) { continue; }
      (function walk(n) {
        if (!n) return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (typeof n !== "object") return;
        var t = n["@type"];
        var isProduct = t === "Product" || (Array.isArray(t) && t.indexOf("Product") >= 0);
        if (isProduct) out.push(n);
        if (n["@graph"]) walk(n["@graph"]);
      })(data);
    }
    return out;
  }
  function fromJsonLd(html) {
    var prods = jsonLdProducts(html);
    for (var i = 0; i < prods.length; i++) {
      var offers = prods[i].offers;
      if (!offers) continue;
      var list = Array.isArray(offers) ? offers : [offers];
      for (var j = 0; j < list.length; j++) {
        var o = list[j] || {};
        var p = o.price != null ? o.price : o.lowPrice;
        var price = p != null ? toNum(Math.round(parseFloat(String(p).replace(/,/g, "")))) : null;
        var oos = /OutOfStock|SoldOut|Discontinued/i.test(String(o.availability || ""));
        if (price || oos) return { price: price, oos: oos };
      }
    }
    return null;
  }

  // ---- Amazon.co.jp ----
  function fromAmazon(html) {
    var avail = "";
    var ai = html.indexOf('id="availability"');
    if (ai >= 0) avail = strip(html.substr(ai, 700));
    var oos =
      /在庫切れ|現在お取り扱いできません|入荷時期は未定|Currently unavailable|一時的に在庫切れ/.test(avail) ||
      html.indexOf('id="outOfStock"') >= 0;

    var price = null;
    var ids = ["corePrice_feature_div", "corePriceDisplay_desktop_feature_div", "apex_desktop", "priceblock_ourprice", "priceblock_dealprice", "price_inside_buybox", "tp_price_block_total_price_ww"];
    for (var i = 0; i < ids.length && !price; i++) {
      var idx = html.indexOf('id="' + ids[i] + '"');
      if (idx < 0) continue;
      var m = /a-offscreen">\s*(?:[￥¥]|JPY)?\s*([\d,]+)/.exec(html.substr(idx, 4000));
      if (m) price = toNum(m[1]);
    }
    if (!price) {
      var m2 = /"priceAmount"\s*:\s*([\d.]+)/.exec(html);
      if (m2) price = toNum(Math.round(parseFloat(m2[1])));
    }
    return { price: price, oos: oos };
  }

  // ---- Rakuten (dự phòng khi không có JSON-LD) ----
  function fromRakutenText(html) {
    var oos = /この商品は(?:現在)?(?:売り切れ|販売して)|SOLD\s*OUT|在庫なし/.test(strip(html).slice(0, 20000));
    var m = /class="price2"[^>]*>\s*([\d,]+)\s*円/.exec(html);
    return { price: m ? toNum(m[1]) : null, oos: oos };
  }

  // httpStatus: mã trả về của trang. Kết quả: { status, jpy, note }
  //   status: ok (có giá) | oos (hết hàng) | gone (link không còn) | blocked (bị yêu cầu xác nhận robot) | unknown (không đọc được)
  function parsePage(html, finalUrl, httpStatus) {
    html = String(html || "");
    if (httpStatus === 404 || httpStatus === 410) return { status: "gone", jpy: null, note: "Trang không còn (404)" };
    if (httpStatus === 429 || httpStatus === 503 || /\/errors\/validateCaptcha/.test(html)) return { status: "blocked", jpy: null, note: "Bị yêu cầu xác nhận không phải robot" };
    if (/ご指定のページが見つかりませんでした|お探しのページが見つかりません|Sorry! We couldn't find that page|dogsofamazon/i.test(html)) return { status: "gone", jpy: null, note: "Trang không còn" };

    var r = null;
    if (isAmazonUrl(finalUrl)) r = fromAmazon(html);
    else r = fromJsonLd(html) || fromRakutenText(html);

    if (r.oos) return { status: "oos", jpy: r.price || null, note: "Hết hàng" };
    if (r.price) return { status: "ok", jpy: r.price, note: "" };
    return { status: "unknown", jpy: null, note: "Không đọc được giá trên trang này" };
  }

  var api = { allowedUrl: allowedUrl, parsePage: parsePage };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.HNPriceCheck = api;
})(typeof self !== "undefined" ? self : this);
