import type { SupabaseClient } from "@supabase/supabase-js";

export interface CategoryRule {
  id: string;
  keyword: string;
  categoryId: string;
  position: number;
}

function fromRow(row: {
  id: string;
  keyword: string;
  category_id: string;
  position: number;
}): CategoryRule {
  return {
    id: row.id,
    keyword: row.keyword,
    categoryId: row.category_id,
    position: row.position,
  };
}

export async function listCategoryRules(
  supabase: SupabaseClient
): Promise<CategoryRule[]> {
  const { data, error } = await supabase
    .from("category_rules")
    .select("id, keyword, category_id, position")
    .order("position");
  if (error) throw error;
  return data.map(fromRow);
}

export async function createCategoryRule(
  supabase: SupabaseClient,
  keyword: string,
  categoryId: string
): Promise<CategoryRule> {
  const { data: existing, error: maxError } = await supabase
    .from("category_rules")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  if (maxError) throw maxError;
  const nextPosition = existing.length > 0 ? existing[0].position + 1 : 0;

  const { data, error } = await supabase
    .from("category_rules")
    .insert({ keyword, category_id: categoryId, position: nextPosition })
    .select("id, keyword, category_id, position")
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteCategoryRule(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("category_rules").delete().eq("id", id);
  if (error) throw error;
}

export async function swapCategoryRulePositions(
  supabase: SupabaseClient,
  ruleA: CategoryRule,
  ruleB: CategoryRule
): Promise<void> {
  const { error: errorA } = await supabase
    .from("category_rules")
    .update({ position: ruleB.position })
    .eq("id", ruleA.id);
  if (errorA) throw errorA;

  const { error: errorB } = await supabase
    .from("category_rules")
    .update({ position: ruleA.position })
    .eq("id", ruleB.id);
  if (errorB) throw errorB;
}
