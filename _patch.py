import re, sys

with open('index.html', 'r', encoding='utf-8') as f:
    src = f.read()

changed = 0

# ============================================================
# 1) Ann tab — use regex to replace regardless of line endings
# ============================================================
ann_pattern = re.compile(
    r"} else if\(p === 'ann'\) \{.*?} else if\(p === 'admin'\) \{",
    re.DOTALL
)

ann_replacement = """> else if(p === 'ann') {
                    localStorage.setItem('lsdt_anns_seen', Date.now().toString());
                    const annDot2 = document.getElementById('ann-dot');
                    if(annDot2) { annDot2.style.display = 'none'; annDot2.textContent = ''; }
                    c.innerHTML = `
                        <div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'>
                            <h2 style='margin:0;'>Duyurular</h2>
                        </div>
                        ${app.user.role==='admin' ? `<div class='card'>
                            <input id='an-title' class='input-p' placeholder='Baslik'>
                            <textarea id='an-text' class='input-p' placeholder='Mesaj' style='height:90px;'></textarea>
                            <div style='display:flex;gap:10px;align-items:center;margin-bottom:10px;'>
                                <input type='checkbox' id='an-pin' style='width:16px;height:16px;accent-color:var(--gold);'>
                                <label for='an-pin' style='font-size:0.85rem;color:var(--gold);font-weight:700;'>&#128204; Sabitlenmis yayinla</label>
                            </div>
                            <button class='btn-p' onclick='app.handleNewAnn()'>YAYINLA</button>
                        </div>` : ''}
                        <div class='ann-search-wrap'>
                            <i class='fas fa-search'></i>
                            <input class='input-p' id='ann-search' style='padding-left:46px;margin-bottom:0;' placeholder='Duyurularda ara...' oninput='app.renderAnns()'>
                        </div>
                        <div id='ann-list'></div>`;
                    app.renderAnns();
                } else if(p === 'admin') {"""

m = ann_pattern.search(src)
if m:
    src = src[:m.start()] + ann_replacement + src[m.end():]
    changed += 1
    print("Ann tab: REPLACED")
else:
    print("Ann tab: NOT FOUND")

# ============================================================
# 2) Dark/Light toggle + Notifications card in set tab
# ============================================================
notif_pattern = re.compile(
    r"<div class=\"card\" style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;\">\s*<div>\s*<b style=\"font-size:0\.95rem;\">&#128276; Bildirimler<\/b>",
    re.DOTALL
)

if not notif_pattern.search(src):
    # try original emoji version
    notif_pattern2 = re.compile(
        r'(<div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">\s*<div>\s*<b style="font-size:0\.95rem;">[^<]*Bildirimler)',
        re.DOTALL
    )
    m2 = notif_pattern2.search(src)
    if m2:
        insert_pos = m2.start()
        theme_card = """<div class='card' style='display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;cursor:pointer;' onclick='app.toggleTheme()'>
                            <div>
                                <b style='font-size:0.95rem;' id='theme-label'>&#127769; Karanlik Mod</b>
                                <p style='font-size:0.75rem;color:var(--sub);margin:4px 0 0;'>Tema degistir</p>
                            </div>
                            <div class='theme-toggle'>
                                <div class='theme-toggle-track'>
                                    <div class='theme-toggle-thumb' id='theme-thumb'>&#9728;&#65039;</div>
                                </div>
                            </div>
                        </div>

                        """
        src = src[:insert_pos] + theme_card + src[insert_pos:]
        changed += 1
        print("Theme toggle card: INSERTED before Bildirimler")
    else:
        print("Notif card: pattern NOT FOUND at all")
else:
    print("Theme toggle already present")

# ============================================================
# 3) handleNewAnn — add pin support
# ============================================================
han_pattern = re.compile(
    r"async handleNewAnn\(\) \{.*?\},",
    re.DOTALL
)
m3 = han_pattern.search(src)
if m3:
    existing = m3.group(0)
    if 'an-pin' not in existing:
        han_new = """async handleNewAnn() {
                const raw = document.getElementById('an-title').value;
                const x = document.getElementById('an-text').value;
                const isPinned = document.getElementById('an-pin')?.checked;
                const t = isPinned ? '[PIN] ' + raw : raw;
                if(!raw||!x) return app.toast('Doldurun!', true);
                const r = await fetch(`${RENDER_URL}/api/announcements`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title:t, text:x, author:app.user.name}) });
                if(r.ok) { app.toast(isPinned ? '&#128204; Sabitlendi!' : 'Yayinlandi'); await app.sync(); app.nav('ann'); } else app.toast('Hata!', true);
            },"""
        src = src[:m3.start()] + han_new + src[m3.end():]
        changed += 1
        print("handleNewAnn: UPDATED with pin support")
    else:
        print("handleNewAnn: already has pin support")
else:
    print("handleNewAnn: NOT FOUND")

# ============================================================
# 4) Apply saved theme on page load (after renderCats)
# ============================================================
if 'lsdt_theme' not in src:
    rc_pattern = re.compile(r"app\.renderCats\(\);(\s*)setInterval")
    m4 = rc_pattern.search(src)
    if m4:
        src = src[:m4.start()] + "app.renderCats();\n                if(localStorage.getItem('lsdt_theme') === 'light') document.body.classList.add('light-mode');" + m4.group(1) + "setInterval" + src[m4.end():]
        changed += 1
        print("Theme init: ADDED")
    else:
        print("renderCats: NOT FOUND")
else:
    print("Theme init: already present")

print(f"\nTotal changes: {changed}")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(src)

print("FILE SAVED")
