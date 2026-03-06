/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Script de inicialização do PostgreSQL.
 * Executado automaticamente na primeira criação do banco.
 * Habilita extensões necessárias: pgvector e uuid-ossp.
 */

-- Extensão pgvector para busca por similaridade (embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Extensão para geração de UUIDs (útil em migrações futuras)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Confirma que as extensões foram instaladas
DO $$
BEGIN
  RAISE NOTICE 'Extensões habilitadas com sucesso: vector, uuid-ossp';
END $$;
