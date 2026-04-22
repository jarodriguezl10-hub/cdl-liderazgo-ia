import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jredmwkogtibqptxjxtx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyZWRtd2tvZ3RpYnFwdHhqeHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk1NjcsImV4cCI6MjA5MjA0NTU2N30.MUfyZpcCPkOZAYiQdPSdzrWo-wnBI1TUIhtNTvUgbM0';
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkUser() {
    console.log("Checking user...");
    const { data, error } = await db.from('crm_usuarios_auth').select('*').eq('email', 'comercialclubdeliderazgo@gmail.com');
    if (error) {
        console.error("Error querying crm_usuarios_auth:", error);
    } else {
        console.log("Result:", data);
    }
}

checkUser();
