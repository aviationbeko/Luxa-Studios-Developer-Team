import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function turnOff() {
    console.log("Updating status to OFF...");
    const data = { 
        title: 'SYSTEM_UPDATE_CONFIG', 
        text: 'OFF|', 
        date: new Date().toISOString() 
    };
    
    const { error } = await supabase.from('announcements').insert([data]);
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Successfully turned OFF the update mode.");
    }
}

turnOff();
