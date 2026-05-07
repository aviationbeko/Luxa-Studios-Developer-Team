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

// Gelişmiş Loglama
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method === 'POST') console.log("Body:", JSON.stringify(req.body).substring(0, 200));
    next();
});

app.get('/', (req, res) => { res.json({ status: 'LSDT Backend Stable', timestamp: new Date().toISOString() }); });

app.get('/api/state', async (req, res) => {
    try {
        const { data: users, error: e1 } = await supabase.from('users').select('*');
        const { data: tasks, error: e2 } = await supabase.from('tasks').select('*');
        const { data: announcements, error: e3 } = await supabase.from('announcements').select('*');
        if (e1 || e2 || e3) throw (e1 || e2 || e3);
        res.json({ users, tasks, announcements });
    } catch (error) {
        console.error("State Fetch Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const userData = { ...req.body };
        const id = userData.id;
        delete userData.id;

        let result;
        if (!id) {
            result = await supabase.from('users').insert([userData]);
        } else {
            result = await supabase.from('users').update(userData).eq('id', id);
        }
        if (result.error) throw result.error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const body = { ...req.body };
        // ID varsa güncelleme, yoksa yeni kayıt
        const hasId = body.id !== undefined && body.id !== null && body.id !== "";
        
        let result;
        if (!hasId) {
            body.id = Date.now(); // Veritabanı ID vermiyorsa biz sayısal ID veriyoruz
            console.log("Inserting new task with ID:", body.id);
            result = await supabase.from('tasks').insert([body]);
        } else {
            const taskId = body.id;
            delete body.id;
            console.log("Updating task:", taskId, body);
            result = await supabase.from('tasks').update(body).eq('id', taskId);
        }

        if (result.error) {
            console.error("Supabase Task Error:", result.error);
            throw result.error;
        }
        res.json({ success: true });
    } catch (error) {
        console.error("Critical Task API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/announcements', async (req, res) => {
    try {
        const data = { ...req.body };
        delete data.id;
        const { error } = await supabase.from('announcements').insert([data]);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SİL endpoint'leri (Hem Number hem String denemesi yapar)
app.delete('/api/:table/:id', async (req, res) => {
    const { table, id } = req.params;
    try {
        let query = supabase.from(table).delete();
        
        // Önce sayı olarak dene, olmazsa yazı olarak dene
        const numId = Number(id);
        if (!isNaN(numId)) {
            const { error, count } = await supabase.from(table).delete().eq('id', numId);
            if (error) throw error;
        } else {
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
