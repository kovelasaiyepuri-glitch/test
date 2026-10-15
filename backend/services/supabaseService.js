import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/**
 * Service to manage Supabase database operations on the backend.
 * Provides persistence for conversations, messages, and health checks.
 */
class SupabaseService {
  constructor() {
    this.client = null;
    this.initClient();
  }

  /**
   * Initializes or refreshes the Supabase client instance.
   */
  initClient() {
    const url = config.supabaseUrl;
    // Prefer service role key on backend if available, fallback to anon key
    const key = config.supabaseServiceRoleKey || config.supabaseAnonKey;

    if (url && key && url.startsWith('http') && !url.includes('your-project-ref')) {
      try {
        this.client = createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
      } catch (err) {
        console.warn('[Supabase Service] Client initialization error:', err.message);
        this.client = null;
      }
    } else {
      this.client = null;
    }
  }

  /**
   * Returns whether Supabase is configured with valid credentials.
   */
  isConfigured() {
    const url = config.supabaseUrl;
    const key = config.supabaseServiceRoleKey || config.supabaseAnonKey;
    return Boolean(url && key && url.startsWith('http') && !url.includes('your-project-ref'));
  }

  /**
   * Tests database connectivity to Supabase.
   */
  async testConnection() {
    if (!this.isConfigured()) {
      return {
        configured: false,
        connected: false,
        message: 'Supabase URL or Key is not configured yet. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env files.'
      };
    }

    this.initClient();
    if (!this.client) {
      return {
        configured: false,
        connected: false,
        message: 'Failed to create Supabase client instance.'
      };
    }

    try {
      // Perform a lightweight probe query
      const { data, error } = await this.client
        .from('chats')
        .select('id')
        .limit(1);

      if (error) {
        // Check if table simply doesn't exist yet
        if (error.code === '42P01') {
          return {
            configured: true,
            connected: true,
            tablesCreated: false,
            message: 'Connected to Supabase, but the "chats" table has not been created yet. Run supabase_schema.sql in the Supabase SQL editor.'
          };
        }
        return {
          configured: true,
          connected: false,
          error: error.message,
          message: `Supabase returned error: ${error.message}`
        };
      }

      return {
        configured: true,
        connected: true,
        tablesCreated: true,
        message: 'Successfully connected to Supabase database!'
      };
    } catch (err) {
      return {
        configured: true,
        connected: false,
        error: err.message,
        message: `Connection failed: ${err.message}`
      };
    }
  }

  /**
   * Create or update a conversation session.
   */
  async saveChat(chatId, title = 'New Conversation', model = 'gemini-2.5-flash') {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('chats')
        .upsert({
          id: chatId,
          title,
          model,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('[Supabase Service] Could not save chat:', err.message);
      return null;
    }
  }

  /**
   * Save a single message to Supabase.
   */
  async saveMessage(chatId, role, content) {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('messages')
        .insert({
          chat_id: chatId,
          role,
          content,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('[Supabase Service] Could not save message:', err.message);
      return null;
    }
  }

  /**
   * Retrieve all saved chat sessions.
   */
  async getChats() {
    if (!this.client) return [];
    try {
      const { data, error } = await this.client
        .from('chats')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('[Supabase Service] Could not retrieve chats:', err.message);
      return [];
    }
  }

  /**
   * Retrieve messages for a given chat session.
   */
  async getMessages(chatId) {
    if (!this.client) return [];
    try {
      const { data, error } = await this.client
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('[Supabase Service] Could not retrieve messages:', err.message);
      return [];
    }
  }
}

export const supabaseService = new SupabaseService();
