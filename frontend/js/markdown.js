/**
 * Safe and performant Markdown parser tailored for chatbot responses.
 * Supports fenced code blocks with language badge and copy button,
 * tables, lists, bold/italics, blockquotes, and links.
 */

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function parseMarkdown(text) {
  if (!text) return '';

  // Store code blocks temporarily to prevent inner markdown processing
  const codeBlocks = [];
  let processed = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({
      lang: lang || 'text',
      code: code.trim()
    });
    return placeholder;
  });

  // Escape HTML in the remaining text
  processed = escapeHtml(processed);

  // Headers (### -> h3, ## -> h2, # -> h1)
  processed = processed.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
  processed = processed.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
  processed = processed.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');

  // Blockquotes
  processed = processed.replace(/^\> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');

  // Bold & Italic
  processed = processed.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline code
  processed = processed.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // Links: [text](url)
  processed = processed.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>'
  );

  // Unordered list items (- item or * item)
  processed = processed.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="md-li">$1</li>');
  // Wrap contiguous <li> in <ul>
  processed = processed.replace(/(<li class="md-li">.*<\/li>\s*)+/g, '<ul class="md-ul">$&</ul>');

  // Tables
  processed = processed.replace(/(\|[^\n]+\|\r?\n)((?:\|:?[-]+:?)+\|)(\r?\n(?:\|[^\n]+\|\r?\n?)+)/g, (match, header, divider, body) => {
    const headerCols = header.trim().split('|').filter(c => c !== '');
    const bodyRows = body.trim().split('\n');

    let tableHtml = '<div class="table-container"><table class="md-table"><thead><tr>';
    for (const col of headerCols) {
      tableHtml += `<th>${col.trim()}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';

    for (const row of bodyRows) {
      const rowCols = row.trim().split('|').filter(c => c !== '');
      if (rowCols.length > 0) {
        tableHtml += '<tr>';
        for (const c of rowCols) {
          tableHtml += `<td>${c.trim()}</td>`;
        }
        tableHtml += '</tr>';
      }
    }

    tableHtml += '</tbody></table></div>';
    return tableHtml;
  });

  // Paragraphs (double newlines)
  const paragraphs = processed.split(/\n{2,}/);
  processed = paragraphs
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h1') ||
        trimmed.startsWith('<h2') ||
        trimmed.startsWith('<h3') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<div class="table-container"') ||
        trimmed.startsWith('__CODE_BLOCK_')
      ) {
        return trimmed;
      }
      return `<p class="md-p">${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');

  // Restore code blocks with UI styling & copy button
  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    const escapedCode = escapeHtml(block.code);
    const replacement = `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-lang">${escapeHtml(block.lang)}</span>
          <button class="btn-copy-code" type="button" data-code="${encodeURIComponent(block.code)}">
            <svg class="icon-copy" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          </button>
        </div>
        <pre><code class="language-${escapeHtml(block.lang)}">${escapedCode}</code></pre>
      </div>
    `.trim();

    processed = processed.replace(`__CODE_BLOCK_${i}__`, replacement);
  }

  return processed;
}
