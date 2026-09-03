-- Migration: Create otp_token table
-- Run this on Neon DB when connected

CREATE TABLE IF NOT EXISTS otp_token (
    id SERIAL PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    code VARCHAR(6) NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_otp_token_email ON otp_token(email);
CREATE INDEX IF NOT EXISTS ix_otp_token_purpose ON otp_token(purpose);
