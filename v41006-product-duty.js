/* KeySuite V4.10.06 — Product curve duty-point editor for ES.
   The editor intentionally owns only ES Product. CHC Product keeps its
   frozen, working duty-point behaviour untouched. */
(() => {
  'use strict';
  if (window.__KEYSUITE_V41006_PRODUCT_DUTY__) return;
  window.__KEYSUITE_V41006_PRODUCT_DUTY__ = true;

  const $ = id => document.getElementById(id);
  const isEs = value => String(value || '').toUpperCase() === 'ES';
  let active = null;

  function productApi() {
    return window.KeySuiteV394411ProductCurve || window.KeySuiteV394410ProductCurve || null;
  }

  function frame() {
    return $('productEsSelectorFrame');
  }

  function pointNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function activePoints() {
    return active ? active.manager.all() : [];
  }

  function ensureEditor() {
    const shell = $('productCurveDialog')?.querySelector('.product-curve-selector-shell');
    const host = $('productCurveHost');
    if (!shell || !host) return null;
    let editor = $('ks41006ProductDutyEditor');
    if (!editor) {
      editor = document.createElement('section');
      editor.id = 'ks41006ProductDutyEditor';
      editor.className = 'ks41006-product-duty-editor';
      shell.insertBefore(editor, host);
    }
    return editor;
  }

  function publish() {
    if (!active || !isEs(active.family)) return;
    const duties = activePoints()
      .filter(point => pointNumber(point.flowM3h) > 0 && pointNumber(point.headM) > 0)
      .map(point => ({ label: point.label, flowM3h: Number(point.flowM3h), headM: Number(point.headM) }));
    if (!duties.length || !frame()?.contentWindow) return;
    frame().contentWindow.postMessage({
      type: 'KEYSUITE_PRODUCT_DUTY_POINTS',
      model: active.model,
      pole: active.pole || 0,
      duties
    }, '*');
  }

  function updatePoint(index, field, value) {
    if (!active) return;
    active.manager.update(index, { [field]: pointNumber(value) });
    render();
    publish();
  }

  function render() {
    const editor = ensureEditor();
    if (!editor) return;
    if (!active || !isEs(active.family)) {
      editor.hidden = true;
      editor.innerHTML = '';
      return;
    }
    editor.hidden = false;
    const rows = activePoints().map((point, index) => {
      const remove = index === 0 ? '<span class="ks41006-duty-spacer" aria-hidden="true"></span>' : `<button class="btn mini outline ks41006-remove-duty" type="button" data-duty-index="${index}" title="Remove ${point.label}">Remove</button>`;
      return `<div class="ks41006-duty-row"><b>${point.label}</b><label>Flow<input data-duty-index="${index}" data-duty-field="flowM3h" aria-label="${point.label} Flow" type="number" min="0" step="0.1" value="${point.flowM3h || ''}"><small>m³/hr</small></label><label>Head<input data-duty-index="${index}" data-duty-field="headM" aria-label="${point.label} Head" type="number" min="0" step="0.1" value="${point.headM || ''}"><small>Mtr</small></label>${remove}</div>`;
    }).join('');
    const atMaximum = active.manager.length >= 6;
    editor.innerHTML = `<div class="ks41006-duty-title"><strong>Flow &amp; Head</strong><span>Duty points D1–D6</span></div><div class="ks41006-duty-rows">${rows}</div><button class="ks41006-add-duty" type="button" ${atMaximum ? 'disabled' : ''}>${atMaximum ? 'Maximum D1–D6 reached' : '+ Add Duty Point'}</button>`;
    editor.querySelectorAll('[data-duty-field]').forEach(input => input.addEventListener('input', event => updatePoint(Number(event.currentTarget.dataset.dutyIndex), event.currentTarget.dataset.dutyField, event.currentTarget.value)));
    editor.querySelectorAll('.ks41006-remove-duty').forEach(button => button.addEventListener('click', event => {
      if (active.manager.remove(Number(event.currentTarget.dataset.dutyIndex))) {
        render();
        publish();
      }
    }));
    editor.querySelector('.ks41006-add-duty')?.addEventListener('click', () => {
      if (active.manager.add({ flowM3h: 0, headM: 0 })) render();
    });
  }

  function startEsSession(model) {
    active = {
      family: 'ES',
      model: String(model || ''),
      pole: 0,
      initialized: false,
      manager: new window.KeySuiteDutyPointManager({ max: 6 })
    };
    render();
  }

  function onProductState(event) {
    const message = event.data || {};
    if (message.type !== 'KEYSUITE_PRODUCT_CURVE_STATE' || event.source !== frame()?.contentWindow || !active || !isEs(active.family)) return;
    if (Number(message.pole) > 0) active.pole = Number(message.pole);
    if (!active.initialized && pointNumber(message.flowM3h) > 0 && pointNumber(message.headM) > 0) {
      active.manager.setPrimary({ flowM3h: Number(message.flowM3h), headM: Number(message.headM) });
      active.initialized = true;
      render();
    }
  }

  function addStyle() {
    if ($('ks41006ProductDutyStyle')) return;
    const style = document.createElement('style');
    style.id = 'ks41006ProductDutyStyle';
    style.textContent = '.ks41006-product-duty-editor{margin:0 0 10px;padding:10px;border:1px solid #dbe4ed;border-radius:9px;background:#f8fbfd}.ks41006-duty-title{display:flex;gap:10px;align-items:baseline;margin:0 0 8px}.ks41006-duty-title strong{color:#17365d}.ks41006-duty-title span{font-size:12px;color:#65798a}.ks41006-duty-rows{display:grid;gap:7px}.ks41006-duty-row{display:grid;grid-template-columns:34px minmax(130px,1fr) minmax(130px,1fr) auto;gap:8px;align-items:end}.ks41006-duty-row>b{align-self:center;color:#0f629c}.ks41006-duty-row label{display:grid;grid-template-columns:1fr auto;gap:4px;align-items:center;margin:0;font-size:11px;font-weight:700;color:#38566b}.ks41006-duty-row input{grid-column:1;min-width:0;width:100%;min-height:36px}.ks41006-duty-row small{grid-column:2;grid-row:2;color:#65798a;white-space:nowrap}.ks41006-duty-row .ks41006-remove-duty,.ks41006-duty-spacer{min-width:70px;height:36px}.ks41006-add-duty{margin-top:8px;border:1px dashed #0877bd;background:#f5fbff;color:#0877bd;border-radius:7px;padding:7px 12px;font-weight:700;cursor:pointer}.ks41006-add-duty:disabled{cursor:not-allowed;opacity:.65}@media(max-width:800px){.ks41006-duty-row{grid-template-columns:30px 1fr 1fr}.ks41006-duty-row .ks41006-remove-duty,.ks41006-duty-spacer{grid-column:2 / span 2;width:100%}}';
    document.head.appendChild(style);
  }

  function install() {
    const api = productApi();
    if (!api || api.__keysuiteV41006DutyWrapped) return !!api;
    api.__keysuiteV41006DutyWrapped = true;
    // V4.11.02: ES Product now keeps the Selector's proven left-hand Required
    // Duty editor. Remove the duplicate outer Flow & Head editor.
    $('ks41006ProductDutyEditor')?.remove();
    return true;
  }

  if (!install()) window.addEventListener('KEYSUITE_V41006_RUNTIME_READY', install, { once: true });
})();
