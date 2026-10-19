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
export function ticketScript(i: {
  bandName: string;
  eventName: string;
  whenLine: string;
  venue: string;
  shortCode: string;
  total: number;
}): string {
  return `
(function(){
  if (!window.HTMLCanvasElement || !document.createElement('canvas').getContext) return;

  var BAND  = ${JSON.stringify(i.bandName)};
  var EVENT = ${JSON.stringify(i.eventName)};
  var WHEN  = ${JSON.stringify(i.whenLine)};
  var VENUE = ${JSON.stringify(i.venue)};
  var CODE  = ${JSON.stringify(i.shortCode)};

  // DESIGN.md light surface. A ticket gets held up in a bright doorway and
  // sometimes printed, and a dark QR on white scans more reliably than the
  // inverse, so the buyer surface is light.
  var PAPER='#FBF8F2', CARD='#FFFFFF', INK='#1A1714', MUTED='#5C554C',
      DIM='#675F52', ACCENT='#A8540E', RULE='#E0D8C9';
  var SANS='-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif';
  var MONO='ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

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

  function compose(token, name, note, index, total){
    return loadImage('/t/'+token+'.png').then(function(qr){
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');

      ctx.fillStyle = PAPER; ctx.fillRect(0,0,W,H);
      ctx.fillStyle = CARD;
      ctx.fillRect(48, 48, W-96, H-96);

      ctx.textBaseline = 'top';
      var x = 108, maxW = W - 216, y = 128;

      ctx.fillStyle = ACCENT;
      ctx.font = font(600, 26, MONO);
      ctx.fillText(BAND.toUpperCase(), x, y);
      y += 54;

      ctx.fillStyle = INK;
      ctx.font = font(750, 62, SANS);
      y = drawLines(ctx, wrap(ctx, EVENT, maxW), x, y, 72) + 14;

      ctx.fillStyle = MUTED;
      ctx.font = font(400, 30, SANS);
      ctx.fillText(WHEN, x, y); y += 42;
      y = drawLines(ctx, wrap(ctx, VENUE, maxW), x, y, 40) + 34;

      // Perforation, so it reads as a stub rather than a poster.
      ctx.strokeStyle = RULE; ctx.lineWidth = 3; ctx.setLineDash([12,10]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(W-x, y); ctx.stroke();
      ctx.setLineDash([]);
      y += 40;

      ctx.fillStyle = INK;
      ctx.font = font(700, 46, SANS);
      y = drawLines(ctx, wrap(ctx, name, maxW), x, y, 56) + 8;

      ctx.fillStyle = MUTED;
      ctx.font = font(400, 28, SANS);
      ctx.fillText('Boleto '+index+' de '+total, x, y);
      y += 40;

      if (note){
        ctx.fillStyle = ACCENT;
        ctx.font = font(400, 26, SANS);
        y = drawLines(ctx, wrap(ctx, note, maxW), x, y, 34);
      }

      // Integer-scale the QR so every module stays a crisp square. Smoothing a
      // QR is what makes one hard to read under a venue's bad lighting.
      // The QR may use more width than the text column — it is the thing being
      // read, and the margins exist for text, not for it.
      var FOOT = 150;                       // room kept for the code and the byline
      var room = H - y - FOOT - 56;
      var scale = Math.max(1, Math.floor(Math.min(W - 160, room) / qr.width));
      var size = qr.width * scale;
      var qx = Math.round((W - size)/2);
      // Sits a fixed gap below the name rather than floating in the leftover
      // space; whatever is left over falls to the bottom, where a stub's
      // margin belongs.
      var qy = y + 44;

      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = CARD;
      ctx.fillRect(qx-24, qy-24, size+48, size+48);
      ctx.drawImage(qr, qx, qy, size, size);

      // Both lines hang off the QR rather than off the canvas bottom. Pinning
      // the byline to H made it collide with the code whenever the QR scaled
      // up; whatever space is left over now falls below, as a stub's margin.
      ctx.textAlign = 'center';
      var below = qy + size + 44;

      ctx.fillStyle = INK;
      ctx.font = font(600, 30, MONO);
      ctx.fillText(CODE, W/2, below);

      ctx.fillStyle = DIM;
      ctx.font = font(400, 22, MONO);
      ctx.fillText('coverr · un producto de macawly.dev', W/2, below + 62);
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
