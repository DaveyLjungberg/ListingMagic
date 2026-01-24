-- ============================================================================
-- ListingGopher Documents & Generated Content Tables
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/vbfwcemtkgymygccgffl/sql
-- ============================================================================

-- 1. Documents Table (uploaded files: PDFs, DOCs, images)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,  -- Supabase storage URL
  file_type TEXT NOT NULL, -- pdf, doc, docx, txt, jpg, png, etc.
  file_size INTEGER NOT NULL, -- bytes
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for documents table
CREATE INDEX IF NOT EXISTS idx_documents_listing_id ON documents(listing_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at DESC);

-- 2. Generated Content Table (AI responses per tab)
CREATE TABLE IF NOT EXISTS generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tab_type TEXT NOT NULL, -- 'draft_text', 'review', 'summarize', 'mls'
  user_prompt TEXT,       -- What the user asked for
  generated_text TEXT,    -- AI response
  ai_cost NUMERIC(10,4) DEFAULT 0, -- Track cost per generation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for generated_content table
CREATE INDEX IF NOT EXISTS idx_generated_content_listing_id ON generated_content(listing_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_tab_type ON generated_content(tab_type);
CREATE INDEX IF NOT EXISTS idx_generated_content_created_at ON generated_content(created_at DESC);

-- 3. Row Level Security (RLS) for documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Users can INSERT their own documents
CREATE POLICY "Users can insert own documents" ON documents
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can SELECT their own documents
CREATE POLICY "Users can view own documents" ON documents
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can DELETE their own documents
CREATE POLICY "Users can delete own documents" ON documents
  FOR DELETE
  USING (user_id = auth.uid());

-- Service role has full access to documents
CREATE POLICY "Service role full access documents" ON documents
  FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Row Level Security (RLS) for generated_content
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;

-- Users can INSERT their own content
CREATE POLICY "Users can insert own content" ON generated_content
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can SELECT their own content
CREATE POLICY "Users can view own content" ON generated_content
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can UPDATE their own content
CREATE POLICY "Users can update own content" ON generated_content
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can DELETE their own content
CREATE POLICY "Users can delete own content" ON generated_content
  FOR DELETE
  USING (user_id = auth.uid());

-- Service role has full access to generated_content
CREATE POLICY "Service role full access content" ON generated_content
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Example usage:
--
-- Insert a document:
-- INSERT INTO documents (listing_id, user_id, file_name, file_url, file_type, file_size)
-- VALUES ('uuid-here', auth.uid(), 'contract.pdf', 'https://...', 'pdf', 102400);
--
-- Get all documents for a listing:
-- SELECT * FROM documents WHERE listing_id = 'uuid-here' ORDER BY uploaded_at DESC;
--
-- Insert generated content:
-- INSERT INTO generated_content (listing_id, user_id, tab_type, user_prompt, generated_text, ai_cost)
-- VALUES ('uuid-here', auth.uid(), 'draft_text', 'Write a description', 'AI response...', 0.0250);
--
-- Get latest content for a tab:
-- SELECT * FROM generated_content
-- WHERE listing_id = 'uuid-here' AND tab_type = 'draft_text'
-- ORDER BY created_at DESC LIMIT 1;
-- ============================================================================
