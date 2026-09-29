// Minimal renderer for .dc.html mockups: {{ holes }}, sc-for, sc-if; props from ?k=v
window.DCLogic = class { constructor(props) { this.props = props; } };
addEventListener('DOMContentLoaded', () => {
  const sc = document.querySelector('script[type="text/x-dc"]');
  const meta = JSON.parse(sc.dataset.props || '{}');
  const props = {}; for (const [k, v] of Object.entries(meta)) if (!k.startsWith('$')) props[k] = v.default;
  for (const [k, v] of new URLSearchParams(location.search)) props[k] = v === 'false' ? false : v === 'true' ? true : isNaN(+v) ? v : +v;
  const Component = new Function('DCLogic', sc.textContent + '\nreturn Component;')(DCLogic);
  const c = new Component(props); const vals = c.renderVals();
  const x = document.querySelector('x-dc');
  const helmet = x.querySelector('helmet'); if (helmet) { document.head.insertAdjacentHTML('beforeend', helmet.innerHTML); helmet.remove(); }
  const ev = (expr, scope) => new Function(...Object.keys(scope), 'return (' + expr + ')')(...Object.values(scope));
  const sub = (s, scope) => s.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, e) => { const v = ev(e, scope); return v == null ? '' : String(v); });
  const walk = (node, scope) => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) { if (ch.data.includes('{{')) ch.data = sub(ch.data, scope); continue; }
      if (ch.nodeType !== 1) continue;
      const tag = ch.localName;
      if (tag === 'sc-for') {
        const list = ev(ch.getAttribute('list').replace(/^\{\{\s*|\s*\}\}$/g, ''), scope) || [];
        const as = ch.getAttribute('as'); const frag = document.createDocumentFragment();
        for (const it of list) { const wrap = ch.cloneNode(true); walk(wrap, { ...scope, [as]: it }); while (wrap.firstChild) frag.appendChild(wrap.firstChild); }
        ch.replaceWith(frag); continue;
      }
      if (tag === 'sc-if') {
        const v = ev(ch.getAttribute('value').replace(/^\{\{\s*|\s*\}\}$/g, ''), scope);
        if (!v) { ch.remove(); continue; }
        walk(ch, scope); ch.replaceWith(...ch.childNodes); continue;
      }
      for (const a of [...ch.attributes]) if (a.value.includes('{{')) ch.setAttribute(a.name, sub(a.value, scope));
      walk(ch, scope);
    }
  };
  walk(x, vals);
  c.componentDidMount?.();                     // start the board's animations (they skip themselves when motion=false)
  document.fonts.ready.then(() => { document.body.dataset.ready = '1'; });
});
