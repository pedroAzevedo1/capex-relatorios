const PDFDocument = require('pdfkit');

const COR = {
  azul:     '#1E2044',
  azul2:    '#00285B',
  dourado:  '#854D00',
  dourado2: '#C48A2A',
  dourado3: '#F0B84A',
  verde:    '#1D7A5F',
  vermelho: '#B02020',
  cinza:    '#E8ECF4',
  muted:    '#6B7A9F',
  branco:   '#FAFDFF',
  bg:       '#F0F2F8',
  borda:    '#D1D8EE',
};

const fmtR = n => 'R$ ' + Math.round(n).toLocaleString('pt-BR');
const fmtP = n => (typeof n === 'number' ? n : parseFloat(n) || 0).toFixed(2) + '%';
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function periodoLabel(periodo) {
  if (!periodo) return '—';
  const [ano, mes] = periodo.split('-');
  return `${MESES[parseInt(mes, 10) - 1]} de ${ano}`;
}

function hexToRgb(hex) {
  if (Array.isArray(hex)) return hex;
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function fillRect(doc, x, y, w, h, hex) {
  doc.save().rect(x, y, w, h).fillColor(hexToRgb(hex)).fill().restore();
}

function strokeRect(doc, x, y, w, h, hex, lw = 0.5) {
  doc.save().rect(x, y, w, h).strokeColor(hexToRgb(hex)).lineWidth(lw).stroke().restore();
}

function sectionTitle(doc, texto, x, y, w) {
  fillRect(doc, x, y, w, 20, '#EEF1FA');
  fillRect(doc, x, y, 3, 20, '#854D00');
  doc.font('Helvetica-Bold').fontSize(9)
     .fillColor(hexToRgb(COR.azul2))
     .text(texto.toUpperCase(), x + 10, y + 6, { characterSpacing: 0.8, width: w - 14 });
}

function gerarAlertas(dados) {
  const alertas = [];
  const tp = dados.total_pat || 0;
  const pc = dados.pct_cdi   || 0;
  const semFgcV = dados.fontes.filter(f => f.fgc === 'Não').reduce((s,f) => s + (f.valor||0), 0);
  const semFgcP = tp > 0 ? semFgcV / tp * 100 : 0;

  if (semFgcP > 40)
    alertas.push({ tipo:'danger', texto:`Concentração sem FGC elevada: ${semFgcP.toFixed(1)}% do patrimônio (${fmtR(semFgcV)}) sem cobertura do FGC. Considere reduzir gradualmente.` });
  else if (semFgcP > 20)
    alertas.push({ tipo:'warn', texto:`Atenção FGC: ${semFgcP.toFixed(1)}% do patrimônio sem cobertura. Dentro do limite, mas recomenda-se monitorar.` });

  dados.fontes.forEach(f => {
    if ((f.valor||0) > 250000 && f.fgc === 'Total')
      alertas.push({ tipo:'danger', texto:`${f.nome}: posição de ${fmtR(f.valor)} excede o limite do FGC de R$ 250.000 por CPF por instituição.` });
  });

  if (pc < 90)
    alertas.push({ tipo:'warn', texto:`Performance abaixo do CDI: a carteira rendeu ${Math.round(pc)}% do CDI. Revise ativos com taxas inferiores ao mercado.` });
  else if (pc > 120)
    alertas.push({ tipo:'ok', texto:`Performance excepcional: a carteira rendeu ${Math.round(pc)}% do CDI — muito acima do benchmark.` });
  else
    alertas.push({ tipo:'ok', texto:`Performance adequada: a carteira rendeu ${Math.round(pc)}% do CDI, dentro do esperado para o perfil ${dados.perfil || 'do cliente'}.` });

  if (dados.fontes.length === 1)
    alertas.push({ tipo:'info', texto:'Concentração em uma única fonte: considere diversificar em mais custodiantes para reduzir risco operacional.' });

  return alertas;
}

function gerarPDF(dados) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top:0, bottom:0, left:0, right:0 },
        info: {
          Title:   `Relatório Capex — ${dados.cliente}`,
          Author:  dados.consultor || 'Capex Investimentos',
          Subject: periodoLabel(dados.periodo),
        },
      });

      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;
      const ML = 40, MR = 40, CW = W - ML - MR;

      // ── Cabeçalho ──────────────────────────────
      fillRect(doc, 0, 0, W, 90, COR.azul);
      fillRect(doc, 0, 87, W, 3, COR.dourado);

      doc.font('Helvetica-Bold').fontSize(28).fillColor(hexToRgb(COR.branco)).text('CAP', ML, 28, { continued: true })
         .fillColor(hexToRgb(COR.dourado3)).text('EX');
      doc.font('Helvetica').fontSize(8).fillColor(hexToRgb(COR.dourado2)).text('INVESTIMENTOS', ML, 60, { characterSpacing: 3 });
      doc.font('Helvetica-Bold').fontSize(14).fillColor(hexToRgb(COR.branco)).text('Relatório Patrimonial', 0, 28, { align:'center', width:W });
      doc.font('Helvetica').fontSize(9).fillColor([200,210,230]).text(periodoLabel(dados.periodo), 0, 48, { align:'center', width:W });

      const chipX = W - MR - 90;
      fillRect(doc, chipX, 30, 90, 20, COR.dourado);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(hexToRgb(COR.branco)).text(dados.perfil || 'Conservador', chipX, 35, { width:90, align:'center' });

      // ── Dados do cliente ───────────────────────
      let y = 105;
      fillRect(doc, ML, y, CW, 44, COR.bg);
      strokeRect(doc, ML, y, CW, 44, COR.borda);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(hexToRgb(COR.azul2)).text(dados.cliente || '—', ML+12, y+8);
      doc.font('Helvetica').fontSize(8.5).fillColor(hexToRgb(COR.muted)).text(
        [dados.consultor?`Consultor: ${dados.consultor}`:null, dados.conta?`Conta: ${dados.conta}`:null,
         `Perfil: ${dados.perfil||'—'}`, `Período: ${periodoLabel(dados.periodo)}`].filter(Boolean).join('   ·   '),
        ML+12, y+24
      );
      y += 58;

      // ── Métricas ───────────────────────────────
      const cardW = (CW - 12) / 4, cardH = 62;
      const metricas = [
        { lbl:'Patrimônio Total',          val: fmtR(dados.total_pat),               cor: COR.azul2,   valCor: COR.azul    },
        { lbl:'Rentabilidade Consolidada', val: '+'+fmtP(dados.rent_pond),            cor: COR.verde,   valCor: COR.verde   },
        { lbl:'% do CDI',                  val: Math.round(dados.pct_cdi)+'%',        cor: COR.dourado, valCor: COR.dourado },
        { lbl:'Rendimento no Mês',         val: '+'+fmtR(dados.total_rend),           cor: COR.verde,   valCor: COR.verde   },
      ];
      metricas.forEach((m, i) => {
        const mx = ML + i * (cardW + 4);
        fillRect(doc, mx, y, cardW, cardH, COR.branco);
        strokeRect(doc, mx, y, cardW, cardH, COR.borda);
        fillRect(doc, mx, y, cardW, 3, m.cor);
        doc.font('Helvetica').fontSize(7.5).fillColor(hexToRgb(COR.muted)).text(m.lbl.toUpperCase(), mx+8, y+10, { width:cardW-16 });
        doc.font('Helvetica-Bold').fontSize(13).fillColor(hexToRgb(m.valCor)).text(m.val, mx+8, y+26, { width:cardW-16 });
        doc.font('Helvetica').fontSize(7.5).fillColor(hexToRgb(COR.muted)).text(`CDI: ${fmtP(dados.cdi_mes)} a.m.`, mx+8, y+46, { width:cardW-16 });
      });
      y += cardH + 18;

      // ── Tabela de fontes ───────────────────────
      sectionTitle(doc, 'Composição da Carteira', ML, y, CW);
      y += 26;

      const cols = [
        { label:'Fonte / Custodiante', w:130 },
        { label:'Produto',             w:90  },
        { label:'Patrimônio',          w:80  },
        { label:'% Cart.',             w:42  },
        { label:'FGC',                 w:46  },
        { label:'Rent. Mês',           w:52  },
        { label:'Rend. R$',            w:75  },
      ];
      const rowH = 22;

      fillRect(doc, ML, y, CW, rowH, COR.azul);
      let cx = ML;
      cols.forEach(col => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(hexToRgb(COR.branco))
           .text(col.label.toUpperCase(), cx+5, y+7, { width:col.w-6 });
        cx += col.w;
      });
      y += rowH;

      dados.fontes.forEach((f, idx) => {
        fillRect(doc, ML, y, CW, rowH, idx%2===0 ? COR.branco : COR.bg);
        strokeRect(doc, ML, y, CW, rowH, COR.borda, 0.3);
        const pct = dados.total_pat > 0 ? (f.valor/dados.total_pat*100).toFixed(1)+'%' : '0%';
        const fgcCor = f.fgc==='Total' ? COR.verde : f.fgc==='Parcial' ? COR.dourado : COR.vermelho;
        const cells = [
          { text:f.nome||'—',          bold:true,  cor:COR.azul    },
          { text:f.tipo||'—',          bold:false, cor:'#333333'   },
          { text:fmtR(f.valor),        bold:false, cor:'#111111'   },
          { text:pct,                  bold:false, cor:COR.muted   },
          { text:f.fgc,                bold:true,  cor:fgcCor      },
          { text:'+'+fmtP(f.rent),     bold:true,  cor:COR.verde   },
          { text:'+'+fmtR(f.rend),     bold:true,  cor:COR.verde   },
        ];
        cx = ML;
        cells.forEach((cell, ci) => {
          doc.font(cell.bold?'Helvetica-Bold':'Helvetica').fontSize(8.5)
             .fillColor(hexToRgb(cell.cor))
             .text(cell.text, cx+5, y+7, { width:cols[ci].w-8 });
          cx += cols[ci].w;
        });
        y += rowH;
      });

      fillRect(doc, ML, y, CW, rowH, COR.azul2);
      const totals = ['TOTAL CONSOLIDADO','', fmtR(dados.total_pat),'100%','—','+'+fmtP(dados.rent_pond),'+'+fmtR(dados.total_rend)];
      cx = ML;
      totals.forEach((t, ci) => {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor([160,232,200])
           .text(t, cx+5, y+7, { width:cols[ci].w-8 });
        cx += cols[ci].w;
      });
      y += rowH + 18;

      // ── Alertas ────────────────────────────────
      const alertas = gerarAlertas(dados);
      if (alertas.length > 0) {
        if (y + 26 + alertas.length * 32 > doc.page.height - 60) { doc.addPage(); y = 40; }
        sectionTitle(doc, 'Alertas e Oportunidades', ML, y, CW);
        y += 26;
        alertas.forEach(a => {
          const bg = { danger:'#FFF0F0', warn:'#FFFBF0', info:'#EFF3FF', ok:'#EDFAF4' }[a.tipo];
          const bc = { danger:COR.vermelho, warn:COR.dourado, info:COR.azul2, ok:COR.verde }[a.tipo];
          const textH = Math.max(28, doc.heightOfString(a.texto, { width:CW-26, fontSize:9 }) + 14);
          if (y + textH > doc.page.height - 60) { doc.addPage(); y = 40; }
          fillRect(doc, ML, y, CW, textH, bg);
          fillRect(doc, ML, y, 4, textH, bc);
          doc.font('Helvetica').fontSize(9).fillColor([30,30,60]).text(a.texto, ML+14, y+8, { width:CW-22 });
          y += textH + 5;
        });
        y += 8;
      }

      // ── Observações ────────────────────────────
      if (dados.obs_extra && dados.obs_extra.trim()) {
        if (y + 60 > doc.page.height - 60) { doc.addPage(); y = 40; }
        sectionTitle(doc, 'Observações do Consultor', ML, y, CW);
        y += 26;
        const obsH = Math.max(40, doc.heightOfString(dados.obs_extra, { width:CW-24 }) + 20);
        fillRect(doc, ML, y, CW, obsH, COR.bg);
        strokeRect(doc, ML, y, CW, obsH, COR.borda);
        doc.font('Helvetica').fontSize(9.5).fillColor(hexToRgb(COR.azul)).text(dados.obs_extra, ML+12, y+10, { width:CW-24 });
        y += obsH + 14;
      }

      // ── Rodapé ─────────────────────────────────
      const pageH = doc.page.height;
      fillRect(doc, 0, pageH-38, W, 38, COR.azul);
      fillRect(doc, 0, pageH-38, W, 2, COR.dourado);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(hexToRgb(COR.branco))
         .text('Capex Investimentos — Confiança, Qualidade, Clareza e Comprometimento', ML, pageH-26, { width:CW*0.65 });
      doc.font('Helvetica').fontSize(8).fillColor(hexToRgb(COR.dourado2))
         .text('@capex_investimentos · São João da Boa Vista, SP', 0, pageH-26, { align:'right', width:W-MR });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = gerarPDF;
