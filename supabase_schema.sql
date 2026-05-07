-- LSDT Management Database Schema

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'dev',
    category TEXT,
    points INTEGER DEFAULT 0,
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, -- Using client-side generated task_... IDs
    title TEXT NOT NULL,
    description TEXT,
    type TEXT,
    priority TEXT,
    status TEXT DEFAULT 'active',
    assignee TEXT REFERENCES users(username),
    assigneeName TEXT,
    report TEXT,
    bugs TEXT,
    images TEXT[], -- Array of base64 or storage URLs
    rejectionReason TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title TEXT,
    text TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Initial Admin User (Run this separately if needed)
-- INSERT INTO users (username, password, name, role, category, points, avatar)
-- VALUES ('Luxa Studios Admin', 'osman_27734', 'Luxa Studios Admin', 'admin', 'Admin', 0, 'L');
