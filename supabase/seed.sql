-- ============================================================
-- Seed: Memosprite catalog, cosmetics shop (Coming Soon),
-- achievements, feature flags.
-- ============================================================

-- --- Memosprites ---
insert into creatures (slug, name, subject_affinity, description, sprite_key, evolution_stage, evolve_at_level) values
  ('sproutome',   'Sproutome',   'starter', 'A seedling growing out of a tiny notebook. It remembers everything you write near it.', 'sproutome', 1, 5),
  ('mossvial',    'Mossvial',    'science', 'A mossy test tube that bubbles happily when experiments go right.', 'mossvial', 1, 5),
  ('sumgolem',    'Sumgolem',    'math',    'A patient little golem with click-clack counting stones for knuckles.', 'sumgolem', 1, 5),
  ('scrollfox',   'Scrollfox',   'history', 'A fox folded from ancient paper scrolls. Its tail is a timeline.', 'scrollfox', 1, 5),
  ('inkmoth',     'Inkmoth',     'english', 'A moth with wings of drying ink. It leaves quotations where it lands.', 'inkmoth', 1, 5);

-- Evolution: Sproutome -> Bloomtome
insert into creatures (slug, name, subject_affinity, description, sprite_key, evolution_stage) values
  ('bloomtome', 'Bloomtome', 'starter', 'The notebook has blossomed. Its pages turn themselves to the topic you need.', 'bloomtome', 2);
update creatures set evolves_to = (select id from creatures where slug = 'bloomtome') where slug = 'sproutome';

-- --- Cosmetics shop (Coming Soon) ---
insert into cosmetic_shop_sections (slug, name, category, sort_order, is_coming_soon) values
  ('outfits',     'Ranger Outfits',    'trainer_outfit',   0, true),
  ('frames',      'Profile Frames',    'profile_frame',    1, true),
  ('decorations', 'Room Decorations',  'room_decoration',  2, true),
  ('biomes',      'Biome Skins',       'biome_skin',       3, true),
  ('variants',    'Sprite Variants',   'creature_variant', 4, true);

insert into cosmetic_items (section_id, slug, name, description, category, sprite_key, coin_price, earnable_from, is_available)
select s.id, v.slug, v.name, v.description, s.category, v.sprite_key, null, v.earnable_from, false
from cosmetic_shop_sections s
join (values
  ('outfits',     'petal-cloak',    'Petal Cloak',        'A cloak stitched from falling blossom petals.',        'petal-cloak',    'gameplay'),
  ('outfits',     'fern-hood',      'Fern Hood',          'Keeps the rain off during long library treks.',        'fern-hood',      null),
  ('frames',      'vine-frame',     'Vine Frame',         'Living vines that curl around your profile.',          'vine-frame',     'rewarded_ad'),
  ('decorations', 'lantern-shelf',  'Lantern Shelf',      'A cozy shelf of softly glowing study lanterns.',       'lantern-shelf',  null),
  ('biomes',      'rose-quartz',    'Rose Quartz Fields', 'Repaints your region in dawn pinks.',                  'rose-quartz',    null),
  ('variants',    'gilded-sproutome', 'Gilded Sproutome', 'A shimmering golden-leaf Sproutome recolor.',          'gilded-sproutome', 'gameplay')
) as v(section_slug, slug, name, description, sprite_key, earnable_from)
  on v.section_slug = s.slug;

-- --- Achievements ---
insert into achievements (slug, name, description, icon_key) values
  ('first-source',   'First Field Notes', 'Upload your first study source.', 'leaf'),
  ('first-battle',   'First Encounter',   'Answer your first question battle.', 'spark'),
  ('focus-chain-5',  'Deep Focus',        'Reach a Focus Chain of 5.', 'chain'),
  ('boss-cleared',   'Isle Restored',     'Defeat your first course boss.', 'crown'),
  ('shadow-redeemed','Shadow Tamer',      'Redeem a concept you previously missed.', 'moon');

-- --- Feature flags ---
insert into feature_flags (key, enabled, value_json, description) values
  ('ads_banner',        false, null, 'Banner ad slots on hub/meta screens (never on study screens).'),
  ('ads_rewarded',      false, '{"coins_per_view": 15}', 'Opt-in rewarded ads granting coins/cosmetic currency only.'),
  ('ads_interstitial',  false, '{"min_seconds_between": 600}', 'Interstitials only at safe breakpoints (session summary, region complete).'),
  ('cosmetics_shop_purchases', false, null, 'Master switch for real shop purchases. Off = Coming Soon.'),
  ('webpage_import',    false, null, 'Public webpage import (post-MVP).'),
  ('docx_import',       false, null, 'DOCX parsing (post-MVP).'),
  ('pptx_import',       false, null, 'PPTX parsing (post-MVP).');
