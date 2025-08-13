import { createClient } from '@supabase/supabase-js';

// Ensure these are loaded securely from environment variables, not hardcoded
const supabaseUrl = "https://gkeaemdxswhexnrnowvl.supabase.co";
const supabaseServiceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZWFlbWR4c3doZXhucm5vd3ZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTAyODc2OSwiZXhwIjoyMDcwNjA0NzY5fQ.CCB16n663QhJJcQY2HttpPZ60j6Wv410m9uYi1r-XAc";

const supabase = createClient(supabaseUrl as string, supabaseServiceRoleKey as string);

async function deleteSupabaseUser(userId: string) {
    const { data, error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
    console.error('Error deleting user:', error.message);
    return { success: false, error: error.message };
    } else {
    console.log('User deleted successfully:', data);
    return { success: true, data };
    }
}

deleteSupabaseUser('60bee5e3-671f-4f04-9395-0628903d0e2d');