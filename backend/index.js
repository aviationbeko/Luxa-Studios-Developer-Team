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

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads

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

// Individual Upserts for better performance
app.post('/api/users', async (req, res) => {
    const { data, error } = await supabase.from('users').upsert(req.body, { onConflict: 'username' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
});

app.post('/api/tasks', async (req, res) => {
    const { data, error } = await supabase.from('tasks').upsert(req.body, { onConflict: 'id' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
});

app.post('/api/announcements', async (req, res) => {
    const { data, error } = await supabase.from('announcements').upsert(req.body);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
