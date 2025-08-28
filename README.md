# Explorador_Da_Matematica
📑 Relatório de Proposta – Jogo Educativo Explorador da Matemática
1. Introdução

O Explorador da Matemática será um jogo educativo digital que utilizará a temática espacial como recurso lúdico para engajar os estudantes no aprendizado da matemática.
A proposta é desenvolver um jogo em JavaScript puro, com interface simples e de fácil integração em aplicativos educacionais, permitindo o acesso em dispositivos móveis ou navegadores.

2. Contexto e Justificativa

O aprendizado da matemática, especialmente no ensino fundamental, muitas vezes é percebido pelos alunos como algo abstrato e repetitivo. Um jogo temático poderá transformar esses exercícios em uma experiência interativa e divertida.

Ao unir narrativa (exploração espacial) e conteúdo pedagógico (operações matemáticas), espera-se que o estudante tenha maior motivação, concentração e retenção de conhecimento.

3. Objetivos

Pedagógicos:

Reforçar a prática de operações matemáticas básicas.

Desenvolver o raciocínio lógico e a resolução de problemas.

Incentivar a atenção, memória de trabalho e tomada de decisão.

Lúdicos:

Estimular o engajamento através da temática espacial.

Recompensar o esforço com ganhos de “combustível”.

Promover desafios progressivos que mantenham o interesse do jogador.

4. Funcionamento Proposto do Jogo
4.1. Regras básicas

O jogador começará com uma quantidade inicial de combustível para sua nave espacial.

A cada rodada, será gerada uma questão matemática (ex.: 5 + 3, 7 × 2).

O estudante deverá responder corretamente para manter sua nave funcionando.

Acertos renderão combustível extra; erros reduzirão o combustível disponível.

O jogo terminará quando:

O combustível se esgotar (derrota).

O jogador atingir o planeta final, acumulando combustível suficiente (vitória).

4.2. Níveis temáticos (planetas)

🌍 Terra: adição e subtração.

🪐 Marte: multiplicação.

🌌 Andrômeda: divisão e equações simples.
Cada planeta representará um estágio de dificuldade crescente, proporcionando evolução gradual.

4.3. Entrada e saída

Entrada: resposta numérica fornecida pelo aluno (digitada ou escolhida).

Saída: feedback imediato, indicando se acertou ou errou, acompanhado da atualização da barra de combustível e mensagens motivacionais.

5. Relação com Pensamento Computacional

O projeto será estruturado com base em três áreas da BNCC (EF69CO04, EF69CO05, EF69CO06):

Decomposição (EF69CO04)

O jogo será dividido em funções específicas: gerar questões, validar respostas, atualizar combustível, verificar vitória/derrota.

Entrada e Saída (EF69CO05)

O aluno fornecerá dados de entrada (resposta) e receberá de saída um feedback imediato (mensagem + combustível atualizado).

Generalização (EF69CO06)

O mesmo algoritmo funcionará para diferentes tipos de operações matemáticas.

O jogo poderá ser configurado para níveis de dificuldade distintos.

6. Impacto Educacional Esperado

Espera-se que o Explorador da Matemática:

Estimule o engajamento dos alunos, ao associar a matemática a uma narrativa divertida.

Promova reforço positivo, já que cada acerto será recompensado com combustível.

Favoreça a aprendizagem ativa, pois o jogador precisará refletir e decidir para avançar.

Contribua para o desenvolvimento do raciocínio lógico, cálculo mental e concentração.

Seja acessível e inclusivo, podendo ser usado em dispositivos diversos sem necessidade de instalação.

7. Potenciais Expansões Futuras

Adição de ranking de jogadores para incentivar cooperação e competição saudável.

Introdução de novos conteúdos (frações, porcentagem, potências).

Inclusão de elementos interdisciplinares (questões de ciências, geografia, sustentabilidade).

Modo colaborativo, onde mais de um jogador contribuirá para manter a nave funcionando.

8. Conclusão

O jogo Explorador da Matemática será uma ferramenta pedagógica inovadora, unindo tecnologia, gamificação e conteúdo escolar.
Com sua proposta lúdica e acessível, espera-se que contribua para tornar o aprendizado da matemática mais atrativo, dinâmico e significativo, podendo ser facilmente expandido e adaptado conforme as necessidades educacionais.
Explorador da Matemática
========================

Jogo web simples em HTML/CSS/JS: pilote uma nave enquanto resolve contas de matemática por planeta.

Regras
------
- Planetas:
	- Terra: adição e subtração
	- Marte: multiplicação (desbloqueia após concluir Terra)
	- Andrômeda: divisão (desbloqueia após concluir Marte)
- Combustível: começa em 100, perde 5 por segundo, ao acertar +15 (máx 100)
- Conclua todas as questões do planeta para desbloquear o próximo.

Como executar
-------------
1. Abra o arquivo `index.html` no navegador (duplo clique). Não há dependências.

Arquivos
--------
- `index.html`: estrutura da página e views (menu, jogo, fim)
- `style.css`: estilos e HUD
- `Index.js`: lógica do jogo e animação no canvas

Notas
-----
- O progresso de desbloqueio é salvo em `localStorage`.
- Para resetar o progresso, use o console do navegador: `localStorage.removeItem('exploradorMath')`.
