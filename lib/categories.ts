import type { SupabaseClient } from "@supabase/supabase-js";

export interface Category {
  id: string;
  name: string;
}

export async function listCategories(
  supabase: SupabaseClient
): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data;
}

export async function createCategory(
  supabase: SupabaseClient,
  name: string
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .insert({ name })
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}
