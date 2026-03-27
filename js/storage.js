import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/+esm';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function saveInvestment(investment) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('investments')
    .insert([{
      user_id: user.id,
      ...investment
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getInvestments() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateInvestment(id, updates) {
  const { data, error } = await supabase
    .from('investments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteInvestment(id) {
  const { error } = await supabase
    .from('investments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function savePortfolio(portfolio) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('portfolios')
    .insert([{
      user_id: user.id,
      ...portfolio
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPortfolios() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function cacheEconomicIndicator(indicatorType, value, referenceDate) {
  const { error } = await supabase
    .from('economic_indicators')
    .upsert({
      indicator_type: indicatorType,
      value,
      reference_date: referenceDate
    }, {
      onConflict: 'indicator_type,reference_date'
    });

  if (error) {
    console.error('Erro ao salvar indicador:', error);
  }
}

export async function getCachedIndicator(indicatorType) {
  const { data, error } = await supabase
    .from('economic_indicators')
    .select('*')
    .eq('indicator_type', indicatorType)
    .order('reference_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar indicador:', error);
    return null;
  }

  return data;
}
