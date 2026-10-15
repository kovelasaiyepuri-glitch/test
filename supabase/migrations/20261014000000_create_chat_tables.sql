-- ==============================================================================
-- Migration: 20261014000000_create_chat_tables.sql
-- Description: Create chats and messages tables with Row Level Security (RLS)
-- ==============================================================================

-- 1. Ensure uuid generation extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Chats Table
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'New Conversation',
    model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON public.chats(updated_at DESC);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 6. Clean up existing policies if re-running
DROP POLICY IF EXISTS "Allow public read access to chats" ON public.chats;
DROP POLICY IF EXISTS "Allow public insert to chats" ON public.chats;
DROP POLICY IF EXISTS "Allow public update on chats" ON public.chats;
DROP POLICY IF EXISTS "Allow public delete on chats" ON public.chats;

DROP POLICY IF EXISTS "Allow public read access to messages" ON public.messages;
DROP POLICY IF EXISTS "Allow public insert to messages" ON public.messages;
DROP POLICY IF EXISTS "Allow public delete on messages" ON public.messages;

-- 7. Create Permissive Policies for chats (anon and authenticated)
CREATE POLICY "Allow public read access to chats" 
    ON public.chats FOR SELECT 
    TO anon, authenticated 
    USING (true);

CREATE POLICY "Allow public insert to chats" 
    ON public.chats FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow public update on chats" 
    ON public.chats FOR UPDATE 
    TO anon, authenticated 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete on chats" 
    ON public.chats FOR DELETE 
    TO anon, authenticated 
    USING (true);

-- 8. Create Permissive Policies for messages (anon and authenticated)
CREATE POLICY "Allow public read access to messages" 
    ON public.messages FOR SELECT 
    TO anon, authenticated 
    USING (true);

CREATE POLICY "Allow public insert to messages" 
    ON public.messages FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow public delete on messages" 
    ON public.messages FOR DELETE 
    TO anon, authenticated 
    USING (true);
