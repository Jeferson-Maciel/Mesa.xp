import { abrirJanela } from './janela.js';
import { esc } from './html.js';
import './manual.css';

/**
 * Manual Operacional e Guia de Treinamento da Mesa XP.
 * Voltado para onboarding de novos colaboradores e consulta rápida de fluxos e atualizações.
 */

export const HTML_DO_MANUAL = `
<dialog class="modal-manual" id="modal-manual" aria-label="Manual e Guia de Treinamento da Mesa XP">
  <header class="manual-cabecalho">
    <div class="manual-titulo-grupo">
      <svg class="manual-icone-livro" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M4 19.5a2.5 2.5 0 0 0 2.5 2.5H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"></path>
        <path d="M8 7h8"></path>
        <path d="M8 11h8"></path>
      </svg>
      <div>
        <h2>Manual da Mesa XP <span class="manual-badge-versao">v1.14.0</span></h2>
        <p class="manual-subtitulo">Guia Completo de Operação, Robô Tampermonkey, Fluxos e Boletas</p>
      </div>
    </div>
    <div class="manual-acoes-topo">
      <button type="button" class="btn-imprimir-pdf" data-manual-acao="imprimir" title="Salvar este manual como documento PDF ou imprimir">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        Salvar como PDF / Imprimir
      </button>
      <button type="button" class="btn-fechar-manual" data-manual-acao="fechar" aria-label="Fechar manual (Esc)">&times;</button>
    </div>
  </header>

  <div class="manual-corpo">
    <nav class="manual-sidebar" aria-label="Sumário do Manual">
      <div class="manual-sidebar-titulo">Capítulos</div>
      <ul class="manual-nav-lista">
        <li><a href="#cap-visao-geral" class="manual-nav-link ativo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> 1. Visão Geral</a></li>
        <li><a href="#cap-instalacao-robo" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> 2. Robô & Extensão</a></li>
        <li><a href="#cap-trio-de-abas" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> 3. As 3 Abas Abertas</a></li>
        <li><a href="#cap-ordens" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 20V5M3.5 8.5 7 5l3.5 3.5M17 4v15M13.5 15.5 17 19l3.5-3.5"/></svg> 4. Ordens & Boletas</a></li>
        <li><a href="#cap-fila" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="4" width="4.5" height="16" rx="1.5"/><rect x="9.75" y="4" width="4.5" height="11" rx="1.5"/><rect x="16" y="4" width="4.5" height="7" rx="1.5"/></svg> 5. Fila do Dia</a></li>
        <li><a href="#cap-rendafixa" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17.5 9 11.5l4 4 8-8M15 7.5h6v6"/></svg> 6. Renda Fixa</a></li>
        <li><a href="#cap-fundos" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6.5h16M4 12h16M4 17.5h16"/></svg> 7. Prateleira de Fundos</a></li>
        <li><a href="#cap-outros-modulos" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg> 8. Outros Módulos</a></li>
        <li><a href="#cap-troubleshooting" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> 9. Dúvidas Frequentes</a></li>
      </ul>
    </nav>

    <main class="manual-conteudo">
      <!-- Capítulo 1: Visão Geral -->
      <section id="cap-visao-geral" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>1. Visão Geral da Mesa XP</h3>
        </div>
        <p>
          A <strong>Mesa XP</strong> é a suíte operacional de alta performance desenvolvida para os assessores e operadores de back office de escritórios credenciados à XP Investimentos. Ela centraliza a emissão de ordens, auditoria de e-mails, controle de prazos e esteira de execução em uma interface única e veloz.
        </p>

        <div class="manual-callout destaque">
          <strong>Segurança e Sigilo Bancário Total</strong>
          A Mesa XP roda 100% no navegador (Client-side). Dados cadastrais de clientes, contas, patrimônio, CPF, limites e comprovantes <strong>nunca são enviados para servidores externos</strong> nem salvos em nuvem de terceiros. Tudo é processado estritamente na memória da sua máquina.
        </div>

        <h4>A Regra de Ouro da Mesa: "Nada é Adivinhado"</h4>
        <p>
          O sistema opera com rigor financeiro estrito. Quando falta uma informação essencial (conta ausente, ticker ambíguo, saldo insuficiente ou falta de cotação), a Mesa <strong>bloqueia a saída</strong> com alerta vermelho e apresenta um botão de conserto rápido à vista. Nenhuma taxa ou quantidade é arredondada por inferência.
        </p>
      </section>

      <!-- Capítulo 2: Robô & Extensão -->
      <section id="cap-instalacao-robo" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>2. Instalação da Extensão e do Robô do Hub</h3>
        </div>
        <p>
          Para que a Mesa XP consiga consultar o preço exato das cotas, abrir boletas, buscar dados do cliente no Hub, vigiar respostas no Outlook e puxar planilhas de Renda Fixa automaticamente, ela utiliza um script complementar via <strong>Tampermonkey</strong>.
        </p>

        <div class="manual-callout atencao">
          <strong>Por que usamos o Tampermonkey?</strong>
          Como as máquinas de trabalho são gerenciadas e não permitem extensões de desenvolvedor arbitrárias, o Tampermonkey executa um script seguro local que se comunica com a Mesa pelo armazenamento interno do próprio navegador (sem tocar em senhas nem credenciais).
        </div>

        <h4>Passo a Passo de Instalação (para Novos Colegas):</h4>
        <ol class="manual-passos">
          <li>
            <strong>Instale o Tampermonkey:</strong><br>
            Acesse a loja oficial de extensões do seu navegador (<a href="https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo" target="_blank" rel="noopener">Chrome Web Store</a> ou loja do Microsoft Edge) e clique em <em>Usar no Chrome / Obter</em>.
          </li>
          <li>
            <strong>Instale o Robô da Mesa XP:</strong><br>
            Com a Mesa XP aberta, na aba <strong>Ordens</strong>, clique no botão <kbd>Instalar robô</kbd> (ou acesse o link de instalação). O Tampermonkey abrirá uma aba com o código do script. Basta clicar no botão azul <strong>"Instalar"</strong>.
          </li>
          <li>
            <strong>Atualizações Automáticas:</strong><br>
            O robô possui atualização automática configurada (versão atual: <strong>1.14.0</strong>). Conforme melhorias são publicadas na Mesa, o script se atualiza sozinho sem você precisar reinstalar.
          </li>
        </ol>
      </section>

      <!-- Capítulo 3: Trio de Abas -->
      <section id="cap-trio-de-abas" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>3. As 3 Abas que Devem Ficar Abertas</h3>
        </div>
        <p>
          Para que todas as automações operem em perfeita sincronia durante o expediente, cada operador deve manter abertas as seguintes três abas no navegador:
        </p>

        <div class="manual-grid-abas">
          <div class="manual-card-aba">
            <strong>🌐 Aba 1: Mesa XP (Pivô Central)</strong>
            <p>Onde você cola os pedidos, confere diagnósticos, gera e-mails, analisa Renda Fixa e controla a Fila.</p>
          </div>
          <div class="manual-card-aba">
            <strong>🤖 Aba 2: Hub XP Logado</strong>
            <p>Aba em <code>hub.xpi.com.br</code> com seu login corporativo ativo. O robô usará uma janela auxiliar silenciosa para boletas e cotações.</p>
          </div>
          <div class="manual-card-aba">
            <strong>✉️ Aba 3: Outlook na Web</strong>
            <p>Aba em <code>outlook.office.com</code> com o e-mail da assessoria aberto. O vigia lê novas respostas de clientes a cada 2s.</p>
          </div>
        </div>

        <div class="manual-callout sucesso">
          <strong>Importante sobre o Hub XP:</strong>
          Nunca digite parâmetros manuais no endereço da URL do Hub (ex: <code>?teste=1</code>), pois isso desativa o carregamento dos componentes do Mercado Secundário.
        </div>
      </section>

      <!-- Capítulo 4: Ordens -->
      <section id="cap-ordens" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>4. Assistente de Ordens (Atalho Alt + 1)</h3>
        </div>
        <p>
          Transforma pedidos bagunçados recebidos via WhatsApp, Slack ou e-mail nos formatos oficiais de auditoria e lotes operacionais da XP.
        </p>

        <h4>Fluxo Operacional:</h4>
        <ol class="manual-passos">
          <li><strong>Colar o pedido:</strong> Cole a mensagem na caixa de texto superior. O parser identifica automaticamente a conta XP (5 a 8 dígitos) e os ativos.</li>
          <li><strong>Analisar:</strong> Pressione <kbd>Ctrl + Enter</kbd> ou clique em <em>Analisar ordens</em>.</li>
          <li><strong>Tabela de conferência:</strong> Ajuste ativo, quantidade, compra/venda (C/V) ou preço limite se necessário.</li>
          <li><strong>Secundário de Fundos:</strong> O robô consulta a prateleira em tempo real. Se o pedido veio em R$, ele converte automaticamente em cotas. Você pode alternar entre <em>ROA Máximo</em> e <em>Sem ROA</em> com um clique.</li>
          <li><strong>Venda no Secundário:</strong> O robô lê a posição disponível exata do cliente (com até 8 casas). Se o Estoque XP estiver fechado no dia, clique em <kbd>Vender no Estoque clientes</kbd>.</li>
          <li><strong>Tirar Prints:</strong> Clique em <kbd>Tirar prints</kbd> para o robô capturar a boleta física no Hub (ou gerar o comprovante determinístico oficial).</li>
          <li><strong>Abrir no Outlook:</strong> O botão <kbd>Abrir no Outlook</kbd> abre a janela de envio preenchida com o cliente, assessor em cópia e injeta os prints no corpo.</li>
        </ol>

        <h4>Grupos de Saída:</h4>
        <table class="manual-tabela">
          <thead>
            <tr><th>Grupo</th><th>O que contém</th><th>Como sai</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Bolsa</strong></td><td>Ações, FIIs listados, BDRs, ETFs</td><td>E-mail modelo padrão, Lote Simples ou TWAP</td></tr>
            <tr><td><strong>Fundos · Compra</strong></td><td>Fundos cetipados comprados</td><td>E-mail com PU exato, deságio e cotas</td></tr>
            <tr><td><strong>Fundos · Venda</strong></td><td>Fundos cetipados vendidos</td><td>E-mail de auditoria com prints abaixo de "Condições:"</td></tr>
            <tr><td><strong>Tesouro Direto</strong></td><td>Aplicação e Resgate de títulos públicos</td><td>E-mail com taxas oficiais do dia lidas do Hub</td></tr>
          </tbody>
        </table>
      </section>

      <!-- Capítulo 5: Fila -->
      <section id="cap-fila" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>5. Fila do Dia (Atalho Alt + 2)</h3>
        </div>
        <p>
          A Fila é a sua caixa de entrada operacional. Cada e-mail copiado ou disparado entra automaticamente na Fila e fica guardado no navegador por até 90 dias.
        </p>

        <h4>Pastas de Trabalho:</h4>
        <ul>
          <li><strong>Aprovação e Execução:</strong> Onde ficam os pedidos que o cliente já respondeu aprovando, ou ordens prontas para gerar lote.</li>
          <li><strong>Enviados:</strong> Pedidos aguardando retorno do investidor.</li>
          <li><strong>Executados:</strong> Ordens já concluídas no sistema.</li>
        </ul>

        <h4>Vigia Automático do Outlook:</h4>
        <p>
          Com a aba do Outlook na Web aberta, o robô monitora a chegada de novas respostas:
        </p>
        <ul>
          <li><strong>Casamento Inteligente:</strong> Lê a conta XP citada na resposta do cliente e move o pedido para <em>Aprovação e Execução</em> com som discreto.</li>
          <li><strong>Desambiguação Compra vs. Venda:</strong> Se foram disparados dois e-mails para o mesmo cliente (ex: uma compra e uma venda), o vigia lê os termos da resposta para casar com o cartão exato, sem misturar.</li>
          <li><strong>Proteção Anti-Avalanche:</strong> Notificações duplicadas são barradas na raiz; o sistema exibe no máximo 3 avisos simultâneos para nunca travar a sua tela.</li>
        </ul>

        <h4>Alarme do Leilão da B3 (16:55):</h4>
        <p>
          Às 16:25 (30 minutos antes do leilão), a Mesa emite um alerta sonoro e destaca a aba Fila em tom âmbar se ainda houver ordens de bolsa na pasta <em>Enviados</em> aguardando o cliente.
        </p>
      </section>

      <!-- Capítulo 6: Renda Fixa -->
      <section id="cap-rendafixa" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>6. Renda Fixa Pro (Atalho Alt + 4)</h3>
        </div>
        <p>
          Motor de análise de oportunidades de Renda Fixa bancária (CDB, LCI, LCA, CRI, CRA) para envio aos clientes no WhatsApp.
        </p>

        <h4>Funcionalidades Principais:</h4>
        <ul>
          <li>
            <strong>Puxar do Hub (Atalho P):</strong><br>
            Não é mais necessário baixar a planilha no Hub todo dia. Basta clicar no botão azul <kbd>Puxar do Hub</kbd>. O robô 1.14.0 acessa a prateleira de Emissão Bancária, clica em Exportar e transfere a grade em segundos direto para a tela.
          </li>
          <li>
            <strong>Mercado Primário vs. Secundário (Atalho M):</strong><br>
            Alterna entre as taxas da emissão matinal e as oportunidades de mercado secundário da tarde.
          </li>
          <li>
            <strong>Configuração de Regras (Atalho R):</strong><br>
            Abra a gaveta de regras para ajustar limites de PU, prazos desejados, bancos autorizados e modelos de texto.
          </li>
          <li>
            <strong>Baixar Imagem (Atalho I):</strong><br>
            Gera na hora uma imagem PNG em alta resolução (1080px) com os cards coloridos dos ativos selecionados, pronta para anexar no WhatsApp.
          </li>
          <li>
            <strong>Simulador de Pré-fixados:</strong><br>
            Localizado abaixo dos cartões: simula o rendimento bruto, alíquota regressiva de IR e valor líquido na data do vencimento.
          </li>
        </ul>
      </section>

      <!-- Capítulo 7: Fundos -->
      <section id="cap-fundos" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>7. Prateleira de Fundos (Atalho Alt + 3)</h3>
        </div>
        <p>
          Visualização panorâmica de todos os fundos cetipados do Mercado Secundário da XP:
        </p>
        <ul>
          <li>Ordenação por maior deságio para encontrar as melhores oportunidades de entrada.</li>
          <li>Filtro em tempo real por ticker (ex: <code>IMOV11</code>, <code>VGPR11</code>).</li>
          <li>Comparativo diário: exibe em destaque fundos novos que entraram na grade hoje ou cuja taxa variou.</li>
        </ul>
      </section>

      <!-- Capítulo 8: Outros Módulos -->
      <section id="cap-outros-modulos" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>8. Calendário, Operacional e Anotações</h3>
        </div>
        <ul>
          <li><strong>Calendário (Alt + 5):</strong> Quadro semanal de escalas e presença física da equipe no escritório, sincronizado em tempo real via Supabase.</li>
          <li><strong>Operacional (Alt + 6):</strong> Base de procedimentos internos da mesa (espelho do Slab). Pressione <kbd>Ctrl + K</kbd> para buscar qualquer modelo ou instrução pelo título ou conteúdo.</li>
          <li><strong>Anotações (Alt + 7):</strong> Bloco de notas com suporte a prints colados, links e lembretes programados que disparam avisos visuais no topo da tela quando o horário chega.</li>
        </ul>
      </section>

      <!-- Capítulo 9: Dúvidas Frequentes -->
      <section id="cap-troubleshooting" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>9. Dúvidas Frequentes & Resolução de Problemas</h3>
        </div>

        <h4>O robô aparece como "não instalado" ou com aviso vermelho</h4>
        <p>
          Verifique se a extensão Tampermonkey está ativada no Chrome/Edge e clique em <kbd>Instalar robô</kbd>. Se já estiver instalado, recarregue a aba da Mesa XP com <kbd>F5</kbd>.
        </p>

        <h4>A cotação do fundo não atualizou</h4>
        <p>
          Certifique-se de que a sua aba do <strong>Hub XP</strong> está aberta e com login ativo. O robô precisa que o Hub esteja logado para conseguir ler as cotações oficiais.
        </p>

        <h4>O cliente respondeu o e-mail mas o pedido não foi para "Aprovação"</h4>
        <p>
          Confira se a aba do <strong>Outlook na Web</strong> está aberta no seu navegador. O vigia precisa da página do Outlook rodando para ler a chegada de novas mensagens.
        </p>

        <h4>Como salvar este manual como arquivo PDF no meu computador?</h4>
        <p>
          Basta clicar no botão superior <strong>"Salvar como PDF / Imprimir"</strong> (ou pressionar <kbd>Ctrl + P</kbd>). Na janela de impressão do seu navegador, escolha a impressora <em>"Salvar como PDF"</em> e clique em Salvar. O manual será gerado com formatação de livro, sem elementos de tela desnecessários.
        </p>
      </section>
    </main>
  </div>
</dialog>
`;

/**
 * Inicializa e liga os eventos do Manual da Mesa XP.
 * @param {HTMLElement} botaoAbrir elemento de botão do cabeçalho que abre o manual.
 */
export const ligarManual = (botaoAbrir) => {
  if (typeof document === 'undefined') {
    return { abrir: () => {}, fechar: () => {}, dialogo: null };
  }
  let dialogo = document.getElementById('modal-manual');
  if (!dialogo) {
    const container = document.createElement('div');
    container.innerHTML = HTML_DO_MANUAL.trim();
    dialogo = container.firstElementChild;
    document.body.appendChild(dialogo);
  }

  const fechar = () => {
    if (dialogo.open) dialogo.close();
  };

  const abrir = (origem = botaoAbrir) => {
    abrirJanela(dialogo, origem);
    // Ativa o primeiro link do sumário
    marcarLinkAtivo('#cap-visao-geral');
  };

  // Botão fechar (X)
  dialogo.querySelector('[data-manual-acao="fechar"]')?.addEventListener('click', fechar);

  // Botão Imprimir / Salvar como PDF
  dialogo.querySelector('[data-manual-acao="imprimir"]')?.addEventListener('click', () => {
    window.print();
  });

  // Fechar ao clicar no backdrop (fora da caixa)
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo) fechar();
  });

  // Navegação suave pelo sumário lateral
  const links = dialogo.querySelectorAll('.manual-nav-link');
  const conteudo = dialogo.querySelector('.manual-conteudo');

  function marcarLinkAtivo(hash) {
    for (const l of links) {
      const bate = l.getAttribute('href') === hash;
      l.classList.toggle('ativo', bate);
    }
  }

  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.getAttribute('href').slice(1);
      const secao = dialogo.querySelector(`#${id}`);
      if (secao) {
        secao.scrollIntoView({ behavior: 'smooth', block: 'start' });
        marcarLinkAtivo(`#${id}`);
      }
    });
  });

  // Atualizar link ativo conforme rolagem
  conteudo?.addEventListener('scroll', () => {
    const secoes = dialogo.querySelectorAll('.manual-secao');
    let secaoAtiva = null;
    const scrollPos = conteudo.scrollTop + 80;

    secoes.forEach((secao) => {
      if (secao.offsetTop <= scrollPos) {
        secaoAtiva = secao.id;
      }
    });

    if (secaoAtiva) marcarLinkAtivo(`#${secaoAtiva}`);
  });

  // Ligar ao botão de abertura no cabeçalho
  botaoAbrir?.addEventListener('click', (e) => abrir(e.currentTarget));

  return { abrir, fechar, dialogo };
};
