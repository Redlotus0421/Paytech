import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zhumwkqnyzxavylcloga.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpodW13a3FueXp4YXZ5bGNsb2dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NTg4OTEsImV4cCI6MjA4MDAzNDg5MX0.QVihnW4URON0n77tXjsj2lUAegDHqg12xPlSWzjG1BY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);