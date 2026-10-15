-- ==============================================================================
-- SUPABASE DATABASE SCHEMA FOR GEMINI CHATBOT
-- ==============================================================================
-- Run this script in your Supabase Project's SQL Editor (Dashboard > SQL Editor)
-- ==============================================================================

-- 1. Create Chats table
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'New Conversation',
    model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create index for faster message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. Create permissive RLS policies for public/anon access
-- (Adjust these if you add Supabase Auth later)
CREATE POLICY "Allow public read access to chats" 
    ON public.chats FOR SELECT 
    TO anon, authenticated 
    USING (true);

CREATE POLICY "Allow public insert to chats" 
    ON public.chats FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow public delete on chats" 
    ON public.chats FOR DELETE 
    TO anon, authenticated 
    USING (true);

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
