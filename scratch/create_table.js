const { createClient } = require('@supabase/supabase-client');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function createTable() {
    console.log("Creating messages table...");
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: `
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            sender TEXT NOT NULL,
            receiver TEXT NOT NULL,
            text TEXT NOT NULL,
            date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `});

    if (error) {
        console.error("Error creating table via RPC:", error);
        // Fallback: Just try to insert a dummy message to trigger table creation if using some auto-schema tool
        // But usually we need SQL. Since I don't have an exec_sql RPC by default, I'll try another way.
    } else {
        console.log("Table created successfully!");
    }
}

createTable();
