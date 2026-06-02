const express  = require('express');
const cors     = require('cors');
const gerarPDF = require('./gerarPDF');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'https://www.seusite.com.br',
    'http://localhost:3000',
  ]
}));

app.use(express.json({ limit: '2mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', servico: 'Capex Relatórios PDF' });
});

app.post('/gerar-pdf', async (req, res) => {
  try {
    const dados = req.body;
    if (!dados.cliente || !dados.periodo || !Array.isArray(dados.fontes) || dados.fontes.length === 0) {
      return res.status(400).json({ erro: 'Dados insuficientes para gerar o relatório.' });
    }
    const pdfBuffer = await gerarPDF(dados);
    const nomeArquivo = `Capex_${dados.cliente.split(' ')[0]}_${dados.periodo.replace('-', '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    res.status(500).json({ erro: 'Falha interna ao gerar o relatório.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅  Capex back-end rodando em http://localhost:${PORT}`);
});
