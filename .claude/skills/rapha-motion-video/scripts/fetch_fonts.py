"""Download the fonts the compositions use and write fonts/fonts.css with paths relative to the CSS file.

Usage: python3 fetch_fonts.py <project_dir>
Gets Inter, Montserrat, Noto Sans Ethiopic (100-900, needed for heavy Amharic headlines) and JetBrains Mono,
latin + ethiopic subsets only. Link it from the page as <link rel="stylesheet" href="fonts/fonts.css">.
"""
import os, re, sys, urllib.request

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
URL = ('https://fonts.googleapis.com/css2?family=Inter:wght@200..900&family=Montserrat:wght@300..900'
       '&family=Noto+Sans+Ethiopic:wght@100..900&family=JetBrains+Mono:wght@400;500&display=block')

def main(project):
    out = os.path.join(project, 'fonts'); os.makedirs(out, exist_ok=True)
    css = urllib.request.urlopen(urllib.request.Request(URL, headers={'User-Agent': UA})).read().decode()
    faces, seen = [], {}
    for sub, body in re.findall(r'/\* (.*?) \*/\s*@font-face \{(.*?)\}', css, re.S):
        if sub not in ('latin', 'ethiopic'): continue
        url = re.search(r'url\((.*?)\)', body).group(1)
        fam = re.search(r"font-family: '(.*?)'", body).group(1)
        fn = seen.get(url) or f"{fam.replace(' ', '')}-{sub}-{len(seen)}.woff2"
        if url not in seen:
            urllib.request.urlretrieve(url, os.path.join(out, fn)); seen[url] = fn
        # paths inside a stylesheet resolve relative to the CSS file, so no "fonts/" prefix here
        faces.append('@font-face {' + body.replace(url, fn) + '}')
    open(os.path.join(out, 'fonts.css'), 'w').write('\n'.join(faces))
    print(f'{len(faces)} faces, {len(seen)} files -> {out}/fonts.css')

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
