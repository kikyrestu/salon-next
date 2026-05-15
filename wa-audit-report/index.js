const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;


function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseMarkdown(md) {
    let html = md;

    // Code blocks (fenced) - must be before inline code
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre class="code-block"><code class="lang-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`;
    });

    // Tables
    html = html.replace(/^(\|.+\|)\n(\|[-:\s|]+\|)\n((?:\|.+\|\n?)*)/gm, (_, headerRow, separatorRow, bodyRows) => {
        const headers = headerRow.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');

        const alignments = separatorRow.split('|').filter(c => c.trim()).map(c => {
            c = c.trim();
            if (c.startsWith(':') && c.endsWith(':')) return 'center';
            if (c.endsWith(':')) return 'right';
            return 'left';
        });

        const rows = bodyRows.trim().split('\n').map(row => {
            const cells = row.split('|').filter(c => c.trim()).map((c, i) => {
                const align = alignments[i] || 'left';
                return `<td style="text-align:${align}">${c.trim()}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        return `<div class="table-wrap"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
    });

    // Headings with IDs for anchor links
    html = html.replace(/^### (.+)$/gm, (_, text) => {
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return `<h3 id="${id}">${text}</h3>`;
    });
    html = html.replace(/^## (.+)$/gm, (_, text) => {
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return `<h2 id="${id}">${text}</h2>`;
    });
    html = html.replace(/^# (.+)$/gm, (_, text) => {
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return `<h1 id="${id}">${text}</h1>`;
    });

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Bold + Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Unordered lists
    html = html.replace(/^(\s*)[-*] (.+)$/gm, (_, indent, text) => {
        const level = Math.floor(indent.length / 2);
        return `<li class="list-level-${level}">${text}</li>`;
    });
    html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<oli>$1</oli>');
    html = html.replace(/((?:<oli>.*<\/oli>\n?)+)/g, (match) => {
        const items = match.replace(/<oli>(.*?)<\/oli>/g, '<li>$1</li>');
        return `<ol>${items}</ol>`;
    });

    // Paragraphs
    html = html.replace(/\n{2,}/g, '\n</p><p>\n');
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs and fix nesting
    html = html.replace(/<p>\s*<(h[1-3]|hr|pre|div|ul|ol|table)/g, '<$1');
    html = html.replace(/<\/(h[1-3]|hr|pre|div|ul|ol|table)>\s*<\/p>/g, '</$1>');
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
}

function buildToc(md) {
    const lines = md.split('\n');
    const toc = [];
    for (const line of lines) {
        const m = line.match(/^(#{1,3}) (.+)$/);
        if (m) {
            const level = m[1].length;
            const text = m[2];
            const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            toc.push({ level, text, id });
        }
    }
    return toc;
}

function renderPage(md, currentFile, allFiles) {
    const toc = buildToc(md);
    const content = parseMarkdown(md);

    const fileLinksHtml = allFiles.map(f => {
        const isActive = f === currentFile ? 'active' : '';
        return `<a href="/?file=${f}" class="toc-link ${isActive}" style="font-weight:bold; margin-bottom: 4px; padding-left: 12px; border-left: 2px solid ${isActive ? 'var(--accent)' : 'transparent'};">📄 ${f}</a>`;
    }).join('');

    const tocHtml = toc.map(item => {
        const indent = (item.level - 1) * 16;
        const cls = item.level === 1 ? 'toc-h1' : item.level === 2 ? 'toc-h2' : 'toc-h3';
        return `<a href="#${item.id}" class="toc-link ${cls}" style="padding-left:${indent + 12}px">${item.text}</a>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WA Module Audit Report - SalonNext</title>
<style>
:root {
    --bg: #0d1117;
    --bg-card: #161b22;
    --bg-sidebar: #0d1117;
    --border: #30363d;
    --text: #e6edf3;
    --text-muted: #8b949e;
    --accent: #58a6ff;
    --accent-hover: #79c0ff;
    --green: #3fb950;
    --red: #f85149;
    --orange: #d29922;
    --purple: #bc8cff;
    --code-bg: #1c2128;
    --table-stripe: #161b22;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.7;
    display: flex;
    min-height: 100vh;
}

/* Sidebar */
.sidebar {
    width: 320px;
    min-width: 320px;
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
    height: 100vh;
    position: sticky;
    top: 0;
    overflow-y: auto;
    padding: 20px 0;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
}

.sidebar-header {
    padding: 0 16px 16px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 12px;
}

.sidebar-header h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 4px;
}

.sidebar-header p {
    font-size: 11px;
    color: var(--text-muted);
}

.toc-link {
    display: block;
    padding: 6px 12px;
    color: var(--text-muted);
    text-decoration: none;
    font-size: 13px;
    border-left: 2px solid transparent;
    transition: all 0.15s;
}

.toc-link:hover {
    color: var(--accent);
    background: rgba(88, 166, 255, 0.05);
    border-left-color: var(--accent);
}

.toc-link.active {
    color: var(--accent);
    border-left-color: var(--accent);
    background: rgba(88, 166, 255, 0.1);
}

.toc-h1 { font-weight: 700; font-size: 14px; color: var(--text); margin-top: 8px; }
.toc-h2 { font-weight: 600; font-size: 13px; }
.toc-h3 { font-weight: 400; font-size: 12px; }

/* Main content */
.main {
    flex: 1;
    max-width: 900px;
    padding: 40px 48px;
    margin: 0 auto;
}

/* Typography */
h1 { font-size: 32px; font-weight: 700; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
h2 { font-size: 24px; font-weight: 600; margin: 40px 0 16px; padding-bottom: 6px; border-bottom: 1px solid var(--border); color: var(--accent); }
h3 { font-size: 18px; font-weight: 600; margin: 28px 0 12px; color: var(--text); }

p { margin: 8px 0; }
hr { border: none; border-top: 1px solid var(--border); margin: 32px 0; }

a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); text-decoration: underline; }

strong { color: var(--text); font-weight: 600; }
em { color: var(--orange); font-style: italic; }

/* Code */
.inline-code {
    background: var(--code-bg);
    color: var(--purple);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.code-block {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 20px;
    margin: 16px 0;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.5;
}

.code-block code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    color: var(--text);
}

/* Tables */
.table-wrap {
    overflow-x: auto;
    margin: 16px 0;
    border-radius: 8px;
    border: 1px solid var(--border);
}

table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}

th {
    background: var(--code-bg);
    color: var(--text);
    font-weight: 600;
    padding: 10px 14px;
    text-align: left;
    border-bottom: 2px solid var(--border);
    white-space: nowrap;
}

td {
    padding: 8px 14px;
    border-bottom: 1px solid var(--border);
    color: var(--text-muted);
}

tr:nth-child(even) td { background: var(--table-stripe); }
tr:hover td { background: rgba(88, 166, 255, 0.05); }

/* Lists */
ul, ol { padding-left: 24px; margin: 8px 0; }
li { margin: 4px 0; color: var(--text-muted); }

/* Severity badges */
h3:has(+ p) { position: relative; }

/* Scroll behavior */
html { scroll-behavior: smooth; scroll-padding-top: 20px; }

/* Search */
.search-box {
    margin: 0 16px 12px;
}
.search-box input {
    width: 100%;
    padding: 8px 12px;
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-size: 13px;
    outline: none;
}
.search-box input:focus { border-color: var(--accent); }
.search-box input::placeholder { color: var(--text-muted); }

/* Stats bar */
.stats-bar {
    display: flex;
    gap: 12px;
    margin: 16px 0;
    flex-wrap: wrap;
}
.stat-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
}
.stat-critical { background: rgba(248, 81, 73, 0.15); color: var(--red); border: 1px solid rgba(248, 81, 73, 0.3); }
.stat-high { background: rgba(210, 153, 34, 0.15); color: var(--orange); border: 1px solid rgba(210, 153, 34, 0.3); }
.stat-medium { background: rgba(88, 166, 255, 0.15); color: var(--accent); border: 1px solid rgba(88, 166, 255, 0.3); }
.stat-low { background: rgba(63, 185, 80, 0.15); color: var(--green); border: 1px solid rgba(63, 185, 80, 0.3); }

/* Back to top */
.back-top {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--accent);
    color: #000;
    border: none;
    cursor: pointer;
    font-size: 18px;
    display: none;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    transition: opacity 0.2s;
    z-index: 100;
}
.back-top.visible { display: flex; }

/* Responsive */
@media (max-width: 900px) {
    .sidebar { display: none; }
    .main { padding: 20px 16px; }
}

/* Print */
@media print {
    .sidebar, .back-top { display: none !important; }
    .main { max-width: 100%; padding: 0; }
    body { background: #fff; color: #000; }
    h2 { color: #000; }
    .code-block { background: #f6f8fa; border: 1px solid #ddd; }
}
</style>
</head>
<body>

<nav class="sidebar">
    <div class="sidebar-header">
        <h2>WA Module Docs</h2>
        <p>SalonNext - 2026-05-15</p>
    </div>
    <div style="padding: 0 16px 12px;">
        <h3 style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase;">Documents</h3>
        ${fileLinksHtml}
    </div>
    <div style="padding: 0 16px; margin-bottom: 8px;">
        <h3 style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase;">Table of Contents</h3>
    </div>
    <div class="search-box">
        <input type="text" id="tocSearch" placeholder="Search sections...">
    </div>
    <div id="tocContainer">
        ${tocHtml}
    </div>
</nav>

<main class="main">
    <div class="stats-bar">
        <span class="stat-badge stat-critical">7 Critical</span>
        <span class="stat-badge stat-high">12 High</span>
        <span class="stat-badge stat-medium">11 Medium</span>
        <span class="stat-badge stat-low">8 Low</span>
    </div>
    ${content}
</main>

<button class="back-top" id="backTop" onclick="window.scrollTo({top:0,behavior:'smooth'})">&#8593;</button>

<script>
// TOC active state tracking
const tocLinks = document.querySelectorAll('.toc-link');
const headings = document.querySelectorAll('h1[id], h2[id], h3[id]');

function updateActiveToc() {
    let current = '';
    headings.forEach(h => {
        if (h.getBoundingClientRect().top <= 80) current = h.id;
    });
    tocLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
}

window.addEventListener('scroll', () => {
    updateActiveToc();
    document.getElementById('backTop').classList.toggle('visible', window.scrollY > 400);
});

// TOC search filter
document.getElementById('tocSearch').addEventListener('input', function() {
    const q = this.value.toLowerCase();
    tocLinks.forEach(link => {
        link.style.display = link.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
});

updateActiveToc();
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
    try {
        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const allFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.md'));
        
        if (urlObj.pathname === '/' || urlObj.pathname === '/index.html') {
            const requestedFile = urlObj.searchParams.get('file');
            const targetFile = requestedFile && allFiles.includes(requestedFile) ? requestedFile : (allFiles.includes('AUDIT-WA-MODULE.md') ? 'AUDIT-WA-MODULE.md' : allFiles[0]);
            
            if (!targetFile) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end('No markdown files found');
            }
            
            const mdPath = path.join(__dirname, targetFile);
            const md = fs.readFileSync(mdPath, 'utf-8');
            const html = renderPage(md, targetFile, allFiles);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
        } else if (urlObj.pathname === '/raw') {
            const requestedFile = urlObj.searchParams.get('file');
            const targetFile = requestedFile && allFiles.includes(requestedFile) ? requestedFile : (allFiles.includes('AUDIT-WA-MODULE.md') ? 'AUDIT-WA-MODULE.md' : allFiles[0]);
            
            if (!targetFile) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end('No markdown files found');
            }

            const mdPath = path.join(__dirname, targetFile);
            const md = fs.readFileSync(mdPath, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
            res.end(md);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
        }
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error: ' + err.message);
    }
});

server.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════╗');
    console.log('  ║   WA Module Audit Report - Markdown Reader      ║');
    console.log('  ╠══════════════════════════════════════════════════╣');
    console.log(`  ║   http://localhost:${PORT}                         ║`);
    console.log(`  ║   http://localhost:${PORT}/raw  (raw markdown)     ║`);
    console.log('  ╠══════════════════════════════════════════════════╣');
    console.log('  ║   Press Ctrl+C to stop                          ║');
    console.log('  ╚══════════════════════════════════════════════════╝');
    console.log('');
});
