import { supabase } from './client';

export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('categories')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }

    console.log('Supabase connection successful');
    return true;
  } catch (err) {
    console.error('Supabase health check failed:', err);
    return false;
  }
}
