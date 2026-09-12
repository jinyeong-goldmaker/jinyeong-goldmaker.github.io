// ui.js — small shared DOM helpers used across the tool pages.

export function wirePalette(container, targetInput, symbols) {
  container.innerHTML = '';
  for (const { label, insert } of symbols) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      const start = targetInput.selectionStart ?? targetInput.value.length;
      const end = targetInput.selectionEnd ?? targetInput.value.length;
      const v = targetInput.value;
      targetInput.value = v.slice(0, start) + insert + v.slice(end);
      targetInput.focus();
      const pos = start + insert.length;
      targetInput.setSelectionRange(pos, pos);
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    container.appendChild(btn);
  }
}

export function wireModeToggle(container, initial, onChange) {
  const buttons = container.querySelectorAll('button[data-mode]');
  function refresh(mode) {
    buttons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  }
  buttons.forEach(b => b.addEventListener('click', () => {
    refresh(b.dataset.mode);
    onChange(b.dataset.mode);
  }));
  refresh(initial);
}

export function showMessage(el, text, kind = 'info') {
  el.className = `msg ${kind}`;
  el.textContent = text;
  el.style.display = text ? 'block' : 'none';
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}
