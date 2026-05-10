import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add RTF CSS
css = """
        .rtf-toolbar { display:flex; gap:5px; margin-bottom:5px; background:rgba(0,0,0,0.1); padding:5px; border-radius:10px; }
        body.light-mode .rtf-toolbar { background:rgba(0,0,0,0.05); }
        .rtf-btn { background:none; border:none; color:var(--text); cursor:pointer; padding:5px 8px; border-radius:5px; font-size:0.9rem; transition:0.2s; }
        .rtf-btn:hover { background:var(--p-grad); color:#fff; }
        /* hide google translate bar */
        .goog-te-banner-frame.skiptranslate { display: none !important; }
        body { top: 0px !important; }
"""
html = html.replace('/* ===== LIGHT MODE ===== */', css + '\n        /* ===== LIGHT MODE ===== */')

# 2. Add RTF toolbars
t_desc_old = '<textarea id="t-desc" class="input-p" placeholder="Detaylar" style="height:100px;" required></textarea>'
t_desc_new = '''<div class="rtf-toolbar">
                            <button type="button" class="rtf-btn" onclick="app.rtf('t-desc','**','**')"><i class="fas fa-bold"></i></button>
                            <button type="button" class="rtf-btn" onclick="app.rtf('t-desc','*','*')"><i class="fas fa-italic"></i></button>
                            <button type="button" class="rtf-btn" onclick="app.rtf('t-desc','`','`')"><i class="fas fa-code"></i></button>
                            <button type="button" class="rtf-btn" onclick="app.rtf('t-desc','\\n• ','')"><i class="fas fa-list-ul"></i></button>
                        </div>
                        <textarea id="t-desc" class="input-p" placeholder="Detaylar" style="height:100px;margin-bottom:10px;" required></textarea>'''
html = html.replace(t_desc_old, t_desc_new)

r_text_old = '<textarea id="r-text" class="input-p" placeholder="Yapılanlar..." style="height:120px;" required></textarea>'
r_text_new = '''<div class="rtf-toolbar">
                            <button type="button" class="rtf-btn" onclick="app.rtf('r-text','**','**')"><i class="fas fa-bold"></i></button>
                            <button type="button" class="rtf-btn" onclick="app.rtf('r-text','*','*')"><i class="fas fa-italic"></i></button>
                            <button type="button" class="rtf-btn" onclick="app.rtf('r-text','`','`')"><i class="fas fa-code"></i></button>
                            <button type="button" class="rtf-btn" onclick="app.rtf('r-text','\\n• ','')"><i class="fas fa-list-ul"></i></button>
                        </div>
                        <textarea id="r-text" class="input-p" placeholder="Yapılanlar..." style="height:120px;margin-bottom:10px;" required></textarea>'''
html = html.replace(r_text_old, r_text_new)

an_text_old = "<textarea id='an-text' class='input-p' placeholder='Mesaj' style='height:90px;'></textarea>"
an_text_new = """<div class='rtf-toolbar' style='margin-bottom:8px;'>
                                <button type='button' class='rtf-btn' onclick="app.rtf('an-text','**','**')"><i class='fas fa-bold'></i></button>
                                <button type='button' class='rtf-btn' onclick="app.rtf('an-text','*','*')"><i class='fas fa-italic'></i></button>
                                <button type='button' class='rtf-btn' onclick="app.rtf('an-text','`','`')"><i class='fas fa-code'></i></button>
                                <button type='button' class='rtf-btn' onclick="app.rtf('an-text','\\n• ','')"><i class='fas fa-list-ul'></i></button>
                            </div>
                            <textarea id='an-text' class='input-p' placeholder='Mesaj' style='height:90px;'></textarea>"""
html = html.replace(an_text_old, an_text_new)

# 3. Add app.rtf and app.parseRTF
js_funcs = """
            rtf(id, pre, post) {
                const el = document.getElementById(id);
                if(!el) return;
                const s = el.selectionStart, e = el.selectionEnd, v = el.value;
                el.value = v.substring(0, s) + pre + v.substring(s, e) + post + v.substring(e);
                el.selectionStart = el.selectionEnd = s + pre.length + (e - s);
                el.focus();
            },
            parseRTF(txt) {
                if(!txt) return '';
                return txt.replace(/\\*\\*(.*?)\\*\\*/g, '<b>$1</b>')
                          .replace(/\\*(.*?)\\*/g, '<i>$1</i>')
                          .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1);color:#fff;padding:2px 4px;border-radius:4px;">$1</code>')
                          .replace(/\\n/g, '<br>');
            },
"""
html = html.replace("show(id) {", js_funcs + "\n            show(id) {")

# 4. Use app.parseRTF in renderAnns
html = html.replace("<h3>${displayTitle}</h3><p>${a.text}</p>", "<h3>${displayTitle}</h3><p>${app.parseRTF(a.text)}</p>")

# 5. Use app.parseRTF in task description display
html = html.replace("document.getElementById('td-desc').innerText = desc;", "document.getElementById('td-desc').innerHTML = app.parseRTF(desc);")

# 6. Add Language translation feature
translate_div = """
                        <div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                            <div>
                                <b style="font-size:0.95rem;">🌐 Çeviri / Language</b>
                                <p style="font-size:0.75rem;color:var(--sub);margin:4px 0 0;">Sistem Dilini Değiştir</p>
                            </div>
                            <div style="display:flex;gap:5px;">
                                <button class="btn-p" style="padding:6px 12px;font-size:0.8rem;margin:0;background:var(--sub);" onclick="app.changeLang('tr')">TR</button>
                                <button class="btn-p" style="padding:6px 12px;font-size:0.8rem;margin:0;" onclick="app.changeLang('en')">EN</button>
                            </div>
                        </div>
"""
notif_card = '<b style="font-size:0.95rem;">🔔 Bildirimler</b>'
if notif_card in html:
    idx = html.find('<div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">', html.find(notif_card) - 200)
    if idx != -1:
        html = html[:idx] + translate_div + html[idx:]

# 7. Add translation logic (Google Translate snippet)
google_script = """
    <div id="google_translate_element" style="display:none;"></div>
    <script type="text/javascript">
        function googleTranslateElementInit() {
            new google.translate.TranslateElement({pageLanguage: 'tr', includedLanguages: 'en,tr', autoDisplay: false}, 'google_translate_element');
        }
    </script>
    <script type="text/javascript" src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>
"""
html = html.replace('</body>', google_script + '\n</body>')

change_lang_func = """
            changeLang(lang) {
                const sel = document.querySelector('.goog-te-combo');
                if(sel) { 
                    sel.value = lang; 
                    sel.dispatchEvent(new Event('change')); 
                    app.toast(lang === 'en' ? 'Language: English' : 'Dil: Türkçe');
                } else {
                    app.toast('Çeviri sistemi yükleniyor...', true);
                }
            },
"""
html = html.replace("logout() {", change_lang_func + "\n            logout() {")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Patch applied')
