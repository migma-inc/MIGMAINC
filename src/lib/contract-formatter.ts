/**
 * Contract Text Formatter
 * Converts plain text to HTML following the contract template format
 */

/**
 * Formats plain text into HTML following the contract template pattern:
 * - Empty lines = new paragraphs
 * - Lines starting with numbers (e.g., "1. ", "2. ") = bold section titles
 * - Lines that are ALL CAPS and end with ":" = bold titles (can have content after)
 * - Regular text = paragraphs with <br> for line breaks within same paragraph
 * 
 * Pattern matches: <p><strong>TITLE</strong><br>content</p> or <p><strong>1. TITLE</strong></p>
 */
export function formatContractTextToHtml(plainText: string): string {
  if (!plainText || !plainText.trim()) {
    return '';
  }

  const lines = plainText.split('\n');
  const htmlParts: string[] = [];
  let currentParagraph: string[] = [];
  let currentTitle: string | null = null;

  const flushParagraph = () => {
    if (currentTitle && currentParagraph.length > 0) {
      // Title with content: <p><strong>TITLE</strong><br>content</p>
      const content = currentParagraph.join('<br>\n');
      htmlParts.push(`<p><strong>${currentTitle}</strong><br>\n${content}</p>`);
      currentTitle = null;
      currentParagraph = [];
    } else if (currentTitle) {
      // Title only: <p><strong>TITLE</strong></p>
      htmlParts.push(`<p><strong>${currentTitle}</strong></p>`);
      currentTitle = null;
    } else if (currentParagraph.length > 0) {
      // Regular paragraph: <p>content</p>
      const paragraphText = currentParagraph.join('<br>\n');
      htmlParts.push(`<p>${paragraphText}</p>`);
      currentParagraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Empty line = new paragraph
    if (trimmedLine === '') {
      flushParagraph();
      continue;
    }

    // Check if line starts with a number followed by a dot and space (section title)
    // Pattern: "1. ", "2. ", "10. ", etc.
    const sectionTitleMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
    if (sectionTitleMatch) {
      // Flush current paragraph if any
      flushParagraph();
      // Set as current title (will be flushed if next line is empty or another title)
      const sectionNumber = sectionTitleMatch[1];
      const sectionText = sectionTitleMatch[2];
      currentTitle = `${sectionNumber}. ${sectionText}`;
      continue;
    }

    // Check if line is ALL CAPS and looks like a title (e.g., "PARTIES:", "TERM:")
    // Must be all caps, end with colon, and not too long
    if (
      trimmedLine === trimmedLine.toUpperCase() && 
      trimmedLine.endsWith(':') && 
      trimmedLine.length < 100 &&
      trimmedLine.length > 3
    ) {
      // Flush current paragraph if any
      flushParagraph();
      // Set as current title (content can follow on next lines)
      currentTitle = trimmedLine;
      continue;
    }

    // Regular line - add to current paragraph
    // If we have a title, this content goes after the title with <br>
    // If no title, it's a regular paragraph
    currentParagraph.push(trimmedLine);
  }

  // Flush any remaining paragraph
  flushParagraph();

  // Join with double newline for better spacing between paragraphs
  return htmlParts.join('\n\n');
}

/**
 * Converts HTML back to plain text (for editing)
 * Removes HTML tags but preserves structure
 */
export function formatHtmlToContractText(html: string): string {
  if (!html || !html.trim()) {
    return '';
  }

  return html
    // Remove paragraph tags but keep content
    .replace(/<p[^>]*>/g, '')
    .replace(/<\/p>/g, '\n')
    // Convert <br> to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove strong tags but keep content
    .replace(/<strong[^>]*>/g, '')
    .replace(/<\/strong>/g, '')
    // Remove other HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Clean up multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

