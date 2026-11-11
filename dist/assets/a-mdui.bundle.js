/* Reconstructed A-MDUI compatibility bundle (classic IIFE).
   Implements the public <a-mdui> host API and .mdui language from
   github.com/anandsankarank/md2ui-mcp (templates, validator, artifact shell).
   Visual language follows the CloudPulse dashboard screenshot.
   This is not the official unpublished @a-mdui/web package. */
(function (global) {
  'use strict';

  var CHART_COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#22d3ee', '#a78bfa', '#fb7185'];

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseLiteral(raw) {
    if (raw == null) return '';
    var s = String(raw).trim();
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null') return null;
    if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
        (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
      try { return JSON.parse(s.charAt(0) === "'" ? '"' + s.slice(1, -1).replace(/"/g, '\\"') + '"' : s); }
      catch (e) { return s.slice(1, -1); }
    }
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  }

  function parseOptions(raw) {
    if (!raw) return [];
    try {
      var v = JSON.parse(raw);
      if (Array.isArray(v)) return v.map(function (x) { return String(x); });
    } catch (e) {}
    return String(raw).replace(/^\[/, '').replace(/\]$/, '').split(',').map(function (s) {
      return s.trim().replace(/^["']|["']$/g, '');
    }).filter(Boolean);
  }

  function splitPipes(s) {
    var out = [], buf = '', q = null;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (q) {
        buf += c;
        if (c === q && s.charAt(i - 1) !== '\\') q = null;
      } else if (c === '"' || c === "'") {
        q = c; buf += c;
      } else if (c === '|') {
        out.push(buf); buf = '';
      } else buf += c;
    }
    out.push(buf);
    return out;
  }

  function isSafeExpr(s) {
    var stripped = s.replace(/"(?:\\.|[^"\\])*"/g, '0').replace(/'(?:\\.|[^'\\])*'/g, '0');
    return /^[\s\w.truefalsenull=!<>&|?:+\-*/%(),[\]]*$/i.test(stripped);
  }

  function evalCondition(expr, state) {
    if (!expr) return true;
    var rewritten = String(expr).replace(/@([A-Za-z_][\w]*)/g, function (_, n) {
      return JSON.stringify(state[n]);
    });
    if (!isSafeExpr(rewritten)) return false;
    try { return !!Function('"use strict";return (' + rewritten + ');')(); }
    catch (e) { return false; }
  }

  function evalExpr(body, state) {
    var parts = splitPipes(body);
    var expr = parts[0].trim();
    var filters = parts.slice(1).map(function (p) { return p.trim(); });
    expr = expr.replace(/\b([A-Za-z_][\w]*)\b/g, function (m) {
      if (m === 'true' || m === 'false' || m === 'null' || m === 'undefined') return m;
      if (Object.prototype.hasOwnProperty.call(state, m)) return JSON.stringify(state[m]);
      return 'undefined';
    });
    var value;
    if (isSafeExpr(expr)) {
      try { value = Function('"use strict";return (' + expr + ');')(); }
      catch (e) { value = undefined; }
    }
    for (var i = 0; i < filters.length; i++) {
      var f = filters[i];
      if (f === 'currency') {
        var n = Number(value);
        value = isFinite(n) ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : value;
      } else if (/^-?\d+(\.\d+)?$/.test(f)) {
        if (value == null || value === '' || (typeof value === 'number' && isNaN(value))) value = Number(f);
      } else if ((f.charAt(0) === '"' && f.charAt(f.length - 1) === '"') ||
                 (f.charAt(0) === "'" && f.charAt(f.length - 1) === "'")) {
        if (value == null || value === '') value = parseLiteral(f);
      }
    }
    return value;
  }

  function parseMods(raw) {
    var classes = [], style = '';
    if (!raw) return { classes: classes, style: style };
    String(raw).replace(/^\{/, '').replace(/\}$/, '').split(',').forEach(function (tok) {
      tok = tok.trim();
      if (!tok) return;
      if (tok.charAt(0) === '.') classes.push(tok.slice(1).replace(/[^\w-]/g, ''));
      else if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(tok)) style += 'color:' + tok + ';';
      else if (/^[A-Za-z_][\w-]*$/.test(tok)) classes.push(tok);
    });
    return { classes: classes, style: style };
  }

  function parseActions(href) {
    var s = String(href || '').trim();
    if (!/^action:/i.test(s) && s.indexOf('action:') === -1) return null;
    return s.split(';').map(function (part) {
      part = part.trim();
      var set = part.match(/^action:set:([A-Za-z_][\w]*)\s*=\s*(.*)$/i);
      if (set) return { kind: 'set', key: set[1], value: parseLiteral(set[2]), raw: part };
      var named = part.match(/^action:([A-Za-z_][\w]*)$/i);
      if (named) return { kind: named[1].toLowerCase() === 'set' ? 'action' : named[1].toLowerCase(), name: named[1], raw: part };
      return { kind: 'action', name: part.replace(/^action:/i, ''), raw: part };
    });
  }

  function parseTable(text) {
    var rows = String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(function (l) {
      return l.charAt(0) === '|';
    }).map(function (r) {
      return r.replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
    });
    if (!rows.length) return null;
    var start = 1;
    if (rows[1] && rows[1].every(function (c) { return /^:?-+:?$/.test(c); })) start = 2;
    return { headers: rows[0], rows: rows.slice(start) };
  }

  function toNumber(v) {
    if (typeof v === 'number') return v;
    var s = String(v).replace(/[$,%\s]/g, '');
    var n = Number(s);
    return isFinite(n) ? n : 0;
  }

  function parseMdui(src) {
    var state = {};
    var lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
    var i = 0;

    function parseBlocks() {
      var nodes = [];
      while (i < lines.length) {
        var trim = lines[i].trim();
        var st = trim.match(/^@([A-Za-z_][\w]*)\((.*)\)\s*$/);
        if (st) { state[st[1]] = parseLiteral(st[2]); i++; continue; }

        var inp = trim.match(/^\?\?\?\s+([A-Za-z_][\w]*)\s*$/);
        if (inp) {
          i++;
          var field = { type: 'input', id: inp[1], attrs: {} };
          while (i < lines.length && lines[i].trim() !== '???') {
            var kv = lines[i].match(/^\s*([A-Za-z_][\w]*)\s*:\s*(.*)$/);
            if (kv) field.attrs[kv[1]] = kv[2].trim();
            i++;
          }
          if (i < lines.length && lines[i].trim() === '???') i++;
          nodes.push(field);
          continue;
        }

        var open = trim.match(/^:::\s*([A-Za-z_][\w]*)\s*(.*)$/);
        if (open) {
          i++;
          var children = parseBlocks();
          nodes.push({ type: 'container', name: open[1], raw: (open[2] || '').trim(), children: children });
          continue;
        }

        if (trim === ':::') { i++; return nodes; }

        var buf = [];
        while (i < lines.length) {
          var t = lines[i].trim();
          if (/^@[A-Za-z_][\w]*\(/.test(t)) break;
          if (/^\?\?\?\s+\S/.test(t)) break;
          if (/^:::/.test(t)) break;
          buf.push(lines[i]);
          i++;
        }
        if (buf.length) nodes.push({ type: 'markdown', text: buf.join('\n') });
      }
      return nodes;
    }

    return { state: state, ast: parseBlocks() };
  }

  function collectText(nodes) {
    return (nodes || []).map(function (n) {
      if (n.type === 'markdown') return n.text;
      if (n.children) return collectText(n.children);
      return '';
    }).join('\n');
  }

  function renderInline(text, state) {
    var re = /\{\{([\s\S]*?)\}\}(\{[^}]*\})?|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\n]+)\*|\[([^\]]+)\]\(([^)]+)\)(\{[^}]*\})?/g;
    var out = '', last = 0, m;
    while ((m = re.exec(text))) {
      out += esc(text.slice(last, m.index));
      if (m[1] != null) {
        var val = evalExpr(m[1], state);
        var mods = parseMods(m[2] || '');
        var cls = ['amdui-expr'].concat(mods.classes);
        out += '<span class="' + esc(cls.join(' ')) + '"' + (mods.style ? ' style="' + esc(mods.style) + '"' : '') + '>' + esc(val == null ? '' : val) + '</span>';
      } else if (m[3] != null) {
        out += '<code class="amdui-code">' + esc(m[3]) + '</code>';
      } else if (m[4] != null) {
        out += '<strong>' + renderInline(m[4], state) + '</strong>';
      } else if (m[5] != null) {
        out += '<em>' + renderInline(m[5], state) + '</em>';
      } else {
        out += renderButton(m[6], m[7], m[8], state, true);
      }
      last = m.index + m[0].length;
    }
    out += esc(text.slice(last));
    return out;
  }

  function interpolateHref(href, state) {
    return String(href || '').replace(/\{\{([\s\S]*?)\}\}/g, function (_, body) {
      var v = evalExpr(body, state);
      return encodeURIComponent(v == null ? '' : String(v));
    });
  }

  function renderButton(label, href, modsRaw, state, inline) {
    var mods = parseMods(modsRaw || '');
    var cls = ['amdui-btn'];
    if (mods.classes.indexOf('primary') !== -1) cls.push('amdui-btn-primary');
    else if (mods.classes.indexOf('secondary') !== -1) cls.push('amdui-btn-secondary');
    else cls.push('amdui-btn-default');
    var actions = parseActions(href);
    var labelHtml = esc(label);
    if (actions) {
      var payload = actions.map(function (a) { return a.raw; }).join(';');
      return '<button type="button" class="' + cls.join(' ') + '" data-amdui-actions="' + esc(payload) + '">' + labelHtml + '</button>';
    }
    var url = interpolateHref(href, state);
    var target = /target:\s*_blank/i.test(modsRaw || '') ? ' target="_blank" rel="noopener noreferrer"' : '';
    return '<a class="' + cls.join(' ') + '" href="' + esc(url) + '"' + target + '>' + labelHtml + '</a>';
  }

  function isActionsOnly(line) {
    var t = line.replace(/\s*=\s*/g, ' ').trim();
    return t.length > 0 && /^(?:\[[^\]]+\]\([^)]+\)(?:\{[^}]*\})?\s*)+$/.test(t);
  }

  function renderMarkdown(text, state) {
    var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    var html = '', i = 0;
    while (i < lines.length) {
      var line = lines[i];
      var trim = line.trim();
      if (!trim) { i++; continue; }

      if (trim.indexOf('```') === 0) {
        var fence = [];
        i++;
        while (i < lines.length && lines[i].trim().indexOf('```') !== 0) { fence.push(lines[i]); i++; }
        if (i < lines.length) i++;
        html += '<pre class="amdui-pre"><code>' + esc(fence.join('\n')) + '</code></pre>';
        continue;
      }

      if (trim.charAt(0) === '|') {
        var block = [];
        while (i < lines.length && lines[i].trim().charAt(0) === '|') { block.push(lines[i]); i++; }
        var table = parseTable(block.join('\n'));
        if (table) {
          html += '<div class="amdui-table-wrap"><table class="amdui-table"><thead><tr>';
          table.headers.forEach(function (h) { html += '<th>' + renderInline(h, state) + '</th>'; });
          html += '</tr></thead><tbody>';
          table.rows.forEach(function (r) {
            html += '<tr>';
            r.forEach(function (c) { html += '<td>' + renderInline(c, state) + '</td>'; });
            html += '</tr>';
          });
          html += '</tbody></table></div>';
        }
        continue;
      }

      if (isActionsOnly(trim)) {
        var split = /\s=\s/.test(trim);
        html += '<div class="amdui-actions' + (split ? ' amdui-split' : '') + '">';
        var chunks = trim.split(/\s=\s/);
        chunks.forEach(function (chunk) {
          html += '<div class="amdui-actions-group">' + renderInline(chunk.trim(), state) + '</div>';
        });
        html += '</div>';
        i++;
        continue;
      }

      var hm = trim.match(/^(#{1,4})\s+(.*)$/);
      if (hm) {
        var rawTitle = hm[2];
        var trail = rawTitle.match(/^(.*?)\s*(\{[^}]+\})\s*$/);
        var title = rawTitle, mods = { classes: [], style: '' };
        if (trail) { title = trail[1]; mods = parseMods(trail[2]); }
        var level = hm[1].length;
        var hcls = ['amdui-h' + level].concat(mods.classes);
        if (level <= 2 && /[\d%$]/.test(title) && title.length < 40) hcls.push('amdui-metric');
        html += '<h' + level + ' class="' + esc(hcls.join(' ')) + '"' + (mods.style ? ' style="' + esc(mods.style) + '"' : '') + '>' + renderInline(title, state) + '</h' + level + '>';
        i++;
        continue;
      }

      if (/^[-*]\s+/.test(trim)) {
        html += '<ul class="amdui-list">';
        while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
          html += '<li>' + renderInline(lines[i].trim().replace(/^[-*]\s+/, ''), state) + '</li>';
          i++;
        }
        html += '</ul>';
        continue;
      }

      html += '<p class="amdui-p">' + renderInline(trim, state) + '</p>';
      i++;
    }
    return html;
  }

  function svgEl(w, h, inner) {
    return '<div class="amdui-chart"><svg viewBox="0 0 ' + w + ' ' + h + '" role="img" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg></div>';
  }

  function renderBarChart(table) {
    if (!table || !table.rows.length) return '<p class="amdui-empty">No chart data</p>';
    var series = table.headers.slice(1);
    var labels = table.rows.map(function (r) { return r[0]; });
    var data = table.rows.map(function (r) { return series.map(function (_, i) { return toNumber(r[i + 1]); }); });
    var max = 0;
    data.forEach(function (row) { row.forEach(function (v) { if (v > max) max = v; }); });
    if (max <= 0) max = 1;
    var left = 44, top = 28, right = 16, bottom = 36;
    var W = 640, H = 220;
    var plotW = W - left - right, plotH = H - top - bottom;
    var n = labels.length, g = series.length;
    var groupW = plotW / n;
    var barW = Math.max(6, Math.min(22, (groupW - 16) / Math.max(g, 1)));
    var parts = [];
    parts.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="none"/>');
    for (var t = 0; t <= 4; t++) {
      var y = top + (plotH * t) / 4;
      var val = max * (1 - t / 4);
      parts.push('<line x1="' + left + '" y1="' + y + '" x2="' + (W - right) + '" y2="' + y + '" stroke="rgba(148,163,184,0.18)" stroke-width="1"/>');
      parts.push('<text x="' + (left - 8) + '" y="' + (y + 3) + '" text-anchor="end" fill="#94a3b8" font-size="10" font-family="Inter,system-ui,sans-serif">' + (val >= 1000 ? (val / 1000).toFixed(val >= 10000 ? 0 : 1) + 'k' : (val < 10 ? val.toFixed(1) : Math.round(val))) + '</text>');
    }
    labels.forEach(function (lab, i) {
      var gx = left + groupW * i + groupW / 2;
      series.forEach(function (_, si) {
        var v = data[i][si];
        var bh = (v / max) * plotH;
        var x = gx - (g * barW + (g - 1) * 3) / 2 + si * (barW + 3);
        var y = top + plotH - bh;
        parts.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW + '" height="' + Math.max(bh, 1).toFixed(1) + '" rx="3" fill="' + CHART_COLORS[si % CHART_COLORS.length] + '" opacity="0.92"/>');
      });
      parts.push('<text x="' + gx.toFixed(1) + '" y="' + (H - 14) + '" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="Inter,system-ui,sans-serif">' + esc(lab) + '</text>');
    });
    series.forEach(function (name, si) {
      var lx = left + si * 128;
      parts.push('<rect x="' + lx + '" y="6" width="8" height="8" rx="2" fill="' + CHART_COLORS[si % CHART_COLORS.length] + '"/>');
      parts.push('<text x="' + (lx + 12) + '" y="14" fill="#cbd5e1" font-size="10" font-family="Inter,system-ui,sans-serif">' + esc(name) + '</text>');
    });
    return svgEl(W, H, parts.join(''));
  }

  function renderLineChart(table) {
    if (!table || !table.rows.length) return '<p class="amdui-empty">No chart data</p>';
    var series = table.headers.slice(1);
    var labels = table.rows.map(function (r) { return r[0]; });
    var data = table.rows.map(function (r) { return series.map(function (_, i) { return toNumber(r[i + 1]); }); });
    var max = 0;
    data.forEach(function (row) { row.forEach(function (v) { if (v > max) max = v; }); });
    if (max <= 0) max = 1;
    var left = 48, top = 28, right = 16, bottom = 36;
    var W = 640, H = 230;
    var plotW = W - left - right, plotH = H - top - bottom;
    var parts = [];
    for (var t = 0; t <= 4; t++) {
      var y = top + (plotH * t) / 4;
      var val = max * (1 - t / 4);
      parts.push('<line x1="' + left + '" y1="' + y + '" x2="' + (W - right) + '" y2="' + y + '" stroke="rgba(148,163,184,0.18)" stroke-width="1"/>');
      parts.push('<text x="' + (left - 8) + '" y="' + (y + 3) + '" text-anchor="end" fill="#94a3b8" font-size="10" font-family="Inter,system-ui,sans-serif">' + (val >= 1000 ? (val / 1000).toFixed(1) + 'k' : Math.round(val)) + '</text>');
    }
    series.forEach(function (_, si) {
      var d = [];
      data.forEach(function (row, i) {
        var x = left + (labels.length === 1 ? plotW / 2 : (plotW * i) / (labels.length - 1));
        var y = top + plotH - (row[si] / max) * plotH;
        d.push((i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1));
      });
      parts.push('<path d="' + d.join(' ') + '" fill="none" stroke="' + CHART_COLORS[si % CHART_COLORS.length] + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>');
      data.forEach(function (row, i) {
        var x = left + (labels.length === 1 ? plotW / 2 : (plotW * i) / (labels.length - 1));
        var y = top + plotH - (row[si] / max) * plotH;
        parts.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.2" fill="' + CHART_COLORS[si % CHART_COLORS.length] + '"/>');
      });
    });
    labels.forEach(function (lab, i) {
      var x = left + (labels.length === 1 ? plotW / 2 : (plotW * i) / (labels.length - 1));
      parts.push('<text x="' + x.toFixed(1) + '" y="' + (H - 14) + '" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="Inter,system-ui,sans-serif">' + esc(lab) + '</text>');
    });
    series.forEach(function (name, si) {
      var lx = left + si * 140;
      parts.push('<rect x="' + lx + '" y="6" width="8" height="8" rx="2" fill="' + CHART_COLORS[si % CHART_COLORS.length] + '"/>');
      parts.push('<text x="' + (lx + 12) + '" y="14" fill="#cbd5e1" font-size="10" font-family="Inter,system-ui,sans-serif">' + esc(name) + '</text>');
    });
    return svgEl(W, H, parts.join(''));
  }

  function renderPieChart(table) {
    if (!table || !table.rows.length) return '<p class="amdui-empty">No chart data</p>';
    var items = table.rows.map(function (r) { return { label: r[0], value: toNumber(r[1]) }; });
    var total = items.reduce(function (a, b) { return a + b.value; }, 0) || 1;
    var cx = 120, cy = 120, r = 78, ir = 46, acc = -Math.PI / 2;
    var parts = [];
    function pt(a, rad) { return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]; }
    items.forEach(function (it, i) {
      var slice = (it.value / total) * Math.PI * 2;
      var a0 = acc, a1 = acc + slice; acc = a1;
      var p0 = pt(a0, r), p1 = pt(a1, r), q0 = pt(a0, ir), q1 = pt(a1, ir);
      var large = slice > Math.PI ? 1 : 0;
      var d = 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) +
        ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) +
        ' L' + q1[0].toFixed(1) + ' ' + q1[1].toFixed(1) +
        ' A' + ir + ' ' + ir + ' 0 ' + large + ' 0 ' + q0[0].toFixed(1) + ' ' + q0[1].toFixed(1) + ' Z';
      parts.push('<path d="' + d + '" fill="' + CHART_COLORS[i % CHART_COLORS.length] + '"/>');
    });
    var legend = items.map(function (it, i) {
      var y = 28 + i * 22;
      var pct = Math.round((it.value / total) * 100);
      return '<rect x="240" y="' + (y - 8) + '" width="8" height="8" rx="2" fill="' + CHART_COLORS[i % CHART_COLORS.length] + '"/>' +
        '<text x="254" y="' + y + '" fill="#e2e8f0" font-size="12" font-family="Inter,system-ui,sans-serif">' + esc(it.label) + '  ' + pct + '%</text>';
    }).join('');
    return svgEl(520, 240, parts.join('') + legend);
  }

  function fieldValue(id, attrs, state) {
    if (Object.prototype.hasOwnProperty.call(state, id) && state[id] !== undefined && state[id] !== null && state[id] !== '') {
      return state[id];
    }
    var opts = parseOptions(attrs.options);
    if (opts.length) return opts[0];
    if (attrs.typeOf === 'toggle') return false;
    if (attrs.typeOf === 'slider') return attrs.min != null ? Number(attrs.min) : 0;
    return '';
  }

  function renderInput(node, state) {
    var id = node.id;
    var a = node.attrs || {};
    var type = (a.typeOf || 'text').toLowerCase();
    var label = a.label || id;
    var required = String(a.required || '').toLowerCase() === 'true';
    var asMenu = String(a.style || '').toLowerCase() === 'menu' || type === 'picker';
    var val = fieldValue(id, a, state);
    if (!Object.prototype.hasOwnProperty.call(state, id)) state[id] = val;
    var html = '<div class="amdui-field" data-field="' + esc(id) + '">';
    html += '<label class="amdui-label' + (required ? ' amdui-required' : '') + '" for="amdui-' + esc(id) + '">' + renderInline(label, state) + '</label>';

    if (type === 'segmented' && !asMenu) {
      var opts = parseOptions(a.options);
      html += '<div class="amdui-seg" role="radiogroup" aria-label="' + esc(label) + '">';
      opts.forEach(function (opt) {
        var on = String(val) === String(opt);
        html += '<button type="button" role="radio" aria-pressed="' + (on ? 'true' : 'false') + '" data-amdui-set="' + esc(id) + '" data-amdui-value="' + esc(opt) + '">' + esc(opt) + '</button>';
      });
      html += '</div>';
    } else if (type === 'toggle') {
      var on = val === true || val === 'true' || val === 1 || val === '1';
      html += '<label class="amdui-toggle"><input type="checkbox" id="amdui-' + esc(id) + '" data-amdui-bind="' + esc(id) + '" data-amdui-kind="toggle"' + (on ? ' checked' : '') + '><span class="amdui-switch"></span></label>';
    } else if (type === 'slider') {
      var min = a.min != null ? a.min : 0, max = a.max != null ? a.max : 100, step = a.step != null ? a.step : 1;
      html += '<div class="amdui-slider-wrap"><input class="amdui-slider" type="range" id="amdui-' + esc(id) + '" min="' + esc(min) + '" max="' + esc(max) + '" step="' + esc(step) + '" value="' + esc(val) + '" data-amdui-bind="' + esc(id) + '" data-amdui-kind="slider"><span class="amdui-slider-value" data-amdui-slider-label="' + esc(id) + '">' + esc(val) + '</span></div>';
    } else if (asMenu || type === 'picker') {
      var opts2 = parseOptions(a.options);
      html += '<select class="amdui-control" id="amdui-' + esc(id) + '" data-amdui-bind="' + esc(id) + '" data-amdui-kind="select">';
      opts2.forEach(function (opt) {
        html += '<option value="' + esc(opt) + '"' + (String(val) === String(opt) ? ' selected' : '') + '>' + esc(opt) + '</option>';
      });
      html += '</select>';
    } else if (type === 'date') {
      html += '<input class="amdui-control" type="date" id="amdui-' + esc(id) + '" value="' + esc(val) + '" data-amdui-bind="' + esc(id) + '" data-amdui-kind="text">';
    } else {
      html += '<input class="amdui-control" type="text" id="amdui-' + esc(id) + '" value="' + esc(val) + '"' +
        (a.placeholder ? ' placeholder="' + esc(a.placeholder) + '"' : '') +
        (required ? ' required' : '') +
        ' data-amdui-bind="' + esc(id) + '" data-amdui-kind="text">';
    }
    html += '</div>';
    return html;
  }

  function renderNodes(nodes, state) {
    var html = '';
    (nodes || []).forEach(function (node) {
      if (node.type === 'markdown') { html += renderMarkdown(node.text, state); return; }
      if (node.type === 'input') { html += renderInput(node, state); return; }
      if (node.type === 'container') {
        var iff = '';
        var raw = node.raw || '';
        var ifm = raw.match(/^if:\s*(.*)$/i);
        if (ifm) iff = ifm[1].trim();
        if (iff && !evalCondition(iff, state)) return;
        var name = (node.name || 'card').toLowerCase();
        if (name === 'barchart') { html += '<div class="amdui-card amdui-chart-card">' + renderBarChart(parseTable(collectText(node.children))) + '</div>'; return; }
        if (name === 'linechart') { html += '<div class="amdui-card amdui-chart-card">' + renderLineChart(parseTable(collectText(node.children))) + '</div>'; return; }
        if (name === 'piechart') { html += '<div class="amdui-card amdui-chart-card">' + renderPieChart(parseTable(collectText(node.children))) + '</div>'; return; }
        var cls = 'amdui-' + name;
        html += '<div class="' + cls + '">' + renderNodes(node.children, state) + '</div>';
      }
    });
    return html;
  }

  function AMduiElement() {
    var self = Reflect.construct(HTMLElement, [], AMduiElement);
    self._content = '';
    self._state = {};
    self._ast = [];
    self._booted = false;
    return self;
  }
  AMduiElement.prototype = Object.create(HTMLElement.prototype);
  AMduiElement.prototype.constructor = AMduiElement;
  Object.defineProperty(AMduiElement, 'observedAttributes', { get: function () { return ['theme']; } });

  Object.defineProperty(AMduiElement.prototype, 'content', {
    get: function () { return this._content; },
    set: function (v) {
      this._content = v == null ? '' : String(v);
      var parsed = parseMdui(this._content);
      this._ast = parsed.ast;
      this._state = Object.assign({}, parsed.state);
      this._booted = true;
      this._render();
    }
  });

  Object.defineProperty(AMduiElement.prototype, 'values', {
    get: function () { return Object.assign({}, this._state); },
    set: function (v) {
      if (v && typeof v === 'object') Object.assign(this._state, v);
      this._render();
    }
  });

  AMduiElement.prototype.connectedCallback = function () {
    if (!this._bound) {
      this._bound = true;
      this.addEventListener('click', this._onClick.bind(this));
      this.addEventListener('input', this._onInput.bind(this));
      this.addEventListener('change', this._onInput.bind(this));
    }
    if (this._booted) this._render();
  };

  AMduiElement.prototype.attributeChangedCallback = function () {
    if (this._booted) this._render();
  };

  AMduiElement.prototype._onClick = function (e) {
    var setBtn = e.target.closest && e.target.closest('[data-amdui-set]');
    if (setBtn && this.contains(setBtn)) {
      var key = setBtn.getAttribute('data-amdui-set');
      var val = setBtn.getAttribute('data-amdui-value');
      this._state[key] = val;
      this._render();
      return;
    }
    var btn = e.target.closest && e.target.closest('[data-amdui-actions]');
    if (btn && this.contains(btn)) this._runActions(btn.getAttribute('data-amdui-actions'));
  };

  AMduiElement.prototype._onInput = function (e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var id = el.getAttribute('data-amdui-bind');
    if (!id) return;
    var kind = el.getAttribute('data-amdui-kind');
    var value;
    if (kind === 'toggle') value = !!el.checked;
    else if (kind === 'slider') {
      value = el.value === '' ? 0 : Number(el.value);
      var lab = this.querySelector('[data-amdui-slider-label="' + id + '"]');
      if (lab) lab.textContent = String(value);
    } else value = el.value;
    this._state[id] = value;
    if (kind !== 'text') this._render();
  };

  AMduiElement.prototype._runActions = function (payload) {
    var actions = parseActions(payload) || [];
    var state = this.values;
    var submitAction = null;
    var firstNamed = null;
    actions.forEach(function (a) {
      if (a.kind === 'set') this._state[a.key] = a.value;
      if (a.kind === 'submit' || (a.name && String(a.name).toLowerCase() === 'submit')) submitAction = a;
      if (!firstNamed && a.kind !== 'set' && a.kind !== 'submit') firstNamed = a;
    }, this);
    if (actions.some(function (a) { return a.kind === 'set'; })) this._render();
    if (submitAction) {
      this.dispatchEvent(new CustomEvent('submit', {
        bubbles: true,
        composed: true,
        detail: { formId: (firstNamed && firstNamed.name) || 'default', values: this.values }
      }));
    }
    var id = (firstNamed && firstNamed.name) || (submitAction && submitAction.name) || (actions[0] && (actions[0].name || ('set:' + actions[0].key))) || 'action';
    var type = submitAction ? 'submit' : (actions[0] && actions[0].kind) || 'action';
    this.dispatchEvent(new CustomEvent('action', {
      bubbles: true,
      composed: true,
      detail: {
        id: id,
        trigger: { type: type, payload: payload },
        values: this.values
      }
    }));
    return state;
  };

  AMduiElement.prototype._render = function () {
    var html = '<div class="amdui-root">' + renderNodes(this._ast, this._state) + '</div>';
    var active = this.contains(document.activeElement) ? document.activeElement : null;
    var restore = null;
    if (active && active.id) {
      restore = { id: active.id, start: active.selectionStart, end: active.selectionEnd };
    }
    this.innerHTML = html;
    if (restore) {
      var el = this.querySelector('#' + CSS.escape(restore.id));
      if (el && typeof el.focus === 'function') {
        el.focus();
        try { if (typeof restore.start === 'number') el.setSelectionRange(restore.start, restore.end); } catch (e) {}
      }
    }
  };

  if (!customElements.get('a-mdui')) customElements.define('a-mdui', AMduiElement);
  global.AMdui = { parse: parseMdui, version: '2.0-compat' };
})(typeof window !== 'undefined' ? window : this);
