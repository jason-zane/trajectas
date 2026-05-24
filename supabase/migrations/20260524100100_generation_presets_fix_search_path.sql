-- Lock down the search_path on generation_presets_set_updated_at so it isn't
-- mutable per Supabase advisor `function_search_path_mutable` (lint 0011).
ALTER FUNCTION public.generation_presets_set_updated_at()
  SET search_path = '';
