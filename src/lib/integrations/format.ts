/** Markdown from the assistant → the dialects Telegram and Slack accept. Pure. */

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function toTelegramHtml(md: string): string {
  const lines = md.split('\n').map((l) => {
    if (/^\|?[\s:|-]+\|[\s:|-]*$/.test(l)) return null;                      // table separators
    if (/^\s*\|/.test(l)) return l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).join('  ·  ');
    return l.replace(/^#{1,4}\s+/, '').replace(/^>\s?/, '').replace(/^\s*[-*]\s+/, '• ');
  }).filter((l): l is string => l !== null);
  return escHtml(lines.join('\n'))
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>')
    .slice(0, 4000);
}

export function toSlackMrkdwn(md: string): string {
  return md.split('\n').map((l) => {
    if (/^\|?[\s:|-]+\|[\s:|-]*$/.test(l)) return null;
    if (/^\s*\|/.test(l)) return l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).join('  ·  ');
    return l.replace(/^#{1,4}\s+(.*)$/, '*$1*').replace(/^\s*[-*]\s+/, '• ');
  }).filter((l): l is string => l !== null).join('\n')
    .replace(/\*\*([^*]+)\*\*/g, '*$1*')
    .replace(/(^|\s)_([^_\n]+)_/g, '$1_$2_')
    .slice(0, 3900);
}

export function alertText(n: { title: string; body: string; severity?: string; link?: string | null }, appUrl: string) {
  const icon = n.severity === 'CRITICAL' ? '🔴' : n.severity === 'WARNING' ? '🟠' : '🟢';
  const link = n.link ? `\n${appUrl}${n.link}` : '';
  return { md: `${icon} **${n.title}**\n${n.body}${link}` };
}
