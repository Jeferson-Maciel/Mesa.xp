import { abrirJanela } from './janela.js';
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
        <p class="manual-subtitulo">Guia Completo para Novos Colaboradores, Robô Tampermonkey e Boletas</p>
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
        <li><a href="#cap-instalacao-robo" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> 2. Como Instalar a Extensão</a></li>
        <li><a href="#cap-trio-de-abas" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> 3. As 3 Abas Abertas</a></li>
        <li><a href="#cap-ordens" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 20V5M3.5 8.5 7 5l3.5 3.5M17 4v15M13.5 15.5 17 19l3.5-3.5"/></svg> 4. Ordens & Boletas</a></li>
        <li><a href="#cap-exemplos-ordens" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg> 5. Exemplos de Mensagens</a></li>
        <li><a href="#cap-fila" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="4" width="4.5" height="16" rx="1.5"/><rect x="9.75" y="4" width="4.5" height="11" rx="1.5"/><rect x="16" y="4" width="4.5" height="7" rx="1.5"/></svg> 6. Fila do Dia & Outlook</a></li>
        <li><a href="#cap-rendafixa" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17.5 9 11.5l4 4 8-8M15 7.5h6v6"/></svg> 7. Renda Fixa Pro</a></li>
        <li><a href="#cap-fundos" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6.5h16M4 12h16M4 17.5h16"/></svg> 8. Fundos & Secundário</a></li>
        <li><a href="#cap-outros-modulos" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/></svg> 9. Outros Módulos</a></li>
        <li><a href="#cap-troubleshooting" class="manual-nav-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> 10. Dúvidas Frequentes</a></li>
      </ul>
    </nav>

    <main class="manual-conteudo">
      <!-- Capítulo 1: Visão Geral -->
      <section id="cap-visao-geral" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>1. Visão Geral da Mesa XP</h3>
        </div>
        <p>
          A <strong>Mesa XP</strong> é o sistema de apoio operacional para assessores de investimentos e operadores de back office. Ela reúne em uma única tela de alta performance:
        </p>
        <ul>
          <li>Transformação instantânea de solicitações informais de WhatsApp/Slack em e-mails oficiais de auditoria;</li>
          <li>Cálculo rigoroso de cotas, deságio, ROA Máximo e boletas do Mercado Secundário da XP;</li>
          <li>Vigia automático do Outlook na Web para detectar confirmações de clientes sem precisar abrir a caixa de e-mails o dia todo;</li>
          <li>Motor de Renda Fixa com importação direta do Hub (botão <em>Puxar do Hub</em>), sem baixar planilhas;</li>
          <li>Controle de presença no escritório e base de procedimentos internos sincronizados em tempo real.</li>
        </ul>

        <div class="manual-callout destaque">
          <strong>Segurança e Sigilo Bancário Total (Client-Side)</strong>
          A Mesa XP roda 100% no navegador da sua máquina. Dados cadastrais de clientes, números de conta, CPFs, e-mails, patrimônio e comprovantes <strong>nunca são transmitidos para servidores externos</strong>. Todas as análises acontecem localmente na memória do seu navegador.
        </div>

        <h4>A Regra Central: "Nada é Adivinhado"</h4>
        <p>
          O sistema trabalha com rigor financeiro estrito. Quando falta uma informação (número de conta ausente, ativo ambíguo, saldo insuficiente ou falta de cotação do Hub), a Mesa <strong>não inventa valores nem arredonda quantidades</strong>: ela bloqueia o envio com um aviso em vermelho e apresenta um botão direto para consertar o dado faltante.
        </p>
      </section>

      <!-- Capítulo 2: Como Instalar a Extensão (Guia Para Leigos) -->
      <section id="cap-instalacao-robo" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>2. Como Instalar a Extensão e o Robô (Guia Passo a Passo para Iniciantes)</h3>
        </div>
        <p>
          Para que a Mesa XP consiga consultar preços de cotas no <strong>Hub XP</strong>, abrir boletas de compra/venda, vigiar respostas no <strong>Outlook na Web</strong> e puxar planilhas de Renda Fixa sem download, você precisa de um pequeno programa assistente no navegador chamado <strong>Tampermonkey</strong>.
        </p>

        <div class="manual-callout destaque">
          <strong>O que é o Tampermonkey em linguagem simples?</strong>
          Pense no Tampermonkey como um "ajudante invisível" que roda com segurança dentro do seu próprio navegador. Ele não salva senhas nem envia nada para a internet: ele apenas executa as tarefas repetitivas do dia a dia (como ler cotações de fundos e verificar se o cliente respondeu ao e-mail).
        </div>

        <!-- Banner Modo Desenvolvedor -->
        <div class="banner-modo-dev">
          <div class="banner-modo-dev-titulo">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Requisito Obrigatório 1: Ativar o "Modo do Desenvolvedor"
          </div>
          <p>
            Desde as atualizações recentes de segurança do Google Chrome e Microsoft Edge (Manifest V3), extensões com scripts locais <strong>só funcionam se o Modo do Desenvolvedor estiver ativado</strong>. O processo é rápido e seguro (veja no Passo 2 abaixo).
          </p>
        </div>

        <!-- Banner Acesso a Arquivos Locais -->
        <div class="banner-arquivo-url">
          <div class="banner-arquivo-url-titulo">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Requisito Obrigatório 2 (Para quem abre a Mesa do computador com 2 cliques):
          </div>
          <p>
            Se você abre a Mesa XP direto de uma pasta no seu computador (o endereço começa com <code>file:///...</code>), você <strong>obrigatoriamente deve ativar a opção "Permitir acesso a URLs de arquivo"</strong> nos Detalhes do Tampermonkey (veja no Passo 4 abaixo). Sem isso, o Chrome bloqueia a comunicação com o robô!
          </p>
        </div>

        <div class="manual-passos-container">
          <!-- Passo 1 -->
          <div class="passo-card">
            <div class="passo-numero">1</div>
            <div class="passo-conteudo">
              <strong>Instalar o Tampermonkey na Loja Oficial</strong>
              <p>
                Abra o Google Chrome ou Microsoft Edge e clique no link abaixo para ir direto à página da extensão:
              </p>
              <p>
                👉 <a href="https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo" target="_blank" rel="noopener"><strong>Clique aqui para abrir o Tampermonkey na Chrome Web Store</strong></a>
              </p>
              <p>
                Na página que abrir, clique no botão azul <strong>"Usar no Chrome"</strong> (ou <em>"Obter"</em> no Edge) e confirme clicando em <strong>"Adicionar extensão"</strong>.
              </p>
            </div>
          </div>

          <!-- Passo 2 -->
          <div class="passo-card">
            <div class="passo-numero">2</div>
            <div class="passo-conteudo">
              <strong>Ativar a chave "Modo do desenvolvedor"</strong>
              <p>
                1. Na barra onde você digita os sites (no topo do navegador), digite: <kbd>chrome://extensions</kbd> (ou <kbd>edge://extensions</kbd> no Edge) e aperte <kbd>Enter</kbd>.<br>
                <em>(Se preferir usar o mouse: clique nos 3 pontinhos ⋮ no canto superior direito do navegador ➔ <strong>Extensões</strong> ➔ <strong>Gerenciar extensões</strong>).</em>
              </p>
              <p>
                2. No <strong>canto superior direito da tela</strong>, procure por uma chave seletora com o texto <strong>"Modo do desenvolvedor"</strong>.
              </p>
              <p>
                3. Clique na chave para <strong>LIGAR</strong> <span class="simulacao-toggle"><span class="simulacao-toggle-chave"></span> Ativado</span>. A chave ficará azul.
              </p>
            </div>
          </div>

          <!-- Passo 3 -->
          <div class="passo-card">
            <div class="passo-numero">3</div>
            <div class="passo-conteudo">
              <strong>Fixar o Ícone do Tampermonkey na Barra do Navegador</strong>
              <p>
                Para você sempre saber se o robô está ativo e vigiando:
              </p>
              <p>
                1. No topo do navegador (ao lado da barra de endereço), clique no ícone de <strong>peça de quebra-cabeça 🧩</strong>.
              </p>
              <p>
                2. Localize o <strong>Tampermonkey</strong> na lista e clique no ícone do <strong>alfinete 📌</strong> ao lado dele.<br>
                O ícone preto do Tampermonkey ficará fixo e sempre visível ao lado da barra de navegação.
              </p>
            </div>
          </div>

          <!-- Passo 4 -->
          <div class="passo-card">
            <div class="passo-numero">4</div>
            <div class="passo-conteudo">
              <strong>Ativar "Permitir acesso a URLs de arquivo" (Muito Importante!)</strong>
              <p>
                Se você usa a Mesa XP abrindo o arquivo do computador com dois cliques:
              </p>
              <p>
                1. Na mesma página de extensões (<kbd>chrome://extensions</kbd>), localize o quadro do <strong>Tampermonkey</strong>.
              </p>
              <p>
                2. Clique no botão <strong>"Detalhes"</strong> dentro do quadro do Tampermonkey.
              </p>
              <p>
                3. Role a página um pouco para baixo até achar a opção: <strong>"Permitir acesso a URLs de arquivo"</strong>.
              </p>
              <p>
                4. <strong>Ligue a chave</strong> ao lado dessa opção para deixá-la ativada.
              </p>
            </div>
          </div>

          <!-- Passo 5 -->
          <div class="passo-card">
            <div class="passo-numero">5</div>
            <div class="passo-conteudo">
              <strong>Instalar o Robô da Mesa XP (1 Clique)</strong>
              <p>
                1. Volte para a aba da Mesa XP e vá na ferramenta <strong>Ordens</strong> (Alt + 1).
              </p>
              <p>
                2. No painel inferior esquerdo, clique no botão azul com o texto <kbd>Instalar robô</kbd>.
              </p>
              <p>
                3. O Tampermonkey abrirá uma aba com o código do script <code>robo-hub.user.js</code> (versão <strong>1.14.0</strong>). Você <strong>não precisa mexer em nada no texto</strong>.
              </p>
              <p>
                4. Basta clicar no botão azul <strong>"Instalar"</strong> (ou <em>"Reinstalar"</em> se você já tinha o robô antigo).
              </p>
            </div>
          </div>

          <!-- Passo 6 -->
          <div class="passo-card">
            <div class="passo-numero">6</div>
            <div class="passo-conteudo">
              <strong>Permissões: "Sempre permitir este domínio"</strong>
              <p>
                Quando você usar a Mesa pela primeira vez, o Tampermonkey pode exibir um aviso no canto perguntando se você autoriza a conexão entre as abas.
              </p>
              <p>
                👉 <strong>Sempre clique em: "Sempre permitir este domínio"</strong> (ou <em>Always allow this domain</em>). Nunca clique em Bloquear!
              </p>
            </div>
          </div>

          <!-- Passo 7 -->
          <div class="passo-card">
            <div class="passo-numero">7</div>
            <div class="passo-conteudo">
              <strong>Como Conferir se está Tudo Funcionando!</strong>
              <p>
                Pressione <kbd>F5</kbd> na aba da Mesa XP para recarregar a página e confira dois detalhes simples:
              </p>
              <p>
                ✅ <strong>No rodapé da Mesa XP:</strong> O indicador no canto inferior esquerdo exibirá uma bolinha verde com o texto: <strong>"Robô: pronto"</strong>.<br>
                ✅ <strong>No ícone do Tampermonkey (no topo do navegador):</strong> Aparecerá um quadradinho vermelho com o número <span class="simulacao-badge-tm">TM <span class="simulacao-badge-numero">1</span></span>, indicando que o robô está ativo e rodando na página.
              </p>
            </div>
          </div>
        </div>

        <!-- Guia Especial para Usuários do Microsoft Edge -->
        <h4>Dica Especial: Usa o Microsoft Edge na sua máquina corporativa?</h4>
        <p>
          O Microsoft Edge funciona exatamente igual ao Chrome, pois ambos usam o mesmo motor (Chromium):
        </p>
        <ul>
          <li>Para abrir as extensões no Edge, digite: <kbd>edge://extensions</kbd>.</li>
          <li>No menu lateral esquerdo do Edge, ative a chave <strong>"Modo de desenvolvedor"</strong>.</li>
          <li>Se você abrir a loja do Chrome no Edge, ele exibirá uma faixa azul no topo: clique em <strong>"Permitir extensões de outras lojas"</strong> e depois em "Instalar".</li>
          <li>Clique em <strong>Detalhes</strong> no Tampermonkey e ligue a opção <strong>"Permitir acesso a URLs de arquivo"</strong>.</li>
        </ul>

        <!-- Fluxograma Visual de Instalação -->
        <div class="manual-fluxograma">
          <svg viewBox="0 0 760 110" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="20" width="130" height="70" rx="8" fill="#222939" stroke="#323b4f" stroke-width="2"/>
            <text x="75" y="48" fill="#eaeef6" font-size="12" font-weight="700" text-anchor="middle">1. Tampermonkey</text>
            <text x="75" y="68" fill="#97a2b6" font-size="10" text-anchor="middle">Instalar na Loja</text>
            
            <path d="M145 55 H 175" stroke="#7eaaf6" stroke-width="2" stroke-linecap="round"/>
            <polygon points="175,50 185,55 175,60" fill="#7eaaf6"/>

            <rect x="190" y="20" width="140" height="70" rx="8" fill="#222939" stroke="#eeb259" stroke-width="2"/>
            <text x="260" y="48" fill="#eeb259" font-size="12" font-weight="700" text-anchor="middle">2. Modo Dev & URLs</text>
            <text x="260" y="68" fill="#97a2b6" font-size="10" text-anchor="middle">Ativar chaves no Chrome</text>

            <path d="M335 55 H 365" stroke="#7eaaf6" stroke-width="2" stroke-linecap="round"/>
            <polygon points="365,50 375,55 365,60" fill="#7eaaf6"/>

            <rect x="380" y="20" width="130" height="70" rx="8" fill="#222939" stroke="#323b4f" stroke-width="2"/>
            <text x="445" y="48" fill="#eaeef6" font-size="12" font-weight="700" text-anchor="middle">3. Instalar Robô</text>
            <text x="445" y="68" fill="#97a2b6" font-size="10" text-anchor="middle">Botão azul (v1.14.0)</text>

            <path d="M515 55 H 545" stroke="#7eaaf6" stroke-width="2" stroke-linecap="round"/>
            <polygon points="545,50 555,55 545,60" fill="#7eaaf6"/>

            <rect x="560" y="20" width="180" height="70" rx="8" fill="#222939" stroke="#5ccb97" stroke-width="2"/>
            <text x="650" y="48" fill="#5ccb97" font-size="12" font-weight="700" text-anchor="middle">4. Pronto para Operar!</text>
            <text x="650" y="68" fill="#97a2b6" font-size="10" text-anchor="middle">Bolinha verde "Robô: pronto"</text>
          </svg>
          <div class="manual-fluxograma-legenda">Figura 1: Fluxo completo de instalação e ativação da máquina do operador.</div>
        </div>
      </section>

      <!-- Capítulo 3: Trio de Abas -->
      <section id="cap-trio-de-abas" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>3. As 3 Abas que Devem Ficar Abertas no Navegador</h3>
        </div>
        <p>
          Para que o sistema trabalhe sozinho em segundo plano (puxando cotações, abrindo boletas e vigiando a chegada de e-mails), <strong>cada operador deve manter três abas abertas durante o horário de trabalho</strong>:
        </p>

        <div class="manual-grid-abas">
          <div class="manual-card-aba">
            <strong>🌐 Aba 1: Mesa XP (Pivô Central)</strong>
            <p>Onde você cola os pedidos de WhatsApp, confere diagnósticos, gera os e-mails, analisa Renda Fixa e acompanha a esteira de pedidos.</p>
          </div>
          <div class="manual-card-aba hub">
            <strong>🤖 Aba 2: Hub XP Logado (hub.xpi.com.br)</strong>
            <p>Deixe uma aba aberta no Hub com seu login corporativo ativo. O robô usará essa sessão para ler preços de cotas, deságio e abrir boletas.</p>
          </div>
          <div class="manual-card-aba outlook">
            <strong>✉️ Aba 3: Outlook na Web (outlook.office.com)</strong>
            <p>Deixe o e-mail corporativo aberto. O vigia da Mesa monitora a chegada de respostas de clientes a cada 2 segundos sem você precisar abrir a caixa.</p>
          </div>
        </div>

        <!-- Fluxograma da Tríade -->
        <div class="manual-fluxograma">
          <svg viewBox="0 0 760 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Mesa XP (Centro) -->
            <rect x="270" y="20" width="220" height="110" rx="10" fill="#222939" stroke="#7eaaf6" stroke-width="2.5"/>
            <text x="380" y="55" fill="#7eaaf6" font-size="14" font-weight="700" text-anchor="middle">Mesa XP (Pivô Central)</text>
            <text x="380" y="80" fill="#eaeef6" font-size="11" text-anchor="middle">Orquestra Ordens, Fila e RF</text>
            <text x="380" y="105" fill="#5ccb97" font-size="11" font-weight="600" text-anchor="middle">● Comunicação Local Segura</text>

            <!-- Hub XP (Esquerda) -->
            <rect x="20" y="35" width="180" height="85" rx="8" fill="#222939" stroke="#e3b664" stroke-width="2"/>
            <text x="110" y="65" fill="#e3b664" font-size="13" font-weight="700" text-anchor="middle">Hub XP (Logado)</text>
            <text x="110" y="90" fill="#97a2b6" font-size="10" text-anchor="middle">Preços de cotas, boletas e RF</text>

            <!-- Setas Hub <-> Mesa -->
            <path d="M205 70 H 265" stroke="#e3b664" stroke-width="2"/>
            <polygon points="265,65 275,70 265,75" fill="#e3b664"/>
            <polygon points="215,65 205,70 215,75" fill="#e3b664"/>

            <!-- Outlook Web (Direita) -->
            <rect x="560" y="35" width="180" height="85" rx="8" fill="#222939" stroke="#78b1f0" stroke-width="2"/>
            <text x="650" y="65" fill="#78b1f0" font-size="13" font-weight="700" text-anchor="middle">Outlook na Web</text>
            <text x="650" y="90" fill="#97a2b6" font-size="10" text-anchor="middle">Vigia automático de respostas</text>

            <!-- Setas Mesa <-> Outlook -->
            <path d="M495 70 H 555" stroke="#78b1f0" stroke-width="2"/>
            <polygon points="555,65 565,70 555,75" fill="#78b1f0"/>
            <polygon points="505,65 495,70 505,75" fill="#78b1f0"/>
          </svg>
          <div class="manual-fluxograma-legenda">Figura 2: A Tríade Operacional — As 3 abas trabalhando em conjunto via armazenamento seguro local.</div>
        </div>

        <div class="manual-callout atencao">
          <strong>Regra de Ouro no Hub XP:</strong>
          Nunca adicione parâmetros de teste manuais na barra de endereço do Hub (como <code>?teste=1</code>). Isso impede o carregamento dos componentes do Mercado Secundário. Deixe a página carregar em sua URL limpa.
        </div>
      </section>

      <!-- Capítulo 4: Ordens -->
      <section id="cap-ordens" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>4. Assistente de Ordens (Atalho Alt + 1)</h3>
        </div>
        <p>
          O Assistente de Ordens transforma mensagens informais enviadas pelos assessores em e-mails padronizados de auditoria e boletas prontas no Hub.
        </p>

        <!-- Fluxograma da Ordem -->
        <div class="manual-fluxograma">
          <svg viewBox="0 0 760 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="25" width="130" height="65" rx="8" fill="#222939" stroke="#323b4f" stroke-width="1.8"/>
            <text x="75" y="52" fill="#eaeef6" font-size="11" font-weight="700" text-anchor="middle">1. Colar Mensagem</text>
            <text x="75" y="70" fill="#97a2b6" font-size="10" text-anchor="middle">WhatsApp / Slack</text>

            <path d="M145 57 H 170" stroke="#7eaaf6" stroke-width="2"/>
            <polygon points="170,52 180,57 170,62" fill="#7eaaf6"/>

            <rect x="185" y="25" width="130" height="65" rx="8" fill="#222939" stroke="#323b4f" stroke-width="1.8"/>
            <text x="250" y="52" fill="#eaeef6" font-size="11" font-weight="700" text-anchor="middle">2. Analisar Ordens</text>
            <text x="250" y="70" fill="#97a2b6" font-size="10" text-anchor="middle">Ctrl + Enter</text>

            <path d="M320 57 H 345" stroke="#7eaaf6" stroke-width="2"/>
            <polygon points="345,52 355,57 345,62" fill="#7eaaf6"/>

            <rect x="360" y="25" width="130" height="65" rx="8" fill="#222939" stroke="#e3b664" stroke-width="1.8"/>
            <text x="425" y="52" fill="#e3b664" font-size="11" font-weight="700" text-anchor="middle">3. Robô no Hub</text>
            <text x="425" y="70" fill="#97a2b6" font-size="10" text-anchor="middle">Cotação & Prints</text>

            <path d="M495 57 H 520" stroke="#7eaaf6" stroke-width="2"/>
            <polygon points="520,52 530,57 520,62" fill="#7eaaf6"/>

            <rect x="535" y="25" width="130" height="65" rx="8" fill="#222939" stroke="#5ccb97" stroke-width="1.8"/>
            <text x="600" y="52" fill="#5ccb97" font-size="11" font-weight="700" text-anchor="middle">4. Abrir no Outlook</text>
            <text x="600" y="70" fill="#97a2b6" font-size="10" text-anchor="middle">E-mail preenchido</text>

            <path d="M670 57 H 695" stroke="#7eaaf6" stroke-width="2"/>
            <polygon points="695,52 705,57 695,62" fill="#7eaaf6"/>

            <circle cx="725" cy="57" r="16" fill="#7eaaf6"/>
            <text x="725" y="62" fill="#fff" font-size="10" font-weight="700" text-anchor="middle">Fila</text>
          </svg>
          <div class="manual-fluxograma-legenda">Figura 3: Esteira operacional de processamento de solicitações.</div>
        </div>

        <h4>Passo a Passo de Emissão de uma Ordem:</h4>
        <ol class="manual-passos">
          <li><strong>Cole o texto bruto:</strong> Cole na caixa superior da tela o texto que você recebeu do assessor. O parser reconhece automaticamente contas de 5 a 8 dígitos e múltiplos ativos.</li>
          <li><strong>Clique em Analisar:</strong> Pressione <kbd>Ctrl + Enter</kbd> ou clique no botão azul <em>Analisar ordens</em>.</li>
          <li><strong>Conferência Inteligente:</strong> A tabela inferior exibirá os ativos identificados, a operação (Compra ou Venda), a quantidade e o preço limite.</li>
          <li><strong>Secundário de Fundos:</strong> O robô consulta o Hub em tempo real. Se o pedido veio em R$ (ex: <em>"aplica 50k no Riza"</em>), a Mesa converte para a quantidade exata de cotas e permite escolher entre <em>ROA Máximo</em> ou <em>Sem ROA</em>.</li>
          <li><strong>Tirar Prints (Venda de Fundos):</strong> Clique em <kbd>Tirar prints</kbd>. O robô abre a boleta no Hub e captura o comprovante oficial determinístico.</li>
          <li><strong>Abrir no Outlook:</strong> Clique em <kbd>Abrir no Outlook</kbd>. A janela de novo e-mail abre já preenchida com o endereço do cliente, o assessor em cópia, o assunto formatado e os prints colados no corpo.</li>
        </ol>
      </section>

      <!-- Capítulo 5: Exemplos de Mensagens -->
      <section id="cap-exemplos-ordens" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>5. Exemplos Reais de Solicitações (Antes vs. Depois)</h3>
        </div>
        <p>
          A Mesa XP é flexível e entende diversos dialetos operacionais. Veja exemplos práticos de mensagens que você pode colar diretamente na caixa de entrada:
        </p>

        <!-- Exemplo 1: Bolsa -->
        <div class="manual-exemplo-card">
          <div class="exemplo-bloco">
            <div class="exemplo-rotulo entrada">Mensagem recebida no WhatsApp (Antes)</div>
            <div class="exemplo-caixa">Favor comprar 1000 PETR4 a mercado e vender 500 VALE3 a 62,50 na conta 1234567 do Fulano</div>
          </div>
          <div class="exemplo-bloco">
            <div class="exemplo-rotulo saida">Resultado Gerado pela Mesa XP (Depois)</div>
            <div class="exemplo-caixa">Conta: 1234567 · FULANO DE TAL
• COMPRA: 1.000 PETR4 @ Mercado
• VENDA: 500 VALE3 @ R$ 62,50 Limite
➡️ E-mail de auditoria montado e lote pronto.</div>
          </div>
        </div>

        <!-- Exemplo 2: Secundário -->
        <div class="manual-exemplo-card">
          <div class="exemplo-bloco">
            <div class="exemplo-rotulo entrada">Mensagem recebida de Fundo Cetipado (Antes)</div>
            <div class="exemplo-caixa">Resgatar 150 mil do Riza Terrax na conta 7654321</div>
          </div>
          <div class="exemplo-bloco">
            <div class="exemplo-rotulo saida">Resultado Gerado pela Mesa XP (Depois)</div>
            <div class="exemplo-caixa">Conta: 7654321 · RIZA TERRAX FII (RZTR11)
PU Hub: R$ 98,42 · Deságio: 4,50%
Quantidade calculada: 1.524 cotas
Prints das boletas anexados abaixo de "Condições:"</div>
          </div>
        </div>
      </section>

      <!-- Capítulo 6: Fila do Dia -->
      <section id="cap-fila" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>6. Fila do Dia & Vigia do Outlook (Atalho Alt + 2)</h3>
        </div>
        <p>
          A <strong>Fila do Dia</strong> é o seu painel de acompanhamento e esteira de execução. Cada e-mail copiado ou aberto no Outlook entra automaticamente na Fila e fica registrado na memória do navegador.
        </p>

        <h4>Pastas de Trabalho:</h4>
        <ul>
          <li><strong>Enviados:</strong> Pedidos disparados aguardando o cliente responder aprovando.</li>
          <li><strong>Aprovação e Execução:</strong> Pedidos que o cliente já aprovou por e-mail, prontos para você boletar ou enviar para a mesa de operações.</li>
          <li><strong>Executados:</strong> Pedidos com boleta confirmada e concluída.</li>
        </ul>

        <h4>Vigia Automático do Outlook:</h4>
        <p>
          Com a aba do Outlook aberta, o robô monitora a chegada de novas respostas:
        </p>
        <ul>
          <li><strong>Casamento por Conta XP:</strong> Quando o cliente responde com <em>"Ok, aprovado"</em> ou <em>"Pode executar"</em>, o vigia localiza o número da conta XP no histórico e move o cartão para <em>Aprovação e Execução</em> com som discreto de aviso.</li>
          <li><strong>Proteção Anti-Avalanche:</strong> O sistema possui teto máximo de 3 notificações na tela para nunca travar a sua máquina.</li>
          <li><strong>Alarme do Leilão da B3 (16:25):</strong> 30 minutos antes do leilão das 16:55, a Mesa emite um alerta se ainda houver ordens de bolsa na pasta <em>Enviados</em> sem aprovação.</li>
        </ul>
      </section>

      <!-- Capítulo 7: Renda Fixa -->
      <section id="cap-rendafixa" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>7. Renda Fixa Pro (Atalho Alt + 4)</h3>
        </div>
        <p>
          Motor para identificar as melhores oportunidades de CDBs, LCIs, LCAs, CRIs e CRAs e disparar vitrines formatadas para o WhatsApp dos clientes.
        </p>

        <h4>Principais Funcionalidades:</h4>
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
            <strong>Baixar Imagem WhatsApp (Atalho I):</strong><br>
            Gera na hora uma imagem PNG de alta resolução (1080px de largura) com os cartões coloridos dos ativos selecionados, pronta para anexar no WhatsApp Web.
          </li>
          <li>
            <strong>Configuração de Regras (Atalho R):</strong><br>
            Permite ajustar filtros por banco emissor, rating mínimo e prazos de vencimento desejados.
          </li>
        </ul>
      </section>

      <!-- Capítulo 8: Fundos -->
      <section id="cap-fundos" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>8. Prateleira de Fundos (Atalho Alt + 3)</h3>
        </div>
        <p>
          Visão panorâmica de todos os fundos cetipados do Mercado Secundário da XP:
        </p>
        <ul>
          <li>Ordenação dinâmica por maior deságio para encontrar as melhores taxas de entrada;</li>
          <li>Filtro em tempo real por ticker (ex: <code>IMOV11</code>, <code>VGPR11</code>, <code>RZTR11</code>);</li>
          <li>Comparativo do que mudou em relação ao dia anterior (novos fundos que entraram na grade ou que tiveram variação de deságio).</li>
        </ul>
      </section>

      <!-- Capítulo 9: Outros Módulos -->
      <section id="cap-outros-modulos" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>9. Calendário, Operacional e Anotações</h3>
        </div>
        <ul>
          <li><strong>Calendário (Alt + 5):</strong> Escala semanal de presença física da equipe no escritório, sincronizada via banco Supabase.</li>
          <li><strong>Operacional (Alt + 6):</strong> Base de procedimentos internos e documentações de compliance (espelho do Slab). Pressione <kbd>Ctrl + K</kbd> para buscar qualquer tópico.</li>
          <li><strong>Anotações (Alt + 7):</strong> Bloco de notas rápido com suporte a lembretes agendados que avisam no topo da tela quando o horário de uma tarefa chega.</li>
        </ul>
      </section>

      <!-- Capítulo 10: Dúvidas Frequentes -->
      <section id="cap-troubleshooting" class="manual-secao">
        <div class="manual-secao-topo">
          <h3>10. Dúvidas Frequentes & Resolução de Problemas</h3>
        </div>

        <h4>O robô aparece com aviso de "não instalado" ou bolinha cinza</h4>
        <p>
          1. Verifique se o <strong>Modo do Desenvolvedor</strong> está ativo em <kbd>chrome://extensions</kbd>.<br>
          2. Verifique se o Tampermonkey está ativado.<br>
          3. Na aba Ordens da Mesa, clique em <kbd>Instalar robô</kbd> e confirme na aba do Tampermonkey.<br>
          4. Pressione <kbd>F5</kbd> na Mesa XP para recarregar.
        </p>

        <h4>A cotação do fundo ou o botão "Puxar do Hub" não respondem</h4>
        <p>
          Certifique-se de que a aba do <strong>Hub XP</strong> está aberta e com seu login corporativo ativo. O robô precisa que você esteja logado para conseguir ler as informações.
        </p>

        <h4>O cliente respondeu o e-mail mas o cartão não se moveu na Fila</h4>
        <p>
          Confira se a aba do <strong>Outlook na Web</strong> está aberta no navegador. O vigia precisa da página do Outlook rodando para ler os e-mails recebidos.
        </p>

        <h4>Como salvar este manual como arquivo PDF no meu computador?</h4>
        <p>
          Basta clicar no botão superior <strong>"Salvar como PDF / Imprimir"</strong> (ou pressionar <kbd>Ctrl + P</kbd>). Na janela de impressão do seu navegador, escolha a impressora <em>"Salvar como PDF"</em> e clique em Salvar.
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
      const secao = dialogo.querySelector('#' + id);
      if (secao) {
        secao.scrollIntoView({ behavior: 'smooth', block: 'start' });
        marcarLinkAtivo('#' + id);
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

    if (secaoAtiva) marcarLinkAtivo('#' + secaoAtiva);
  });

  // Ligar ao botão de abertura no cabeçalho
  botaoAbrir?.addEventListener('click', (e) => abrir(e.currentTarget));

  // Suporte a abrir caso o hash seja #manual
  const checarHash = () => {
    if (location.hash === '#manual') {
      abrir();
    }
  };
  window.addEventListener('hashchange', checarHash);
  checarHash();

  return { abrir, fechar, dialogo };
};
