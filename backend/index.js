import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => { console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`); next(); });

app.get('/', (req, res) => { res.json({ status: 'LSDT Backend Running', timestamp: new Date().toISOString() }); });

// Tüm veriyi getir
app.get('/api/state', async (req, res) => {
    try {
        const { data: users, error: e1 } = await supabase.from('users').select('*');
        const { data: tasks, error: e2 } = await supabase.from('tasks').select('*');
        const { data: announcements, error: e3 } = await supabase.from('announcements').select('*');
        if (e1 || e2 || e3) throw new Error('Veri çekme hatası');
        res.json({ users, tasks, announcements });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Kullanıcı ekle
app.post('/api/users', async (req, res) => {
    try {
        const userData = { ...req.body };
        delete userData.id; // ID'yi sil, veritabanı otomatik atasın

        const { data: existing } = await supabase.from('users').select('username').eq('username', userData.username).single();
        let result;
        if (existing) {
            result = await supabase.from('users').update(userData).eq('username', userData.username);
        } else {
            result = await supabase.from('users').insert([userData]);
        }
        if (result.error) throw result.error;
        res.json({ success: true });
    } catch (err) {
        console.error("User Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Görev ekle veya güncelle
app.post('/api/tasks', async (req, res) => {
    try {
        const body = { ...req.body };
        const taskId = body.id ? Number(body.id) : null;

        let result;
        if (!taskId) {
            // YENİ GÖREV: ID yok, tüm alanlarla insert yap
            delete body.id;
            result = await supabase.from('tasks').insert([body]);
        } else {
            // MEVCUT GÖREV GÜNCELLEMESİ: Sadece gönderilen alanları güncelle
            const updateData = {};
            if (body.status !== undefined) updateData.status = body.status;
            if (body.description !== undefined) updateData.description = body.description;
            // Başka bir alan gelmişse onu da ekle
            ['title', 'assignee', 'date'].forEach(k => { if (body[k] !== undefined) updateData[k] = body[k]; });
            
            result = await supabase.from('tasks').update(updateData).eq('id', taskId);
        }

        if (result.error) throw result.error;
        res.json({ success: true });
    } catch (error) {
        console.error("Task Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Duyuru ekle
app.post('/api/announcements', async (req, res) => {
    try {
        const annData = { ...req.body };
        delete annData.id; // ID'yi sil, veritabanı otomatik atasın
        const { error } = await supabase.from('announcements').insert([annData]);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error("Announcement Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// SİL endpoint'leri
app.delete('/api/users/:id', async (req, res) => {
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.delete('/api/tasks/:id', async (req, res) => {
    const { error } = await supabase.from('tasks').delete().eq('id', Number(req.params.id));
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.delete('/api/announcements/:id', async (req, res) => {
    const { error } = await supabase.from('announcements').delete().eq('id', Number(req.params.id));
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
