/**
 * Regenera supabase/operacional.sql a partir da semente (src/modulos/operacional/conteudo.js).
 *
 * Uso: npm run sql:operacional
 */

import { writeFileSync } from 'node:fs';
import * as semente from '../src/modulos/operacional/conteudo.js';
import { gerarSql } from '../src/modulos/operacional/sql.js';

const destino = new URL('../supabase/operacional.sql', import.meta.url);
writeFileSync(destino, gerarSql(semente));
console.log(`supabase/operacional.sql: ${semente.TOPICOS.length} tópicos, ${semente.POSTS.length} posts`);
