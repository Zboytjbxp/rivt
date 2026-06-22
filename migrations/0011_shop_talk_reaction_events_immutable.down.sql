ALTER TABLE shop_talk_reaction_events
  ADD CONSTRAINT shop_talk_reaction_events_reaction_id_fkey
  FOREIGN KEY (reaction_id) REFERENCES shop_talk_reactions(id) ON DELETE SET NULL NOT VALID;
