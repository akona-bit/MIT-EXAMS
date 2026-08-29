const { createClient } = require('@supabase/supabase-js');

const url = 'https://hsqasoggkhdfzchfnmhb.supabase.co';
const anonKey = 'sb_publishable_Eu6x2Lc94jwN4DPlUS_evA_-l5EcTGG';

const supabase = createClient(url, anonKey);

async function testLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@mitexams.com',
    password: 'admin123'
  });
  if (error) {
    console.error("Login failed:", error.message, error.status);
  } else {
    console.log("Login success! Token:", data.session.access_token);
  }
}

testLogin();
