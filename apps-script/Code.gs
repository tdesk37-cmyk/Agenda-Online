/**
 * Agenda online – Unhas de Gel
 * Backend: Google Apps Script + Google Sheets
 *
 * 1. Ajuste o CONFIG abaixo (serviços, preços, horários).
 * 2. Rode a função setup() uma vez.
 * 3. Em Configurações do projeto > Propriedades do script, crie ADMIN_SENHA.
 * 4. Implantar > Nova implantação > App da Web (Executar como: Eu / Acesso: Qualquer pessoa).
 */

const CONFIG = {
  ABA: 'Agendamentos',
  FUSO: 'America/Sao_Paulo',
  ABERTURA: '09:00',
  FECHAMENTO: '19:00',
  INTERVALO_MIN: 30,             // de quantos em quantos minutos os horários aparecem
  ANTECEDENCIA_MIN_MINUTOS: 60,  // no dia de hoje, só mostra horários daqui a 1h em diante
  DIAS_ANTECEDENCIA: 30,         // até quantos dias à frente a cliente pode agendar
  DIAS_FUNCIONAMENTO: [2, 3, 4, 5, 6], // 0=dom 1=seg 2=ter 3=qua 4=qui 5=sex 6=sáb
  PAUSAS: [{ inicio: '12:00', fim: '13:00' }], // almoço etc.
  FOLGAS: ['2026-12-25', '2027-01-01'],         // dias fechados (aaaa-mm-dd)
  SERVICOS: [
    // preco em número (150 = R$ 150,00). descricao aparece no card do serviço.
    { id: 'aplicacao',  nome: 'Aplicação de gel',  duracao: 120, preco: 150, descricao: 'Alongamento completo na tips ou fibra, formato à sua escolha.' },
    { id: 'manutencao', nome: 'Manutenção',        duracao: 90,  preco: 100, descricao: 'Preenchimento do crescimento e nova esmaltação. A cada 20–25 dias.' },
    { id: 'esmaltacao', nome: 'Esmaltação em gel', duracao: 60,  preco: 70,  descricao: 'Brilho e cor que duram semanas, na unha natural.' },
    { id: 'remocao',    nome: 'Remoção',           duracao: 30,  preco: 40,  descricao: 'Retirada cuidadosa do gel, sem agredir a unha.' }
  ]
};

const COLUNAS = ['ID', 'Data', 'Início', 'Fim', 'Serviço', 'Nome', 'Telefone', 'Status', 'Observação', 'Criado em'];
const STATUS_VALIDOS = ['confirmado', 'concluido', 'cancelado', 'faltou', 'bloqueado'];

/* ---------- Instalação ---------- */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.ABA);
  if (!sh) sh = ss.insertSheet(CONFIG.ABA);
  sh.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]).setFontWeight('bold');
  sh.getRange('A:D').setNumberFormat('@');
  sh.getRange('G:G').setNumberFormat('@');
  sh.setFrozenRows(1);
  if (!PropertiesService.getScriptProperties().getProperty('ADMIN_SENHA')) {
    Logger.log('Lembre de criar a propriedade ADMIN_SENHA em Configurações do projeto.');
  }
}

/* ---------- Rotas ---------- */

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.acao === 'config') return json({ ok: true, config: configPublica() });
    if (p.acao === 'horarios') {
      const serv = acharServico(p.servico);
      if (!serv) throw new Error('Serviço inválido.');
      return json({ ok: true, horarios: horariosLivres(p.data, serv.duracao) });
    }
    if (p.acao === 'disponibilidade') {
      const serv = acharServico(p.servico);
      if (!serv) throw new Error('Serviço inválido.');
      return json({ ok: true, dias: disponibilidade(serv.duracao) });
    }
    throw new Error('Ação desconhecida.');
  } catch (err) {
    return json({ ok: false, erro: err.message });
  }
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents || '{}');
    switch (d.acao) {
      case 'agendar':
        return json(agendar(d, false));
      case 'admin_login':
        exigirSenha(d.senha);
        return json({ ok: true });
      case 'admin_listar':
        exigirSenha(d.senha);
        return json({ ok: true, itens: listar(d.de, d.ate) });
      case 'admin_status':
        exigirSenha(d.senha);
        return json(mudarStatus(d.id, d.status));
      case 'admin_agendar':
        exigirSenha(d.senha);
        return json(agendar(d, true));
    }
    throw new Error('Ação desconhecida.');
  } catch (err) {
    return json({ ok: false, erro: err.message });
  }
}

/* ---------- Regras ---------- */

function configPublica() {
  return {
    hoje: hojeISO(),
    abertura: CONFIG.ABERTURA,
    fechamento: CONFIG.FECHAMENTO,
    diasAntecedencia: CONFIG.DIAS_ANTECEDENCIA,
    diasFuncionamento: CONFIG.DIAS_FUNCIONAMENTO,
    folgas: CONFIG.FOLGAS,
    servicos: CONFIG.SERVICOS
  };
}

// Quantidade de horários livres por dia, para o calendário
function disponibilidade(duracao) {
  const todas = linhas();
  const hoje = hojeISO();
  const dias = {};
  for (let i = 0; i <= CONFIG.DIAS_ANTECEDENCIA; i++) {
    const d = somarDias(hoje, i);
    if (dataAberta(d)) dias[d] = horariosLivres(d, duracao, todas).length;
  }
  return dias;
}

function horariosLivres(data, duracao, todas) {
  if (!dataAberta(data)) return [];
  let minimo = 0;
  if (data === hojeISO()) {
    minimo = toMin(Utilities.formatDate(new Date(), CONFIG.FUSO, 'HH:mm')) + CONFIG.ANTECEDENCIA_MIN_MINUTOS;
  }
  const ocupado = ocupacoes(data, todas).concat(
    CONFIG.PAUSAS.map(p => ({ ini: toMin(p.inicio), fim: toMin(p.fim) }))
  );
  const livres = [];
  const fecha = toMin(CONFIG.FECHAMENTO);
  for (let t = toMin(CONFIG.ABERTURA); t + duracao <= fecha; t += CONFIG.INTERVALO_MIN) {
    if (t < minimo) continue;
    if (ocupado.some(o => t < o.fim && t + duracao > o.ini)) continue;
    livres.push(deMin(t));
  }
  return livres;
}

function agendar(d, admin) {
  let duracao, nomeServico;
  const bloqueio = admin && d.servico === 'bloqueio';
  if (bloqueio) {
    duracao = Math.max(15, Number(d.duracao) || 60);
    nomeServico = 'Bloqueio';
  } else {
    const s = acharServico(d.servico);
    if (!s) throw new Error('Escolha um serviço válido.');
    duracao = s.duracao;
    nomeServico = s.nome;
  }

  const nome = String(d.nome || '').trim().slice(0, 80);
  const tel = String(d.telefone || '').replace(/\D/g, '');
  if (!bloqueio) {
    if (nome.length < 2) throw new Error('Informe o nome.');
    if (tel.length < 10 || tel.length > 11) throw new Error('Telefone inválido. Use DDD + número.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data || '')) throw new Error('Data inválida.');
  if (!/^\d{2}:\d{2}$/.test(d.hora || '')) throw new Error('Horário inválido.');

  const ini = toMin(d.hora);
  const fim = ini + duracao;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (admin) {
      if (ocupacoes(d.data).some(o => ini < o.fim && fim > o.ini)) {
        throw new Error('Esse horário conflita com outro agendamento.');
      }
    } else if (horariosLivres(d.data, duracao).indexOf(d.hora) === -1) {
      throw new Error('Esse horário acabou de ser ocupado. Escolha outro.');
    }

    const id = Utilities.getUuid().slice(0, 8);
    aba().appendRow([
      id,
      "'" + d.data,
      "'" + d.hora,
      "'" + deMin(fim),
      nomeServico,
      texto(nome || '—'),
      "'" + tel,
      bloqueio ? 'bloqueado' : 'confirmado',
      texto(String(d.obs || '').slice(0, 300)),
      Utilities.formatDate(new Date(), CONFIG.FUSO, 'yyyy-MM-dd HH:mm')
    ]);
    return { ok: true, id: id, data: d.data, inicio: d.hora, fim: deMin(fim), servico: nomeServico };
  } finally {
    lock.releaseLock();
  }
}

function listar(de, ate) {
  de = de || hojeISO();
  ate = ate || de;
  return linhas()
    .filter(l => l.data >= de && l.data <= ate)
    .sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio))
    .map(l => { delete l.linha; return l; });
}

function mudarStatus(id, status) {
  if (STATUS_VALIDOS.indexOf(status) === -1) throw new Error('Status inválido.');
  const alvo = linhas().find(l => l.id === String(id));
  if (!alvo) throw new Error('Agendamento não encontrado.');
  aba().getRange(alvo.linha, 8).setValue(status);
  return { ok: true };
}

/* ---------- Apoio ---------- */

function exigirSenha(senha) {
  const certa = PropertiesService.getScriptProperties().getProperty('ADMIN_SENHA');
  if (!certa) throw new Error('Senha do painel não configurada no Apps Script.');
  if (String(senha || '') !== certa) {
    Utilities.sleep(1200);
    throw new Error('Senha incorreta.');
  }
}

function aba() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA);
  if (!sh) throw new Error('Aba "' + CONFIG.ABA + '" não existe. Rode setup().');
  return sh;
}

function linhas() {
  const sh = aba();
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, COLUNAS.length).getValues().map((r, i) => ({
    linha: i + 2,
    id: String(r[0]),
    data: normData(r[1]),
    inicio: normHora(r[2]),
    fim: normHora(r[3]),
    servico: String(r[4]),
    nome: String(r[5]),
    telefone: String(r[6]),
    status: String(r[7]).trim().toLowerCase(),
    obs: String(r[8])
  })).filter(l => l.id);
}

function ocupacoes(data, todas) {
  return (todas || linhas())
    .filter(l => l.data === data && l.status !== 'cancelado')
    .map(l => ({ ini: toMin(l.inicio), fim: toMin(l.fim) }));
}

function acharServico(id) {
  return CONFIG.SERVICOS.find(s => s.id === id) || null;
}

function dataAberta(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return false;
  const hoje = hojeISO();
  if (data < hoje || data > somarDias(hoje, CONFIG.DIAS_ANTECEDENCIA)) return false;
  if (CONFIG.FOLGAS.indexOf(data) !== -1) return false;
  return CONFIG.DIAS_FUNCIONAMENTO.indexOf(diaSemana(data)) !== -1;
}

function hojeISO() { return Utilities.formatDate(new Date(), CONFIG.FUSO, 'yyyy-MM-dd'); }
function diaSemana(iso) { const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]).getDay(); }
function somarDias(iso, n) {
  const p = iso.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2] + n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function pad(n) { return String(n).padStart(2, '0'); }
function toMin(hhmm) { const p = String(hhmm).split(':').map(Number); return p[0] * 60 + p[1]; }
function deMin(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }

function normData(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  return String(v).trim();
}
function normHora(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'HH:mm');
  return String(v).trim().slice(0, 5);
}

// Evita que um nome como "=IMPORTXML(...)" vire fórmula na planilha
function texto(v) {
  const s = String(v || '').trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
