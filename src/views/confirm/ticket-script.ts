/**
 * Draws each ticket as a shareable PNG, in the browser.
 *
 * Why here and not on the server: Workers have no canvas, and `lib/png.ts` is a
 * 1-bit encoder that can draw a QR matrix and nothing else — no text, no
 * layout. Composing on the client is what makes a designed ticket possible at
 * all, and it has a second payoff: the same Blob feeds `navigator.share`, which
 * on iOS opens the sheet carrying *Save Image* and WhatsApp together. One
 * button covers "put it in my gallery" and "send it to my friend".
 *
 * Progressive enhancement throughout. Without JavaScript, or on a browser
 * missing canvas or the Share API, the download link still points at the bare
 * QR PNG and the door still works — the QR is the ticket, the frame is dressing.
 *
 * Blobs are built once on load rather than on click. iOS Safari drops the user
 * gesture across a long await chain, and loading the QR image is long enough to
 * lose it, so by the time anyone taps, the File already exists.
 */
import { jsonForScript } from "../../lib/core";

export function ticketScript(i: {
  eventSlug: string;
  bandName: string;
  eventName: string;
  whenLine: string;
  venue: string;
  shortCode: string;
  total: number;
}): string {
  return `
(function(){
  // The buy form keeps the buyer's draft in localStorage until their order
  // actually exists, so a refused submit never loses it. It exists now, so
  // this is the point where it stops being needed.
  try { localStorage.removeItem('coverr:' + ${jsonForScript(i.eventSlug)}); } catch (e) {}

  if (!window.HTMLCanvasElement || !document.createElement('canvas').getContext) return;

  var BAND  = ${jsonForScript(i.bandName)};
  var EVENT = ${jsonForScript(i.eventName)};
  var WHEN  = ${jsonForScript(i.whenLine)};
  var VENUE = ${jsonForScript(i.venue)};
  var CODE  = ${jsonForScript(i.shortCode)};

  // Drawn the way the page draws it (DESIGN.md, light surface): the lime
  // ticket with a black outline and a hard shadow, the QR below the
  // perforation on pure white. A ticket gets held up in a bright doorway and
  // sometimes printed, and a dark QR on white scans more reliably than the
  // inverse.
  var CREAM='#FFF4DE', LIME='#B8F35A', WHITE='#FFFFFF', YELLOW='#FFD43B',
      INK='#111111', MUTED='#3B372F';
  var DISPLAY='"Archivo Black","Arial Black",Impact,sans-serif';
  var SANS='-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif';
  var MONO='ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

  // The name is set in the display face, which the page loads with swap. A
  // canvas draws with whatever is loaded at that moment, so wait for it, or
  // the saved ticket keeps the fallback face forever.
  var fontReady = (document.fonts && document.fonts.load)
    ? document.fonts.load('68px "Archivo Black"').catch(function(){})
    : Promise.resolve();

  // 4:5. Instagram and WhatsApp both prefer it, and it is tall enough for the
  // QR to dominate without the stub turning into a poster.
  var W = 1080, H = 1350;

  function font(weight, size, family){ return weight+' '+size+'px '+family; }

  // Greedy wrap. Returns the lines so the caller can centre the block itself.
  function wrap(ctx, text, maxWidth){
    var words = String(text).split(/\\s+/), lines = [], line = '';
    for (var n = 0; n < words.length; n++){
      var test = line ? line+' '+words[n] : words[n];
      if (ctx.measureText(test).width > maxWidth && line){ lines.push(line); line = words[n]; }
      else { line = test; }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawLines(ctx, lines, x, y, lineHeight){
    for (var n = 0; n < lines.length; n++) ctx.fillText(lines[n], x, y + n*lineHeight);
    return y + lines.length*lineHeight;
  }

  function loadImage(src){
    return new Promise(function(resolve, reject){
      var img = new Image();
      // Same origin, so the canvas stays untainted and toBlob is allowed.
      img.onload = function(){ resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // A sticker chip: filled, outlined in ink, text set inside. Returns its width.
  function chip(ctx, text, x, y, fill, size, family){
    ctx.font = font(700, size, family);
    var w = ctx.measureText(text).width + 44;
    roundRect(ctx, x, y, w, size + 32, 14);
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillText(text, x + 22, y + 17);
    return w;
  }

  function compose(token, name, note, index, total){
    return fontReady.then(function(){ return loadImage('/t/'+token+'.png'); }).then(function(qr){
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      ctx.textBaseline = 'top';

      ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);

      // The card, its hard shadow first: offset, no blur — the page's own.
      var cx = 56, cy = 56, cw = W - 130, ch = H - 130, R = 40, SHADOW = 18;
      roundRect(ctx, cx + SHADOW, cy + SHADOW, cw, ch, R);
      ctx.fillStyle = INK; ctx.fill();

      // Measure the top half before painting it, so the perforation lands
      // where the text ends rather than at a guessed height.
      var x = cx + 44, maxW = cw - 88;
      ctx.font = font(700, 26, MONO);
      var eventLines = wrap(ctx, EVENT.toUpperCase(), maxW);
      ctx.font = font(400, 68, DISPLAY);
      var nameLines = wrap(ctx, name, maxW);
      ctx.font = font(500, 28, SANS);
      var noteLines = note ? wrap(ctx, note, maxW) : [];
      ctx.font = font(700, 28, SANS);
      var sideBySide = ctx.measureText(WHEN).width + ctx.measureText(VENUE).width + 44 * 2 + 14 <= maxW;
      var chipsH = sideBySide ? 60 : 60 * 2 + 12;
      var bodyTop = cy + 84 + 40;
      var perfY = bodyTop + eventLines.length * 34 + 6 + nameLines.length * 76 + 14
        + noteLines.length * 36 + (noteLines.length ? 12 : 0) + chipsH + 34;

      // Everything inside the card is drawn clipped to it, so the head band
      // and the white stub take its rounded corners for free.
      ctx.save();
      roundRect(ctx, cx, cy, cw, ch, R); ctx.clip();
      ctx.fillStyle = LIME; ctx.fillRect(cx, cy, cw, perfY - cy);
      ctx.fillStyle = WHITE; ctx.fillRect(cx, perfY, cw, cy + ch - perfY);

      ctx.fillStyle = INK; ctx.fillRect(cx, cy, cw, 84);
      ctx.fillStyle = LIME; ctx.font = font(700, 26, MONO);
      ctx.fillText(BAND.toUpperCase(), cx + 44, cy + 29);
      ctx.textAlign = 'right';
      ctx.fillText(('Boleto '+index+' de '+total).toUpperCase(), cx + cw - 44, cy + 29);
      ctx.textAlign = 'left';

      var y = bodyTop;
      ctx.fillStyle = INK;
      ctx.font = font(700, 26, MONO);
      y = drawLines(ctx, eventLines, x, y, 34) + 6;
      ctx.font = font(400, 68, DISPLAY);
      y = drawLines(ctx, nameLines, x, y, 76) + 14;
      if (noteLines.length){
        ctx.fillStyle = MUTED; ctx.font = font(500, 28, SANS);
        y = drawLines(ctx, noteLines, x, y, 36) + 12;
      }
      var w = chip(ctx, WHEN, x, y, WHITE, 28, SANS);
      if (sideBySide) chip(ctx, VENUE, x + w + 14, y, WHITE, 28, SANS);
      else chip(ctx, VENUE, x, y + 72, WHITE, 28, SANS);

      // Perforation, so it reads as a stub rather than a poster.
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.setLineDash([18, 14]);
      ctx.beginPath(); ctx.moveTo(cx, perfY); ctx.lineTo(cx + cw, perfY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.lineWidth = 8; ctx.strokeStyle = INK;
      roundRect(ctx, cx, cy, cw, ch, R); ctx.stroke();

      // The notches: page-coloured bites out of each edge, ringed in ink.
      [cx, cx + cw].forEach(function(nx){
        ctx.beginPath(); ctx.arc(nx, perfY, 30, 0, Math.PI * 2);
        ctx.fillStyle = CREAM; ctx.fill();
        ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
      });

      // Integer-scale the QR so every module stays a crisp square. Smoothing a
      // QR is what makes one hard to read under a venue's bad lighting.
      var FOOT = 190;                       // room kept for the code chip and the byline
      var room = cy + ch - perfY - 50 - FOOT;
      var scale = Math.max(1, Math.floor(Math.min(maxW - 40, room) / qr.width));
      var size = qr.width * scale;
      var qx = Math.round(cx + (cw - size) / 2);
      var qy = perfY + 50;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qr, qx, qy, size, size);

      // Crop marks, as on the page: outside the QR's own quiet zone.
      ctx.strokeStyle = INK; ctx.lineWidth = 6;
      var m = 18, L = 34;
      [[qx - m, qy - m, 1, 1], [qx + size + m, qy - m, -1, 1],
       [qx - m, qy + size + m, 1, -1], [qx + size + m, qy + size + m, -1, -1]].forEach(function(k){
        ctx.beginPath();
        ctx.moveTo(k[0] + k[2] * L, k[1]); ctx.lineTo(k[0], k[1]); ctx.lineTo(k[0], k[1] + k[3] * L);
        ctx.stroke();
      });

      // The code on a yellow chip, and the byline, hang off the QR rather than
      // off the canvas bottom, so a QR that scales up never collides with them.
      ctx.font = font(700, 34, MONO);
      var cwid = ctx.measureText(CODE).width + 44;
      var below = qy + size + m + 36;
      chip(ctx, CODE, Math.round(cx + (cw - cwid) / 2), below, YELLOW, 34, MONO);

      ctx.textAlign = 'center';
      ctx.fillStyle = MUTED;
      ctx.font = font(500, 22, MONO);
      ctx.fillText('coverr · un producto de macawly.dev', cx + cw / 2, below + 94);
      ctx.textAlign = 'left';

      return new Promise(function(resolve){ c.toBlob(resolve, 'image/png'); });
    });
  }

  var files = {};

  function fileFor(card){
    var token = card.getAttribute('data-token');
    if (files[token]) return Promise.resolve(files[token]);
    return compose(
      token,
      card.getAttribute('data-name'),
      card.getAttribute('data-note'),
      card.getAttribute('data-index'),
      card.getAttribute('data-total')
    ).then(function(blob){
      if (!blob) return null;
      var f = new File([blob], 'boleto-'+card.getAttribute('data-index')+'.png', { type:'image/png' });
      files[token] = f;
      return f;
    });
  }

  var cards = [].slice.call(document.querySelectorAll('[data-token]'));

  // Build them all up front so a tap never waits on image decoding. A failure
  // here is not fatal — the download link still points at the bare QR — but it
  // is worth saying out loud rather than swallowing.
  cards.forEach(function(card){
    fileFor(card).catch(function(err){
      console.error('[ticket] could not compose', card.getAttribute('data-token'), err);
    });
  });

  var canShareFiles = !!(navigator.canShare && navigator.share);

  cards.forEach(function(card){
    var shareBtn = card.querySelector('[data-share]');
    var dlLink   = card.querySelector('[data-download]');

    if (shareBtn && canShareFiles){
      shareBtn.hidden = false;
      shareBtn.addEventListener('click', function(){
        fileFor(card).then(function(f){
          if (!f || !navigator.canShare({ files:[f] })) return;
          return navigator.share({
            files: [f],
            title: EVENT,
            text: card.getAttribute('data-name')+' · '+EVENT
          });
        }).catch(function(err){
          // AbortError is the user closing the share sheet, which is not a fault.
          if (err && err.name !== 'AbortError') console.error('[ticket] share failed', err);
        });
      });
    }

    if (dlLink){
      dlLink.addEventListener('click', function(ev){
        var f = files[card.getAttribute('data-token')];
        if (!f) return;                       // not ready: the href still points at the bare QR
        ev.preventDefault();
        var url = URL.createObjectURL(f);
        var a = document.createElement('a');
        a.href = url; a.download = f.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 10000);
      });
    }
  });
})();`;
}
