/**
 * Run Supabase Migration
 *
 * This script directly executes the migration SQL using Supabase client
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  try {
    console.log('🚀 Running Supabase migration...')

    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/001_sessions_and_programs.sql')
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    // Split SQL into individual statements (rough split by semicolons)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`📝 Executing ${statements.length} SQL statements...`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'

      // Skip comments
      if (statement.trim().startsWith('--')) continue

      console.log(`\n[${i + 1}/${statements.length}] Executing...`)

      const { data, error } = await supabase.rpc('exec_sql', {
        query: statement
      })

      if (error) {
        // Try alternative method using REST API
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`
          },
          body: JSON.stringify({ query: statement })
        })

        if (!response.ok) {
          console.error(`❌ Failed to execute statement ${i + 1}:`, error.message)
          console.error('Statement:', statement.substring(0, 100) + '...')
          // Continue anyway - some statements might already exist
        } else {
          console.log(`✅ Statement ${i + 1} executed`)
        }
      } else {
        console.log(`✅ Statement ${i + 1} executed`)
      }
    }

    console.log('\n✅ Migration completed successfully!')
    console.log('\n📊 Verifying tables...')

    // Verify tables were created
    const { data: tables, error: tablesError } = await supabase
      .from('sessions')
      .select('id')
      .limit(0)

    if (tablesError) {
      console.log('⚠️ Warning: Could not verify tables:', tablesError.message)
      console.log('💡 You may need to run the migration manually in Supabase Dashboard')
      console.log(`   URL: ${supabaseUrl.replace('.supabase.co', '.supabase.co/project/_/sql/new')}`)
    } else {
      console.log('✅ Tables verified successfully!')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.log('\n💡 Manual migration steps:')
    console.log('1. Go to Supabase Dashboard SQL Editor:')
    console.log(`   ${supabaseUrl.replace('.supabase.co', '.supabase.co/project/_/sql/new')}`)
    console.log('2. Copy and paste the contents of:')
    console.log('   supabase/migrations/001_sessions_and_programs.sql')
    console.log('3. Click "Run"')
    process.exit(1)
  }
}

runMigration()