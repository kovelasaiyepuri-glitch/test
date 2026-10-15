import { api } from './api.js';
import { parseMarkdown } from './markdown.js';
import { getSupabase, testSupabaseConnection } from './supabaseClient.js';

/**
 * ============================================================================
 * GEMINI NEXUS - FRONTEND APP CONTROLLER WITH SUPABASE
 * ============================================================================
 * State management, DOM events, UI interactions, Supabase connectivity,
 * and streaming orchestration.
 * ============================================================================
 */

class ChatApplication {
  constructor() {
    this.state = {
      chatId: localStorage.getItem('active_chat_id') || this.generateUUID(),
      messages: [],
      isStreaming: false,
      abortController: null,
      backendStatus: 'connecting',
      geminiConfigured: false,
      supabaseConfigured: false,
      settings: {
        model: localStorage.getItem('gemini_model') || 'gemini-2.5-flash',
        temperature: parseFloat(localStorage.getItem('gemini_temperature') || '0.7'),
        systemInstruction: localStorage.getItem('gemini_system') || '',
        customApiKey: localStorage.getItem('gemini_custom_key') || '',
        supabaseUrl: window.__ENV__?.SUPABASE_URL || localStorage.getItem('supabase_url') || '',
        supabaseAnonKey: window.__ENV__?.SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || ''
      }
    };

    this.dom = {};
    this.init();
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  init() {
    this.cacheDomElements();
    this.bindEvents();
    this.applyInitialSettings();
    this.checkBackendHealth();
  }

  cacheDomElements() {
    this.dom = {
      chatHistory: document.getElementById('chat-history'),
      welcomeHero: document.getElementById('welcome-hero'),
      messagesContainer: document.getElementById('messages-container'),
      chatInput: document.getElementById('chat-input'),
      btnSend: document.getElementById('btn-send-message'),
      btnStop: document.getElementById('btn-stop-streaming'),
      selectModel: document.getElementById('select-model'),
      checkStreaming: document.getElementById('check-streaming'),
      charCounter: document.getElementById('char-counter'),
      backendStatus: document.getElementById('backend-status'),
      backendStatusText: document.getElementById('backend-status-text'),
      supabaseStatus: document.getElementById('supabase-status'),
      supabaseStatusText: document.getElementById('supabase-status-text'),
      apiKeyHeaderStatus: document.getElementById('api-key-header-status'),
      btnClearChat: document.getElementById('btn-clear-chat'),
      btnOpenArch: document.getElementById('btn-open-arch'),
      btnOpenSettings: document.getElementById('btn-open-settings'),
      modalArch: document.getElementById('modal-architecture'),
      modalSettings: document.getElementById('modal-settings'),
      inputApiKey: document.getElementById('input-api-key'),
      btnToggleKeyVis: document.getElementById('btn-toggle-key-visibility'),
      btnTestKey: document.getElementById('btn-test-key'),
      inputSupabaseUrl: document.getElementById('input-supabase-url'),
      inputSupabaseAnonKey: document.getElementById('input-supabase-anon-key'),
      btnTestSupabase: document.getElementById('btn-test-supabase'),
      btnSaveSettings: document.getElementById('btn-save-settings'),
      modalSelectModel: document.getElementById('modal-select-model'),
      rangeTemperature: document.getElementById('range-temperature'),
      tempValDisplay: document.getElementById('temp-val'),
      textareaSystemPrompt: document.getElementById('textarea-system-prompt'),
      toastContainer: document.getElementById('toast-container')
    };
  }

  bindEvents() {
    // Input typing & auto-resize
    this.dom.chatInput.addEventListener('input', () => this.handleInputChange());
    this.dom.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Send button
    this.dom.btnSend.addEventListener('click', () => this.sendMessage());

    // Stop streaming button
    this.dom.btnStop.addEventListener('click', () => this.stopStreaming());

    // Model select toolbar change
    this.dom.selectModel.addEventListener('change', (e) => {
      this.state.settings.model = e.target.value;
      this.dom.modalSelectModel.value = e.target.value;
      localStorage.setItem('gemini_model', e.target.value);
      this.showToast(`Active model switched to ${e.target.value}`, 'info');
    });

    // Suggestion cards
    document.querySelectorAll('.suggestion-card').forEach((card) => {
      card.addEventListener('click', () => {
        const prompt = card.getAttribute('data-prompt');
        if (prompt) {
          this.dom.chatInput.value = prompt;
          this.handleInputChange();
          this.sendMessage();
        }
      });
    });

    // Clear chat
    this.dom.btnClearChat.addEventListener('click', () => this.clearChat());

    // Modals open/close
    this.dom.btnOpenArch.addEventListener('click', () => this.openModal(this.dom.modalArch));
    this.dom.btnOpenSettings.addEventListener('click', () => {
      this.syncSettingsToModal();
      this.openModal(this.dom.modalSettings);
    });

    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-close');
        const modal = document.getElementById(targetId);
        if (modal) this.closeModal(modal);
      });
    });

    // Close modals on overlay backdrop click
    [this.dom.modalArch, this.dom.modalSettings].forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal(modal);
      });
    });

    // Toggle API key visibility in settings
    this.dom.btnToggleKeyVis.addEventListener('click', () => {
      const type = this.dom.inputApiKey.getAttribute('type') === 'password' ? 'text' : 'password';
      this.dom.inputApiKey.setAttribute('type', type);
      this.dom.btnToggleKeyVis.textContent = type === 'password' ? '👁️' : '🙈';
    });

    // Test API Key button
    this.dom.btnTestKey.addEventListener('click', () => this.handleTestApiKey());

    // Test Supabase connection button
    this.dom.btnTestSupabase.addEventListener('click', () => this.handleTestSupabase());

    // Temperature slider display
    this.dom.rangeTemperature.addEventListener('input', (e) => {
      this.dom.tempValDisplay.textContent = e.target.value;
    });

    // Save Settings button
    this.dom.btnSaveSettings.addEventListener('click', () => this.handleSaveSettings());

    // Copy code button delegation
    document.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.btn-copy-code');
      if (copyBtn) {
        const rawCode = decodeURIComponent(copyBtn.getAttribute('data-code') || '');
        this.copyToClipboard(rawCode, copyBtn);
      }

      const copyMsgBtn = e.target.closest('.btn-copy-msg');
      if (copyMsgBtn) {
        const rawText = decodeURIComponent(copyMsgBtn.getAttribute('data-text') || '');
        this.copyToClipboard(rawText, copyMsgBtn);
      }
    });
  }

  applyInitialSettings() {
    this.dom.selectModel.value = this.state.settings.model;
    this.dom.modalSelectModel.value = this.state.settings.model;
    this.dom.rangeTemperature.value = this.state.settings.temperature;
    this.dom.tempValDisplay.textContent = this.state.settings.temperature;
    this.dom.textareaSystemPrompt.value = this.state.settings.systemInstruction;
    this.dom.inputApiKey.value = this.state.settings.customApiKey;
    this.dom.inputSupabaseUrl.value = this.state.settings.supabaseUrl;
    this.dom.inputSupabaseAnonKey.value = this.state.settings.supabaseAnonKey;
  }

  syncSettingsToModal() {
    this.dom.inputApiKey.value = this.state.settings.customApiKey;
    this.dom.modalSelectModel.value = this.state.settings.model;
    this.dom.rangeTemperature.value = this.state.settings.temperature;
    this.dom.tempValDisplay.textContent = this.state.settings.temperature;
    this.dom.textareaSystemPrompt.value = this.state.settings.systemInstruction;
    this.dom.inputSupabaseUrl.value = this.state.settings.supabaseUrl || window.__ENV__?.SUPABASE_URL || '';
    this.dom.inputSupabaseAnonKey.value = this.state.settings.supabaseAnonKey || window.__ENV__?.SUPABASE_ANON_KEY || '';
  }

  async checkBackendHealth() {
    try {
      this.dom.backendStatusText.textContent = 'Checking...';
      const health = await api.checkHealth();

      if (health.status === 'online') {
        this.state.backendStatus = 'online';
        this.state.geminiConfigured = health.geminiConfigured || Boolean(this.state.settings.customApiKey);
        this.state.supabaseConfigured = health.supabaseConfigured;

        this.dom.backendStatus.classList.remove('offline');

        if (this.state.geminiConfigured) {
          this.dom.backendStatusText.textContent = `Online • ${this.state.settings.model}`;
          this.dom.apiKeyHeaderStatus.textContent = 'Settings ✅';
        } else {
          this.dom.backendStatusText.textContent = 'Key Required ⚠️';
          this.dom.apiKeyHeaderStatus.textContent = 'Configure Key ⚠️';
        }

        // Supabase Status Indicator
        if (health.supabaseConfigured) {
          this.dom.supabaseStatus.classList.remove('offline');
          this.dom.supabaseStatusText.textContent = 'Supabase: Connected ✅';
        } else {
          this.dom.supabaseStatus.classList.add('offline');
          this.dom.supabaseStatusText.textContent = 'Supabase: Inactive ⚠️';
        }
      } else {
        throw new Error('Backend responded with offline status');
      }
    } catch (err) {
      this.state.backendStatus = 'offline';
      this.dom.backendStatus.classList.add('offline');
      this.dom.backendStatusText.textContent = 'Backend Offline';
      this.dom.supabaseStatus.classList.add('offline');
      this.dom.supabaseStatusText.textContent = 'Supabase: Offline';
      this.dom.apiKeyHeaderStatus.textContent = 'Server Down';
      this.showToast('Cannot connect to Node.js backend on port 5000.', 'error');
    }
  }

  handleInputChange() {
    const input = this.dom.chatInput;
    input.style.height = 'auto';
    const newHeight = Math.min(input.scrollHeight, 160);
    input.style.height = `${newHeight}px`;

    const length = input.value.trim().length;
    this.dom.charCounter.textContent = `${length} chars`;
    this.dom.btnSend.disabled = length === 0 || this.state.isStreaming;
  }

  async sendMessage() {
    const text = this.dom.chatInput.value.trim();
    if (!text || this.state.isStreaming) return;

    this.dom.chatInput.value = '';
    this.handleInputChange();

    if (this.state.messages.length === 0) {
      this.dom.welcomeHero.style.display = 'none';
      this.dom.messagesContainer.style.display = 'flex';
    }

    const userMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.state.messages.push(userMessage);
    this.appendMessageToDom(userMessage);

    const isStreaming = this.dom.checkStreaming.checked;
    const model = this.dom.selectModel.value;

    const assistantMessage = {
      role: 'assistant',
      content: '',
      model,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (isStreaming) {
      await this.handleStreamingResponse(assistantMessage);
    } else {
      await this.handleStandardResponse(assistantMessage);
    }
  }

  async handleStreamingResponse(assistantMessage) {
    this.setStreamingState(true);
    const { bubbleElement, metaElement } = this.appendStreamingAssistantPlaceholder(assistantMessage);

    this.state.abortController = new AbortController();
    let accumulatedText = '';

    try {
      await api.streamMessage({
        messages: this.state.messages,
        model: assistantMessage.model,
        temperature: this.state.settings.temperature,
        systemInstruction: this.state.settings.systemInstruction,
        customApiKey: this.state.settings.customApiKey,
        chatId: this.state.chatId,
        signal: this.state.abortController.signal,
        onChunk: (chunk) => {
          accumulatedText += chunk;
          assistantMessage.content = accumulatedText;
          bubbleElement.innerHTML = parseMarkdown(accumulatedText) + '<span class="streaming-cursor"></span>';
          this.scrollToBottom();
        },
        onComplete: (data) => {
          assistantMessage.content = data.text || accumulatedText;
          bubbleElement.innerHTML = parseMarkdown(assistantMessage.content);
          this.finalizeAssistantMessage(metaElement, assistantMessage);
          this.state.messages.push(assistantMessage);
          this.setStreamingState(false);
          this.scrollToBottom();
        },
        onError: (err) => {
          console.error('[Streaming Error]', err);
          bubbleElement.innerHTML = `<span style="color: var(--rose-accent);">⚠️ ${err.message || 'Stream connection failed'}</span>`;
          this.showToast(err.message || 'Failed to stream response', 'error');
          this.setStreamingState(false);
        }
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        bubbleElement.innerHTML = `<span style="color: var(--rose-accent);">⚠️ ${err.message}</span>`;
        this.showToast(err.message, 'error');
      }
      this.setStreamingState(false);
    }
  }

  async handleStandardResponse(assistantMessage) {
    this.setStreamingState(true);
    const { bubbleElement, metaElement } = this.appendStreamingAssistantPlaceholder(assistantMessage);
    bubbleElement.innerHTML = `
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;

    try {
      const response = await api.sendMessage({
        messages: this.state.messages,
        model: assistantMessage.model,
        temperature: this.state.settings.temperature,
        systemInstruction: this.state.settings.systemInstruction,
        customApiKey: this.state.settings.customApiKey,
        chatId: this.state.chatId
      });

      assistantMessage.content = response.message.content;
      bubbleElement.innerHTML = parseMarkdown(assistantMessage.content);
      this.finalizeAssistantMessage(metaElement, assistantMessage);
      this.state.messages.push(assistantMessage);
    } catch (err) {
      console.error('[Chat Error]', err);
      bubbleElement.innerHTML = `<span style="color: var(--rose-accent);">⚠️ ${err.message}</span>`;
      this.showToast(err.message, 'error');
    } finally {
      this.setStreamingState(false);
      this.scrollToBottom();
    }
  }

  appendMessageToDom(msg) {
    const row = document.createElement('div');
    row.className = `message-row ${msg.role}`;

    if (msg.role === 'user') {
      row.innerHTML = `
        <div class="message-bubble user">
          <p>${this.escapeHtml(msg.content).replace(/\n/g, '<br/>')}</p>
        </div>
        <div class="message-avatar user" title="You">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
      `;
    }

    this.dom.messagesContainer.appendChild(row);
    this.scrollToBottom();
  }

  appendStreamingAssistantPlaceholder(msg) {
    const row = document.createElement('div');
    row.className = 'message-row assistant';

    row.innerHTML = `
      <div class="message-avatar assistant" title="Gemini AI">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
      </div>
      <div class="message-bubble assistant">
        <div class="bubble-content">
          <div class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
        <div class="message-meta">
          <span class="meta-model-tag">${msg.model}</span>
          <span class="meta-time">${msg.timestamp}</span>
          <div class="meta-actions"></div>
        </div>
      </div>
    `;

    this.dom.messagesContainer.appendChild(row);
    this.scrollToBottom();

    return {
      rowElement: row,
      bubbleElement: row.querySelector('.bubble-content'),
      metaElement: row.querySelector('.meta-actions')
    };
  }

  finalizeAssistantMessage(metaActionsEl, msg) {
    metaActionsEl.innerHTML = `
      <button class="btn-meta btn-copy-msg" title="Copy response text" data-text="${encodeURIComponent(msg.content)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy</span>
      </button>
    `;
  }

  setStreamingState(isStreaming) {
    this.state.isStreaming = isStreaming;
    if (isStreaming) {
      this.dom.btnSend.style.display = 'none';
      this.dom.btnStop.style.display = 'flex';
      this.dom.chatInput.disabled = true;
    } else {
      this.dom.btnSend.style.display = 'flex';
      this.dom.btnStop.style.display = 'none';
      this.dom.chatInput.disabled = false;
      this.dom.chatInput.focus();
      this.handleInputChange();
    }
  }

  stopStreaming() {
    if (this.state.abortController) {
      this.state.abortController.abort();
      this.state.abortController = null;
    }
    this.setStreamingState(false);
    this.showToast('Response generation stopped.', 'info');
  }

  clearChat() {
    if (this.state.messages.length === 0) return;
    this.state.messages = [];
    this.state.chatId = this.generateUUID();
    localStorage.setItem('active_chat_id', this.state.chatId);
    this.dom.messagesContainer.innerHTML = '';
    this.dom.messagesContainer.style.display = 'none';
    this.dom.welcomeHero.style.display = 'flex';
    this.showToast('Conversation cleared and new session started.', 'info');
  }

  scrollToBottom() {
    this.dom.chatHistory.scrollTop = this.dom.chatHistory.scrollHeight;
  }

  openModal(modal) {
    modal.classList.add('active');
  }

  closeModal(modal) {
    modal.classList.remove('active');
  }

  async handleTestApiKey() {
    const key = this.dom.inputApiKey.value.trim();
    if (!key) {
      this.showToast('Please enter an API key to test.', 'error');
      return;
    }

    this.dom.btnTestKey.textContent = 'Testing...';
    this.dom.btnTestKey.disabled = true;

    try {
      const res = await api.testApiKey(key);
      if (res.valid) {
        this.showToast('✅ Gemini API Key is valid and working!', 'success');
      } else {
        this.showToast(`❌ Verification failed: ${res.message}`, 'error');
      }
    } catch (err) {
      this.showToast(`Error testing key: ${err.message}`, 'error');
    } finally {
      this.dom.btnTestKey.textContent = 'Test Key';
      this.dom.btnTestKey.disabled = false;
    }
  }

  async handleTestSupabase() {
    const url = this.dom.inputSupabaseUrl.value.trim();
    const key = this.dom.inputSupabaseAnonKey.value.trim();

    if (!url || !key) {
      this.showToast('Please enter both Supabase URL and Anon Key.', 'error');
      return;
    }

    this.dom.btnTestSupabase.textContent = 'Testing...';
    this.dom.btnTestSupabase.disabled = true;

    try {
      const res = await fetch('/api/supabase/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, key })
      });
      const data = await res.json();

      if (data.connected) {
        this.showToast(`✅ ${data.message}`, 'success');
        this.dom.supabaseStatus.classList.remove('offline');
        this.dom.supabaseStatusText.textContent = 'Supabase: Connected ✅';
      } else {
        this.showToast(`❌ Supabase test: ${data.message}`, 'error');
      }
    } catch (err) {
      this.showToast(`Supabase check failed: ${err.message}`, 'error');
    } finally {
      this.dom.btnTestSupabase.textContent = 'Test Supabase';
      this.dom.btnTestSupabase.disabled = false;
    }
  }

  async handleSaveSettings() {
    const key = this.dom.inputApiKey.value.trim();
    const model = this.dom.modalSelectModel.value;
    const temp = parseFloat(this.dom.rangeTemperature.value);
    const system = this.dom.textareaSystemPrompt.value.trim();
    const supabaseUrl = this.dom.inputSupabaseUrl.value.trim();
    const supabaseAnonKey = this.dom.inputSupabaseAnonKey.value.trim();

    this.state.settings = {
      model,
      temperature: temp,
      systemInstruction: system,
      customApiKey: key,
      supabaseUrl,
      supabaseAnonKey
    };

    localStorage.setItem('gemini_model', model);
    localStorage.setItem('gemini_temperature', String(temp));
    localStorage.setItem('gemini_system', system);
    localStorage.setItem('gemini_custom_key', key);
    localStorage.setItem('supabase_url', supabaseUrl);
    localStorage.setItem('supabase_anon_key', supabaseAnonKey);

    this.dom.selectModel.value = model;

    if (key) {
      try {
        const res = await api.saveApiKey(key);
        if (res.success) {
          this.state.geminiConfigured = true;
          this.dom.apiKeyHeaderStatus.textContent = 'Settings ✅';
          this.dom.backendStatusText.textContent = `Online • ${model}`;
        }
      } catch (err) {
        console.warn('[Frontend App] Could not save key to backend config:', err);
      }
    }

    this.closeModal(this.dom.modalSettings);
    this.showToast('Settings saved successfully!', 'success');
  }

  async copyToClipboard(text, btnElement) {
    try {
      await navigator.clipboard.writeText(text);
      const span = btnElement.querySelector('span');
      if (span) {
        const original = span.textContent;
        span.textContent = 'Copied!';
        setTimeout(() => { span.textContent = original; }, 2000);
      }
      this.showToast('Copied to clipboard!', 'success');
    } catch (err) {
      this.showToast('Failed to copy to clipboard', 'error');
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new ChatApplication();
});
