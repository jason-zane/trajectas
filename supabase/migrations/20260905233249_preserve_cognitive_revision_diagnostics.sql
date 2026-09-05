-- Cognitive successors retain their per-distractor review context on the
-- newly allocated options. Human reviews and calibration are not inherited.
-- Replace the existing RPC without changing its authorization or edit gates.
CREATE OR REPLACE FUNCTION public.revise_library_item(p_item_id uuid,p_patch jsonb,p_options jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_row items; new_row items; target uuid; option_row item_options;
  new_option uuid; option_map jsonb := '{}'; cloned boolean;
BEGIN
  -- Match the statement-trigger lock order before taking the explicit item
  -- row lock below. A freeze cannot slip between the delivered check and edit.
  PERFORM pg_advisory_xact_lock(178438921, 1);
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN
    ('purpose','construct_id','response_format_id','stem','stem_observer','reverse_scored','weight','status','display_order','difficulty','source_id','keyed_answer')) THEN
    RAISE EXCEPTION 'Unsupported item property';
  END IF;
  IF p_options IS NOT NULL AND jsonb_typeof(p_options)<>'array' THEN RAISE EXCEPTION 'Options must be an array'; END IF;
  SELECT * INTO old_row FROM items WHERE id=p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  cloned:=private.item_was_delivered(p_item_id);
  target:=CASE WHEN cloned THEN gen_random_uuid() ELSE p_item_id END;
  new_row:=jsonb_populate_record(old_row,p_patch);
  IF cloned THEN
    new_row.id:=target; new_row.parent_item_id:=p_item_id;
    new_row.item_version:=old_row.item_version+1; new_row.content_hash:=NULL;
    new_row.status:='draft'; new_row.lifecycle_state:='draft';
    new_row.created_at:=now(); new_row.updated_at:=now();
    INSERT INTO items SELECT (new_row).*;
    FOR option_row IN SELECT * FROM item_options WHERE item_id=p_item_id LOOP
      new_option:=gen_random_uuid();
      option_map:=option_map||jsonb_build_object(option_row.id::text,new_option);
      option_row.id:=new_option; option_row.item_id:=target;
      INSERT INTO item_options SELECT (option_row).*;
    END LOOP;
    -- Preserve cognitive content and answer provenance without copying review
    -- approvals or calibration parameters. The successor must be reviewed.
    INSERT INTO cognitive_item_specs(item_id,kind,spec_version,spec,render_style_version,generation_run_id,generator_seed,qa,content_hash)
      SELECT target,kind,spec_version,spec,render_style_version,generation_run_id,generator_seed,qa,content_hash FROM cognitive_item_specs WHERE item_id=p_item_id;
    INSERT INTO cognitive_option_specs(option_id,item_id,spec)
      SELECT (option_map->>option_id::text)::uuid,target,spec FROM cognitive_option_specs WHERE item_id=p_item_id;
    INSERT INTO item_answer_keys(item_id,correct_option_id,scoring_rule,rationale)
      SELECT target,(option_map->>correct_option_id::text)::uuid,scoring_rule,rationale FROM item_answer_keys WHERE item_id=p_item_id;
    INSERT INTO item_option_diagnostics(option_id,item_id,error_label,rationale)
      SELECT (option_map->>option_id::text)::uuid,target,error_label,rationale
      FROM item_option_diagnostics WHERE item_id=p_item_id;
  ELSE
    UPDATE items SET purpose=new_row.purpose,construct_id=new_row.construct_id,response_format_id=new_row.response_format_id,
      stem=new_row.stem,stem_observer=new_row.stem_observer,reverse_scored=new_row.reverse_scored,weight=new_row.weight,
      status=new_row.status,display_order=new_row.display_order,difficulty=new_row.difficulty,source_id=new_row.source_id,keyed_answer=new_row.keyed_answer
    WHERE id=target;
  END IF;
  IF p_options IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM cognitive_item_specs WHERE item_id=target) THEN
      RAISE EXCEPTION 'Cognitive options must be revised through the cognitive item bank.';
    END IF;
    DELETE FROM item_options WHERE item_id=target;
    INSERT INTO item_options(item_id,label,value,score_value,exclude_from_scoring,display_order)
      SELECT target,x->>'label',(x->>'value')::numeric,(x->>'scoreValue')::numeric,
        COALESCE((x->>'excludeFromScoring')::boolean,false),ord::int
      FROM jsonb_array_elements(p_options) WITH ORDINALITY AS opts(x,ord);
  END IF;
  RETURN target;
END $$;
REVOKE ALL ON FUNCTION public.revise_library_item(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.revise_library_item(uuid,jsonb,jsonb) TO service_role;
