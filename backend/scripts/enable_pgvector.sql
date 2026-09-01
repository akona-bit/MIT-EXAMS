-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create question_embedding table
CREATE TABLE IF NOT EXISTS question_embedding (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL UNIQUE REFERENCES question(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536),
    model_name VARCHAR(50) DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_question_embedding_hnsw
    ON question_embedding USING hnsw (embedding vector_cosine_ops);

-- B-tree index for question_id lookups
CREATE INDEX IF NOT EXISTS idx_question_embedding_question_id
    ON question_embedding (question_id);
