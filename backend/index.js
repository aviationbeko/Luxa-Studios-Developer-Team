import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for backend operations
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors({
    origin: '*', // Tüm adreslere izin ver
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(compression());
app.use(express.json({ limit: '50mb' }));

// Middleware to log requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Health Check
app.get('/', (req, res) => {
    res.json({ status: 'LSDT Backend is running', timestamp: new Date().toISOString() });
});

// --- API Endpoints ---

// Get all data
app.get('/api/state', async (req, res) => {
    try {
        const { data: users, error: userError } = await supabase.from('users').select('*');
        const { data: tasks, error: taskError } = await supabase.from('tasks').select('*');
        const { data: announcements, error: annError } = await supabase.from('announcements').select('*');

        if (userError || taskError || annError) throw new Error('Failed to fetch from Supabase');

        res.json({ users, tasks, announcements });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sync state (Save everything)
app.post('/api/sync', async (req, res) => {
    const { users, tasks, announcements } = req.body;
    try {
        // This is a simplified sync. In a real app, we would handle upserts properly.
        // For now, we'll implement specific endpoints or a bulk upsert.
        
        if (users) {
            const { error } = await supabase.from('users').upsert(users, { onConflict: 'username' });
            if (error) throw error;
        }
        if (tasks) {
            const { error } = await supabase.from('tasks').upsert(tasks, { onConflict: 'id' });
            if (error) throw error;
        }
        if (announcements) {
            const { error } = await supabase.from('announcements').upsert(announcements);
            if (error) throw error;
        }

        res.json({ success: true, message: 'Sync completed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Individual Upserts
app.post('/api/users', async (req, res) => {
    console.log("Processing user request:", req.body);
    try {
        const userData = { ...req.body };
        delete userData.id; // Manuel ID'yi sil, UUID otomatik oluşsun

        // Kullanıcı adı kontrolü
        const { data: existingUser } = await supabase.from('users').select('username').eq('username', userData.username).single();
        
        let result;
        if (existingUser) {
            result = await supabase.from('users').update(userData).eq('username', userData.username);
        } else {
            result = await supabase.from('users').insert([userData]);
        }

        if (result.error) {
            console.error("Supabase Error:", result.error);
            return res.status(500).json({ error: result.error.message });
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Critical Server Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const taskData = { ...req.body };
        const taskId = taskData.id;
        
        let result;
        if (!taskData.id) { // ID yoksa yeni kayıt, veritabanı otomatik sayı versin
            delete taskData.id;
            result = await supabase.from('tasks').insert([taskData]);
        } else { // ID varsa güncelleme (upsert)
            result = await supabase.from('tasks').upsert([taskData]);
        }

        if (result.error) throw result.error;
        res.json({ success: true });
    } catch (error) {
        console.error("Task Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/announcements', async (req, res) => {
    try {
        const { error } = await supabase.from('announcements').insert([req.body]);
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- DELETE Endpoints ---
app.delete('/api/users/:id', async (req, res) => {
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.delete('/api/tasks/:id', async (req, res) => {
    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.delete('/api/announcements/:id', async (req, res) => {
    const { error } = await supabase.from('announcements').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
