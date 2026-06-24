import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Helpers reutilizables
export const getCount = async (table) => {
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
  return count ?? 0
}

export const getAll = async (table, query = {}) => {
  let req = supabase.from(table).select(query.select || '*')
  if (query.order) req = req.order(query.order, { ascending: query.asc ?? true })
  if (query.limit) req = req.limit(query.limit)
  if (query.eq) Object.entries(query.eq).forEach(([k, v]) => { req = req.eq(k, v) })
  const { data, error } = await req
  if (error) throw error
  return data ?? []
}

export const insert = async (table, payload) => {
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export const update = async (table, id, payload) => {
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const remove = async (table, id) => {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}
