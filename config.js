// Cole aqui a URL do App da Web do Apps Script (termina em /exec)
const AGENDA_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwxsrNdojgx_Sjkk451VXSGr8oB9ChA1T6Yj-6qabSPTjrqCz3Q66QqgA7WtPXcBlw2/exec',
  NOME_SALAO: 'Unhas de Gel',
  // WhatsApp do salão com DDI + DDD, só números. Deixe '' para esconder o botão.
  WHATSAPP: '5519999999999',
  // Opcionais: aparecem no rodapé. Deixe '' para esconder.
  ENDERECO: 'Rua Exemplo, 123 – Campinas/SP',
  INSTAGRAM: 'unhasdegel'
};

async function apiGet(params) {
  const r = await fetch(AGENDA_CONFIG.API_URL + '?' + new URLSearchParams(params));
  const j = await r.json();
  if (!j.ok) throw new Error(j.erro || 'Não foi possível falar com a agenda.');
  return j;
}

// text/plain evita o "preflight" de CORS que o Apps Script não responde
async function apiPost(body) {
  const r = await fetch(AGENDA_CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.erro || 'Não foi possível falar com a agenda.');
  return j;
}

function apiConfigurada() {
  return AGENDA_CONFIG.API_URL && !AGENDA_CONFIG.API_URL.startsWith('COLE');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function paraISO(dt) {
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}
function dataLonga(s) { return parseISO(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); }
function duracaoTxt(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return m + ' min';
  return h + 'h' + (m ? String(m).padStart(2, '0') : '');
}
function mascaraTel(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? '(' + d : '';
  if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
  if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
}

function precoTxt(p) {
  if (typeof p !== 'number') return p || '';
  return p.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: p % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
function somarDias(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return paraISO(d); }
function toMin(h) { const [a, b] = h.split(':').map(Number); return a * 60 + b; }
function deMin(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function fimDe(h, dur) { return deMin(toMin(h) + dur); }
function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
