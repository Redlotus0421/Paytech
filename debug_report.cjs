
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zhumwkqnyzxavylcloga.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpodW13a3FueXp4YXZ5bGNsb2dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NTg4OTEsImV4cCI6MjA4MDAzNDg5MX0.QVihnW4URON0n77tXjsj2lUAegDHqg12xPlSWzjG1BY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSaveReport() {
    const reportId = '00000000-0000-0000-0000-000000000001'; // Dummy UUID
    const storeId = '00000000-0000-0000-0000-000000000000'; // Assuming this exists or foreign key check might fail
    
    // First, let's check if we can fetch a store to get a valid store_id
    const { data: stores } = await supabase.from('stores').select('id').limit(1);
    const validStoreId = stores && stores.length > 0 ? stores[0].id : storeId;

    console.log('Using Store ID:', validStoreId);

    const dbReport = {
      id: reportId,
      store_id: validStoreId, 
      user_id: 'u_admin', // This is the suspect
      date: '2025-01-01', 
      timestamp: new Date().toISOString(),
      sod_gpo: 0, sod_gcash: 0, sod_petty_cash: 0, sod_petty_cash_note: '',
      fund_in: 0,
      cash_atm: 0,
      fund_ins: 0, 
      custom_sales: [], pos_sales_details: [],
      bank_transfer_fees: 0, operational_expenses: 0, operational_expenses_note: '',
      expenses: [],
      eod_gpo: 0, eod_gcash: 0, eod_actual_cash: 0,
      gcash_notebook: 0, total_start_fund: 0, total_end_assets: 0,
      total_net_sales: 0, total_expenses: 0, theoretical_growth: 0,
      recorded_profit: 0, discrepancy: 0, status: 'DRAFT', notes: ''
    };

    console.log('Attempting to upsert report...');
    const { error } = await supabase.from('reports').upsert([dbReport], { onConflict: 'id' });
    
    if (error) {
        console.error('Error saving report:', error);
    } else {
        console.log('Success!');
    }
}

testSaveReport();
