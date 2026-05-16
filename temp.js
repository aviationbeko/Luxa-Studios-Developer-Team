
        const RENDER_URL = "https://lsdt.onrender.com";
        const SUPA_URL = "https://iczzynikkupxlvrrdihv.supabase.co";
        const SUPA_KEY = "sb_publishable_neFoM9r6SQkKD7GF7zQ_jg_OyV-SBHd";
        const app = {
            db: { users: [], tasks: [], announcements: [], messages: [] },
            user: null,
            sel: { dCat: 'Script', tTo: '', lTo: '', rejId: '', chatTarget: null, stMembers: [], stImgBase64: null, replyTo: null },
            tempImages: [],

            async init() {
                if(localStorage.getItem('lsdt_theme') === 'light') document.body.classList.add('light-mode');
                // Kaydedilmiş tercihler
                const cbMode=localStorage.getItem('lsdt_cb'); if(cbMode&&cbMode!=='none') document.body.classList.add('cb-'+cbMode);
                if(localStorage.getItem('lsdt_hc')==='1') document.body.classList.add('high-contrast');
                app.applyViewMode();
                app.initSwipe();

                const tl = gsap.timeline();
                tl.fromTo("#l-cube", { y: -50, opacity: 0 }, { y: 0, opacity: 1, duration: 1 })
                  .to("#l-code", { opacity: 1, width: "180px", duration: 1, ease: "steps(15)" })
                  .to("#l-text", { opacity: 1, duration: 1 })
                  .call(async () => {
                      document.getElementById('l-code').innerText = ">_ sunucuya baglaniliyor...";
                      await app.sync();
                      gsap.to("#loading-screen", { opacity: 0, duration: 0.5, onComplete: () => {
                          document.getElementById('loading-screen').classList.remove('active');
                          const rem = localStorage.getItem('lsdt_rem');
                          if(!localStorage.getItem('lsdt_setup')) app.show('setup-screen');
                          else if(rem) {
                              const u = JSON.parse(rem);
                              const f = app.db.users.find(x => x.username === u.username && x.password === u.password);
                              if(f) app.loginAs(f); else app.show('login-screen');
                          } else app.show('login-screen');
                      }});
                  });
                app.applyPrefs();
                app.renderCats();
                setInterval(() => app.sync(), 6000);
                setInterval(() => { if(app.sel.chatTarget) app.syncMessages(); }, 1500);
                const releaseDate = new Date("2026-12-31T23:59:59").getTime();
                setInterval(() => {
                    const now = new Date().getTime();
                    const d = releaseDate - now;
                    if(d > 0) {
                        const days = Math.floor(d / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((d % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((d % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((d % (1000 * 60)) / 1000);
                        const t = document.getElementById('countdown-timer');
                        if(t) t.textContent = `${days}g ${hours}s ${minutes}d ${seconds}sn`;
                    }
                }, 1000);
            },
            
            sendFileMsg(input) {
                const file = input.files[0]; if(!file) return;
                // Dosya boyutu sınırı (Supabase payload çok büyük olmasın, max 2MB)
                if(file.size > 2*1024*1024) { app.toast('Dosya çok büyük (Max 2MB)!', true); return; }
                const reader = new FileReader();
                reader.onload = async (e) => {
                    app.toast('Gönderiliyor...');
                    const base64 = e.target.result;
                    const msg = { sender: app.user.username, receiver: app.sel.chatTarget, text: base64, date: new Date().toISOString() };
                    try {
                        const r = await fetch(`${SUPA_URL}/rest/v1/messages`, {
                            method: 'POST',
                            headers: {'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'},
                            body: JSON.stringify(msg)
                        });
                        if(r.ok) await app.syncMessages();
                    } catch(e) {}
                };
                reader.readAsDataURL(file);
            },

            uploadProfilePic(input) {
                const file = input.files[0];
                if(!file) return;
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64 = e.target.result;
                    app.toast('Fotoğraf yükleniyor...', false);
                    try {
                        const r = await fetch(`${SUPA_URL}/rest/v1/messages`, {
                            method: 'POST',
                            headers: {
                                'apikey': SUPA_KEY,
                                'Authorization': `Bearer ${SUPA_KEY}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=minimal'
                            },
                            body: JSON.stringify({ sender: app.user.username, receiver: 'SYSTEM_PFP', text: base64 })
                        });
                        if(r.ok) { 
                            app.toast('Profil resmi güncellendi!'); 
                            await app.sync(); 
                            app.nav('set'); 
                        } else { 
                            app.toast('Yükleme hatası!', true); 
                        }
                    } catch(e) { app.toast('Bağlantı hatası!', true); }
                };
                reader.readAsDataURL(file);
            },

            saveProfileSettings() {
                const bg = document.getElementById('profile-bg-input').value;
                localStorage.setItem('lsdt_profile_bg_' + app.user.username, bg);
                document.getElementById('avatar').style.background = bg;
                app.toast('Profil güncellendi!');
            },

            toggleTheme(isLight) {
                if(isLight) {
                    document.body.classList.add('light-mode');
                    localStorage.setItem('lsdt_theme', 'light');
                } else {
                    document.body.classList.remove('light-mode');
                    localStorage.setItem('lsdt_theme', 'dark');
                }
            },

            async sync() {
                try {
                    // Kullanıcılar, görevler, duyurular Render'dan
                    const r = await fetch(`${RENDER_URL}/api/state`);
                    const d = await r.json();
                    app.db.users = d.users || [];
                    app.db.tasks = d.tasks || [];
                    app.db.announcements = d.announcements || [];
                    
                    // Veritabanından gelen verilerdeki [IS_PROJECT: true] olanları ayırabiliriz veya render'da filtreleyebiliriz.
                    app.db.projects = app.db.tasks.filter(t => t.description && t.description.includes('[IS_PROJECT: true]'));
                    app.db.studios = app.db.tasks.filter(t => t.description && t.description.includes('[IS_STUDIO:true]'));

                    // Mesajlar doğrudan Supabase'den (Render bypass) - no-store cache ile anlık veri
                    try {
                        const mr = await fetch(`${SUPA_URL}/rest/v1/messages?select=*&order=date.asc&_t=${Date.now()}`, {
                            headers: {
                                'apikey': SUPA_KEY,
                                'Authorization': `Bearer ${SUPA_KEY}`,
                                'Pragma': 'no-cache',
                                'Cache-Control': 'no-cache'
                            },
                            cache: 'no-store'
                        });
                        if(mr.ok) app.db.messages = await mr.json();
                    } catch(me) { console.warn("Mesaj sync hatası:", me); }

                    app.checkUpdate();
                    app.checkNewMsgs();
                    app.checkNewAnns();
                    if(app.sel.chatTarget) app.renderChat();
                } catch(e) { console.error("Sync error:", e); }
            },

            checkNewMsgs() {
                if(!app.user) return;
                const badge = document.getElementById('msg-dot');
                if(!badge) return;
                const lastSeen = parseInt(localStorage.getItem('lsdt_msgs_seen') || '0');
                const unread = (app.db.messages || []).filter(m => m.receiver === app.user.username && new Date(m.date).getTime() > lastSeen);
                const prevCount = app._prevUnread ?? -1;
                if(unread.length > 0) {
                    badge.style.display = 'flex';
                    badge.textContent = unread.length > 9 ? '9+' : unread.length;
                    // Yeni mesaj geldiyse bildirim gönder
                    if(unread.length > prevCount && prevCount >= 0) {
                        const newest = unread[unread.length - 1];
                        const senderName = (app.db.users.find(u => u.username === newest.sender)?.name) || newest.sender;
                        const msgText = newest.text.startsWith('data:image') ? '📷 Resim gönderdi' : newest.text.substring(0, 80);
                        // Tarayıcı push bildirimi — her zaman gönder (document.hidden şartı YOK)
                        if(Notification.permission === 'granted') {
                            new Notification(`💬 ${senderName}`, { body: msgText, icon: 'https://img.icons8.com/fluency/48/lightning-bolt.png', tag: 'lsdt-msg' });
                        }
                        // Uygulama içi banner
                        app.showMsgBanner(senderName, msgText);
                    }
                } else {
                    badge.style.display = 'none';
                    badge.textContent = '';
                }
                app._prevUnread = unread.length;
            },

            showMsgBanner(from, text) {
                let b = document.getElementById('notif-banner');
                if(!b) {
                    b = document.createElement('div');
                    b.id = 'notif-banner';
                    document.body.appendChild(b);
                }
                b.onclick = () => { app.nav('admin'); b.classList.remove('show'); };
                b.innerHTML = `<i class="fas fa-comment-dots" style="font-size:1.3rem;"></i><div><div style="font-size:0.75rem;opacity:0.75;margin-bottom:2px;">Yeni mesaj — ${from}</div><div style="font-size:0.9rem;">${text}</div></div>`;
                // Önce kaldır (önceki animasyon varsa sıfırla)
                b.classList.remove('show');
                clearTimeout(app._bannerTimer);
                // requestAnimationFrame ile geciktir ki CSS geçiş çalışsın
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        b.classList.add('show');
                        app._bannerTimer = setTimeout(() => b.classList.remove('show'), 5000);
                    });
                });
            },

            renderTaskList() {
                const c = document.getElementById('page-content');
                const q = (app.sel.taskSearch || '').toLowerCase();
                const tasks = [...app.db.tasks].reverse().filter(t => {
                    if(t.description && t.description.includes('[IS_PROJECT: true]')) return false;
                    if(t.description && t.description.includes('[IS_STUDIO:true]')) return false;
                    if(app.user.role !== 'admin' && t.assignee !== app.user.username) return false;
                    if(q && !t.title.toLowerCase().includes(q) && !t.assignee.toLowerCase().includes(q)) return false;
                    return true;
                });
                // Mevcut kart container'ı temizle
                let container = document.getElementById('task-list-container');
                if(!container) {
                    container = document.createElement('div');
                    container.id = 'task-list-container';
                    c.appendChild(container);
                }
                container.innerHTML = '';
                if(tasks.length === 0) {
                    container.innerHTML = `<div class="card" style="text-align:center;color:var(--sub);">🔍 Sonuç bulunamadı</div>`;
                    return;
                }
                tasks.forEach(t => {
                    let rHtml = '';
                    if(t.description && t.description.includes('[REPORT_START]')) {
                        try {
                            const r = JSON.parse(t.description.split('[REPORT_START]')[1].split('[REPORT_END]')[0]);
                            rHtml = `<div class="report-section" style="border-left:4px solid var(--green);background:rgba(0,255,0,0.05);">
                                <h4 style="color:var(--green)">GÖNDERİLEN RAPOR</h4>
                                <p style="margin:10px 0;">${r.report}</p>
                                ${r.bug ? `<p style="color:var(--red);background:rgba(255,0,0,0.1);padding:8px;border-radius:10px;"><b>HATA:</b> ${r.bug}</p>` : ''}
                                ${r.link ? `<a href="${r.link}" target="_blank" style="display:block; margin:10px 0; color:var(--p); text-decoration:none;"><i class="fas fa-external-link-alt"></i> Ekli Dosyayı / Linki Aç</a>` : ''}
                                ${r.imgs && r.imgs.length ? `<button class="btn-mini" style="background:var(--p);width:100%;margin:10px 0;" onclick="app.toggleImgs('${t.id}')">GÖRSELLER (${r.imgs.length})</button><div id="imgs-${t.id}" class="img-grid" style="display:none;">${r.imgs.map(i=>`<img src="${i}" class="img-item" onclick="app.viewImg('${i}')">`).join('')}</div>` : ''}
                                ${app.user.role==='admin' && t.status==='İnceleniyor' ? `<div style="display:flex;gap:10px;margin-top:10px;"><button class="btn-mini" style="background:var(--green);color:black;" onclick="app.updateTaskStatus('${t.id}','Onaylandı')">ONAYLA</button><button class="btn-mini" style="background:var(--red);color:white;" onclick="app.openRejectModal('${t.id}')">REDDET</button></div>` : ''}
                            </div>`;
                        } catch(e) {}
                    }
                    // Deadline badge
                    let deadlineBadge = '';
                    let dlValue = t.deadline || null;
                    if(t.description && t.description.includes('[DEADLINE: ')) {
                        dlValue = t.description.split('[DEADLINE: ')[1].split(']')[0];
                    }
                    if(dlValue) {
                        const dl = new Date(dlValue); const now = new Date(); const diffDays = Math.ceil((dl-now)/(1000*60*60*24));
                        if(diffDays < 0) deadlineBadge = `<span class="deadline-badge deadline-over">⏰ ${Math.abs(diffDays)} gün gecikti!</span>`;
                        else if(diffDays <= 2) deadlineBadge = `<span class="deadline-badge deadline-soon">⏰ ${diffDays === 0 ? 'Bugün!' : diffDays+' gün kaldı'}</span>`;
                        else deadlineBadge = `<span class="deadline-badge deadline-ok">⏰ ${diffDays} gün kaldı</span>`;
                    }
                    let timeSpentBadge = '';
                    if(t.description && t.description.includes('[TIME_SPENT: ')) {
                        const ts = t.description.split('[TIME_SPENT: ')[1].split(']')[0];
                        timeSpentBadge = `<span class="badge" style="background:var(--card);color:var(--sub);margin-left:5px;text-transform:none;">⏳ Tamamlanma Süresi: ${ts}</span>`;
                    }
                    let cleanDesc = t.description ? t.description.split('[REPORT_START]')[0].split('[REJECT_REASON]')[0] : '';
                    if (cleanDesc.includes('[DEADLINE: ')) {
                        cleanDesc = cleanDesc.split('[DEADLINE: ')[0];
                    }
                    if (cleanDesc.includes('[TIME_SPENT: ')) {
                        cleanDesc = cleanDesc.split('[TIME_SPENT: ')[0];
                    }
                    cleanDesc = cleanDesc.trim();
                    const rej = (t.status==='Reddedildi' && t.description?.includes('[REJECT_REASON]')) ? `<div style="color:var(--red);padding:10px;background:rgba(255,118,117,0.1);border-radius:10px;margin:10px 0;"><b>RED:</b> ${t.description.split('[REJECT_REASON]')[1].split('[END_REASON]')[0]}</div>` : '';
                    container.innerHTML += `<div class="card">
                        <div style="display:flex;align-items:flex-start;justify-content:space-between;">
                            <div class="badge" style="background:${t.status==='Onaylandı'?'var(--green)':(t.status==='Reddedildi'?'var(--red)':'var(--p-grad)')};">${t.status}</div>
                            ${app.user.role==='admin'?`<i class="fas fa-trash del-btn" style="position:static;margin:0;" onclick="app.delItem('tasks','${t.id}')"></i>`:''}
                        </div>
                        <h3 style="margin:10px 0 5px;">${t.title}</h3>
                        ${deadlineBadge}${timeSpentBadge}
                        ${rej}<p style="opacity:0.8;margin:10px 0;">${cleanDesc}</p>
                        ${rHtml}
                        <div class="info-row" style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px;align-items:center;">
                            <span style="display:flex;align-items:center;">
                                <div style="width:8px;height:8px;border-radius:50%;background:${app.db.tasks.some(x=>x.assignee===t.assignee && x.status==='İzinde')?'var(--red)':'var(--green)'};display:inline-block;margin-right:5px;box-shadow:0 0 5px ${app.db.tasks.some(x=>x.assignee===t.assignee && x.status==='İzinde')?'var(--red)':'var(--green)'};"></div>
                                ${
                                    (() => {
                                        const pfpMsg = (app.db.messages||[]).filter(m => m.sender === t.assignee && m.receiver === 'SYSTEM_PFP').pop();
                                        if(pfpMsg) return `<img src="${pfpMsg.text}" style="width:20px;height:20px;border-radius:50%;margin-right:5px;object-fit:cover;">`;
                                        return `<i class="fas fa-user" style="margin-right:5px;color:var(--p)"></i>`;
                                    })()
                                }
                                ${t.assignee}
                            </span>
                            <span><i class="fas fa-calendar-alt" style="margin-right:5px;color:var(--p)"></i>${new Date(t.date).toLocaleDateString('tr')}</span>
                        </div>
                    </div>`;
                });
            },

            renderCalendar() {
                const cv = document.getElementById('calendar-view');
                if(!cv) return;
                let html = '';
                const items = [...app.db.tasks].filter(t => t.status !== 'Reddedildi' && t.status !== 'Tamamlandı' && t.status !== 'Onaylandı');
                items.sort((a,b) => new Date(a.date) - new Date(b.date));
                items.forEach(t => {
                    const isLeave = t.status === 'İzinde';
                    const dlValue = t.description?.includes('[DEADLINE: ') ? t.description.split('[DEADLINE: ')[1].split(']')[0] : null;
                    const dl = dlValue ? new Date(dlValue) : null;
                    html += `<div style="padding:15px; background:var(--card); border-left:4px solid ${isLeave ? 'var(--red)' : 'var(--p)'}; border-radius:15px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:bold; font-size:1.1rem; color:${isLeave ? 'var(--red)' : 'var(--p)'};">${isLeave ? '🌴 İZİN: ' : '📋 '}${t.assignee}</div>
                            <div style="font-size:0.85rem; color:var(--sub); margin-top:5px;">${t.title}</div>
                        </div>
                        <div style="text-align:right; font-size:0.8rem;">
                            <div style="color:var(--text);">${new Date(t.date).toLocaleDateString('tr')}</div>
                            ${dl ? `<div style="color:var(--gold); margin-top:5px;">Bitiş: ${dl.toLocaleDateString('tr')}</div>` : ''}
                        </div>
                    </div>`;
                });
                if(items.length === 0) html = `<div style="text-align:center; color:var(--sub);">Aktif kayıt bulunamadı.</div>`;
                cv.innerHTML = html;
                app.open('modal-calendar');
            },

            toggleAI() {
                const fab = document.getElementById('ai-fab');
                const popup = document.getElementById('ai-popup');
                const isOpen = popup.classList.contains('show');
                if(isOpen) {
                    popup.classList.remove('show');
                    fab.classList.remove('open');
                    setTimeout(() => { if(!popup.classList.contains('show')) popup.style.display='none'; }, 250);
                } else {
                    popup.style.display = 'flex';
                    app._aiHistory = app._aiHistory || [];
                    const box = document.getElementById('ai-box-popup');
                    if(box && box.children.length === 0) {
                        // İlk açılış — karşılama + hızlı sorular
                        const greet = document.createElement('div');
                        greet.className = 'ai-bubble bot';
                        greet.innerHTML = `👋 Merhaba <b>${app.user?.name || ''}</b>! LSDT hakkında her şeyi sorabilirsin.`;
                        box.appendChild(greet);
                        const chips = document.createElement('div');
                        chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;';
                        chips.innerHTML = `
                            <span class="ai-chip" onclick="app.aiAsk('Son duyuru ne?')">📢 Son Duyuru</span>
                            <span class="ai-chip" onclick="app.aiAsk('Adminler kimler?')">👑 Adminler</span>
                            <span class="ai-chip" onclick="app.aiAsk('Görevlerim neler?')">📋 Görevlerim</span>
                            <span class="ai-chip" onclick="app.aiAsk('Rapor durumum?')">📊 Raporlarım</span>
                            <span class="ai-chip" onclick="app.aiAsk('Ekip kaç kişi?')">👥 Ekip</span>
                            <span class="ai-chip" onclick="app.aiAsk('Reddedilen görevim var mı?')">❌ Reddedilenler</span>`;
                        box.appendChild(chips);
                        app._aiHistory.forEach(h => { const d=document.createElement('div'); d.className=`ai-bubble ${h.role}`; d.innerHTML=h.text; box.appendChild(d); });
                        box.scrollTop = box.scrollHeight;
                    }
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            popup.classList.add('show');
                            fab.classList.add('open');
                            document.getElementById('ai-popup-input')?.focus();
                        });
                    });
                }
            },

            aiAsk(preset) {
                const input = document.getElementById('ai-popup-input');
                const q = (preset || input?.value || '').trim();
                if(!q) return;
                if(input) input.value = '';
                const box = document.getElementById('ai-box-popup');
                if(!box) return;
                app._aiHistory = app._aiHistory || [];
                const uDiv = document.createElement('div');
                uDiv.className = 'ai-bubble user'; uDiv.textContent = q;
                box.appendChild(uDiv);
                app._aiHistory.push({role:'user', text: q});
                const typingDiv = document.createElement('div');
                typingDiv.className = 'ai-bubble bot ai-typing';
                typingDiv.innerHTML = '<span></span><span></span><span></span>';
                box.appendChild(typingDiv);
                box.scrollTop = box.scrollHeight;
                setTimeout(() => {
                    typingDiv.remove();
                    const answer = app.aiThink(q);
                    const bDiv = document.createElement('div');
                    bDiv.className = 'ai-bubble bot'; bDiv.innerHTML = answer;
                    box.appendChild(bDiv);
                    app._aiHistory.push({role:'bot', text: answer});
                    box.scrollTop = box.scrollHeight;
                }, 700 + Math.random() * 500);
            },

            aiThink(q) {
                const ql = q.toLowerCase();
                const db = app.db;
                const me = app.user;

                // Son duyuru
                if(ql.includes('duyuru') || ql.includes('announcement')) {
                    const anns = db.announcements || [];
                    if(!anns.length) return '📢 Henüz duyuru yok.';
                    const last = [...anns].reverse()[0];
                    const all = [...anns].reverse().slice(0,3).map(a=>`• <b>${a.title}</b>: ${a.text.substring(0,60)}${a.text.length>60?'...':''}`).join('<br>');
                    return `📢 <b>Son Duyuru:</b><br><b>${last.title}</b><br>${last.text}<br><br><b>Son 3 duyuru:</b><br>${all}`;
                }

                // Adminler kimler
                if(ql.includes('admin') || ql.includes('lider') || ql.includes('yönetici')) {
                    const admins = (db.users||[]).filter(u=>u.role==='admin');
                    if(!admins.length) return '👑 Admin bulunamadı.';
                    return `👑 <b>Adminler (${admins.length} kişi):</b><br>` + admins.map(a=>`• <b>${a.name}</b> — ${a.category}`).join('<br>');
                }

                // Ekip / kaç kişi
                if(ql.includes('ekip') || ql.includes('kaç kişi') || ql.includes('üye') || ql.includes('developer')) {
                    const devs = (db.users||[]).filter(u=>u.role==='dev');
                    const admins = (db.users||[]).filter(u=>u.role==='admin');
                    return `👥 <b>Ekip Durumu:</b><br>• Toplam: <b>${db.users?.length||0} kişi</b><br>• Admin: <b>${admins.length}</b><br>• Developer: <b>${devs.length}</b><br><br>` + (db.users||[]).map(u=>`${u.role==='admin'?'👑':'🔧'} ${u.name} — ${u.category}`).join('<br>');
                }

                // Görevlerim
                if(ql.includes('görev') && (ql.includes('benim') || ql.includes('lerim') || ql.includes('neler'))) {
                    const myTasks = (db.tasks||[]).filter(t=>t.assignee===me.username && t.status!=='İzinde');
                    if(!myTasks.length) return `📋 Şu an sana atanmış görev yok.`;
                    return `📋 <b>Görevlerin (${myTasks.length}):</b><br>` + myTasks.map(t=>{
                        const icon = t.status==='Onaylandı'?'✅':t.status==='Reddedildi'?'❌':t.status==='İnceleniyor'?'🔍':'⏳';
                        return `${icon} <b>${t.title}</b> — ${t.status}`;
                    }).join('<br>');
                }

                // Rapor / inceleme durumu
                if(ql.includes('rapor') || ql.includes('inceleme') || ql.includes('durum')) {
                    const myTasks = (db.tasks||[]).filter(t=>t.assignee===me.username);
                    const reviewing = myTasks.filter(t=>t.status==='İnceleniyor');
                    const approved = myTasks.filter(t=>t.status==='Onaylandı');
                    const rejected = myTasks.filter(t=>t.status==='Reddedildi');
                    return `📊 <b>Rapor Durumun:</b><br>🔍 İncelemede: <b>${reviewing.length}</b><br>✅ Onaylanan: <b>${approved.length}</b><br>❌ Reddedilen: <b>${rejected.length}</b><br>⏳ Aktif: <b>${myTasks.filter(t=>t.status==='Aktif').length}</b>`;
                }

                // Reddedilen
                if(ql.includes('reddedil') || ql.includes('red')) {
                    const rejected = (db.tasks||[]).filter(t=>t.assignee===me.username && t.status==='Reddedildi');
                    if(!rejected.length) return `✅ Reddedilen görevin yok, harika!`;
                    return `❌ <b>Reddedilen Görevler (${rejected.length}):</b><br>` + rejected.map(t=>{
                        const reason = t.description?.includes('[REJECT_REASON]') ? t.description.split('[REJECT_REASON]')[1].split('[END_REASON]')[0] : 'Sebep belirtilmemiş';
                        return `• <b>${t.title}</b><br>&nbsp;&nbsp;Sebep: ${reason}`;
                    }).join('<br>');
                }

                // İzin durumu
                if(ql.includes('izin') || ql.includes('tatil')) {
                    const myLeave = (db.tasks||[]).find(t=>t.assignee===me.username && t.status==='İzinde');
                    return myLeave ? `🏖️ Şu an izindesin! Detay: ${myLeave.description.split('[REPORT_START]')[0]}` : `💼 Şu an aktif olarak çalışıyorsun, izin statün yok.`;
                }

                // Toplam görev / istatistik
                if(ql.includes('istatistik') || ql.includes('kaç görev') || ql.includes('toplam')) {
                    const allTasks = db.tasks||[];
                    const active = allTasks.filter(t=>t.status==='Aktif').length;
                    const done = allTasks.filter(t=>t.status==='Onaylandı').length;
                    const review = allTasks.filter(t=>t.status==='İnceleniyor').length;
                    return `📈 <b>LSDT Genel İstatistik:</b><br>⏳ Aktif Görev: <b>${active}</b><br>🔍 İncelemede: <b>${review}</b><br>✅ Tamamlanan: <b>${done}</b><br>👥 Üye Sayısı: <b>${db.users?.length||0}</b><br>📢 Duyuru Sayısı: <b>${db.announcements?.length||0}</b>`;
                }

                // Profil / ben kimim
                if(ql.includes('ben kim') || ql.includes('profilim') || ql.includes('hesabım')) {
                    return `👤 <b>Profil Bilgin:</b><br>• Ad: <b>${me.name}</b><br>• Kullanıcı: <b>${me.username}</b><br>• Rol: <b>${me.category}</b><br>• Yetki: <b>${me.role==='admin'?'Admin 👑':'Developer 🔧'}</b>`;
                }

                // Deadline / yaklaşan
                if(ql.includes('deadline') || ql.includes('son teslim') || ql.includes('süre') || ql.includes('yaklaşan')) {
                    const tasks = (db.tasks||[]).filter(t=>t.assignee===me.username && t.deadline && t.status==='Aktif');
                    if(!tasks.length) return `⏰ Deadline'ı tanımlı aktif görevin yok.`;
                    const sorted = tasks.sort((a,b)=>new Date(a.deadline)-new Date(b.deadline));
                    return `⏰ <b>Yaklaşan Deadline'lar:</b><br>` + sorted.map(t=>{
                        const diff = Math.ceil((new Date(t.deadline)-new Date())/(1000*60*60*24));
                        const icon = diff<0?'🔴':diff<=2?'🟡':'🟢';
                        return `${icon} <b>${t.title}</b> — ${diff<0?`${Math.abs(diff)} gün gecikti!`:diff+' gün kaldı'}`;
                    }).join('<br>');
                }

                const fallbacks = [
                    `🤔 Bu konuda daha fazla bilgim yok. Şunları sorabilirsin: <b>son duyuru, adminler, görevlerim, rapor durumum, ekip kaç kişi, reddedilen görevler, deadline'larım.</b>`,
                    `💡 Anladığım konular: duyurular, ekip bilgisi, görev durumu, rapor inceleme, izin durumu. Hangisini merak ediyorsun?`,
                ];
                return fallbacks[Math.floor(Math.random()*fallbacks.length)];
            },

            checkNewAnns() {
                const lastSeen = parseInt(localStorage.getItem('lsdt_anns_seen') || '0');
                const newAnns = (app.db.announcements||[]).filter(a => new Date(a.created_at||a.date||0).getTime() > lastSeen);
                const dot = document.getElementById('ann-dot');
                if(dot) { dot.style.display = newAnns.length > 0 ? 'flex' : 'none'; if(newAnns.length>0) dot.textContent=newAnns.length; }
                if(newAnns.length > 0 && app._prevAnnCount !== undefined && (app.db.announcements||[]).length > app._prevAnnCount) {
                    const latest = newAnns[newAnns.length-1];
                    if(Notification.permission==='granted') { new Notification('📢 Yeni Duyuru — LSDT', { body: latest.title + ': ' + (latest.text||'').substring(0,60), icon:'https://cdn-icons-png.flaticon.com/512/3176/3176272.png' }); }
                    app.showMsgBanner(`📢 Yeni Duyuru: ${latest.title}`, 'Duyurular');
                }
                app._prevAnnCount = (app.db.announcements||[]).length;
            },

            show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); },
            open(id) { document.getElementById(id).classList.add('active'); },
            close() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); app.tempImages = []; document.getElementById('r-preview').innerHTML = ''; },
            
            setupStep(n) {
                document.querySelectorAll('.setup-step').forEach(s => s.classList.remove('active'));
                document.getElementById('setup-' + n).classList.add('active');
            },

            async enableNotif() {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    new Notification("LSDT v11.0", { body: "Bildirimler başarıyla aktif edildi!", icon: "https://img.icons8.com/fluency/48/lightning-bolt.png" });
                    app.toast('Bildirimler Aktif!');
                    app.setupStep(3);
                } else {
                    app.toast('Lütfen bildirim izni verin!', true);
                }
            },

            finishSetup() { localStorage.setItem('lsdt_setup', 'true'); app.show('login-screen'); },

            renderCats() {
                const countdownHtml = `<div style="background:var(--p-grad); border-radius:15px; padding:15px; margin-bottom:15px; text-align:center; box-shadow:0 10px 25px rgba(138,43,226,0.3);">
                    <div style="font-size:0.8rem; font-weight:800; opacity:0.9; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">🚀 Yeni Oyun Çıkışına Kalan Süre</div>
                    <div id="countdown-timer" style="font-size:2rem; font-weight:900; font-family:monospace; text-shadow:0 2px 10px rgba(0,0,0,0.5);">--:--:--:--</div>
                </div>`;
                const cats = ['Script','Modelleme','GUI Tasarımı','VFX','SFX','Admin','Bug Raporcusu'];
                const w = document.getElementById('d-cat-wrap'); if(!w) return; w.innerHTML = countdownHtml;
                cats.forEach(c => {
                    const o = document.createElement('div'); o.className = 'p-opt' + (c === app.sel.dCat ? ' active':'');
                    o.innerText = c; o.onclick = () => { app.sel.dCat = c; app.renderCats(); }; w.appendChild(o);
                });
            },

            async handleLogin(e) {
                e.preventDefault();
                const u = document.getElementById('l-user').value, p = document.getElementById('l-pass').value, rem = document.getElementById('l-rem').checked;
                const f = app.db.users.find(x => x.username === u && x.password === p);
                if(f) { if(rem) localStorage.setItem('lsdt_rem', JSON.stringify(f)); app.loginAs(f); } else app.toast('Hatalı!', true);
            },

            loginAs(u) {
                app.user = u;
                document.getElementById('welcome-screen').style.display = 'flex';
                document.getElementById('w-avatar').innerText = u.name[0];
                document.getElementById('w-title').innerText = "SELAM, " + u.name.split(' ')[0].toUpperCase();
                document.getElementById('w-sub').innerText = u.category;
                gsap.to("#w-content", { opacity: 1, scale: 1, duration: 0.8 });
                setTimeout(() => {
                    gsap.to("#welcome-screen", { opacity: 0, duration: 0.5, onComplete: () => {
                        document.getElementById('welcome-screen').style.display = 'none';
                        document.getElementById('welcome-screen').style.opacity = '1';
                        
                        const pfpMsg = (app.db.messages||[]).filter(m => m.sender === u.username && m.receiver === 'SYSTEM_PFP').pop();
                        if(pfpMsg) {
                            document.getElementById('avatar').innerHTML = `<img src="${pfpMsg.text}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
                        } else {
                            document.getElementById('avatar').innerText = u.name[0];
                        }
                        const savedBg = localStorage.getItem('lsdt_profile_bg_' + u.username);
                        if(savedBg) document.getElementById('avatar').style.background = savedBg;
                        const uLeave = app.db.tasks.some(t => t.assignee === u.username && t.status === 'İzinde');
                        const statusDot = `<div style="width:10px;height:10px;border-radius:50%;background:${uLeave?'var(--red)':'var(--green)'};display:inline-block;margin-right:6px;box-shadow:0 0 5px ${uLeave?'var(--red)':'var(--green)'};"></div>`;
                        document.getElementById('u-name').innerHTML = statusDot + u.name;
                        document.getElementById('u-role').innerText = u.category;
                        // AI FAB'u göster
                        const fab = document.getElementById('ai-fab');
                        if(fab) fab.style.display = 'flex';
                        app.startHeartbeat();
                        app.show('main-app'); app.nav('dash');
                    }});
                }, 2000);
            },

            nav(p) {
                const c = document.getElementById('page-content');
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                document.getElementById('nav-'+p).classList.add('active');
                if(p === 'dash') {
                    const myTasks = app.db.tasks.filter(t => t.assignee === app.user.username && (t.status === 'Aktif' || t.status === 'Reddedildi'));
                    const myLeave = app.db.tasks.find(t => t.assignee === app.user.username && t.status === 'İzinde');
                    c.innerHTML = `<div class="card" style="background:${myLeave ? 'var(--gold-grad)' : 'var(--p-grad)'};"><h1>${myLeave ? 'İzindesin' : 'LSDT Panel'}</h1><p>${myLeave ? myLeave.description.split('[REPORT_START]')[0] : app.user.category}</p></div>`;
                    if(app.user.role === 'admin') {
                        c.innerHTML += `<div class="action-grid">
                            <div class="action-card" onclick="app.open('modal-dev')"><i class="fas fa-user-plus"></i><span>Yeni Üye</span></div>
                            <div class="action-card" onclick="app.openTaskModal()"><i class="fas fa-tasks"></i><span>Görev Ver</span></div>
                            <div class="action-card" onclick="app.openLeaveModal()" style="color:var(--gold)"><i class="fas fa-bed"></i><span>İzin Tanımla</span></div>
                            <div class="action-card" onclick="app.nav('ann')"><i class="fas fa-comment-alt"></i><span>Duyuru At</span></div>
                        </div>`;
                    } else if(!myLeave) {
                        c.innerHTML += `<h3>Aktif Görevler</h3>`;
                        if(myTasks.length > 0) myTasks.forEach(t => {
                            let rej = (t.status === 'Reddedildi' && t.description.includes('[REJECT_REASON]')) ? `<div style="color:var(--red); padding:10px; background:rgba(255,118,117,0.1); border-radius:10px; margin:10px 0;"><b>RED:</b> ${t.description.split('[REJECT_REASON]')[1].split('[END_REASON]')[0]}</div>` : '';
                            c.innerHTML += `<div class="card"><div class="badge">${t.status}</div><h3>${t.title}</h3>${rej}<p>${t.description.split('[REPORT_START]')[0].split('[REJECT_REASON]')[0]}</p><button class="btn-p" style="margin-top:15px;" onclick="app.openReportModal('${t.id}', '${t.title.replace(/'/g, "\\'")}')">RAPOR GÖNDER</button></div>`;
                        });
                        else c.innerHTML += `<div class="card"><p>Atanmış görev yok.</p></div>`;
                    }
                } else if(p === 'tasks') {
                    app.sel.taskSearch = app.sel.taskSearch || '';
                    c.innerHTML = `<h2>${app.user.role === 'admin' ? 'Kayıt Denetimi' : 'Görevlerim'}</h2>
                        ${app.user.role === 'admin' ? `<button class="btn-p" style="margin-bottom:15px; background:var(--card); color:var(--text); border:1px solid rgba(255,255,255,0.1);" onclick="app.renderCalendar()"><i class="fas fa-calendar-alt"></i> Takvim & İzinleri Gör</button>` : ''}
                        <div style="position:relative;margin-bottom:15px;">
                            <i class="fas fa-search" style="position:absolute;left:18px;top:50%;transform:translateY(-50%);color:var(--sub);font-size:0.9rem;"></i>
                            <input id="task-search-input" class="input-p" style="padding-left:45px;margin-bottom:0;border-radius:20px;" placeholder="Görev ara..." value="${app.sel.taskSearch}" oninput="app.sel.taskSearch=this.value; app.renderTaskList()">
                        </div>`;
                    app.renderTaskList();
                } else if(p === 'ai') {
                    app._aiHistory = app._aiHistory || [];
                    c.innerHTML = `
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
                            <div style="width:46px;height:46px;background:var(--p-grad);border-radius:14px;display:flex;justify-content:center;align-items:center;font-size:1.4rem;">🤖</div>
                            <div><h2 style="margin:0;">LSDT AI Asistan</h2><p style="color:var(--sub);font-size:0.8rem;margin:2px 0 0;">Roblox & LSDT konularında yardımcı olurum</p></div>
                        </div>
                        <div id="ai-box" style="background:var(--glass);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:20px;min-height:300px;max-height:calc(100vh - 380px);overflow-y:auto;display:flex;flex-direction:column;gap:12px;margin-bottom:15px;">
                            <div class="ai-bubble bot">👋 Merhaba <b>${app.user.name}</b>! Ben LSDT AI Asistan. Roblox scripting, görev yönetimi, rapor yazımı ve daha fazlasında yardımcı olabilirim.</div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
                                <span class="ai-chip" onclick="app.aiAsk('Luau script nasıl yazılır?')">📜 Luau Script</span>
                                <span class="ai-chip" onclick="app.aiAsk('GUI tasarımı ipuçları')">🎨 GUI</span>
                                <span class="ai-chip" onclick="app.aiAsk('VFX efekti nasıl yapılır?')">✨ VFX</span>
                                <span class="ai-chip" onclick="app.aiAsk('Rapor nasıl yazılır?')">📋 Rapor Yaz</span>
                                <span class="ai-chip" onclick="app.aiAsk('3D modelleme ipuçları')">🧊 Modelleme</span>
                                <span class="ai-chip" onclick="app.aiAsk('RemoteEvent nasıl kullanılır?')">🔗 RemoteEvent</span>
                                <span class="ai-chip" onclick="app.aiAsk('DataStore nasıl kullanılır?')">💾 DataStore</span>
                                <span class="ai-chip" onclick="app.aiAsk('Tween animasyonu nasıl yapılır?')">🎞️ Tween</span>
                            </div>
                        </div>
                        <div style="display:flex;gap:10px;align-items:center;">
                            <input id="ai-input" class="input-p" style="margin-bottom:0;flex:1;border-radius:20px;padding:15px 20px;background:rgba(0,0,0,0.3);" placeholder="Bir şey sor..." onkeypress="if(event.key==='Enter') app.aiAsk()">
                            <button class="btn-p" style="width:52px;height:52px;border-radius:50%;padding:0;flex-shrink:0;display:flex;justify-content:center;align-items:center;" onclick="app.aiAsk()"><i class="fas fa-paper-plane"></i></button>
                        </div>`;
                    if(app._aiHistory.length > 0) {
                        const box = document.getElementById('ai-box');
                        app._aiHistory.forEach(h => { const d=document.createElement('div'); d.className=`ai-bubble ${h.role}`; d.innerHTML=h.text; box.appendChild(d); });
                        box.scrollTop = box.scrollHeight;
                    }
                } else if(p === 'ann') {
                    // Duyuru görüldü — dot sıfırla
                    localStorage.setItem('lsdt_anns_seen', Date.now().toString());
                    const annDot = document.getElementById('ann-dot');
                    if(annDot) { annDot.style.display = 'none'; annDot.textContent = ''; }
                    c.innerHTML = `<h2>Duyurular</h2>
                        <input type="text" id="ann-search" class="input-p" placeholder="🔍 Duyuru Ara..." onkeyup="app.renderAnns()" style="margin-bottom:15px; padding:12px 15px;">
                        ${app.user.role==='admin'?`<div class="card"><input id="an-title" class="input-p" placeholder="Başlık"><textarea id="an-text" class="input-p" placeholder="Mesaj"></textarea>
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:15px;color:var(--sub);font-size:0.85rem;cursor:pointer;"><input type="checkbox" id="an-pin"> 📌 Başa Tuttur (Sabitle)</label>
                        <button class="btn-p" onclick="app.handleNewAnn()">YAYINLA</button></div>`:''}
                        <div id="ann-list"></div>`;
                    app.renderAnns();
                } else if(p === 'admin') {
                    // Admin sekmesi açılınca okundu olarak işaretle
                    localStorage.setItem('lsdt_msgs_seen', Date.now().toString());
                    app.checkNewMsgs();
                    c.innerHTML = `<h2>İletişim & Destek</h2>`;
                    if(!app.sel.chatTarget) {
                        const targets = app.user.role === 'admin' ? app.db.users.filter(u => u.username !== app.user.username) : app.db.users.filter(u => u.role === 'admin');
                        
                        c.innerHTML += `<div class="card" style="padding:0; overflow:hidden; background:rgba(0,0,0,0.2);">
                            <div style="padding:20px; background:var(--glass); border-bottom:1px solid rgba(255,255,255,0.05);">
                                <div style="display:flex;justify-content:space-between;align-items:center;">
                                    <h3 style="margin:0; font-size:1.1rem; color:white;"><i class="fas fa-users" style="color:var(--p); margin-right:10px;"></i>Kişiler</h3>
                                    ${app.user.role==='admin'?`<div style="display:flex;gap:8px;">
                                        <button class="btn-mini" style="background:linear-gradient(135deg,#e17055,#d63031);color:white;padding:6px 12px;border-radius:10px;" onclick="app.openBroadcastModal()"><i class="fas fa-broadcast-tower"></i> Toplu</button>
                                        <button class="btn-mini" style="background:var(--glass);color:var(--p);padding:6px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);" onclick="app.openChannelModal()"><i class="fas fa-plus"></i> Kanal</button>
                                        <button class="btn-mini" style="background:var(--glass);color:var(--gold);padding:6px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);" onclick="app.showStarred()">⭐</button>
                                    </div>`:''}
                                </div>
                            </div>
                            <div style="padding:10px;">
                                ${targets.map(u => {
                                    // Son görülme: o kullanıcıyla son mesaj zamanı
                                    const conv = (app.db.messages || []).filter(m =>
                                        (m.sender === u.username && m.receiver === app.user.username) ||
                                        (m.sender === app.user.username && m.receiver === u.username)
                                    );
                                    const lastMsg = conv.length ? conv[conv.length - 1] : null;
                                    const unreadCount = (app.db.messages || []).filter(m => m.sender === u.username && m.receiver === app.user.username && new Date(m.date).getTime() > parseInt(localStorage.getItem('lsdt_msgs_seen') || '0')).length;
                                    let lastSeenStr = u.category;
                                    if(lastMsg) {
                                        const d = new Date(lastMsg.date);
                                        const now = new Date();
                                        const diffMin = Math.floor((now - d) / 60000);
                                        if(diffMin < 1) lastSeenStr = '🟢 Az önce';
                                        else if(diffMin < 60) lastSeenStr = `🟡 ${diffMin} dk önce`;
                                        else if(diffMin < 1440) lastSeenStr = `⚪ ${Math.floor(diffMin/60)} saat önce`;
                                        else lastSeenStr = `⚪ ${Math.floor(diffMin/1440)} gün önce`;
                                    }
                                    const pfpMsg = (app.db.messages||[]).filter(m => m.sender === u.username && m.receiver === 'SYSTEM_PFP').pop();
                                    const avatarHtml = pfpMsg ? `<img src="${pfpMsg.text}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : u.name[0];
                                    return `<div class="chat-user-item" onclick="app.sel.chatTarget='${u.username}'; app.nav('admin')">
                                        <div style="position:relative; width:48px; height:48px;">
                                            <div style="width:100%; height:100%; background:var(--p-grad); border-radius:50%; display:flex; justify-content:center; align-items:center; font-weight:900; font-size:1.2rem; overflow:hidden;">${avatarHtml}</div>
                                            ${unreadCount > 0 ? `<div style="position:absolute;top:-4px;right:-4px;background:var(--red);color:white;border-radius:50%;width:18px;height:18px;font-size:0.65rem;font-weight:900;display:flex;justify-content:center;align-items:center;z-index:2;">${unreadCount}</div>` : ''}
                                        </div>
                                        <div style="flex:1;">
                                            <div style="font-weight:900; font-size:1rem;">${u.name}</div>
                                            <div style="font-size:0.78rem; color:var(--sub); margin-top:2px;">${lastSeenStr}</div>
                                        </div>
                                        <i class="fas fa-chevron-right" style="color:var(--p); opacity:0.5;"></i>
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>`;
                        
                        if(channels.length > 0) {
                            c.innerHTML += `<div class="card" style="padding:0; overflow:hidden; background:rgba(0,0,0,0.2); margin-top:15px;">
                                <div style="padding:15px 20px; background:var(--glass); border-bottom:1px solid rgba(255,255,255,0.05);">
                                    <h3 style="margin:0; font-size:1rem; color:white;"><i class="fas fa-hashtag" style="color:var(--p); margin-right:10px;"></i>Kanallar</h3>
                                </div>
                                <div style="padding:10px;">
                                    ${channels.map(ch => {
                                        let iconHtml = '<i class="fas fa-hashtag"></i>';
                                        if(ch.icon) iconHtml = `<i class="fas fa-${ch.icon}"></i>`;
                                        return `<div class="chat-user-item" onclick="app.sel.chatTarget='CHANNEL_${ch.name}'; app.nav('admin')">
                                            <div style="width:40px; height:40px; background:var(--p-grad); border-radius:12px; display:flex; justify-content:center; align-items:center; font-size:1.1rem; color:white;">${iconHtml}</div>
                                            <div style="flex:1;"><div style="font-weight:900; font-size:1rem;">#${ch.name}</div><div style="font-size:0.75rem; color:var(--sub); margin-top:2px;">Oluşturan: ${ch.creator}</div></div>
                                            <i class="fas fa-chevron-right" style="color:var(--p); opacity:0.5;"></i>
                                        </div>`;
                                    }).join('')}
                                </div>
                            </div>`;
                        }
                    } else {
                        const targetUser = app.db.users.find(u => u.username === app.sel.chatTarget);
                        c.innerHTML += `
                        <div class="card" style="padding:0; overflow:hidden; display:flex; flex-direction:column; height: calc(100vh - 210px);">
                            <div style="padding:15px 20px; background:var(--glass); display:flex; align-items:center; gap:15px; border-bottom:1px solid rgba(255,255,255,0.05);">
                                <i class="fas fa-arrow-left" style="cursor:pointer; font-size:1.2rem; color:white;" onclick="app.sel.chatTarget=null; app.nav('admin')"></i>
                                <div style="width:40px; height:40px; background:var(--p-grad); border-radius:50%; display:flex; justify-content:center; align-items:center; font-weight:900; overflow:hidden;">${(() => {
                                    const pfpMsg = (app.db.messages||[]).filter(m => m.sender === targetUser?.username && m.receiver === 'SYSTEM_PFP').pop();
                                    return pfpMsg ? `<img src="${pfpMsg.text}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : (targetUser?.name[0] || '?');
                                })()}</div>
                                <div style="flex:1;">
                                    <div style="font-weight:900; font-size:1.1rem;">${targetUser?.name || 'Bilinmeyen'}</div>
                                    <div style="font-size:0.75rem; color:${app.isOnline(app.sel.chatTarget)?'var(--green)':'var(--sub)'}">${app.isOnline(app.sel.chatTarget)?'\u26ab\ufe0f Çevrimiçi':'\u26aa Çevrimdışı'}</div>
                                </div>
                                <button onclick="app.startCall('${targetUser?.username}')" class="msg-act-btn" style="background:rgba(85,239,196,0.15); color:var(--green); border-radius:50%; width:36px; height:36px; font-size:1.1rem; box-shadow:0 0 10px rgba(85,239,196,0.2);" title="Sesli Ara"><i class="fas fa-phone-alt"></i></button>
                                <button class="msg-act-btn" style="font-size:1rem;" onclick="app.showStarred()" title="Yıldızlı Mesajlar">⭐</button>
                            </div>
                            <div class="chat-search-bar"><input placeholder="🔍 Mesajlarda ara..." oninput="app.searchMessages(this.value)"></div>
                            <div class="pinned-bar" id="pinned-msg-bar"><i class="fas fa-thumbtack" style="color:var(--p);"></i><span class="pinned-bar-text" id="pinned-bar-text"></span><button style="background:none;border:none;color:var(--sub);cursor:pointer;font-size:0.8rem;" onclick="app.unpinMessage()">✕</button></div>
                            <div class="typing-ind" id="typing-indicator"><span></span><span></span><span></span></div>
                            <div class="chat-messages" id="chat-box" style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:15px; background:rgba(0,0,0,0.15);"></div>
                            <div id="reply-preview-bar" style="display:none; padding:8px 12px; background:rgba(0,0,0,0.3); border-left:3px solid var(--p); font-size:0.8rem; color:var(--sub); margin:0 15px 5px; border-radius:8px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div><i class="fas fa-reply" style="color:var(--p);margin-right:6px;"></i><span id="reply-preview-text">...</span></div>
                                    <i class="fas fa-times" style="cursor:pointer;color:var(--red);" onclick="app.cancelReply()"></i>
                                </div>
                            </div>
                            <div id="quick-replies-wrap" class="quick-replies-wrap">
                                <button class="p-opt" style="padding:4px 10px;margin:0;white-space:nowrap;font-size:0.75rem;" onclick="document.getElementById('msg-input').value='Tamamdır 👍';app.sendMsg()">Tamamdır 👍</button>
                                <button class="p-opt" style="padding:4px 10px;margin:0;white-space:nowrap;font-size:0.75rem;" onclick="document.getElementById('msg-input').value='İnceliyorum 🧐';app.sendMsg()">İnceliyorum 🧐</button>
                                <button class="p-opt" style="padding:4px 10px;margin:0;white-space:nowrap;font-size:0.75rem;" onclick="document.getElementById('msg-input').value='Harika! 🎉';app.sendMsg()">Harika! 🎉</button>
                                <button class="p-opt" style="padding:4px 10px;margin:0;white-space:nowrap;font-size:0.75rem;" onclick="document.getElementById('msg-input').value='Sorun çözüldü ✅';app.sendMsg()">Sorun çözüldü ✅</button>
                            </div>
                            <div style="padding:15px; background:rgba(255,255,255,0.02); border-top:1px solid rgba(255,255,255,0.05); display:flex; gap:10px; align-items:center;">
                                <input type="file" id="msg-img-input" accept="*/*" style="display:none;" onchange="app.sendFileMsg(this)">
                                <button class="btn-p" style="width:44px;height:44px;border-radius:50%;display:flex;justify-content:center;align-items:center;padding:0;flex-shrink:0;background:rgba(255,255,255,0.08);" onclick="document.getElementById('msg-img-input').click()" title="Dosya / Resim"><i class="fas fa-paperclip" style="font-size:1rem;"></i></button>
                                <button id="voice-btn" class="btn-p" style="width:44px;height:44px;border-radius:50%;display:flex;justify-content:center;align-items:center;padding:0;flex-shrink:0;background:rgba(255,255,255,0.08);" onclick="app.startVoiceNote()" title="Sesli Not"><i class="fas fa-microphone" style="font-size:1rem;"></i></button>
                                <button class="btn-p" style="width:44px;height:44px;border-radius:50%;display:flex;justify-content:center;align-items:center;padding:0;flex-shrink:0;background:rgba(255,255,255,0.08);" id="ghost-toggle-btn" onclick="app.toggleGhost()" title="Kaybolan Mesaj"><i class="fas fa-ghost" style="font-size:1rem;color:var(--sub)"></i></button>
                                <input id="msg-input" class="input-p" style="margin-bottom:0; flex:1; border-radius:20px; padding:15px 20px; background:rgba(0,0,0,0.3);" placeholder="Mesaj (Sessiz için Shift+Enter)" oninput="app.sendTypingPing()" onkeypress="if(event.key==='Enter') { if(event.shiftKey) app.sel.isSilent=true; app.sendMsg(); }">
                                <button id="msg-send-btn" class="btn-p" style="width:55px; height:55px; border-radius:50%; display:flex; justify-content:center; align-items:center; padding:0; flex-shrink:0;" onclick="app.sendMsg()"><i class="fas fa-paper-plane" style="font-size:1.2rem; margin-left:-3px;"></i></button>
                            </div>
                        </div>`;
                        setTimeout(() => app.renderChat(), 50);

                    }
                } else if(p === 'studios' || p === 'projects') {
                    c.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2 style="margin:0;">🎬 Studios</h2>${app.user.role==='admin'?`<button class="btn-p" style="width:auto;padding:12px 20px;font-size:0.85rem;" onclick="app.openStudioModal()"><i class="fas fa-plus"></i> Yeni Proje</button>`:''}</div><div id="studios-list"></div>`;
                    app.renderStudios();
                } else if(p === 'set') {
                    const myTasks = app.db.tasks.filter(t => t.assignee === app.user.username);
                    const activeTasks = myTasks.filter(t => t.status === 'active' || t.status === 'pending').length;
                    const doneTasks = myTasks.filter(t => t.status === 'done' || t.status === 'completed').length;
                    const myPts = app.user.points || 0;
                    const myMsgs = (app.db.messages || []).filter(m => m.sender === app.user.username || m.receiver === app.user.username).length;
                    c.innerHTML = `
                        <div class="card" style="text-align:center; padding-bottom:10px;">
                            <div style="width:72px;height:72px;background:var(--p-grad);border-radius:50%;display:flex;justify-content:center;align-items:center;font-size:2rem;font-weight:900;margin:0 auto 12px;overflow:hidden;">${(() => {
                                const pfpMsg = (app.db.messages||[]).filter(m => m.sender === app.user.username && m.receiver === 'SYSTEM_PFP').pop();
                                return pfpMsg ? `<img src="${pfpMsg.text}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : app.user.name[0];
                            })()}</div>
                            <h2 style="margin:0;">${app.user.name}</h2>
                            <p style="color:var(--sub);margin:4px 0 0;">${app.user.category}</p>
                        </div>

                        <div class="stat-grid">
                            <div class="stat-card red" style="grid-column: span 2;">
                                <span class="stat-num" style="color:var(--red); font-size:1.5rem;">${myMsgs}</span>
                                <span class="stat-label">💬 Toplam Mesajlaşma</span>
                            </div>
                        </div>

                        <div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                            <div>
                                <b style="font-size:0.95rem;">🎨 Tema Görünümü</b>
                                <p style="font-size:0.75rem;color:var(--sub);margin:4px 0 0;">Aydınlık veya Karanlık Mod</p>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="theme-toggle" ${document.body.classList.contains('light-mode') ? 'checked' : ''} onchange="app.toggleTheme(this.checked)">
                                <span class="slider round"></span>
                            </label>
                        </div>

                        <div class="card" style="margin-bottom:20px;">
                            <h3 style="margin-top:0;">Özelleştirilebilir Profil</h3>
                            <label style="font-size:0.8rem;color:var(--sub);display:block;margin-bottom:5px;">Avatar Arka Plan Rengi</label>
                            <input type="color" id="profile-bg-input" value="${localStorage.getItem('lsdt_profile_bg_' + app.user.username) || '#8a2be2'}" style="width:100%;height:40px;border:none;border-radius:10px;margin-bottom:15px;background:none;cursor:pointer;" onchange="app.saveProfileSettings()">
                            <label style="font-size:0.8rem;color:var(--sub);display:block;margin-bottom:5px;">Profil Resmi (Sadece Görsel Yükleyin)</label>
                            <div class="img-picker" onclick="document.getElementById('profile-pfp-input').click()" style="margin-bottom:10px;"><i class="fas fa-camera"></i> FOTOĞRAF SEÇ / DEĞİŞTİR</div>
                            <input type="file" id="profile-pfp-input" accept="image/*" style="display:none;" onchange="app.uploadProfilePic(this)">
                            <button class="btn-p" style="margin:0;" onclick="app.saveProfileSettings()">RENGİ KAYDET</button>
                        </div>

                        <div class="card" style="margin-bottom:20px;">
                            <h3 style="margin-top:0;">⚡ UI/UX & Deneyim (81-90)</h3>
                            <div class="view-toggle-bar" style="flex-wrap:wrap; gap:10px;">
                                <button class="view-toggle-btn ${document.body.classList.contains('focus-mode')?'active':''}" onclick="app.toggleUI('focus-mode');app.nav('set')">🎯 Odak Modu</button>
                                <button class="view-toggle-btn ${document.body.classList.contains('zen-mode')?'active':''}" onclick="app.toggleUI('zen-mode');app.nav('set')">🧘 Zen Modu</button>
                                <button class="view-toggle-btn ${document.body.classList.contains('dynamic-bg')?'active':''}" onclick="app.toggleUI('dynamic-bg');app.nav('set')">🌌 Dinamik Arkaplan</button>
                                <button class="view-toggle-btn ${document.body.classList.contains('deep-glass')?'active':''}" onclick="app.toggleUI('deep-glass');app.nav('set')">🧊 Derin Glassmorphism</button>
                                <button class="view-toggle-btn ${document.body.classList.contains('neon-mode')?'active':''}" onclick="app.toggleUI('neon-mode');app.nav('set')">🚀 Neon Modu</button>
                                <button class="view-toggle-btn ${document.body.classList.contains('scroll-prog-mode')?'active':''}" onclick="app.toggleUI('scroll-prog-mode');app.nav('set')">📏 Scroll İlerleyişi</button>
                                <button class="view-toggle-btn ${document.body.classList.contains('particles-mode')?'active':''}" onclick="app.toggleUI('particles-mode');app.nav('set')">✨ Yüzen Parçacıklar</button>
                            </div>
                        </div>

                        <div class="card" style="margin-bottom:20px;">
                            <h3 style="margin-top:0;">💬 Özel Durum Mesajı (80)</h3>
                            <p style="color:var(--sub);font-size:0.82rem;margin-bottom:10px;">Şu anki durum: <b style="color:var(--green);">${app.getStatus(app.user.username)||'Ayarlanmamış'}</b></p>
                            <button class="btn-p" style="padding:12px;" onclick="app.open('modal-status');document.getElementById('status-input').value=app.getStatus(app.user.username);">DURUMU DÜZENLE</button>
                        </div>

                        <div class="card" style="margin-bottom:20px;">
                            <h3 style="margin-top:0;">🎨 Tema Paketi (69)</h3>
                            <div style="display:flex;flex-wrap:wrap;gap:8px;">
                                ${[['Varsayılan',''],['Okyanus','ocean'],['Ateş','fire'],['Matrix','matrix'],['Altın','gold']].map(([l,v])=>`<button class="btn-mini" style="background:var(--p-grad);color:white;" onclick="app.applyTheme('${v}')">${l}</button>`).join('')}
                            </div>
                        </div>

                        <div class="card" style="margin-bottom:20px;">
                            <h3 style="margin-top:0;">⚡ Görünüm & Erişilebilirlik</h3>
                            <div class="view-toggle-bar">
                                <button class="view-toggle-btn ${localStorage.getItem('lsdt_view_mode')!=='list'?'active':''}" onclick="app.setViewMode('card');app.nav('set')">🃏 Kart</button>
                                <button class="view-toggle-btn ${localStorage.getItem('lsdt_view_mode')==='list'?'active':''}" onclick="app.setViewMode('list');app.nav('set')">☰ Liste</button>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                                <span style="font-size:0.88rem;">🔲 Yüksek Kontrast (79)</span>
                                <label class="switch"><input type="checkbox" ${localStorage.getItem('lsdt_hc')==='1'?'checked':''} onchange="app.toggleHighContrast(this.checked)"><span class="slider round"></span></label>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                                <span style="font-size:0.88rem;">🔔 Bildirim Sesi (74)</span>
                                <label class="switch"><input type="checkbox" ${localStorage.getItem('lsdt_sound')!=='off'?'checked':''} onchange="app.toggleSound(this.checked)"><span class="slider round"></span></label>
                            </div>
                            <label style="font-size:0.82rem;color:var(--sub);display:block;margin-bottom:6px;">👁️ Renk Körlüğü Modu (78)</label>
                            <select style="width:100%;background:rgba(255,255,255,0.1);color:white;border-radius:20px;padding:12px;border:none;font-family:'Outfit',sans-serif;" onchange="app.setColorblind(this.value)">
                                <option value="none" ${!localStorage.getItem('lsdt_cb')||localStorage.getItem('lsdt_cb')==='none'?'selected':''}>Normal</option>
                                <option value="protanopia" ${localStorage.getItem('lsdt_cb')==='protanopia'?'selected':''}>Protanopia (Kırmızı körlüğü)</option>
                                <option value="deuteranopia" ${localStorage.getItem('lsdt_cb')==='deuteranopia'?'selected':''}>Deuteranopia (Yeşil körlüğü)</option>
                                <option value="tritanopia" ${localStorage.getItem('lsdt_cb')==='tritanopia'?'selected':''}>Tritanopia (Mavi körlüğü)</option>
                            </select>
                            <label style="font-size:0.82rem;color:var(--sub);display:block;margin:10px 0 6px;">✍️ Font Boyutu (72)</label>
                            <div style="display:flex;gap:8px;">
                                ${[['Normal',''],['Büyük','font-lg'],['Çok Büyük','font-xl']].map(([l,v])=>`<button class="btn-mini" style="background:var(--glass);color:white;flex:1;" onclick="document.body.classList.remove('font-lg','font-xl');if('${v}')document.body.classList.add('${v}');localStorage.setItem('lsdt_font','${v}')">${l}</button>`).join('')}
                            </div>
                        </div>


                        <div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                            <div>
                                <b style="font-size:0.95rem;">🔔 Bildirimler</b>
                                <p style="font-size:0.75rem;color:var(--sub);margin:4px 0 0;">Yeni mesajlarda uyarı al</p>
                            </div>
                            <button class="btn-p" style="padding:10px 18px;font-size:0.8rem;margin:0;" onclick="app.enableNotif()">AKTİF ET</button>
                        </div>

                        <button class="btn-p" style="background:var(--red); margin-bottom:20px;" onclick="app.logout()">GÜVENLİ ÇIKIŞ</button>

                        ${app.user.role === 'admin' ? `
                            <div class="card" style="background:rgba(255,43,226,0.1); border:1px solid var(--p); margin-bottom:20px; text-align:left;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <b>GÜNCELLEME SİSTEMİ (UPDATE)</b>
                                    <label class="switch">
                                        <input type="checkbox" id="update-toggle" ${app.getUpdateStatus() ? 'checked' : ''} onchange="app.toggleUpdate(this.checked)">
                                        <span class="slider round"></span>
                                    </label>
                                </div>
                                <input id="update-url-input" class="input-p" style="margin-top:10px; margin-bottom:0; font-size:0.8rem;" placeholder="İndirme Linki" value="${app.getUpdateLink()}">
                                <button class="btn-p" onclick="app.saveUpdateUrl()" style="margin-top:10px; padding:5px; font-size:0.7rem;">LİNKİ KAYDET VE GÜNCELLE</button>
                            </div>
                            <h3 style="margin-bottom:15px;">Ekip Yönetimi</h3>
                        ` : ''}
                    `;
                    if(app.user.role==='admin') {
                        app.db.users.forEach(u => { c.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><span>${u.name} (${u.category})</span>${u.username!==app.user.username?`<i class="fas fa-trash del-btn" style="position:static" onclick="app.delItem('users', '${u.id}')"></i>`:''}</div>`; });
                    }
                }
            },

            toggleImgs(id) { const d = document.getElementById(`imgs-${id}`); d.style.display = d.style.display==='none'?'grid':'none'; },
            viewImg(src) { const w = window.open(""); w.document.write(`<img src="${src}" style="width:100%">`); },
            handleFiles(i) {
                const p = document.getElementById('r-preview'); p.innerHTML = ''; app.tempImages = [];
                Array.from(i.files).forEach(f => {
                    const r = new FileReader(); r.onload = (e) => { app.tempImages.push(e.target.result); const im = document.createElement('img'); im.src=e.target.result; im.className='img-item'; p.appendChild(im); }; r.readAsDataURL(f);
                });
            },

            openTaskModal() {
                const w = document.getElementById('t-to-wrap'); w.innerHTML = '';
                app.db.users.forEach(u => { const o = document.createElement('div'); o.className = 'p-opt'+(u.username===app.sel.tTo?' active':''); o.innerText=u.name; o.onclick=()=>{app.sel.tTo=u.username; app.openTaskModal();}; w.appendChild(o); });
                app.open('modal-task');
            },

            openLeaveModal() {
                const w = document.getElementById('l-to-wrap'); w.innerHTML = '';
                app.db.users.forEach(u => { const o = document.createElement('div'); o.className = 'p-opt'+(u.username===app.sel.lTo?' active':''); o.innerText=u.name; o.onclick=()=>{app.sel.lTo=u.username; app.openLeaveModal();}; w.appendChild(o); });
                app.open('modal-leave');
            },

            openReportModal(id, title) { document.getElementById('r-task-id').value = id; document.getElementById('r-task-title').innerText = title; app.open('modal-report'); },
            openRejectModal(id) { app.sel.rejId = id; document.getElementById('rej-reason').value = ''; app.open('modal-reject'); },

            async handleNewDev(e) {
                e.preventDefault();
                const u = { name: document.getElementById('d-name').value, username: document.getElementById('d-user').value, password: document.getElementById('d-pass').value, role: app.sel.dCat==='Admin'?'admin':'dev', category: app.sel.dCat };
                const r = await fetch(`${RENDER_URL}/api/users`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(u)});
                if(r.ok) { app.toast('Eklendi'); app.close(); await app.sync(); app.nav('set'); } else app.toast('Hata: ' + (await r.json()).error, true);
            },

            async handleNewTask(e) {
                e.preventDefault(); if(!app.sel.tTo) return app.toast('Kişi seç!', true);
                const deadline = document.getElementById('t-deadline').value;
                const dlTag = deadline ? `\n\n[DEADLINE: ${deadline}]` : '';
                const t = { assignee: app.sel.tTo, title: document.getElementById('t-title').value, description: document.getElementById('t-desc').value + dlTag + `\n\n[ADMIN: ${app.user.name}]`, status: 'Aktif', date: new Date().toISOString() };
                const r = await fetch(`${RENDER_URL}/api/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(t)});
                if(r.ok) { app.toast('Atandı'); app.close(); await app.sync(); app.nav('tasks'); } else app.toast('Hata: ' + (await r.json()).error, true);
            },

            async handleNewLeave(e) {
                e.preventDefault(); if(!app.sel.lTo) return app.toast('Kişi seç!', true);
                const l = { assignee: app.sel.lTo, title: 'İZİN', description: `${document.getElementById('l-days').value} Günlük İzin Onaylandı. Gerekçe: ${document.getElementById('l-reason').value}`, status: 'İzinde', date: new Date().toISOString() };
                const r = await fetch(`${RENDER_URL}/api/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(l)});
                if(r.ok) { app.toast('İzin verildi'); app.close(); await app.sync(); app.nav('tasks'); } else app.toast('Hata: ' + (await r.json()).error, true);
            },

            async handleNewReport(e) {
                e.preventDefault();
                const tid = document.getElementById('r-task-id').value;
                const t = app.db.tasks.find(x => x.id == tid);
                if(!t) return app.toast('Görev bulunamadı', true);
                
                const d = { report: document.getElementById('r-text').value, bug: document.getElementById('r-bug').value, link: document.getElementById('r-link').value, imgs: app.tempImages };
                const ut = { 
                    id: tid, 
                    status: 'İnceleniyor', 
                    description: t.description.split('[REPORT_START]')[0].split('[REJECT_REASON]')[0].trim() + `\n\n[REPORT_START]${JSON.stringify(d)}[REPORT_END]` 
                };

                const r = await fetch(`${RENDER_URL}/api/tasks`, { 
                    method:'POST', 
                    headers:{'Content-Type':'application/json'}, 
                    body:JSON.stringify(ut)
                });
                
                if(r.ok) { 
                    app.toast('Rapor Gönderildi'); 
                    app.close(); 
                    await app.sync(); 
                    app.nav('dash'); 
                } else {
                    app.toast('Gönderim Hatası', true);
                }
            },

            async updateTaskStatus(id, s) {
                const t = app.db.tasks.find(x => x.id == id);
                let updatePayload = { id: id, status: s };
                if (s === 'Onaylandı') {
                    const start = new Date(t.created_at || t.date).getTime();
                    const hours = Math.floor((Date.now() - start) / (1000 * 60 * 60));
                    const mins = Math.floor((Date.now() - start) / (1000 * 60)) % 60;
                    if(!t.description.includes('[TIME_SPENT:')) {
                        updatePayload.description = t.description + `\n\n[TIME_SPENT: ${hours} Saat ${mins} Dakika]`;
                    }
                }
                const r = await fetch(`${RENDER_URL}/api/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(updatePayload)});
                if(r.ok) { app.toast('Güncellendi'); await app.sync(); app.nav('tasks'); } else app.toast('Hata: ' + (await r.json()).error, true);
            },

            async confirmReject() {
                const rMsg = document.getElementById('rej-reason').value; if(!rMsg) return app.toast('Sebep yaz!', true);
                const t = app.db.tasks.find(x => x.id == app.sel.rejId);
                const ut = { id: app.sel.rejId, status: 'Reddedildi', description: t.description.split('[REPORT_START]')[0].split('[REJECT_REASON]')[0] + `\n\n[REJECT_REASON]${rMsg}[END_REASON]` };
                const re = await fetch(`${RENDER_URL}/api/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(ut)});
                if(re.ok) { app.toast('Reddedildi'); app.close(); await app.sync(); app.nav('tasks'); } else app.toast('Hata!', true);
            },

            async handleNewAnn() {
                const isPinned = document.getElementById('an-pin')?.checked;
                let title = document.getElementById('an-title').value, text = document.getElementById('an-text').value;
                if(!title || !text) return app.toast('Boş bırakma!', true);
                if(isPinned) title = '📌 ' + title;
                const r = await fetch(`${RENDER_URL}/api/announcements`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ title, text })});
                if(r.ok) { app.toast('Yayınlandı'); await app.sync(); app.nav('ann'); } else app.toast('Hata!', true);
            },

            async delItem(table, id) {
                if(confirm('Silmek istediğinize emin misiniz?')) {
                    const r = await fetch(`${RENDER_URL}/api/${table}/${id}`, {method:'DELETE'});
                    if(r.ok) { app.toast('Silindi'); await app.sync(); app.nav(table === 'users' ? 'set' : (table === 'tasks' ? 'tasks' : 'ann')); } else app.toast('Hata: ' + (await r.json()).error, true);
                }
            },

            logout() { localStorage.removeItem('lsdt_rem'); location.reload(); },
            
            renderChat() {
                const box = document.getElementById('chat-box'); if(!box) return;
                const msgs = (app.db.messages || []).filter(m => (m.sender === app.user.username && m.receiver === app.sel.chatTarget) || (m.sender === app.sel.chatTarget && m.receiver === app.user.username));
                const lastSeen = parseInt(localStorage.getItem('lsdt_msgs_seen') || '0');
                const stars = JSON.parse(localStorage.getItem('lsdt_stars')||'[]').map(s=>s.id);
                const pinned = JSON.parse(localStorage.getItem(`lsdt_pin_${app.sel.chatTarget}_${app.user.username}`)||'null');
                // Sabitlenmiş mesaj barı
                const pinnedBar=document.getElementById('pinned-msg-bar');
                const pinnedText=document.getElementById('pinned-bar-text');
                if(pinnedBar&&pinnedText&&pinned) { pinnedBar.classList.add('show'); pinnedText.textContent='📌 '+pinned.text; }
                else if(pinnedBar) pinnedBar.classList.remove('show');
                const atBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 50;
                box.innerHTML = msgs.map(m => {
                    const isMe = m.sender === app.user.username;
                    const senderName = isMe ? 'Siz' : (app.db.users.find(x=>x.username===m.sender)?.name || m.sender);
                    const timeStr = m.date ? new Date(m.date).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : '';
                    const isRead = isMe && new Date(m.date).getTime() <= lastSeen;
                    const tick = isMe ? `<span class="msg-tick ${isRead?'read':''}"><i class="fas fa-check-double"></i></span>` : '';
                    const isImage = m.text && m.text.startsWith('data:image');
                    const isFile = m.text && m.text.startsWith('data:application');
                    const isVoice = m.text && m.text.startsWith('[VOICE:');
                    const msgId = m.id || ('m'+m.date);
                    const isStarred = stars.includes(String(msgId));
                    let safeText = (m.text||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
                    
                    let replyBlock = '';
                    if(safeText.startsWith('[REPLY:')) {
                        const endIdx = safeText.indexOf(']');
                        if(endIdx !== -1) {
                            const rId = safeText.substring(7, endIdx);
                            safeText = safeText.substring(endIdx+1).trim();
                            const rMsg = app.db.messages.find(x => x.id === rId);
                            if(rMsg) replyBlock = `<div class="msg-reply-preview"><i class="fas fa-reply"></i> ${(rMsg.text||'').replace(/\[.*?\]/g,'').substring(0,40)}...</div>`;
                        }
                    }

                    let isGhost = false;
                    if(safeText.startsWith('[GHOST] ')) {
                        isGhost = true;
                        safeText = safeText.substring(8).trim();
                        if(isRead && !isMe && new Date().getTime() - lastSeen > 15000) {
                            safeText = `<span class="msg-ghost">👻 Bu mesaj kayboldu.</span>`;
                        } else if(!isMe) { setTimeout(() => app.renderChat(), 15000); }
                    }
                    
                    let isSilent = false;
                    if(safeText.startsWith('[SILENT] ')) {
                        isSilent = true;
                        safeText = safeText.substring(9).trim();
                    }

                    let content;
                    const isEmoji = /^(\p{Emoji}|\s)+$/u.test(safeText) && safeText.replace(/\s/g,'').length <= 3;
                    const is3DModel = safeText.match(/https?:\/\/.*?\.(glb|gltf|obj)/i);
                    const isCall = safeText.startsWith('[CALL_INVITE:');

                    if(isVoice) { const src=m.text.slice(7,-1); content=`${replyBlock}<audio controls src="${src}" style="max-width:200px;margin-top:6px;"></audio>`; }
                    else if(isImage) { content=`${replyBlock}<img class="msg-img" src="${m.text}" onclick="app.viewImg('${m.text}')" />`; }
                    else if(isFile) { content=`${replyBlock}<a href="${m.text}" download="file" style="display:inline-block;padding:8px 12px;background:rgba(0,0,0,0.2);border-radius:8px;color:var(--p);text-decoration:none;"><i class="fas fa-file"></i> Dosyayı İndir</a>`; }
                    else if(isEmoji && !replyBlock) { content=`<span class="jumbo-emoji">${safeText}</span>`; }
                    else if(is3DModel) {
                        content = `${replyBlock}<model-viewer src="${safeText}" auto-rotate camera-controls style="width:100%;height:250px;background:rgba(0,0,0,0.5);border-radius:10px;margin-top:5px;"></model-viewer><div style="font-size:0.7rem;color:var(--sub);text-align:center;margin-top:4px;">3D Model Önizleme</div>`;
                    }
                    else if(isCall) {
                        const callId = safeText.substring(13, safeText.indexOf(']'));
                        content = `<div style="background:rgba(85,239,196,0.1); border:1px solid rgba(85,239,196,0.3); padding:15px; border-radius:15px; text-align:center; margin-top:5px; margin-bottom:5px;">
                            <div style="width:50px;height:50px;border-radius:50%;background:rgba(85,239,196,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">
                                <i class="fas fa-phone-alt" style="font-size:20px; color:var(--green);"></i>
                            </div>
                            <div style="font-weight:700; margin-bottom:12px; color:white;">LSDT Sesli Arama</div>
                            <button class="btn-p" onclick="app.joinCall('${callId}')" style="width:100%; padding:10px; font-size:0.85rem;"><i class="fas fa-phone-volume"></i> Tıkla ve Katıl</button>
                        </div>`;
                    }
                    else { 
                        let formatted = safeText
                            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                            .replace(/\*(.*?)\*/g, '<i>$1</i>')
                            .replace(/~~(.*?)~~/g, '<s>$1</s>')
                            .replace(/`([^`]+)`/g, '<code>$1</code>')
                            .replace(/\|\|(.*?)\|\|/g, "<span class=\"msg-spoiler\" onclick=\"this.classList.toggle('revealed')\">$1</span>")
                            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
                        content = `${replyBlock}<span class="msg-formatted">${formatted}</span>`;
                    }
                    
                    const reactHtml = app.getReactionsHtml(String(msgId));
                    const actionBar = `<div class="msg-action-bar">
                        <button class="msg-act-btn" onclick="app.setReply('${msgId}')" title="Yanıtla"><i class="fas fa-reply"></i></button>
                        <button class="msg-act-btn" onclick="navigator.clipboard.writeText(\`${(m.text||'').replace(/`/g,'').replace(/\[.*?\] /g,'')}\`);app.toast('Kopyalandı')" title="Kopyala"><i class="fas fa-copy"></i></button>
                        <button class="msg-act-btn" onclick="app.toggleEmojiPicker('${msgId}',this)" title="Tepki">😊</button>
                        <button class="msg-act-btn ${isStarred?'starred-on':''}" onclick="app.toggleStar('${msgId}','${safeText}')" title="Yıldızla">⭐</button>
                        <button class="msg-act-btn" onclick="app.pinMessage('${msgId}','${safeText}')" title="Sabitle">📌</button>
                        ${isMe&&!isVoice&&!isImage?`<button class="msg-act-btn" onclick="app.editMsg('${msgId}','${safeText}')" title="Düzenle">✏️</button>`:''}${isMe?`<button class="msg-act-btn" style="color:rgba(255,100,100,0.7)" onclick="app.delMsg('${msgId}')" title="Sil">🗑️</button>`:''}
                    </div>`;
                    return `<div class="msg ${isMe ? 'sent' : 'received'}" id="msg-${msgId}">
                        <span class="msg-info">${senderName} · ${timeStr}${tick}${isSilent?' 🔕':''}</span>
                        ${content}
                        ${reactHtml?`<div class="msg-reactions">${reactHtml}</div>`:''}
                        ${actionBar}
                    </div>`;
                }).join('');
                if(atBottom) box.scrollTop = box.scrollHeight;
                // Yeni mesaj sesi
                if(msgs.length > (app._prevMsgCount||0)) { app.playNotifSound(); }
                app._prevMsgCount = msgs.length;
            },


            renderAnns() {
                const list = document.getElementById('ann-list');
                if(!list) return;
                const query = document.getElementById('ann-search')?.value.toLowerCase() || '';
                let anns = [...app.db.announcements];
                
                anns.sort((a,b) => {
                    const aPin = a.title.startsWith('📌');
                    const bPin = b.title.startsWith('📌');
                    if(aPin && !bPin) return -1;
                    if(!aPin && bPin) return 1;
                    return new Date(b.created_at||b.date||0) - new Date(a.created_at||a.date||0);
                });

                let html = '';
                let count = 0;
                anns.forEach(a => {
                    if(query && !a.title.toLowerCase().includes(query) && !a.text.toLowerCase().includes(query)) return;
                    count++;
                    const d = new Date(a.created_at||a.date||0);
                    const dateStr = isNaN(d)?'':`<span style="font-size:0.75rem;color:var(--sub);margin-top:4px;display:block;">${d.toLocaleDateString('tr')} ${d.toLocaleTimeString('tr',{hour:'2-digit',minute:'2-digit'})}</span>`;
                    const isPinned = a.title.startsWith('📌');
                    const titleClean = isPinned ? a.title.replace('📌 ', '') : a.title;
                    html += `<div class="card" ${isPinned ? 'style="border-left:4px solid var(--gold);"' : ''}>
                        <h3 style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">${isPinned?'<i class="fas fa-thumbtack" style="color:var(--gold);"></i>':''} ${titleClean}</h3>
                        <p style="white-space:pre-wrap;">${a.text}</p>${dateStr}
                        ${app.user.role==='admin'?`<i class="fas fa-trash del-btn" onclick="app.delItem('announcements', '${a.id}')"></i>`:''}
                    </div>`;
                });
                if(count === 0) html = `<div class="card" style="text-align:center;color:var(--sub);">📢 Duyuru bulunamadı.</div>`;
                list.innerHTML = html;
            },

            async sendImgMsg(input) {
                const file = input.files[0];
                if(!file || !app.sel.chatTarget) return;
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64 = e.target.result;
                    const btn = document.getElementById('msg-send-btn');
                    if(btn) btn.disabled = true;
                    try {
                        const r = await fetch(`${SUPA_URL}/rest/v1/messages`, {
                            method: 'POST',
                            headers: {
                                'apikey': SUPA_KEY,
                                'Authorization': `Bearer ${SUPA_KEY}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=minimal'
                            },
                            body: JSON.stringify({ sender: app.user.username, receiver: app.sel.chatTarget, text: base64 })
                        });
                        if(r.ok) { await app.syncMessages(); }
                        else { app.toast('Resim gönderilemedi!', true); }
                    } catch(e) { app.toast('Bağlantı hatası!', true); }
                    finally { if(btn) btn.disabled = false; input.value = ''; }
                };
                reader.readAsDataURL(file);
            },

            async delMsg(msgId) {
                if(!confirm('Bu mesajı silmek istiyor musunuz?')) return;
                try {
                    await fetch(`${SUPA_URL}/rest/v1/messages?id=eq.${msgId}`,{method:'DELETE',headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`,'Prefer':'return=minimal'}});
                    await app.syncMessages();
                } catch(e) { app.toast('Silinemedi!',true); }
            },

            async sendMsg() {
                const input = document.getElementById('msg-input');
                let text = input.value.trim();
                if(!text || !app.sel.chatTarget) return;

                const btn = document.getElementById('msg-send-btn');
                if(btn) btn.disabled = true;
                input.value = '';

                if(app.sel.replyToId) { text = `[REPLY:${app.sel.replyToId}] ` + text; app.cancelReply(); }
                if(app.sel.isGhost) { text = `[GHOST] ` + text; app.toggleGhost(); }
                if(app.sel.isSilent) { text = `[SILENT] ` + text; app.sel.isSilent = false; }

                const msg = { sender: app.user.username, receiver: app.sel.chatTarget, text: text };

                try {
                    const r = await fetch(`${SUPA_URL}/rest/v1/messages`, {
                        method: 'POST',
                        headers: {
                            'apikey': SUPA_KEY,
                            'Authorization': `Bearer ${SUPA_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify(msg)
                    });

                    if(!r.ok) {
                        const errText = await r.text();
                        console.error("Supabase mesaj hatası:", errText);
                        app.toast('Gönderilemedi!', true);
                        document.body.classList.add('haptic-shake'); setTimeout(()=>document.body.classList.remove('haptic-shake'), 300);
                        input.value = text;
                    } else {
                        await app.syncMessages();
                    }
                } catch(e) {
                    app.toast('Bağlantı hatası!', true);
                    document.body.classList.add('haptic-shake'); setTimeout(()=>document.body.classList.remove('haptic-shake'), 300);
                    input.value = text;
                } finally {
                    if(btn) btn.disabled = false;
                    input.focus();
                }
            },

            applyTheme(theme) {
                document.body.classList.remove('theme-ocean','theme-fire','theme-matrix','theme-gold');
                if(theme) document.body.classList.add('theme-'+theme);
                localStorage.setItem('lsdt_color_theme', theme);
                app.toast('Tema uygulandı!');
            },

            toggleUI(className) {
                document.body.classList.toggle(className);
                localStorage.setItem('lsdt_ui_' + className, document.body.classList.contains(className) ? '1' : '0');
                app.toast('Arayüz güncellendi!');
            },

            getLatestConfig() {
                const confs = app.db.announcements.filter(a => a.title === 'SYSTEM_UPDATE_CONFIG');
                if(!confs || confs.length === 0) return null;
                confs.sort((a,b) => new Date(b.date) - new Date(a.date));
                return confs[0];
            },

            getUpdateStatus() {
                const conf = app.getLatestConfig();
                return conf && conf.text.startsWith('ON');
            },

            getUpdateLink() {
                const conf = app.getLatestConfig();
                return conf ? conf.text.split('|')[1] || '' : '';
            },

            async toggleUpdate(status) {
                const pass = prompt("İşleme devam etmek için şifreyi giriniz:");
                if(pass !== "osman_27734") {
                    app.toast("Hatalı Şifre! İşlem iptal edildi.", true);
                    document.getElementById('update-toggle').checked = !status;
                    return;
                }
                const link = document.getElementById('update-url-input')?.value || app.getUpdateLink();
                const val = (status ? 'ON' : 'OFF') + '|' + link;
                await app.saveConfig(val);
                app.toast('Güncelleme Modu: ' + (status ? 'AÇIK' : 'KAPALI'));
            },

            async saveUpdateUrl() {
                const status = document.getElementById('update-toggle').checked;
                const link = document.getElementById('update-url-input').value;
                const val = (status ? 'ON' : 'OFF') + '|' + link;
                await app.saveConfig(val);
                app.toast('Ayarlar Kaydedildi');
            },

            async saveConfig(val) {
                const data = { 
                    title: 'SYSTEM_UPDATE_CONFIG', 
                    text: val, 
                    author: 'SYSTEM',
                    date: new Date().toISOString() 
                };
                try {
                    const r = await fetch(`${RENDER_URL}/api/announcements`, { 
                        method: 'POST', 
                        headers: {'Content-Type':'application/json'}, 
                        body: JSON.stringify(data) 
                    });
                    if(r.ok) {
                        const existingIdx = app.db.announcements.findIndex(a => a.title === 'SYSTEM_UPDATE_CONFIG');
                        if(existingIdx !== -1) app.db.announcements.push(data);
                        else app.db.announcements.push(data);
                        
                        await app.sync();
                    }
                } catch(e) { console.error(e); }
            },

            checkUpdate() {
                if(app.getUpdateStatus()) {
                    const overlay = document.getElementById('update-overlay');
                    if(overlay) {
                        overlay.style.display = 'flex';
                        document.getElementById('update-link-display').value = app.getUpdateLink();
                        document.getElementById('admin-skip-btn').style.display = (app.user && app.user.role === 'admin') ? 'block' : 'none';
                    }
                } else {
                    const overlay = document.getElementById('update-overlay');
                    if(overlay) overlay.style.display = 'none';
                }
            },

            copyUpdateLink() {
                const el = document.getElementById('update-link-display');
                el.select();
                document.execCommand('copy');
                app.toast('Link Kopyalandı!');
            },

            logout() {
                app.user = null;
                app.sel.chatTarget = null;
                app._aiHistory = [];
                localStorage.removeItem('lsdt_rem');
                const fab = document.getElementById('ai-fab');
                if(fab) { fab.style.display = 'none'; fab.classList.remove('open'); }
                const popup = document.getElementById('ai-popup');
                if(popup) { popup.classList.remove('show'); popup.style.display = 'none'; }
                const box = document.getElementById('ai-box-popup');
                if(box) box.innerHTML = '';
                app.show('login-screen');
            },

            openStudioModal() {
                app.sel.stMembers = app.sel.stMembers || [];
                const w = document.getElementById('st-members-wrap');
                if(w) {
                    w.innerHTML = '';
                    app.db.users.forEach(u => {
                        const o = document.createElement('div');
                        o.className = 'p-opt' + (app.sel.stMembers.includes(u.username) ? ' active' : '');
                        o.innerText = u.name;
                        o.onclick = () => { if(app.sel.stMembers.includes(u.username)) { app.sel.stMembers = app.sel.stMembers.filter(x => x !== u.username); } else { app.sel.stMembers.push(u.username); } app.openStudioModal(); };
                        w.appendChild(o);
                    });
                }
                const prev = document.getElementById('st-img-preview');
                if(prev && app.sel.stImgBase64) prev.innerHTML = `<img src="${app.sel.stImgBase64}" style="width:100%;border-radius:15px;max-height:120px;object-fit:cover;margin-bottom:10px;">`;
                else if(prev) prev.innerHTML = '';
                app.open('modal-studio');
            },

            handleStudioImg(input) {
                const file = input.files[0]; if(!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    app.sel.stImgBase64 = e.target.result;
                    const prev = document.getElementById('st-img-preview');
                    if(prev) prev.innerHTML = `<img src="${app.sel.stImgBase64}" style="width:100%;border-radius:15px;max-height:120px;object-fit:cover;margin-bottom:10px;">`;
                };
                reader.readAsDataURL(file);
            },

            openChannelModal() {
                app.sel.chMembers = app.sel.chMembers || [];
                const w = document.getElementById('ch-members-wrap');
                if(w) {
                    w.innerHTML = '';
                    app.db.users.forEach(u => {
                        const o = document.createElement('div');
                        o.className = 'p-opt' + (app.sel.chMembers.includes(u.username) ? ' active' : '');
                        o.innerText = u.name;
                        o.onclick = () => { if(app.sel.chMembers.includes(u.username)) { app.sel.chMembers = app.sel.chMembers.filter(x => x !== u.username); } else { app.sel.chMembers.push(u.username); } app.openChannelModal(); };
                        w.appendChild(o);
                    });
                }
                app.open('modal-channel');
            },

            async createChannel() {
                const name = document.getElementById('ch-name').value.trim();
                const icon = document.getElementById('ch-icon').value;
                const members = app.sel.chMembers || [];
                if(!name) return app.toast('Ad boş olamaz!', true);
                
                const fullDesc = `[IS_CHANNEL:true]\n[CH_ICON:${icon}]\n[CH_MEMBERS:${members.join(',')}]`;
                const payload = { assignee: app.user.username, title: name, description: fullDesc, status: 'Aktif', date: new Date().toISOString() };
                const r = await fetch(`${RENDER_URL}/api/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
                if(r.ok) { 
                    app.toast('Kanal Oluşturuldu! 💬'); 
                    app.sel.chMembers = []; 
                    app.close(); 
                    await app.sync(); 
                    app.nav('admin'); 
                } else app.toast('Hata!', true);
            },

            async handleNewStudio(e) {
                e.preventDefault();
                const title = document.getElementById('st-title').value;
                const desc = document.getElementById('st-desc').value;
                const imgUrl = document.getElementById('st-img-url').value;
                const img = app.sel.stImgBase64 || imgUrl || '';
                const members = app.sel.stMembers || [];
                const fullDesc = `[IS_STUDIO:true]\n[STUDIO_IMG:${img}]\n[STUDIO_MEMBERS:${members.join(',')}]\n${desc}`;
                const payload = { assignee: app.user.username, title, description: fullDesc, status: 'Aktif', date: new Date().toISOString() };
                const r = await fetch(`${RENDER_URL}/api/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
                if(r.ok) { app.toast('Proje Oluşturuldu! 🎬'); app.sel.stMembers = []; app.sel.stImgBase64 = null; app.close(); await app.sync(); app.nav('studios'); } else app.toast('Hata!', true);
            },

            renderStudios() {
                const list = document.getElementById('studios-list');
                if(!list) return;
                const studios = (app.db.tasks || []).filter(t => t.description && t.description.includes('[IS_STUDIO:true]')).reverse();
                if(studios.length === 0) { list.innerHTML = `<div class="card" style="text-align:center;color:var(--sub);padding:40px;">🎬 Henüz studio projesi oluşturulmamış.</div>`; return; }
                list.innerHTML = studios.map(s => {
                    let img = '', members = [], cleanDesc = '';
                    try {
                        const lines = s.description.split('\n');
                        const imgLine = lines.find(l => l.startsWith('[STUDIO_IMG:'));
                        const memLine = lines.find(l => l.startsWith('[STUDIO_MEMBERS:'));
                        if(imgLine) img = imgLine.slice('[STUDIO_IMG:'.length, -1).trim();
                        if(memLine) { const raw = memLine.slice('[STUDIO_MEMBERS:'.length, -1).trim(); members = raw ? raw.split(',') : []; }
                        cleanDesc = lines.filter(l => !l.startsWith('[IS_STUDIO') && !l.startsWith('[STUDIO_')).join('\n').trim();
                    } catch(err) {}
                    const coverHtml = img ? `<img class="studio-cover" src="${img}" onerror="this.style.display='none'">` : `<div class="studio-cover-ph"><i class="fas fa-film"></i></div>`;
                    const avatars = members.map(un => { const u = app.db.users.find(x => x.username === un); if(!u) return ''; const pfp = (app.db.messages||[]).filter(m => m.sender === un && m.receiver === 'SYSTEM_PFP').pop(); return `<div class="studio-av" title="${u.name}">${pfp ? `<img src="${pfp.text}">` : u.name[0]}</div>`; }).join('');
                    const memberNames = members.map(un => { const u = app.db.users.find(x => x.username === un); return u ? u.name : ''; }).filter(Boolean).join(', ');
                    return `<div class="studio-card">${coverHtml}<div class="studio-body"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><h3 style="color:var(--p);margin:0 0 8px;">${s.title}</h3>${app.user.role==='admin'?`<i class="fas fa-trash del-btn" style="position:static;" onclick="app.delItem('tasks','${s.id}')"></i>`:''}</div><p style="color:var(--sub);font-size:0.9rem;line-height:1.5;margin:0 0 12px;">${cleanDesc}</p>${members.length>0?`<div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:14px;"><div style="font-size:0.72rem;color:var(--sub);font-weight:700;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">👥 ÇALIŞANLAR (${members.length})</div><div class="studio-members-row">${avatars}</div><div style="font-size:0.78rem;color:var(--sub);margin-top:8px;">${memberNames}</div></div>`:''}</div></div>`;
                }).join('');
            },

            toast(m, b=false) { const e = document.getElementById('toast'); document.getElementById('toast-msg').innerText=m; e.style.background=b?'var(--red)':'var(--p-grad)'; e.style.transform='translateX(-50%) translateY(0)'; e.style.opacity='1'; setTimeout(()=>{e.style.transform='translateX(-50%) translateY(-200%)'; e.style.opacity='0';}, 3000); },

            /* === 41: EMOJİ TEPKİLERİ === */
            toggleEmojiPicker(msgId, el) {
                document.querySelectorAll('.emoji-picker-popup').forEach(p => { if(p.dataset.mid !== msgId) p.classList.remove('show'); });
                let picker = document.querySelector(`.emoji-picker-popup[data-mid="${msgId}"]`);
                if(!picker) { picker = document.createElement('div'); picker.className='emoji-picker-popup'; picker.dataset.mid=msgId; ['👍','❤️','😂','🔥','👀','✅','💯','🎉','😮','💜'].forEach(em => { const b=document.createElement('button'); b.className='ep-emoji'; b.textContent=em; b.onclick=(e)=>{e.stopPropagation();app.addReaction(msgId,em);picker.classList.remove('show');}; picker.appendChild(b); }); el.closest('.msg').appendChild(picker); }
                picker.classList.toggle('show');
            },
            addReaction(msgId, emoji) {
                const reactions = JSON.parse(localStorage.getItem('lsdt_reactions') || '{}');
                if(!reactions[msgId]) reactions[msgId] = {};
                const me = app.user.username;
                const key = emoji;
                if(!reactions[msgId][key]) reactions[msgId][key] = [];
                const idx = reactions[msgId][key].indexOf(me);
                if(idx > -1) reactions[msgId][key].splice(idx,1); else reactions[msgId][key].push(me);
                if(reactions[msgId][key].length === 0) delete reactions[msgId][key];
                localStorage.setItem('lsdt_reactions', JSON.stringify(reactions));
                app.renderChat();
            },
            getReactionsHtml(msgId) {
                const reactions = JSON.parse(localStorage.getItem('lsdt_reactions') || '{}');
                const r = reactions[msgId] || {};
                return Object.entries(r).filter(([,v])=>v.length>0).map(([em,users]) => `<span class="reaction-pill ${users.includes(app.user.username)?'mine':''}" onclick="app.addReaction('${msgId}','${em}')" title="${users.join(', ')}">${em} <span style="font-size:0.72rem;font-weight:700;">${users.length}</span></span>`).join('');
            },

            /* === 42: SESLİ NOT === */
            async startVoiceNote() {
                if(app._recording) { app._recording.stop(); return; }
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
                    const rec = new MediaRecorder(stream);
                    const chunks = [];
                    rec.ondataavailable = e => chunks.push(e.data);
                    rec.onstop = () => {
                        stream.getTracks().forEach(t=>t.stop());
                        const blob = new Blob(chunks,{type:'audio/webm'});
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                            const base64 = ev.target.result;
                            await fetch(`${SUPA_URL}/rest/v1/messages`,{method:'POST',headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({sender:app.user.username,receiver:app.sel.chatTarget,text:'[VOICE:'+base64+']'})});
                            await app.syncMessages();
                        };
                        reader.readAsDataURL(blob);
                        app._recording = null;
                        const btn = document.getElementById('voice-btn');
                        if(btn) { btn.style.background=''; btn.innerHTML='<i class="fas fa-microphone"></i>'; }
                    };
                    rec.start();
                    app._recording = rec;
                    const btn = document.getElementById('voice-btn');
                    if(btn) { btn.style.background='var(--red)'; btn.innerHTML='<i class="fas fa-stop"></i>'; }
                    app.toast('🎙️ Ses kaydediliyor...');
                } catch(e) { app.toast('Mikrofon erişimi reddedildi!', true); }
            },

            /* === 44: MESAJ ARAMA === */
            searchMessages(query) {
                document.querySelectorAll('.msg').forEach(el => {
                    el.classList.remove('highlighted');
                    if(query && el.textContent.toLowerCase().includes(query.toLowerCase())) el.classList.add('highlighted');
                });
            },
            
            /* === MESSAGING UTILS === */
            toggleGhost() { app.sel.isGhost = !app.sel.isGhost; document.getElementById('ghost-toggle-btn').style.background = app.sel.isGhost ? 'var(--p-grad)' : 'rgba(255,255,255,0.08)'; document.getElementById('ghost-toggle-btn').style.color = app.sel.isGhost ? 'white' : 'var(--sub)'; },
            setReply(msgId) {
                app.sel.replyToId = msgId;
                const m = app.db.messages.find(x => x.id === msgId);
                if(m) {
                    document.getElementById('reply-preview-bar').style.display = 'block';
                    document.getElementById('reply-preview-text').textContent = m.text.substring(0,60) + '...';
                    document.getElementById('msg-input').focus();
                }
            },
            cancelReply() { app.sel.replyToId = null; document.getElementById('reply-preview-bar').style.display = 'none'; },

            /* === 43: YAZILIYOR GÖSTERGESİ === */
            _typingTimer: null,
            sendTypingPing() {
                const key = `lsdt_typing_${app.user.username}_to_${app.sel.chatTarget}`;
                localStorage.setItem(key, Date.now().toString());
                clearTimeout(app._typingTimer);
                app._typingTimer = setTimeout(() => localStorage.removeItem(key), 3000);
            },
            checkTyping() {
                if(!app.sel.chatTarget) return;
                const key = `lsdt_typing_${app.sel.chatTarget}_to_${app.user.username}`;
                const t = parseInt(localStorage.getItem(key)||'0');
                const ind = document.getElementById('typing-indicator');
                if(!ind) return;
                const isTyping = Date.now() - t < 3000;
                if(isTyping) { const name=(app.db.users.find(u=>u.username===app.sel.chatTarget)?.name||app.sel.chatTarget).split(' ')[0]; ind.innerHTML=`<span></span><span></span><span></span> <b>${name}</b> yazıyor...`; ind.classList.add('show'); }
                else ind.classList.remove('show');
            },

            /* === 44: MESAJ ARAMA === */
            searchMessages(query) {
                document.querySelectorAll('.msg').forEach(el => {
                    el.classList.remove('highlighted');
                    if(query && el.textContent.toLowerCase().includes(query.toLowerCase())) el.classList.add('highlighted');
                });
                const first = document.querySelector('.msg.highlighted');
                if(first) first.scrollIntoView({behavior:'smooth',block:'center'});
            },

            /* === 48: MESAJ DÜZENLEME === */
            async editMsg(msgId, oldText) {
                const newText = prompt('Mesajı düzenle:', oldText);
                if(!newText || newText === oldText) return;
                try {
                    await fetch(`${SUPA_URL}/rest/v1/messages?id=eq.${msgId}`,{method:'PATCH',headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({text:newText+' ✏️'})});
                    await app.syncMessages();
                } catch(e) { app.toast('Düzenlenemedi!',true); }
            },

            /* === 49: BROADCAST === */
            openBroadcastModal() {
                const w = document.getElementById('bc-to-wrap'); w.innerHTML='';
                app.sel.bcTargets = app.sel.bcTargets||[];
                app.db.users.filter(u=>u.username!==app.user.username).forEach(u=>{
                    const o=document.createElement('div'); o.className='p-opt'+(app.sel.bcTargets.includes(u.username)?' active':'');
                    o.innerText=u.name; o.onclick=()=>{const i=app.sel.bcTargets.indexOf(u.username); if(i>-1)app.sel.bcTargets.splice(i,1); else app.sel.bcTargets.push(u.username); app.openBroadcastModal();}; w.appendChild(o);
                });
                app.open('modal-broadcast');
            },
            async sendBroadcast() {
                const text=document.getElementById('bc-text').value.trim();
                if(!text||!(app.sel.bcTargets||[]).length) return app.toast('Mesaj ve alıcı seç!',true);
                for(const target of app.sel.bcTargets) {
                    await fetch(`${SUPA_URL}/rest/v1/messages`,{method:'POST',headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({sender:app.user.username,receiver:target,text:`📢 [BROADCAST] ${text}`})});
                }
                app.toast(`${app.sel.bcTargets.length} kişiye gönderildi!`);
                app.sel.bcTargets=[];
                app.close();
                await app.sync();
            },

            /* === 52: MESAJ SABİTLEME === */
            pinMessage(msgId, text) {
                localStorage.setItem(`lsdt_pin_${app.sel.chatTarget}_${app.user.username}`, JSON.stringify({msgId,text}));
                app.renderChat();
                app.toast('Mesaj sabitlendi 📌');
            },
            unpinMessage() {
                localStorage.removeItem(`lsdt_pin_${app.sel.chatTarget}_${app.user.username}`);
                app.renderChat();
            },

            /* === 53: @MENTION === */
            checkMentions(text) {
                if(!app.user||!text) return;
                const mentioned = text.includes('@'+app.user.username)||text.includes('@'+app.user.name.split(' ')[0]);
                if(mentioned) app.toast('📣 Birisi seni mention etti!', false);
            },

            /* === 54: KANAL SİSTEMİ === */
            createChannel() {
                const name=document.getElementById('ch-name').value.trim();
                const icon=document.getElementById('ch-icon').value;
                if(!name) return app.toast('Kanal adı gir!',true);
                const channels=JSON.parse(localStorage.getItem('lsdt_channels')||'[]');
                channels.push({id:'ch_'+Date.now(),name,icon,creator:app.user.username,date:new Date().toISOString()});
                localStorage.setItem('lsdt_channels',JSON.stringify(channels));
                app.toast(`#${name} kanalı oluşturuldu!`);
                app.close();
                if(app._currentNav==='admin') app.nav('admin');
            },
            getChannels() { return JSON.parse(localStorage.getItem('lsdt_channels')||'[]'); },

            /* === 55: YILDIZLI MESAJLAR === */
            toggleStar(msgId, text) {
                const stars=JSON.parse(localStorage.getItem('lsdt_stars')||'[]');
                const idx=stars.findIndex(s=>s.id===msgId);
                if(idx>-1) { stars.splice(idx,1); app.toast('Yıldız kaldırıldı'); }
                else { stars.push({id:msgId,text,date:new Date().toISOString(),from:app.sel.chatTarget}); app.toast('⭐ Yıldızlandı!'); }
                localStorage.setItem('lsdt_stars',JSON.stringify(stars));
                app.renderChat();
            },
            showStarred() {
                const stars=JSON.parse(localStorage.getItem('lsdt_stars')||'[]');
                const list=document.getElementById('starred-list');
                if(!list) return;
                list.innerHTML=stars.length?stars.map(s=>`<div style="background:rgba(255,200,0,0.08);border:1px solid rgba(255,200,0,0.2);border-radius:16px;padding:14px;"><div style="font-size:0.78rem;color:var(--sub);margin-bottom:5px;">📩 ${s.from} • ${new Date(s.date).toLocaleDateString('tr')}</div><p style="margin:0;font-size:0.9rem;">${s.text}</p><button class="btn-mini" style="margin-top:8px;background:var(--red);color:white;" onclick="app.toggleStar('${s.id}','${s.text.replace(/'/g,"'")}');app.showStarred()">✕ Kaldır</button></div>`).join(''):`<p style="text-align:center;color:var(--sub);">Henüz yıldızlanmış mesaj yok.</p>`;
                app.open('modal-starred');
            },

            /* === 50: ÇEVRİMİÇİ DURUM HEARTBEAT === */
            startHeartbeat() {
                const ping = () => localStorage.setItem('lsdt_online_'+app.user.username, Date.now().toString());
                ping();
                setInterval(ping, 10000);
            },
            isOnline(username) {
                const t=parseInt(localStorage.getItem('lsdt_online_'+username)||'0');
                return Date.now()-t < 30000;
            },

            /* === 74: BİLDİRİM SESİ === */
            playNotifSound() {
                if(localStorage.getItem('lsdt_sound')==='off') return;
                try {
                    const ctx=new (window.AudioContext||window.webkitAudioContext)();
                    const osc=ctx.createOscillator(); const gain=ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.frequency.setValueAtTime(880,ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(440,ctx.currentTime+0.15);
                    gain.gain.setValueAtTime(0.3,ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);
                    osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.3);
                } catch(e){}
            },
            toggleSound(on) {
                localStorage.setItem('lsdt_sound', on?'on':'off');
                app.toast(on?'🔔 Ses açık':'🔇 Ses kapalı');
            },

            /* === 75: SWIPE GESTURESi === */
            initSwipe() {
                const navOrder=['dash','tasks','projects','ann','admin','set'];
                let sx=0,sy=0;
                document.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
                document.addEventListener('touchend',e=>{
                    if(!app.user) return;
                    const dx=e.changedTouches[0].clientX-sx;
                    const dy=Math.abs(e.changedTouches[0].clientY-sy);
                    if(Math.abs(dx)<60||dy>40) return;
                    const cur=navOrder.indexOf(app._currentNav||'dash');
                    const next=dx<0?Math.min(cur+1,navOrder.length-1):Math.max(cur-1,0);
                    if(next!==cur) {
                        const flash=document.getElementById('swipe-flash');
                        flash.textContent=dx<0?'→':'←';
                        flash.classList.add('show');
                        setTimeout(()=>flash.classList.remove('show'),400);
                        app.nav(navOrder[next]);
                    }
                },{passive:true});
            },

            /* === 77: KART/LİSTE GÖRÜNÜM === */
            setViewMode(mode) {
                localStorage.setItem('lsdt_view_mode',mode);
                if(mode==='list') document.body.classList.add('task-list-view');
                else document.body.classList.remove('task-list-view');
            },
            applyViewMode() {
                if(localStorage.getItem('lsdt_view_mode')==='list') document.body.classList.add('task-list-view');
            },

            /* === 78: RENK KÖRLÜĞÜ === */
            setColorblind(mode) {
                document.body.classList.remove('cb-protanopia','cb-deuteranopia','cb-tritanopia');
                if(mode&&mode!=='none') document.body.classList.add('cb-'+mode);
                localStorage.setItem('lsdt_cb',mode||'none');
                app.toast('Renk modu güncellendi');
            },

            /* === 79: YÜKSEK KONTRAST === */
            toggleHighContrast(on) {
                if(on) document.body.classList.add('high-contrast');
                else document.body.classList.remove('high-contrast');
                localStorage.setItem('lsdt_hc', on?'1':'0');
                app.toast(on?'🔲 Yüksek kontrast açık':'Yüksek kontrast kapalı');
            },

            /* === 80: ÖZEL DURUM MESAJI === */
            saveStatus() {
                const s=document.getElementById('status-input').value.trim();
                localStorage.setItem('lsdt_status_'+app.user.username, s);
                app.toast('Durum güncellendi!'); app.close();
                app.nav('set');
            },
            getStatus(username) { return localStorage.getItem('lsdt_status_'+username)||''; },

            /* SYNC MESSAGES helper */
            async syncMessages() {
                try {
                    // cache: 'no-store' ve timestamp ile %100 canlı veri garantisi
                    const mr=await fetch(`${SUPA_URL}/rest/v1/messages?select=*&order=date.asc&_t=${Date.now()}`,{headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${SUPA_KEY}`, 'Pragma': 'no-cache', 'Cache-Control': 'no-cache'}, cache:'no-store'});
                    if(mr.ok) { 
                        const data = await mr.json();
                        const oldLen = (app.db.messages||[]).length;
                        app.db.messages = data; 
                        app.renderChat(); 
                        
                        // Check mentions for new messages
                        if(data.length > oldLen) {
                            const newMsgs = data.slice(oldLen);
                            newMsgs.forEach(m => {
                                if(m.sender !== app.user.username) app.checkMentions(m.text);
                            });
                        }
                    }
                } catch(e){}
            },

            startCall(targetUser) {
                const callId = `lsdt_call_${Date.now()}_${Math.floor(Math.random()*1000)}`;
                const msg = { sender: app.user.username, receiver: targetUser, text: `[CALL_INVITE:${callId}]` };
                fetch(`${SUPA_URL}/rest/v1/messages`, {
                    method: 'POST',
                    headers: {'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'},
                    body: JSON.stringify(msg)
                }).then(() => {
                    app.syncMessages();
                    app.joinCall(callId);
                });
            },
            joinCall(callId) {
                const w = window.open(`https://meet.jit.si/${callId}#config.prejoinPageEnabled=false&interfaceConfig.SHOW_JITSI_WATERMARK=false`, '_blank', 'width=800,height=600');
                if(!w) app.toast('Lütfen açılır pencerelere (pop-up) izin verin!', true);
            },

            toggleWidget() {
                const w = document.getElementById('lsdt-widget');
                if(w) { w.remove(); return; }
                const div = document.createElement('div');
                div.id = 'lsdt-widget';
                div.style.cssText = 'position:fixed; bottom:20px; right:20px; width:300px; height:400px; background:rgba(15,5,29,0.95); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.1); border-radius:20px; z-index:9999; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 15px 40px rgba(0,0,0,0.8); cursor:move; resize:both;';
                div.innerHTML = `
                    <div style="background:var(--p-grad); padding:10px 15px; font-weight:900; font-size:0.9rem; display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="fas fa-bolt"></i> LSDT WIDGET</span>
                        <i class="fas fa-times" style="cursor:pointer;" onclick="this.parentElement.parentElement.remove()"></i>
                    </div>
                    <div id="widget-content" style="padding:15px; flex:1; overflow-y:auto; cursor:default;">
                        <div style="font-size:0.8rem; color:var(--sub); margin-bottom:10px;">Yaklaşan Görevler</div>
                        ${(app.db.tasks||[]).slice(0,5).map(t => `<div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:8px; margin-bottom:5px; font-size:0.75rem;"><b>${t.assignee}:</b> ${t.title}</div>`).join('')}
                        <hr style="border:0; border-top:1px solid rgba(255,255,255,0.05); margin:10px 0;">
                        <div style="font-size:0.8rem; color:var(--sub); margin-bottom:10px;">Yeni Mesajlar</div>
                        ${(app.db.messages||[]).slice(-3).map(m => `<div style="font-size:0.75rem; margin-bottom:4px;"><b>${m.sender}:</b> ${(m.text||'').substring(0,30)}</div>`).join('')}
                    </div>
                `;
                document.body.appendChild(div);
                // Simple drag
                let isDragging = false, startX, startY, initialX, initialY;
                div.children[0].addEventListener('mousedown', e => {
                    isDragging = true; startX = e.clientX; startY = e.clientY;
                    initialX = div.offsetLeft; initialY = div.offsetTop;
                });
                document.addEventListener('mousemove', e => {
                    if(!isDragging) return;
                    div.style.left = (initialX + e.clientX - startX) + 'px';
                    div.style.top = (initialY + e.clientY - startY) + 'px';
                    div.style.bottom = 'auto'; div.style.right = 'auto';
                });
                document.addEventListener('mouseup', () => isDragging = false);
            },

        };
        window.onload = () => {
            ['focus-mode','zen-mode','dynamic-bg','deep-glass','neon-mode','scroll-prog-mode','particles-mode'].forEach(c => {
                if(localStorage.getItem('lsdt_ui_'+c)==='1') document.body.classList.add(c);
            });
            const c = document.getElementById('page-content');
            if(c) {
                c.addEventListener('scroll', () => {
                    const prog = document.getElementById('scroll-prog');
                    if(prog && document.body.classList.contains('scroll-prog-mode')) {
                        prog.style.width = (c.scrollTop / (c.scrollHeight - c.clientHeight)) * 100 + '%';
                    }
                });
            }
            app.init();
        };
    