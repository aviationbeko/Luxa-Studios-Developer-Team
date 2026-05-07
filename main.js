import './style.css';

// LSDT - Advanced Logic (Cloud Sync Edition)
// LSDT - Advanced Logic (Cloud Sync Edition)
const RENDER_URL = 'http://localhost:3000';
const CLOUD_API = `${RENDER_URL}/api/state`;

const State = {
    currentUser: null,
    currentPage: 'dashboard',
    users: [],
    tasks: [],
    announcements: [],
    currentTaskToReview: null
};

// ... (window.showModal etc stays same)

async function fetchState() {
    try {
        const response = await fetch(CLOUD_API);
        if (!response.ok) throw new Error('Sunucu hatası');
        const data = await response.json();
        State.users = data.users || [];
        State.tasks = data.tasks || [];
        State.announcements = data.announcements || [];
        
        // Local fallback if cloud is empty (first run)
        if (State.users.length === 0) {
            State.users = [{
                name: 'Luxa Studios Admin',
                username: 'Luxa Studios Admin',
                password: 'osman_27734',
                role: 'admin',
                category: 'Admin',
                points: 0,
                avatar: 'L'
            }];
            await saveState();
        }
    } catch (error) {
        console.warn('Sunucuya bağlanılamadı, yerel yedek kullanılıyor', error);
        State.users = JSON.parse(localStorage.getItem('lsdt_users')) || [];
        State.tasks = JSON.parse(localStorage.getItem('lsdt_tasks')) || [];
        State.announcements = JSON.parse(localStorage.getItem('lsdt_announcements')) || [];
    }
}

async function saveState() {
    // Save to Local for redundancy
    localStorage.setItem('lsdt_users', JSON.stringify(State.users));
    localStorage.setItem('lsdt_tasks', JSON.stringify(State.tasks));
    localStorage.setItem('lsdt_announcements', JSON.stringify(State.announcements));

    // Save to Cloud via Render
    try {
        await fetch(`${RENDER_URL}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                users: State.users,
                tasks: State.tasks,
                announcements: State.announcements
            })
        });
    } catch (error) {
        console.error('Buluta kaydedilemedi', error);
    }
}


function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function switchPage(pageId) {
    State.currentPage = pageId;
    
    // Update Nav UI
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.innerText.toLowerCase().includes(pageId === 'dashboard' ? 'panel' : (pageId === 'tasks' ? 'görev' : (pageId === 'announcements' ? 'duyuru' : 'ayar')))) {
            item.classList.add('active');
        }
    });

    renderPage();
}

// Auth
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;
    
    // Refresh state before login to ensure we have latest accounts
    await fetchState();
    
    const foundUser = State.users.find(u => u.username === user && u.password === pass);

    if (foundUser) {
        State.currentUser = foundUser;
        showScreen('loading');
        document.getElementById('member-name').innerText = foundUser.name;
        
        setTimeout(() => {
            updateNavInfo();
            showScreen('main-app');
            switchPage('dashboard');
        }, 3000);
    } else {
        showToast('Giriş başarısız! Bilgileri kontrol edin.', 'error');
    }
});

function updateNavInfo() {
    document.getElementById('nav-user-name').innerText = State.currentUser.name;
    document.getElementById('nav-user-rank').innerText = getRank(State.currentUser.points);
    document.getElementById('user-points').innerText = State.currentUser.points || 0;
    document.getElementById('user-avatar').innerText = State.currentUser.name[0];
}

function getRank(points = 0) {
    if (points < 500) return 'Junior Developer';
    if (points < 1500) return 'Mid-Level Developer';
    if (points < 3000) return 'Senior Developer';
    return 'Lead Developer';
}

// Page Rendering
function renderPage() {
    const container = document.getElementById('page-container');
    container.innerHTML = '';
    container.classList.add('fade-page');
    setTimeout(() => container.classList.remove('fade-page'), 400);

    if (State.currentPage === 'dashboard') {
        renderDashboard(container);
    } else if (State.currentPage === 'tasks') {
        renderTasksPage(container);
    } else if (State.currentPage === 'announcements') {
        renderAnnouncementsPage(container);
    } else if (State.currentPage === 'settings') {
        renderSettingsPage(container);
    }
}

function renderDashboard(container) {
    const isAdmin = State.currentUser.role === 'admin';
    const pendingCount = State.tasks.filter(t => t.status === 'pending_approval').length;
    const myActiveTasks = State.tasks.filter(t => t.assignee === State.currentUser.username && (t.status === 'active' || t.status === 'rejected')).length;

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-item">
                <span class="value">${isAdmin ? State.users.length - 1 : myActiveTasks}</span>
                <span class="label">${isAdmin ? 'Toplam Üye' : 'Aktif Görevim'}</span>
            </div>
            <div class="stat-item">
                <span class="value">${isAdmin ? pendingCount : State.currentUser.points || 0}</span>
                <span class="label">${isAdmin ? 'Bekleyen Onay' : 'Toplam XP'}</span>
            </div>
        </div>

        ${isAdmin ? `
            <div class="action-grid">
                <div class="action-card" onclick="window.showModal('create-dev-modal')">
                    <i class="fas fa-user-plus"></i>
                    <span>Üye Ekle</span>
                </div>
                <div class="action-card" onclick="window.showModal('assign-task-modal'); renderAssigneeSelect();">
                    <i class="fas fa-tasks"></i>
                    <span>Görev Ver</span>
                </div>
                <div class="action-card" onclick="window.showModal('announcement-modal')">
                    <i class="fas fa-bullhorn"></i>
                    <span>Duyuru</span>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
                <h3>Onay Bekleyenler</h3>
                <button onclick="syncNow()" class="btn-primary" style="padding:5px 10px; font-size:0.7rem;"><i class="fas fa-sync"></i> Yenile</button>
            </div>
            <div id="admin-review-list"></div>
        ` : `
            <div class="card">
                <h3>Merhaba, ${State.currentUser.name}!</h3>
                <p>Bugün yapılacak ${myActiveTasks} görevin var. Başarılar dileriz!</p>
            </div>
            <h3>Hızlı Erişim</h3>
            <div class="action-grid">
                <div class="action-card" onclick="switchPage('tasks')">
                    <i class="fas fa-clipboard-list"></i>
                    <span>Görevlerim</span>
                </div>
                <div class="action-card" onclick="switchPage('announcements')">
                    <i class="fas fa-bell"></i>
                    <span>Duyurular</span>
                </div>
                <div class="action-card" onclick="switchPage('settings')">
                    <i class="fas fa-user-cog"></i>
                    <span>Profil</span>
                </div>
            </div>
        `}
    `;

    if (isAdmin) renderAdminReviewList();
}

window.syncNow = async () => {
    showToast('Senkronize ediliyor...');
    await fetchState();
    renderPage();
};

function renderTasksPage(container) {
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3>Görev Takibi</h3>
            <button onclick="syncNow()" class="btn-primary" style="padding:5px 10px; font-size:0.7rem;"><i class="fas fa-sync"></i></button>
        </div>
        <div class="task-tabs" style="display:flex; gap:10px; margin-bottom:15px;">
            <button class="tag active" id="tab-active" onclick="renderTaskList('active')">Aktif</button>
            <button class="tag" id="tab-completed" onclick="renderTaskList('completed')">Geçmiş</button>
        </div>
        <div id="task-list-content"></div>
    `;
    renderTaskList('active');
}

window.renderTaskList = (filter) => {
    const list = document.getElementById('task-list-content');
    const isAdmin = State.currentUser.role === 'admin';
    const tasks = State.tasks.filter(t => {
        const isMyTask = isAdmin || t.assignee === State.currentUser.username;
        if (filter === 'active') return isMyTask && (t.status === 'active' || t.status === 'pending_approval' || t.status === 'rejected');
        return isMyTask && t.status === 'completed';
    });

    document.querySelectorAll('.task-tabs .tag').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${filter}`).classList.add('active');

    list.innerHTML = tasks.length ? '' : `<p class="empty-msg">Henüz ${filter === 'active' ? 'aktif' : 'geçmiş'} görev yok.</p>`;
    
    tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = `task-item priority-${task.priority}`;
        div.innerHTML = `
            <div class="task-header">
                <span class="tag">${task.type} | ${task.priority || 'Normal'}</span>
                <span class="status-text" style="font-size:0.7rem; font-weight:700; color:${getStatusColor(task.status)}">${getStatusText(task.status)}</span>
            </div>
            <h4 style="margin-bottom:5px;">${task.title}</h4>
            <p style="font-size:0.8rem; color:#636e72;">${task.description}</p>
            ${!isAdmin && (task.status === 'active' || task.status === 'rejected') ? 
                `<button onclick="window.showModal('complete-task-modal')" class="btn-primary" style="padding:8px; font-size:0.8rem; margin-top:10px;">Tamamla & Raporla</button>` : ''}
            ${task.rejectionReason ? `<div style="margin-top:10px; padding:8px; background:#fff5f5; border-radius:8px; border-left:3px solid var(--danger); font-size:0.75rem;"><strong>Revize Notu:</strong> ${task.rejectionReason}</div>` : ''}
        `;
        list.appendChild(div);
    });
};

function renderAnnouncementsPage(container) {
    container.innerHTML = `
        <h3>Duyurular</h3>
        ${State.announcements.length ? '' : '<p class="empty-msg">Henüz duyuru yayınlanmadı.</p>'}
        <div class="ann-list">
            ${State.announcements.slice().reverse().map(ann => `
                <div class="card animate__animated animate__fadeIn">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <i class="fas fa-bullhorn" style="color:var(--primary);"></i>
                        <h4 style="color:var(--primary);">${ann.title || 'Duyuru'}</h4>
                    </div>
                    <p style="font-size:0.9rem;">${ann.text}</p>
                    <small style="color:#aaa; display:block; margin-top:10px;">${new Date(ann.date).toLocaleDateString('tr-TR')}</small>
                </div>
            `).join('')}
        </div>
    `;
}

function renderSettingsPage(container) {
    container.innerHTML = `
        <div class="card" style="text-align:center;">
            <div class="avatar" style="width:80px; height:80px; font-size:2rem; margin: 0 auto 15px auto;">${State.currentUser.name[0]}</div>
            <h2>${State.currentUser.name}</h2>
            <p style="color:var(--text-muted);">${State.currentUser.category}</p>
            <div class="tag" style="margin-top:10px;">${getRank(State.currentUser.points)}</div>
        </div>

        <div class="card">
            <h3>Hesap Ayarları</h3>
            <div class="settings-item" style="display:flex; justify-content:space-between; padding:15px 0; border-bottom:1px solid #eee;">
                <span>Puanlarım (XP)</span>
                <span style="font-weight:700; color:var(--primary);">${State.currentUser.points || 0}</span>
            </div>
            <div class="settings-item" style="display:flex; justify-content:space-between; padding:15px 0; cursor:pointer;" onclick="logout()">
                <span style="color:var(--danger); font-weight:700;">Çıkış Yap</span>
                <i class="fas fa-sign-out-alt" style="color:var(--danger);"></i>
            </div>
        </div>
    `;
}

function renderAdminReviewList() {
    const list = document.getElementById('admin-review-list');
    const pending = State.tasks.filter(t => t.status === 'pending_approval');
    
    if (!pending.length) {
        list.innerHTML = '<p class="empty-msg">Onay bekleyen görev yok.</p>';
        return;
    }

    pending.forEach(task => {
        const div = document.createElement('div');
        div.className = 'admin-review-card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                    <h4>${task.title}</h4>
                    <small>Gönderen: <strong>${task.assigneeName}</strong></small>
                </div>
                <span class="tag">${task.priority}</span>
            </div>
            <p style="margin:10px 0; font-size:0.85rem; background:#f0f0f0; padding:10px; border-radius:10px;">${task.report}</p>
            ${task.bugs ? `<p style="font-size:0.75rem; color:var(--danger); margin-bottom:10px;"><strong>Hatalar:</strong> ${task.bugs}</p>` : ''}
            
            <div class="review-gallery">
                ${task.images && task.images.length ? task.images.map(img => `<img src="${img}" class="gallery-img">`).join('') : '<p style="font-size:0.7rem; color:#aaa;">Resim yok.</p>'}
            </div>

            <div class="flex-row" style="margin-top:15px;">
                <button onclick="window.approveTask('${task.id}')" class="btn-primary" style="flex:1; padding:10px;">Onayla (+100 XP)</button>
                <button onclick="window.openRejectModal('${task.id}')" class="btn-danger" style="flex:1; padding:10px;">Reddet</button>
            </div>
        `;
        list.appendChild(div);
    });
}

async function approveTask(id) {
    const task = State.tasks.find(t => t.id === id);
    const dev = State.users.find(u => u.username === task.assignee);
    
    task.status = 'completed';
    dev.points = (dev.points || 0) + 100;
    
    await saveState();
    renderPage();
    showToast(`${dev.name} görevini onayladın!`);
}

function openRejectModal(id) {
    State.currentTaskToReview = id;
    window.showModal('reject-modal');
}

function getStatusText(status) {
    const map = { active: 'Devam Ediyor', pending_approval: 'Onay Bekliyor', rejected: 'Revize Gerekli', completed: 'Tamamlandı' };
    return map[status] || status;
}

function getStatusColor(status) {
    const map = { active: '#6c5ce7', pending_approval: '#fdcb6e', rejected: '#ff7675', completed: '#55efc4' };
    return map[status] || '#000';
}

window.renderAssigneeSelect = () => {
    const select = document.getElementById('task-assignee');
    select.innerHTML = '<option value="" disabled selected>Developer Seçin</option>';
    State.users.filter(u => u.role === 'dev').forEach(dev => {
        select.innerHTML += `<option value="${dev.username}">${dev.name} (${dev.category})</option>`;
    });
};

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast animate__animated animate__fadeInDown`;
    if (type === 'error') toast.style.background = 'var(--danger)';
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.replace('animate__fadeInDown', 'animate__fadeOutUp');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function logout() {
    State.currentUser = null;
    showScreen('login');
}

document.getElementById('task-images').addEventListener('change', async (e) => {
    const files = e.target.files;
    const preview = document.getElementById('image-preview-container');
    preview.innerHTML = '';
    
    for (const file of files) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target.result;
            img.className = 'preview-img';
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    }
});

function setupEventListeners() {
    document.getElementById('create-dev-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = {
            name: document.getElementById('new-dev-name').value,
            username: document.getElementById('new-dev-username').value,
            password: document.getElementById('new-dev-password').value,
            category: document.getElementById('new-dev-category').value,
            role: 'dev',
            points: 0
        };
        State.users.push(user);
        await saveState();
        document.getElementById('create-dev-modal').classList.remove('active');
        renderPage();
        showToast('Yeni üye eklendi!');
    });

    document.getElementById('assign-task-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const devUsername = document.getElementById('task-assignee').value;
        const dev = State.users.find(u => u.username === devUsername);
        State.tasks.push({
            id: 'task_' + Date.now(),
            assignee: devUsername,
            assigneeName: dev.name,
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-desc').value,
            type: document.getElementById('task-type').value,
            priority: document.getElementById('task-priority').value,
            status: 'active',
            date: new Date().toISOString()
        });
        await saveState();
        document.getElementById('assign-task-modal').classList.remove('active');
        renderPage();
        showToast('Görev atandı.');
    });

    document.getElementById('complete-task-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const images = document.getElementById('task-images').files;
        const base64Images = [];
        for (const file of images) {
            const base64 = await toBase64(file);
            base64Images.push(base64);
        }

        const task = State.tasks.find(t => t.assignee === State.currentUser.username && (t.status === 'active' || t.status === 'rejected'));
        task.status = 'pending_approval';
        task.report = document.getElementById('task-report').value;
        task.bugs = document.getElementById('task-bugs').value;
        task.images = base64Images;
        
        await saveState();
        document.getElementById('complete-task-modal').classList.remove('active');
        renderPage();
        showToast('Rapor gönderildi!');
    });

    document.getElementById('reject-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const task = State.tasks.find(t => t.id === State.currentTaskToReview);
        task.status = 'rejected';
        task.rejectionReason = document.getElementById('reject-reason').value;
        await saveState();
        document.getElementById('reject-modal').classList.remove('active');
        renderPage();
        showToast('Reddedildi.');
    });

    document.getElementById('announcement-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        State.announcements.push({
            title: document.getElementById('ann-title').value,
            text: document.getElementById('announcement-text').value,
            date: new Date().toISOString()
        });
        await saveState();
        document.getElementById('announcement-modal').classList.remove('active');
        renderPage();
        showToast('Duyuru yayınlandı!');
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = (e) => e.target.closest('.modal').classList.remove('active');
    });
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

init();

