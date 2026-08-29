const { createClient } = require('@supabase/supabase-js');

const url = 'https://hsqasoggkhdfzchfnmhb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzcWFzb2dna2hkZnpjaGZubWhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQ2NDAyMiwiZXhwIjoyMTAzMDQwMDIyfQ.qmDetNn6em1IoSCQ_pVJGr9jNr5eD7pxFWkAK5zBwE0';

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const users = [
  { email: 'admin@mitexams.com', password: 'admin123' },
  { email: 'teacher@mitexams.com', password: 'teacher123' },
  { email: 'student@mitexams.com', password: 'student123' }
];

async function seed() {
  for (const u of users) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true
    });
    if (error) {
      console.log(`Failed to create ${u.email}:`, error.message);
    } else {
      console.log(`Created ${u.email}:`, data.user.id);
    }
  }
}

seed();
