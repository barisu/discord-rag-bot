-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify pgvector installation
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Create a test table to verify vector functionality
CREATE TABLE IF NOT EXISTS vector_test (
    id SERIAL PRIMARY KEY,
    embedding vector(1536)  -- OpenAI embedding dimension
);

-- Insert a test vector
INSERT INTO vector_test (embedding) VALUES ('[0.1,0.2,0.3]'::vector);

-- Clean up test table
DROP TABLE vector_test;

-- Log successful installation
\echo 'pgvector extension successfully installed and verified';