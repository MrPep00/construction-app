-- ============================================================
-- rebuild-B-files.sql
-- Generated 2026-08-30 by scripts/generate-rebuild-B-files.ts
-- DO NOT EDIT BY HAND — regenerate from backups/r2-mapping-dryrun.json.
--
-- Recovered after the 2026-08-30 cascade incident. The group prefixes in
-- files.name ([G01]..[G41], [T01]..[T04]) are DEAD LOCATION IDS: the locations and tasks
-- those photos hung off were deleted, so the rows come back as project-level
-- files and the prefix is the only surviving link between a photo and the lokal
-- it came from. Which prefix means which old UUID is recorded in the mapping at
-- backups/r2-mapping-dryrun.md.
--
-- PHASE C of the rebuild. Phase A (scripts/rebuild-A-apartments.sql) restored
-- the 63 lokale. Phase D — re-entering issues by hand, using the recovered
-- gallery as a memory aid — is manual and is NOT covered here.
--
-- Safety   : INSERT ONLY. No DELETE, no UPDATE, no DDL, no R2 access.
--            Single transaction. Every row is guarded by NOT EXISTS on
--            storage_path, so re-running inserts nothing twice.
--            Aborts (and rolls back everything) on any assertion failure.
--
-- How to run : Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Why scripts/ not migrations/ : DECISIONS.md D-022.
--
-- >>> BEFORE RUNNING: set the project name on the SELECT set_config line
-- >>> below (two places) to the project you created in the app.
--
-- Source bucket : construction-files
-- Inventory run : 2026-08-30T20:24:17.708Z
-- Objects       : 212
--   -> floor-level files : 76 (levels -2, -1, 0, 1, 2, 3, 4, 5, 6, 7)
--   -> project-level     : 136 (45 recovery groups + already-project-scoped)
--
-- Column choices
--   storage_provider : 'r2' for every row (migration 016)
--   storage_path     : the R2 key, verbatim — this is what resolveFileUrls() signs
--   project_id       : always set (migration 022); floor_id set only where the
--                      old floor UUID resolved to a level
--   location_id / task_id / issue_id : always NULL — those parents are gone
--   name             : original filename, group-prefixed for recovered files
--   created_at       : the R2 object's LastModified, so the gallery keeps its
--                      real chronology instead of collapsing to today
--   uploaded_by      : the team creator (teams.created_by) — the true uploader
--                      is not recorded anywhere in R2
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Target project name.  EDIT THIS LINE.
-- ============================================================

SELECT set_config('app.project_name', 'Budynek A', true);

-- ============================================================
-- 1. Pre-flight
-- ============================================================

DO $$
DECLARE
  v_name        text := current_setting('app.project_name');
  v_project_cnt integer;
  v_project_id  uuid;
  v_uploader    uuid;
  v_missing     text;
  v_existing    integer;
BEGIN
  SELECT count(*) INTO v_project_cnt FROM projects WHERE name = v_name;

  IF v_project_cnt = 0 THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: no project named %. Fix the set_config line at the top.', v_name;
  ELSIF v_project_cnt > 1 THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: % projects named % - ambiguous target, refusing to guess.',
      v_project_cnt, v_name;
  END IF;

  SELECT id INTO v_project_id FROM projects WHERE name = v_name;

  SELECT t.created_by INTO v_uploader
  FROM projects p JOIN teams t ON t.id = p.team_id
  WHERE p.id = v_project_id;

  IF v_uploader IS NULL THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: cannot resolve an uploader (teams.created_by) for project %.', v_name;
  END IF;

  -- Every level referenced by a floor-scoped file must exist as a real floor,
  -- otherwise that file would silently fall through to project level.
  SELECT string_agg(x.level::text, ', ' ORDER BY x.level) INTO v_missing
  FROM (VALUES
    (-2),
    (-1),
    (0),
    (1),
    (2),
    (3),
    (4),
    (5),
    (6),
    (7)
  ) AS x(level)
  WHERE NOT EXISTS (
    SELECT 1 FROM floors f
    WHERE f.project_id = v_project_id AND f.kind = 'floor' AND f.level = x.level
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: project % has no floor at level(s) %. Expected the seeding trigger to create -2..7.',
      v_name, v_missing;
  END IF;

  SELECT count(*) INTO v_existing FROM files WHERE project_id = v_project_id;

  RAISE NOTICE 'Pre-flight OK: project % (%), uploader %, % files already present.',
    v_name, v_project_id, v_uploader, v_existing;
END $$;

-- ============================================================
-- 2. Insert 212 file rows
--    level = NULL  -> project-level file (all targets NULL, migration 022)
--    level = <int> -> floor-level file on that floor
-- ============================================================

WITH src (storage_path, name, mime_type, category, level, size_bytes, created_at) AS (
  VALUES
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/1c480e3c-77c3-4139-8657-0bc4135e6b26/6d74abc8-55bd-4767-9456-36dd48fb614c-nr_2_fundamenty_wod-kan.pdf', 'nr_2_fundamenty_wod-kan.pdf', 'application/pdf', 'drawing', -2::int, 597719::bigint, '2026-06-01T06:26:07.684Z'::timestamptz),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/1c480e3c-77c3-4139-8657-0bc4135e6b26/ab7a08f9-bd83-41ae-88c0-ecf73cca23df-nr_3_pi_tro_-2_wod-kan.pdf', 'nr_3_pi_tro_-2_wod-kan.pdf', 'application/pdf', 'drawing', -2, 682421, '2026-06-01T06:26:08.155Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/1c480e3c-77c3-4139-8657-0bc4135e6b26/b3d2b5e5-300b-4665-a545-7c7e700f7fea-kopia_1._gara_-2.pdf', 'kopia_1._gara_-2.pdf', 'application/pdf', 'drawing', -2, 1469219, '2026-06-01T06:35:15.333Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/28fb4152-3776-446c-a86c-e610155177a9/ea196ec0-12d3-43f5-b294-c40703d0aa36-nr_4_pi_tro_-1_wod-kan.pdf', 'nr_4_pi_tro_-1_wod-kan.pdf', 'application/pdf', 'drawing', -1, 961268, '2026-06-01T06:26:34.428Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/28fb4152-3776-446c-a86c-e610155177a9/a3893478-3ff1-4996-825c-0b16ee707c5a-kopia_2._gara_-1.pdf', 'kopia_2._gara_-1.pdf', 'application/pdf', 'drawing', -1, 1598720, '2026-06-01T06:35:35.471Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/28fb4152-3776-446c-a86c-e610155177a9/d2958884-1fdb-41f4-b7cd-a2bf5b250ce7-nr_2_pi_tro_-1_went.pdf', 'nr_2_pi_tro_-1_went.pdf', 'application/pdf', 'drawing', -1, 744495, '2026-06-01T06:42:58.151Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/28fb4152-3776-446c-a86c-e610155177a9/391b680a-118c-4bf0-8bac-d1580343b4b3-rys._nr_1_pi_tro_-1_co.pdf', 'rys._nr_1_pi_tro_-1_co.pdf', 'application/pdf', 'drawing', -1, 691233, '2026-06-11T08:12:40.223Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/1399c759-02c7-4bcc-b2ae-947f9653096d/ec77f184-1cae-40d8-b086-7fe03dd4f8ca-kopia_3._rzut_parteru.pdf', 'kopia_3._rzut_parteru.pdf', 'application/pdf', 'drawing', 0, 1733232, '2026-06-01T06:18:43.152Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/1399c759-02c7-4bcc-b2ae-947f9653096d/fbdb5c79-e116-4221-9732-6dd0a594b37d-nr_5_parter_wod-kan.pdf', 'nr_5_parter_wod-kan.pdf', 'application/pdf', 'drawing', 0, 2051715, '2026-06-01T06:26:50.391Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/1399c759-02c7-4bcc-b2ae-947f9653096d/135cc603-3899-4643-b19c-2f85a84c1f79-nr_3_parter_went.pdf', 'nr_3_parter_went.pdf', 'application/pdf', 'drawing', 0, 2353133, '2026-06-01T06:43:23.372Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/1399c759-02c7-4bcc-b2ae-947f9653096d/48d2f91c-2248-400e-ba82-50bc1190a1a7-rys._nr_2_parter_co.pdf', 'rys._nr_2_parter_co.pdf', 'application/pdf', 'drawing', 0, 787852, '2026-06-11T08:14:09.325Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/d9d9ac70-d034-4a47-8942-9d6d7f9d73c6/d0814efb-fc9f-4b06-a6ab-b93036252b4e-nr_6_i_pi_tro_wod-kan.pdf', 'nr_6_i_pi_tro_wod-kan.pdf', 'application/pdf', 'drawing', 1, 592494, '2026-05-19T12:43:42.310Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/d9d9ac70-d034-4a47-8942-9d6d7f9d73c6/a80f23af-b14a-4e24-b059-fff03fa4128a-nr_3_i_pi_tro_co.pdf', 'nr_3_i_pi_tro_co.pdf', 'application/pdf', 'drawing', 1, 586349, '2026-05-19T12:43:43.038Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/d9d9ac70-d034-4a47-8942-9d6d7f9d73c6/68998c05-5daa-471c-9660-bf3115d52676-e22_-_pi_tro_1_el.pdf', 'e22_-_pi_tro_1_el.pdf', 'application/pdf', 'drawing', 1, 833901, '2026-05-19T12:43:43.979Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/d9d9ac70-d034-4a47-8942-9d6d7f9d73c6/807b84d6-a8aa-43ef-8f74-18d3e38398f8-4._rzut_pi_tra_1_31.10.2025.pdf', '4._rzut_pi_tra_1_31.10.2025.pdf', 'application/pdf', 'drawing', 1, 12347051, '2026-05-19T12:43:47.565Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/d9d9ac70-d034-4a47-8942-9d6d7f9d73c6/6891d737-989d-4354-97c1-e152716de11a-nr_4_pi_tro_1_went.pdf', 'nr_4_pi_tro_1_went.pdf', 'application/pdf', 'drawing', 1, 613682, '2026-06-01T06:44:53.359Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/d9d9ac70-d034-4a47-8942-9d6d7f9d73c6/58570340-c0e1-47ce-9be8-a0ee4f2ee0ff-img_3722.jpeg', 'img_3722.jpeg', 'image/jpeg', 'documentation', 1, 1925840, '2026-08-12T09:40:43.508Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/d9d9ac70-d034-4a47-8942-9d6d7f9d73c6/31a9205d-0d8c-4818-8a2f-21516afa2d40-img_3720.jpeg', 'img_3720.jpeg', 'image/jpeg', 'documentation', 1, 2635822, '2026-08-12T09:40:44.931Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/d9d9ac70-d034-4a47-8942-9d6d7f9d73c6/33e0e9b2-7958-4a9d-8a62-d2b537a08446-img_3721.jpeg', 'img_3721.jpeg', 'image/jpeg', 'documentation', 1, 2286831, '2026-08-12T09:40:45.768Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/4e369160-8c5b-4b88-8247-051d8fc1769a-nr_7_pi_tro_2_wod-kan.pdf', 'nr_7_pi_tro_2_wod-kan.pdf', 'application/pdf', 'drawing', 2, 551151, '2026-06-01T06:28:17.680Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/dd64ff1a-852c-4551-9c40-79df4f7cb1fb-5._rzut_pi_tra_2_31.10.2025.pdf', '5._rzut_pi_tra_2_31.10.2025.pdf', 'application/pdf', 'drawing', 2, 1375505, '2026-06-01T06:36:13.330Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/96d375f9-e0ee-4046-828f-ea6c921c8503-nr_5_pi_tro_2_went.pdf', 'nr_5_pi_tro_2_went.pdf', 'application/pdf', 'drawing', 2, 577159, '2026-06-01T06:45:17.697Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/8df30b63-8da7-43b2-8d44-1b1536393060-e23_-_pi_tro_2_el.pdf', 'e23_-_pi_tro_2_el.pdf', 'application/pdf', 'drawing', 2, 786063, '2026-06-09T12:31:06.164Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/924b11fe-7865-45d1-aba1-58f2e50705f1-rys._nr_4_pi_tro_2_co.pdf', 'rys._nr_4_pi_tro_2_co.pdf', 'application/pdf', 'drawing', 2, 564260, '2026-06-11T08:17:43.352Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/4f61803c-aa95-4ea9-8f68-bf48acaab931-img_3717.jpeg', 'img_3717.jpeg', 'image/jpeg', 'documentation', 2, 2033875, '2026-08-12T09:42:52.420Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/632f82ab-351a-45a7-b06a-68522b73cdc6-img_3719.jpeg', 'img_3719.jpeg', 'image/jpeg', 'documentation', 2, 1692506, '2026-08-12T09:42:55.477Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/2175437b-74d8-4a07-a904-11fcbf7de1f6-img_3718.jpeg', 'img_3718.jpeg', 'image/jpeg', 'documentation', 2, 1816473, '2026-08-12T09:43:06.985Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/1f69d66f-c3a1-4a52-a1e8-f43e6dc1585d-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 2, 2220705, '2026-08-12T09:43:08.343Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/7aa09d51-3cd9-453a-97fa-671284452e27-img_3903.jpeg', 'img_3903.jpeg', 'image/jpeg', 'documentation', 2, 2946339, '2026-08-19T09:01:41.708Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/beb40a99-0767-468c-ad81-382ffc4dae95-img_3905.jpeg', 'img_3905.jpeg', 'image/jpeg', 'documentation', 2, 2695777, '2026-08-19T09:01:41.864Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/ceb74c94-d110-4b56-9fd4-0434715d75ce-img_3904.jpeg', 'img_3904.jpeg', 'image/jpeg', 'documentation', 2, 3065936, '2026-08-19T09:01:48.286Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/08f8f749-d169-43e2-a80c-0145e53ecdf7-img_3902.jpeg', 'img_3902.jpeg', 'image/jpeg', 'documentation', 2, 3090420, '2026-08-19T09:01:48.589Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/19cf7393-d8c1-407a-a8c1-cd682645891e-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 2, 3008045, '2026-08-21T06:15:27.653Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c68b2d08-75af-40fb-9e3a-6bedfa03f641/edd61f20-9e8d-4b56-abd7-1630cd733cdc-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 2, 2826404, '2026-08-21T06:16:42.416Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/503bcf66-f065-4e64-8e03-549a0a7fa9f0/70d24d35-ef40-4e23-96a7-69c82262bf68-nr_8_pi_tro_3_wod-kan.pdf', 'nr_8_pi_tro_3_wod-kan.pdf', 'application/pdf', 'drawing', 3, 547307, '2026-06-01T06:28:55.531Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/503bcf66-f065-4e64-8e03-549a0a7fa9f0/b0c0638e-d0be-4038-83d4-a968a8e64b89-6._rzut_pi_tra_3._02.02.2026.pdf', '6._rzut_pi_tra_3._02.02.2026.pdf', 'application/pdf', 'drawing', 3, 1364377, '2026-06-01T06:36:42.353Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/503bcf66-f065-4e64-8e03-549a0a7fa9f0/29777c3b-4769-4092-9421-0a81892a3007-nr_6_pi_tro_3_went.pdf', 'nr_6_pi_tro_3_went.pdf', 'application/pdf', 'drawing', 3, 576573, '2026-06-01T06:45:47.179Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/503bcf66-f065-4e64-8e03-549a0a7fa9f0/071ca3d0-9bbc-4603-8ae5-508eddde3687-e24_-_pi_tro_3_el.pdf', 'e24_-_pi_tro_3_el.pdf', 'application/pdf', 'drawing', 3, 778053, '2026-06-09T12:31:57.280Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/503bcf66-f065-4e64-8e03-549a0a7fa9f0/c396db89-1054-460f-ab49-f3d29e712157-rys._nr_5_pi_tro_3_co.pdf', 'rys._nr_5_pi_tro_3_co.pdf', 'application/pdf', 'drawing', 3, 563891, '2026-06-11T08:19:22.668Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/503bcf66-f065-4e64-8e03-549a0a7fa9f0/e61f3971-c46e-4fb7-8125-26f5492e8c71-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 3, 1656184, '2026-07-10T06:26:03.283Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/503bcf66-f065-4e64-8e03-549a0a7fa9f0/95f6bc19-a8cc-428d-b10e-1cc2550dc231-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 3, 3296794, '2026-07-10T06:27:25.746Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6/b82e2fec-a57d-4971-b8fd-2f44ae5073ef-nr_9_pi_tro_4_wod-kan.pdf', 'nr_9_pi_tro_4_wod-kan.pdf', 'application/pdf', 'drawing', 4, 547056, '2026-06-01T06:29:26.760Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6/6a1d8aaf-be8c-4192-9d13-6885e13bb9f4-7._rzut_pi_tra_4_06.11.25.pdf', '7._rzut_pi_tra_4_06.11.25.pdf', 'application/pdf', 'drawing', 4, 1395221, '2026-06-01T06:37:04.742Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6/b69f0ad9-fbcf-437a-bec3-bdb38408dea5-nr_7_pi_tro_4_went.pdf', 'nr_7_pi_tro_4_went.pdf', 'application/pdf', 'drawing', 4, 575970, '2026-06-01T06:46:45.778Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6/5b66d0f6-2488-4cd6-b869-1ccfc6d5c8e0-e25_-_pi_tro_4_el.pdf', 'e25_-_pi_tro_4_el.pdf', 'application/pdf', 'drawing', 4, 770985, '2026-06-09T12:30:27.018Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6/243ca12c-dafe-4316-b601-1b319f77788a-rys._nr_6_pi_tro_4_co.pdf', 'rys._nr_6_pi_tro_4_co.pdf', 'application/pdf', 'drawing', 4, 563928, '2026-06-11T08:19:57.393Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6/9e114e93-2a0c-43c5-8cb6-25589e967564-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 4, 1964106, '2026-07-10T06:25:18.183Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6/5dafa22e-efe7-4059-871a-f04fbe6a4f31-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 4, 2999429, '2026-07-10T06:25:19.168Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6/9dfdab83-6051-45a0-b50e-f6c270398dfe-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 4, 2527834, '2026-07-10T06:25:20.744Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/f5125cd3-d724-48b3-9736-6855aeee87e0/63cfd2c2-2898-4970-b446-ee16d8c00f58-nr_10_p_tro_5_wod-kan.pdf', 'nr_10_p_tro_5_wod-kan.pdf', 'application/pdf', 'drawing', 5, 543427, '2026-06-01T06:29:51.592Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/f5125cd3-d724-48b3-9736-6855aeee87e0/85f144a7-b05f-4229-b908-06d363ff5910-8._rzut_pi_tra_5_31.10.2025.pdf', '8._rzut_pi_tra_5_31.10.2025.pdf', 'application/pdf', 'drawing', 5, 1365910, '2026-06-01T06:37:22.604Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/f5125cd3-d724-48b3-9736-6855aeee87e0/fafde225-ff71-46a2-8c74-ef4a88d69ace-nr_8_pi_tro_5_went.pdf', 'nr_8_pi_tro_5_went.pdf', 'application/pdf', 'drawing', 5, 557625, '2026-06-01T06:47:10.123Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/f5125cd3-d724-48b3-9736-6855aeee87e0/cbe512ba-30a1-4f90-a638-4472cccdd54c-e26_-_pi_tro_5_el.pdf', 'e26_-_pi_tro_5_el.pdf', 'application/pdf', 'drawing', 5, 741108, '2026-06-09T12:40:26.934Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/f5125cd3-d724-48b3-9736-6855aeee87e0/7aa6e4ba-6d01-420c-b6b1-e3707d3ba582-rys._nr_7_pi_tro_5_co.pdf', 'rys._nr_7_pi_tro_5_co.pdf', 'application/pdf', 'drawing', 5, 550824, '2026-06-11T08:20:22.936Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/f5125cd3-d724-48b3-9736-6855aeee87e0/f0bf104a-0919-4a3b-ad97-c4ba5944419a-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 5, 2497053, '2026-07-10T06:22:23.181Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/f5125cd3-d724-48b3-9736-6855aeee87e0/90703ddf-f1dc-42d5-a55b-427f7754c6a8-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 5, 2223008, '2026-07-10T06:22:23.978Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/f5125cd3-d724-48b3-9736-6855aeee87e0/3a8c405b-2bd0-4255-8af9-dda688d58b34-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 5, 3142502, '2026-07-10T06:22:24.669Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/f5125cd3-d724-48b3-9736-6855aeee87e0/1fb82a51-591c-460d-8d5b-37634925f004-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 5, 2155512, '2026-07-10T06:22:25.119Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/f5125cd3-d724-48b3-9736-6855aeee87e0/03eb2e13-2184-4884-b1e1-aedd8ba6c147-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 5, 2842621, '2026-07-10T06:24:02.520Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/f5125cd3-d724-48b3-9736-6855aeee87e0/5935ab87-afad-4562-a452-f98c8d68f331-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 5, 2096072, '2026-07-10T06:24:21.627Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/f5125cd3-d724-48b3-9736-6855aeee87e0/ab548aef-9209-40c5-afa5-bfeb64b04e78-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 5, 3023237, '2026-07-10T06:24:21.630Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/f5125cd3-d724-48b3-9736-6855aeee87e0/36a691f5-53f6-4519-b8e3-db21a771900d-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 5, 2422726, '2026-07-10T06:24:23.736Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/ecf158d9-d8f8-4024-a38d-f0325ee21f67/b46eb191-6367-4c5f-8c74-b55b1aa3aa6c-nr_11_pi_tro_6_wod-kan.pdf', 'nr_11_pi_tro_6_wod-kan.pdf', 'application/pdf', 'drawing', 6, 545700, '2026-06-01T06:30:05.836Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/ecf158d9-d8f8-4024-a38d-f0325ee21f67/5cd5329e-6d5f-4269-8980-c756c729f038-9._rzut_pi_tra_6_31.10.2025.pdf', '9._rzut_pi_tra_6_31.10.2025.pdf', 'application/pdf', 'drawing', 6, 1362192, '2026-06-01T06:37:38.812Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/ecf158d9-d8f8-4024-a38d-f0325ee21f67/4f6fd893-932a-4a48-9374-36773aff75df-nr_9_pi_tro_6_went.pdf', 'nr_9_pi_tro_6_went.pdf', 'application/pdf', 'drawing', 6, 561915, '2026-06-01T06:47:39.677Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/ecf158d9-d8f8-4024-a38d-f0325ee21f67/0cad55e0-a673-472e-8ee1-b3c4dc28b111-e27_-_pi_tro_6_el.pdf', 'e27_-_pi_tro_6_el.pdf', 'application/pdf', 'drawing', 6, 726848, '2026-06-09T12:42:00.367Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/ecf158d9-d8f8-4024-a38d-f0325ee21f67/2c2707a0-26a9-4039-a3d2-a995782a2562-rys._nr_8_pi_tro_6_co.pdf', 'rys._nr_8_pi_tro_6_co.pdf', 'application/pdf', 'drawing', 6, 555090, '2026-06-11T08:23:54.738Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/ecf158d9-d8f8-4024-a38d-f0325ee21f67/7fa7d154-900c-4e01-a24e-eedad6abff02-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 6, 3265745, '2026-07-10T06:21:28.706Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/ecf158d9-d8f8-4024-a38d-f0325ee21f67/0fedd007-831b-46e7-a040-450b39763c10-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 6, 1614975, '2026-07-10T06:21:30.988Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/ecf158d9-d8f8-4024-a38d-f0325ee21f67/7a61046e-b6a7-47c2-9600-9644142b7cfa-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 6, 1851119, '2026-07-10T06:21:31.819Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/ecf158d9-d8f8-4024-a38d-f0325ee21f67/4975d768-bc73-4b37-8365-09fe6efd22d0-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 6, 1740589, '2026-07-10T06:21:32.095Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/ecf158d9-d8f8-4024-a38d-f0325ee21f67/335cf57b-a626-44cb-8024-e58e4e92f445-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 6, 3353699, '2026-07-16T11:34:44.572Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/ecf158d9-d8f8-4024-a38d-f0325ee21f67/5e4db2f2-92e3-4598-81b8-b3f0eb60a6bf-image.jpg', 'image.jpg', 'image/jpeg', 'documentation', 6, 2192958, '2026-07-16T11:34:44.957Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c30b485c-24f9-48f2-a62f-92bd3170a633/162eb527-aaf2-4066-8d8a-e58cab9120b6-nr_12_dach_wod-kan.pdf', 'nr_12_dach_wod-kan.pdf', 'application/pdf', 'drawing', 7, 422136, '2026-06-01T06:30:25.665Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c30b485c-24f9-48f2-a62f-92bd3170a633/22764c7c-3a8e-44da-a6b2-031bd15d81c9-kopia_10._rzut_dachu.pdf', 'kopia_10._rzut_dachu.pdf', 'application/pdf', 'drawing', 7, 1019501, '2026-06-01T06:37:57.672Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/floors/c30b485c-24f9-48f2-a62f-92bd3170a633/8f127848-153b-47b4-b683-56891c4d6876-nr_10_dach_went.pdf', 'nr_10_dach_went.pdf', 'application/pdf', 'drawing', 7, 404804, '2026-06-01T06:48:08.112Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/projects/d554a1b7-cef2-421f-b8d8-904378658c6d/a2cd69d9-7e30-42cc-b403-29ed2c4d3655-20260825_130119.jpg', '20260825_130119.jpg', 'image/jpeg', 'documentation', NULL, 2570655, '2026-08-25T12:15:47.595Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/projects/d554a1b7-cef2-421f-b8d8-904378658c6d/c884b4c2-5aa5-429d-8adc-712e24571c4c-20260825_130115.jpg', '20260825_130115.jpg', 'image/jpeg', 'documentation', NULL, 2726600, '2026-08-25T12:16:03.975Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/projects/d554a1b7-cef2-421f-b8d8-904378658c6d/e83b3f4e-1eaf-4a01-bdc4-ead5eb3e1b43-20260825_125954.jpg', '20260825_125954.jpg', 'image/jpeg', 'documentation', NULL, 3336460, '2026-08-25T12:16:04.759Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/e2739ce2-38e6-4ba2-b38c-7974096029f0/a2b31a03-51fd-4ed7-927d-72ef8a76f7db-ul._bohater_w_getta_14_m._12_-_zmiany_elektryczne_i_teletechniczne.pdf', '[G01] ul._bohater_w_getta_14_m._12_-_zmiany_elektryczne_i_teletechniczne.pdf', 'application/pdf', 'documentation', NULL, 1293158, '2026-05-19T12:47:20.355Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/e2739ce2-38e6-4ba2-b38c-7974096029f0/92450eea-b2a3-4782-9d1a-f42e4973c5a8-ul._bohater_w_getta_14_m._12_-_zmiany_cian_sanitarne.pdf', '[G01] ul._bohater_w_getta_14_m._12_-_zmiany_cian_sanitarne.pdf', 'application/pdf', 'documentation', NULL, 1633172, '2026-05-19T12:47:21.068Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/e2739ce2-38e6-4ba2-b38c-7974096029f0/076c5c12-234f-47ae-9f44-de8234a7f3aa-ul._bohater_w_getta_14_m._12_-_zmiany_sanitarne_-_polecenie.pdf', '[G01] ul._bohater_w_getta_14_m._12_-_zmiany_sanitarne_-_polecenie.pdf', 'application/pdf', 'documentation', NULL, 2272370, '2026-06-02T12:16:18.744Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/04047ff4-b57b-406a-9d00-3fd4b4f964a0/41eaa3bc-033c-489f-bea3-92cf209d5b94-ul._boh._getta_m._14_-_zmiany_inst_elektr_teletech..pdf', '[G02] ul._boh._getta_m._14_-_zmiany_inst_elektr_teletech..pdf', 'application/pdf', 'documentation', NULL, 368651, '2026-05-19T12:47:41.834Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/04047ff4-b57b-406a-9d00-3fd4b4f964a0/72e76b33-93a8-4baa-a7f4-5681720d769e-ul._boh._getta_m._14_-_zmiany_sanitarne.pdf', '[G02] ul._boh._getta_m._14_-_zmiany_sanitarne.pdf', 'application/pdf', 'documentation', NULL, 584473, '2026-05-19T12:47:42.331Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/04047ff4-b57b-406a-9d00-3fd4b4f964a0/15a7f2b7-808f-48a5-96f4-5daaa750d9a1-ul._boh._getta_m._14_-_zmiany_cian.pdf', '[G02] ul._boh._getta_m._14_-_zmiany_cian.pdf', 'application/pdf', 'documentation', NULL, 433080, '2026-05-19T12:47:42.830Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/04047ff4-b57b-406a-9d00-3fd4b4f964a0/f4ce8ab2-ff89-4024-b1aa-9e14c1584924-ul._boh._getta_m._p._42_poziom_-2_-_pkt._ad._sam._elektr..pdf', '[G02] ul._boh._getta_m._p._42_poziom_-2_-_pkt._ad._sam._elektr..pdf', 'application/pdf', 'documentation', NULL, 343321, '2026-08-27T10:17:11.992Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/2fc95609-30df-42d2-b35e-79ae2c917081/312daee8-20ea-4331-a188-d198b3c37589-ul._boh._getta_m._15_-_zmiany_sanitarne_2_.pdf', '[G03] ul._boh._getta_m._15_-_zmiany_sanitarne_2_.pdf', 'application/pdf', 'documentation', NULL, 557743, '2026-05-19T12:48:00.294Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/2fc95609-30df-42d2-b35e-79ae2c917081/37e95f6b-9f47-4612-9308-57faf8cc772d-ul._bohater_w_getta_m._15_-_zmiany_elektr._teletech._poprawa.pdf', '[G03] ul._bohater_w_getta_m._15_-_zmiany_elektr._teletech._poprawa.pdf', 'application/pdf', 'documentation', NULL, 357135, '2026-05-19T12:48:00.739Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/2fc95609-30df-42d2-b35e-79ae2c917081/33426e45-b4fb-499a-a05b-80e1ff25f71f-ul._bohater_w_getta_m._15_-_zmiany_cian_dzia_owych.pdf', '[G03] ul._bohater_w_getta_m._15_-_zmiany_cian_dzia_owych.pdf', 'application/pdf', 'documentation', NULL, 367100, '2026-05-19T12:48:01.457Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/2fc95609-30df-42d2-b35e-79ae2c917081/eb3e6d52-27f9-4c16-ad65-410564789c27-image.jpg', '[G03] image.jpg', 'image/jpeg', 'documentation', NULL, 1991013, '2026-06-24T06:08:17.954Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/2fc95609-30df-42d2-b35e-79ae2c917081/8f577e1f-c1d3-448b-aacb-d23a9d33e4ad-image.jpg', '[G03] image.jpg', 'image/jpeg', 'documentation', NULL, 2123715, '2026-06-24T06:08:19.849Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/2fc95609-30df-42d2-b35e-79ae2c917081/b1944342-e6d6-41df-a0af-00ed797088ae-img_3633.jpeg', '[G03] img_3633.jpeg', 'image/jpeg', 'documentation', NULL, 2108777, '2026-06-24T06:08:21.843Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/84efb4af-c81c-4444-afe6-9028b724cea6/85037ed0-5cff-4cd5-b083-096f9ec319f8-ul._bohater_w_getta_14_m._16_-_zmiany_elektryczne_i_teletechniczne.pdf', '[G04] ul._bohater_w_getta_14_m._16_-_zmiany_elektryczne_i_teletechniczne.pdf', 'application/pdf', 'documentation', NULL, 1408324, '2026-05-19T12:48:16.776Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/84efb4af-c81c-4444-afe6-9028b724cea6/92b4fb6e-688b-42d5-b4ab-41e3ed98ae96-ul._bohater_w_getta_14_m._16_-_zmiany_sanitarne_posadzka_-_polecenie.pdf', '[G04] ul._bohater_w_getta_14_m._16_-_zmiany_sanitarne_posadzka_-_polecenie.pdf', 'application/pdf', 'documentation', NULL, 2104809, '2026-05-19T12:48:17.529Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/0fdc6142-8f37-44d2-a87f-2d9c53d80442/7dcecaa8-f5ff-413e-99a0-ead7a4fdceb7-ul._bohater_w_getta_14_m._17_-_zmiany_elektryczne_i_teletechniczne.pdf', '[G05] ul._bohater_w_getta_14_m._17_-_zmiany_elektryczne_i_teletechniczne.pdf', 'application/pdf', 'documentation', NULL, 1467846, '2026-05-19T12:48:30.061Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/0fdc6142-8f37-44d2-a87f-2d9c53d80442/df5568db-9c39-4ae2-b99c-213ccac78cc6-ul._bohater_w_getta_14_m._17_-_zmiany_sanitarne_-_polecenie.pdf', '[G05] ul._bohater_w_getta_14_m._17_-_zmiany_sanitarne_-_polecenie.pdf', 'application/pdf', 'documentation', NULL, 2443422, '2026-05-19T12:48:31.024Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/0fdc6142-8f37-44d2-a87f-2d9c53d80442/d6f63f82-aa13-4c81-b505-1b34594d6076-image.jpg', '[G05] image.jpg', 'image/jpeg', 'documentation', NULL, 2629634, '2026-06-24T06:02:39.386Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/0fdc6142-8f37-44d2-a87f-2d9c53d80442/df83f52a-a9e0-4a30-910f-199e7738ba98-image.jpg', '[G05] image.jpg', 'image/jpeg', 'documentation', NULL, 2489827, '2026-06-24T06:02:39.401Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/0fdc6142-8f37-44d2-a87f-2d9c53d80442/fda27cfc-823b-4799-8710-70f0b66dffbb-image.jpg', '[G05] image.jpg', 'image/jpeg', 'documentation', NULL, 1999066, '2026-06-24T06:02:41.079Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/a19e7268-2784-4c08-a741-134809dbe642/c341fb80-2956-4cdf-bd9d-2a4767a65ac5-ul._bohater_w_getta_14_m._26_-_zmiana_cian_dzia_owych.pdf', '[G06] ul._bohater_w_getta_14_m._26_-_zmiana_cian_dzia_owych.pdf', 'application/pdf', 'documentation', NULL, 1219495, '2026-05-19T12:50:50.322Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/a19e7268-2784-4c08-a741-134809dbe642/5409ff0d-1d62-43b5-a59a-34b196c01969-ul._bohater_w_getta_14_m._26_-_zmiany_elektryczne_i_teletechniczne.pdf', '[G06] ul._bohater_w_getta_14_m._26_-_zmiany_elektryczne_i_teletechniczne.pdf', 'application/pdf', 'documentation', NULL, 931879, '2026-05-19T12:50:50.867Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/a19e7268-2784-4c08-a741-134809dbe642/5a5da60d-f37b-4f0c-88d4-007259b50389-ul._bohater_w_getta_14_m._26_-_zmiany_sanitarne_-_polecenie.pdf', '[G06] ul._bohater_w_getta_14_m._26_-_zmiany_sanitarne_-_polecenie.pdf', 'application/pdf', 'documentation', NULL, 2211572, '2026-05-19T12:50:51.916Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/a19e7268-2784-4c08-a741-134809dbe642/873c1339-bfcf-453f-ae6a-38cc4d0f37cd-image.jpg', '[G06] image.jpg', 'image/jpeg', 'documentation', NULL, 2813914, '2026-06-24T06:41:38.896Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/a19e7268-2784-4c08-a741-134809dbe642/0a95e143-77fa-494e-a69d-d3a067039d03-image.jpg', '[G06] image.jpg', 'image/jpeg', 'documentation', NULL, 2936934, '2026-06-24T06:41:43.099Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/a19e7268-2784-4c08-a741-134809dbe642/e2826692-e4bd-41a5-98d3-4475ba5f9888-image.jpg', '[G06] image.jpg', 'image/jpeg', 'documentation', NULL, 2647618, '2026-06-24T06:41:43.196Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/cacf67b6-0e6e-4760-9db5-da7a49d66007/ec2d6dea-e94d-4e6c-8a2b-b96ecae412bc-ul._bohater_w_getta_14_m._33_-_zmiana_cian_dzia_owych.pdf', '[G07] ul._bohater_w_getta_14_m._33_-_zmiana_cian_dzia_owych.pdf', 'application/pdf', 'documentation', NULL, 784343, '2026-05-19T12:52:09.433Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/cacf67b6-0e6e-4760-9db5-da7a49d66007/cc02f8ca-ec30-4783-87c4-7c6f16000378-ul._bohater_w_getta_14_m._33_-_zmiany_posadzki.pdf', '[G07] ul._bohater_w_getta_14_m._33_-_zmiany_posadzki.pdf', 'application/pdf', 'documentation', NULL, 941040, '2026-06-02T12:13:37.513Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/cacf67b6-0e6e-4760-9db5-da7a49d66007/1b2f0e7e-2cb1-445e-bd0b-fcfcb5b10635-ul._bohater_w_getta_14_m._33_-_zmiany_sanitarne_-_polecenie.pdf', '[G07] ul._bohater_w_getta_14_m._33_-_zmiany_sanitarne_-_polecenie.pdf', 'application/pdf', 'documentation', NULL, 3437228, '2026-08-27T10:21:33.377Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/cacf67b6-0e6e-4760-9db5-da7a49d66007/9402f0fa-c52d-407f-b482-b6b7e8a87028-ul._bohater_w_getta_14_m._33_-_zmiany_elektryczne_i_teletechniczne.pdf', '[G07] ul._bohater_w_getta_14_m._33_-_zmiany_elektryczne_i_teletechniczne.pdf', 'application/pdf', 'documentation', NULL, 4187855, '2026-08-27T10:21:35.168Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/fad39ee1-4de5-4822-b3ae-c01bb6f4c578/b9d26d3e-0d5c-4e4a-a2d1-076b14496936-ul._boh._getta_m._39_-_zmiany_inst._elektr._teletech._aktualizacja.pdf', '[G08] ul._boh._getta_m._39_-_zmiany_inst._elektr._teletech._aktualizacja.pdf', 'application/pdf', 'documentation', NULL, 433255, '2026-05-19T12:52:20.169Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/fad39ee1-4de5-4822-b3ae-c01bb6f4c578/98a28291-4de8-46f7-adf6-abe99631e390-ul._boh._getta_m._39_-_zmiany_sanitarne_2_.pdf', '[G08] ul._boh._getta_m._39_-_zmiany_sanitarne_2_.pdf', 'application/pdf', 'documentation', NULL, 617600, '2026-05-19T12:52:20.953Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/fad39ee1-4de5-4822-b3ae-c01bb6f4c578/11237b0c-7a9b-45c9-98c2-3c6c8068dc34-ul._boh._getta_m._39_-_zmiany_wysok._otwor_w_drzwiowych.pdf', '[G08] ul._boh._getta_m._39_-_zmiany_wysok._otwor_w_drzwiowych.pdf', 'application/pdf', 'documentation', NULL, 350153, '2026-05-19T12:52:21.312Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/fad39ee1-4de5-4822-b3ae-c01bb6f4c578/19d94dea-0bd5-424b-8ec3-0c78a94c13d5-image.jpg', '[G08] image.jpg', 'image/jpeg', 'documentation', NULL, 2589379, '2026-06-24T11:33:07.084Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/fad39ee1-4de5-4822-b3ae-c01bb6f4c578/2b60fe0a-3178-4940-84b1-79694d69fa68-image.jpg', '[G08] image.jpg', 'image/jpeg', 'documentation', NULL, 2560015, '2026-06-24T11:33:08.877Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/72356612-b3c0-41f8-810c-f027f20a7796/19fdf8d4-1072-4b5f-8f41-36161dce9715-ul._boh._getta_m._44_-_zmiany_wentylacji.pdf', '[G09] ul._boh._getta_m._44_-_zmiany_wentylacji.pdf', 'application/pdf', 'documentation', NULL, 437483, '2026-05-19T12:53:23.058Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/72356612-b3c0-41f8-810c-f027f20a7796/e45912b9-30ef-4d0e-8acc-70b7ebf92f25-ul._boh._getta_m._44_54_-_zmiana_przekroju_pionu_wentylacyjnego.pdf', '[G09] ul._boh._getta_m._44_54_-_zmiana_przekroju_pionu_wentylacyjnego.pdf', 'application/pdf', 'documentation', NULL, 270457, '2026-05-19T12:53:23.615Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/72356612-b3c0-41f8-810c-f027f20a7796/f74f53f7-f324-448b-8cdf-1c9d3625b80b-image.jpg', '[G09] image.jpg', 'image/jpeg', 'documentation', NULL, 2666484, '2026-07-02T07:30:13.059Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/72356612-b3c0-41f8-810c-f027f20a7796/b7d26b98-aa64-4838-bbbc-084ae5e0d65c-ul._boh._getta_m._44_-_przewody_do_pod_og_wki.pdf', '[G09] ul._boh._getta_m._44_-_przewody_do_pod_og_wki.pdf', 'application/pdf', 'documentation', NULL, 425422, '2026-08-27T10:25:04.184Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/72356612-b3c0-41f8-810c-f027f20a7796/5fead870-5656-4b76-a1be-772840ebdf6f-ul._boh._getta_m._44_-_zmiany_inst._elektr._teletech._ostateczna_wersja.pdf', '[G09] ul._boh._getta_m._44_-_zmiany_inst._elektr._teletech._ostateczna_wersja.pdf', 'application/pdf', 'documentation', NULL, 739526, '2026-08-27T10:25:04.931Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/72356612-b3c0-41f8-810c-f027f20a7796/22af4644-a675-427c-b45e-9751d3303ac3-ul._boh._getta_m._44_-_aneks_c.o..pdf', '[G09] ul._boh._getta_m._44_-_aneks_c.o..pdf', 'application/pdf', 'documentation', NULL, 3316770, '2026-08-27T10:25:05.189Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/72356612-b3c0-41f8-810c-f027f20a7796/30121d31-3535-4d85-9569-dad532eb8456-ul._boh._getta_m._44_-_zmiany_cian_dzia_owych.pdf', '[G09] ul._boh._getta_m._44_-_zmiany_cian_dzia_owych.pdf', 'application/pdf', 'documentation', NULL, 315249, '2026-08-27T10:25:05.524Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/72356612-b3c0-41f8-810c-f027f20a7796/99c4a56d-3bb5-48cf-adf2-28da8d2160c0-ul._boh._getta_m._44_-_zmiany_sanitarne_2_.pdf', '[G09] ul._boh._getta_m._44_-_zmiany_sanitarne_2_.pdf', 'application/pdf', 'documentation', NULL, 753355, '2026-08-27T10:25:06.140Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/0cebacce-ff2f-442d-b418-d4296ab10863/5f6284a7-6ada-42d3-9858-3795ce2dde1f-ul._boh._getta_m._45_-_zmiana_kierunku_wypr._went..pdf', '[G10] ul._boh._getta_m._45_-_zmiana_kierunku_wypr._went..pdf', 'application/pdf', 'documentation', NULL, 283234, '2026-05-19T12:53:37.432Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/0cebacce-ff2f-442d-b418-d4296ab10863/c1896089-70ca-4215-943e-24bfd024e07a-ul._boh._getta_m._45_-_zmiany_inst._elektr._teletech..pdf', '[G10] ul._boh._getta_m._45_-_zmiany_inst._elektr._teletech..pdf', 'application/pdf', 'documentation', NULL, 643526, '2026-08-27T10:25:36.426Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/0cebacce-ff2f-442d-b418-d4296ab10863/e6ddae69-1cfe-4b6c-bf1c-b81f7fc39774-ul._boh._getta_m._45_-_zmiany_sanitarne_aktualizacja.pdf', '[G10] ul._boh._getta_m._45_-_zmiany_sanitarne_aktualizacja.pdf', 'application/pdf', 'documentation', NULL, 692836, '2026-08-27T10:25:37.055Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/0cebacce-ff2f-442d-b418-d4296ab10863/b08a4412-6203-4223-b915-11666394c37c-ul._boh._getta_m._45_-_zmiany_cian_dzia_owych.pdf', '[G10] ul._boh._getta_m._45_-_zmiany_cian_dzia_owych.pdf', 'application/pdf', 'documentation', NULL, 408393, '2026-08-27T10:25:37.300Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/f8f693b2-f2ff-4403-a289-c5389c86d14d/f20f3841-71e8-45fc-a7c2-02cdc6be1a43-ul._bohater_w_getta_14_m._46_-_zmiana_cian_dzia_owych.pdf', '[G11] ul._bohater_w_getta_14_m._46_-_zmiana_cian_dzia_owych.pdf', 'application/pdf', 'documentation', NULL, 1535104, '2026-05-19T12:53:48.738Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/f8f693b2-f2ff-4403-a289-c5389c86d14d/66e9f84d-a19c-4b1e-a148-77a92a7810a0-ul._bohater_w_getta_14_m._46_-_zmiany_elektryczne_i_teletechniczne.pdf', '[G11] ul._bohater_w_getta_14_m._46_-_zmiany_elektryczne_i_teletechniczne.pdf', 'application/pdf', 'documentation', NULL, 1198587, '2026-06-02T12:10:58.771Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/f8f693b2-f2ff-4403-a289-c5389c86d14d/581b6a8e-7df5-4aec-a28d-84afe8fe1fac-ul._bohater_w_getta_14_m._46_-_zmiany_sanitarne_-_polecenie.pdf', '[G11] ul._bohater_w_getta_14_m._46_-_zmiany_sanitarne_-_polecenie.pdf', 'application/pdf', 'documentation', NULL, 2690967, '2026-06-02T12:11:00.372Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/f8f693b2-f2ff-4403-a289-c5389c86d14d/02fa3fd2-96dc-4930-bc45-8f89d0670c26-ul._bohater_w_getta_14_m._46_-_zmiany_sanitarne_wentylacji_posadzki.pdf', '[G11] ul._bohater_w_getta_14_m._46_-_zmiany_sanitarne_wentylacji_posadzki.pdf', 'application/pdf', 'documentation', NULL, 1952524, '2026-06-02T12:11:00.643Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/fb60b0b3-33af-4828-83c9-5633965d0449/cad4d657-9133-493e-84b5-f5de544b848e-ul._bohater_w_getta_14_m._48_-_zmiany_elektryczne_i_teletechniczne.pdf', '[G12] ul._bohater_w_getta_14_m._48_-_zmiany_elektryczne_i_teletechniczne.pdf', 'application/pdf', 'documentation', NULL, 982801, '2026-05-19T12:54:00.302Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/fb60b0b3-33af-4828-83c9-5633965d0449/035f091e-d9c7-4490-91b2-6f6e7f404deb-image.jpg', '[G12] image.jpg', 'image/jpeg', 'documentation', NULL, 2745229, '2026-06-25T11:14:02.319Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/fb60b0b3-33af-4828-83c9-5633965d0449/45c4f5d4-89b5-4e1f-a7cb-7f7cba176ede-ul._bohater_w_getta_14_m._48_-_zmiany_sanitarne_-_polecenie_r.ptaszy_ski.pdf', '[G12] ul._bohater_w_getta_14_m._48_-_zmiany_sanitarne_-_polecenie_r.ptaszy_ski.pdf', 'application/pdf', 'documentation', NULL, 1552446, '2026-08-27T10:26:30.351Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/b9c6e952-b412-44f2-933a-1435a0c4ce99/e17d3d85-d714-41b6-9b6c-f5a26d31880b-ul._boh._getta_m._49_-_zmiany_sanitarne_2_.pdf', '[G13] ul._boh._getta_m._49_-_zmiany_sanitarne_2_.pdf', 'application/pdf', 'documentation', NULL, 494750, '2026-05-19T12:54:11.321Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/b9c6e952-b412-44f2-933a-1435a0c4ce99/5ae7b6e2-5b45-4f3e-aaae-12dc04628d31-ul._bohater_w_getta_m._49_-_zmiany_cianek.pdf', '[G13] ul._bohater_w_getta_m._49_-_zmiany_cianek.pdf', 'application/pdf', 'documentation', NULL, 409681, '2026-05-19T12:54:12.039Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/b9c6e952-b412-44f2-933a-1435a0c4ce99/90543bc4-6fda-4010-8121-e71f31b335c6-ul._boh._getta_m._49_-_zmiany_inst._elektr._teletech..pdf', '[G13] ul._boh._getta_m._49_-_zmiany_inst._elektr._teletech..pdf', 'application/pdf', 'documentation', NULL, 433329, '2026-06-02T12:07:32.397Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/b9c6e952-b412-44f2-933a-1435a0c4ce99/09334ea0-eb91-422c-a47a-3907fa549831-ul._boh._getta_m._49_-_bruzdy.pdf', '[G13] ul._boh._getta_m._49_-_bruzdy.pdf', 'application/pdf', 'documentation', NULL, 443385, '2026-08-27T10:27:04.050Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/279a9109-c39e-4d2c-91a2-b179b82ee6d8/d0d21619-a2a4-4160-8537-eeb7a8051996-ul._boh._getta_m._50_-_rezygnacja_z_went._tr_jniki_ks.pdf', '[G14] ul._boh._getta_m._50_-_rezygnacja_z_went._tr_jniki_ks.pdf', 'application/pdf', 'documentation', NULL, 280851, '2026-05-19T12:54:23.331Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/279a9109-c39e-4d2c-91a2-b179b82ee6d8/96829351-d3c4-4804-8e95-c14a8f30b89f-ul._boh._getta_m._50_-_zmiany_w_tr_j._kan..pdf', '[G14] ul._boh._getta_m._50_-_zmiany_w_tr_j._kan..pdf', 'application/pdf', 'documentation', NULL, 466741, '2026-05-19T12:54:24.021Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/279a9109-c39e-4d2c-91a2-b179b82ee6d8/87985e36-6fc5-4c4e-9079-bc166249d89a-ul._boh._getta_m._50_-_zmiany_inst._elektr._teletech._ostateczne.pdf', '[G14] ul._boh._getta_m._50_-_zmiany_inst._elektr._teletech._ostateczne.pdf', 'application/pdf', 'documentation', NULL, 356241, '2026-06-02T12:04:24.673Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/279a9109-c39e-4d2c-91a2-b179b82ee6d8/45d3d59d-f3ce-4005-8140-f4d4fb35ec49-ul._boh._getta_m._50_-_zmiany_cian_2_.pdf', '[G14] ul._boh._getta_m._50_-_zmiany_cian_2_.pdf', 'application/pdf', 'documentation', NULL, 248670, '2026-06-02T12:04:24.988Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/279a9109-c39e-4d2c-91a2-b179b82ee6d8/6e2acf79-d22f-40bb-8d2e-78154ce80a91-image.jpg', '[G14] image.jpg', 'image/jpeg', 'documentation', NULL, 2814344, '2026-06-25T11:16:40.299Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/279a9109-c39e-4d2c-91a2-b179b82ee6d8/12eafeda-e425-4d8e-98da-bcbb624d479a-image.jpg', '[G14] image.jpg', 'image/jpeg', 'documentation', NULL, 2979174, '2026-06-25T11:16:40.970Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/6b46d299-18a9-45ff-9aeb-e68cf501e772/fa4c0882-dd64-4b24-a556-933ac57edf7c-ul._boh._getta_m._55_-_zmiany_w_tr_j._kan..pdf', '[G15] ul._boh._getta_m._55_-_zmiany_w_tr_j._kan..pdf', 'application/pdf', 'documentation', NULL, 667376, '2026-05-19T12:55:16.972Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/6b46d299-18a9-45ff-9aeb-e68cf501e772/67324581-9fbb-427b-a18f-a258d37e1322-ul._boh._getta_m._55_-_zmiany_went..pdf', '[G15] ul._boh._getta_m._55_-_zmiany_went..pdf', 'application/pdf', 'documentation', NULL, 760801, '2026-05-19T12:55:17.530Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/6b46d299-18a9-45ff-9aeb-e68cf501e772/e00724d9-a9f6-419e-9b4c-ba317657ebb7-ul._boh._getta_m._55_-_zmiany_inst._elektr._teletech._ostateczne_2_.pdf', '[G15] ul._boh._getta_m._55_-_zmiany_inst._elektr._teletech._ostateczne_2_.pdf', 'application/pdf', 'documentation', NULL, 1113557, '2026-08-27T10:31:30.148Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/6b46d299-18a9-45ff-9aeb-e68cf501e772/b39f1688-54c3-4a4f-a877-ddeb04fe87c4-ul._boh._getta_m._55_-_zmiany_cian_dzia_owych_ostateczne.pdf', '[G15] ul._boh._getta_m._55_-_zmiany_cian_dzia_owych_ostateczne.pdf', 'application/pdf', 'documentation', NULL, 772198, '2026-08-27T10:31:30.518Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/5ccd53d1-ac11-47b8-beaf-c1c4dbe166c1/70fe8b7d-143e-4738-a393-34c4d46eb468-ul._bohater_w_getta_14_m._59_-_zmiana_cian_dzia_owych.pdf', '[G16] ul._bohater_w_getta_14_m._59_-_zmiana_cian_dzia_owych.pdf', 'application/pdf', 'documentation', NULL, 1542287, '2026-05-19T12:55:29.699Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/5ccd53d1-ac11-47b8-beaf-c1c4dbe166c1/aff21e4c-1cec-4531-a913-47aa80eb7004-ul._bohater_w_getta_14_m._59_-_zmiany_elektryczne_i_teletechniczne.pdf', '[G16] ul._bohater_w_getta_14_m._59_-_zmiany_elektryczne_i_teletechniczne.pdf', 'application/pdf', 'documentation', NULL, 3037022, '2026-06-02T11:53:59.141Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/5ccd53d1-ac11-47b8-beaf-c1c4dbe166c1/2ab7f749-e505-4aa0-bb54-68322cbe1bfa-ul._bohater_w_getta_14_m._59_-_zmiany_sanitarne_-_polecenie.pdf', '[G16] ul._bohater_w_getta_14_m._59_-_zmiany_sanitarne_-_polecenie.pdf', 'application/pdf', 'documentation', NULL, 2536583, '2026-06-02T11:53:59.471Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/19769c86-cfc0-48cb-9ce8-0c1dcc29278c/c7e4a86a-9663-4d08-9fa6-9daa7446180b-ul._bohater_w_getta_14_m._61_-_zmiana_cian_dzia_owych.pdf', '[G17] ul._bohater_w_getta_14_m._61_-_zmiana_cian_dzia_owych.pdf', 'application/pdf', 'documentation', NULL, 1027286, '2026-05-19T12:55:41.256Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/19769c86-cfc0-48cb-9ce8-0c1dcc29278c/338455c9-0adf-4794-99bd-32241d560a01-ul._bohater_w_getta_14_m._61_-_zmiany_elektryczne_i_teletechniczne.pdf', '[G17] ul._bohater_w_getta_14_m._61_-_zmiany_elektryczne_i_teletechniczne.pdf', 'application/pdf', 'documentation', NULL, 2573967, '2026-08-27T10:32:06.045Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/dba480d4-60f6-4de9-8716-570789769674/07b637ff-f458-42de-b193-5117bbc40a2d-ul._bohater_w_getta_14_m._35_-_zmiana_cian_dzia_owych.pdf', '[G18] ul._bohater_w_getta_14_m._35_-_zmiana_cian_dzia_owych.pdf', 'application/pdf', 'documentation', NULL, 2020185, '2026-06-02T12:12:58.679Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/dba480d4-60f6-4de9-8716-570789769674/01c37ef9-94da-46fa-86fd-7ac323f5c7d0-image.jpg', '[G18] image.jpg', 'image/jpeg', 'documentation', NULL, 2048944, '2026-06-24T11:25:00.960Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/dba480d4-60f6-4de9-8716-570789769674/3a4f7b57-f763-42a6-832a-95c5c5fa12fd-image.jpg', '[G18] image.jpg', 'image/jpeg', 'documentation', NULL, 1865826, '2026-06-24T11:25:02.864Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/dba480d4-60f6-4de9-8716-570789769674/089c5b7d-d135-4a29-bc2f-4e4188731a17-image.jpg', '[G18] image.jpg', 'image/jpeg', 'documentation', NULL, 2040322, '2026-06-24T11:25:03.206Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/dba480d4-60f6-4de9-8716-570789769674/451ce5f7-026a-43d8-90e3-9e64572c725b-image.jpg', '[G18] image.jpg', 'image/jpeg', 'documentation', NULL, 2463481, '2026-06-24T11:25:03.327Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/dba480d4-60f6-4de9-8716-570789769674/cc3ea0a8-af17-4096-a449-60fb8bbc4102-image.jpg', '[G18] image.jpg', 'image/jpeg', 'documentation', NULL, 2559475, '2026-06-24T11:25:04.323Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/dba480d4-60f6-4de9-8716-570789769674/8d86b976-af32-4676-8f5c-1070e6ed0485-image.jpg', '[G18] image.jpg', 'image/jpeg', 'documentation', NULL, 2078930, '2026-06-24T11:25:04.808Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/dba480d4-60f6-4de9-8716-570789769674/7c807581-8c4e-4ac0-90ee-23d7c0923624-image.jpg', '[G18] image.jpg', 'image/jpeg', 'documentation', NULL, 1969017, '2026-06-24T11:25:04.845Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/dba480d4-60f6-4de9-8716-570789769674/be018d5f-bf0f-451f-9b70-78dfd19a36f5-image.jpg', '[G18] image.jpg', 'image/jpeg', 'documentation', NULL, 2602521, '2026-06-24T11:25:05.446Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/dba480d4-60f6-4de9-8716-570789769674/2804d333-250d-43e2-a40a-1f4ca132e931-ul._bohater_w_getta_14_m._35_-_zmiany_elektryczne_i_teletechniczne4.pdf', '[G18] ul._bohater_w_getta_14_m._35_-_zmiany_elektryczne_i_teletechniczne4.pdf', 'application/pdf', 'documentation', NULL, 3437774, '2026-08-27T10:22:19.826Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/24dc4cf2-d4c5-4e37-82ad-784a367095f1/a37c8a02-c0b5-4241-8bdb-fca89d750659-image.jpg', '[G19] image.jpg', 'image/jpeg', 'documentation', NULL, 2551151, '2026-06-24T05:44:57.358Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/c6da793e-9955-48a8-8904-5be97c49cc29/40a4df26-6a4a-4dde-8d9b-ccfce5719fc6-image.jpg', '[G20] image.jpg', 'image/jpeg', 'documentation', NULL, 1836731, '2026-06-24T05:50:55.954Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/298977e9-9e76-4b44-ba2d-135d2b5d2786/baaf5ff6-7354-4e04-949c-4c90857a1a72-image.jpg', '[G21] image.jpg', 'image/jpeg', 'documentation', NULL, 3149030, '2026-06-24T05:56:42.300Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/298977e9-9e76-4b44-ba2d-135d2b5d2786/47ae2ccb-0473-494a-b4ba-41dae69b9bd6-image.jpg', '[G21] image.jpg', 'image/jpeg', 'documentation', NULL, 2281712, '2026-06-24T05:56:43.129Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/298977e9-9e76-4b44-ba2d-135d2b5d2786/c5932c9f-3e08-4afe-8156-dfcff0166b73-image.jpg', '[G21] image.jpg', 'image/jpeg', 'documentation', NULL, 2621085, '2026-08-24T12:14:55.192Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/5eccede0-2851-4699-9c13-822123b640ec/a57530a2-7e38-437e-a924-36de0a1102d8-image.jpg', '[G22] image.jpg', 'image/jpeg', 'documentation', NULL, 2446071, '2026-06-24T06:14:04.885Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/5eccede0-2851-4699-9c13-822123b640ec/ca8268aa-7ca1-4894-8f71-f3008f8673ca-image.jpg', '[G22] image.jpg', 'image/jpeg', 'documentation', NULL, 3171790, '2026-06-24T06:14:06.395Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/88040a0b-194c-4a62-92f8-776e7430f4d8/5f1dd340-7efd-4be4-9174-43ea2d8238d4-image.jpg', '[G23] image.jpg', 'image/jpeg', 'documentation', NULL, 2444834, '2026-06-24T06:24:55.907Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/d7a3ee2a-0644-4af2-8770-ef4d4e0f8298/b108cce9-3311-4558-acb4-d17c8d17b2bb-image.jpg', '[G24] image.jpg', 'image/jpeg', 'documentation', NULL, 2366800, '2026-06-24T06:32:55.403Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/e5dbaeeb-45e7-4d08-bd4e-b79879ead41c/ab46465d-790b-42c7-b2c9-e9a028eeab3f-image.jpg', '[G25] image.jpg', 'image/jpeg', 'documentation', NULL, 1957949, '2026-06-24T06:37:49.929Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/4f39e770-366c-4239-b06c-9c2266e4883c/4f3ed442-64d3-4ccc-8eb5-9cb6e64cbc37-image.jpg', '[G26] image.jpg', 'image/jpeg', 'documentation', NULL, 2831896, '2026-06-24T06:39:29.972Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/16ee6fed-c6b5-4cb8-8f48-68bc68af7979/c6277965-f40d-4477-8075-bfe78bf067eb-image.jpg', '[G27] image.jpg', 'image/jpeg', 'documentation', NULL, 2793215, '2026-06-24T06:43:34.509Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/77e09bd5-0bcc-4b8b-8d3f-bd8fdba1e01d/45cacf3d-b72b-4102-8da6-4da56638ccd8-image.jpg', '[G28] image.jpg', 'image/jpeg', 'documentation', NULL, 2394426, '2026-06-24T06:46:02.717Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/77e09bd5-0bcc-4b8b-8d3f-bd8fdba1e01d/99284dd5-c1ff-41b3-b967-a52500cf41be-image.jpg', '[G28] image.jpg', 'image/jpeg', 'documentation', NULL, 2937796, '2026-06-24T06:46:03.481Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/9c8249f6-b056-476b-a01d-04afdaa2b9fe/d2e79c12-ca46-460d-ba0b-6e75728188fc-image.jpg', '[G29] image.jpg', 'image/jpeg', 'documentation', NULL, 2310624, '2026-06-24T11:09:48.453Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/9c8249f6-b056-476b-a01d-04afdaa2b9fe/4b88d281-16c1-447a-b03a-a0a6af6dcb1f-image.jpg', '[G29] image.jpg', 'image/jpeg', 'documentation', NULL, 2348775, '2026-06-24T11:09:49.934Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/9c8249f6-b056-476b-a01d-04afdaa2b9fe/dd698d63-9ae7-4a82-abb3-9afd3affdbc5-image.jpg', '[G29] image.jpg', 'image/jpeg', 'documentation', NULL, 2195430, '2026-06-24T11:09:50.910Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/912bc8e0-836a-4620-8313-626eaec13bda/a7ff69d8-1ecb-4420-9e1b-ec992ee516ab-image.jpg', '[G30] image.jpg', 'image/jpeg', 'documentation', NULL, 2903891, '2026-06-24T11:28:21.882Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/912bc8e0-836a-4620-8313-626eaec13bda/375b4014-e726-4653-af23-37a4f3a029cf-image.jpg', '[G30] image.jpg', 'image/jpeg', 'documentation', NULL, 2369535, '2026-06-24T11:28:22.793Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/912bc8e0-836a-4620-8313-626eaec13bda/fdf7d84f-1025-401b-8737-fd937aa75145-ul._bohater_w_getta_14_m._36_-_przer_bki_cian.pdf', '[G30] ul._bohater_w_getta_14_m._36_-_przer_bki_cian.pdf', 'application/pdf', 'documentation', NULL, 404602, '2026-08-27T10:22:48.106Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/912bc8e0-836a-4620-8313-626eaec13bda/69ab0d63-f8b2-426f-8b00-47976f5c31be-ul._bohater_w_getta_14_m._36_-_zmiany_elektryczne_i_teletechniczne.pdf', '[G30] ul._bohater_w_getta_14_m._36_-_zmiany_elektryczne_i_teletechniczne.pdf', 'application/pdf', 'documentation', NULL, 1348982, '2026-08-27T10:22:49.140Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/912bc8e0-836a-4620-8313-626eaec13bda/49327291-5650-469b-967c-8e52b987499a-ul._bohater_w_getta_14_m._36_-_zmiany_sanitarne_-_polecenie.pdf', '[G30] ul._bohater_w_getta_14_m._36_-_zmiany_sanitarne_-_polecenie.pdf', 'application/pdf', 'documentation', NULL, 1589547, '2026-08-27T10:22:50.001Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/3ac28d01-b8e6-4a21-bda1-fab1cc79fbd0/b369c6c5-bf68-41a5-a42e-727c1cb4ed0e-image.jpg', '[G31] image.jpg', 'image/jpeg', 'documentation', NULL, 2620065, '2026-06-24T11:29:31.290Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/8c58258e-34d9-4780-82a5-920f4d3bbbc4/e0e6c25e-49a2-4d56-83a2-9360cd3d5bc6-image.jpg', '[G32] image.jpg', 'image/jpeg', 'documentation', NULL, 1974005, '2026-06-24T11:30:52.580Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/0534f348-148b-4a9c-afa9-5616a6d26344/fdd83dcd-f276-4c17-acbf-3082a9f0108a-image.jpg', '[G33] image.jpg', 'image/jpeg', 'documentation', NULL, 2375061, '2026-06-24T11:50:03.167Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/9e2aceb3-d26a-465b-87d0-9a59939f3697/20ac0773-6512-47a0-bd1d-56ec341678cd-image.jpg', '[G34] image.jpg', 'image/jpeg', 'documentation', NULL, 2049840, '2026-06-25T11:20:56.070Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/23a9c3c9-945e-4910-83d5-37fcd7306917/b846aa80-7e1d-4ffc-8067-b28ff5dca387-img_3795.jpeg', '[G35] img_3795.jpeg', 'image/jpeg', 'documentation', NULL, 3221781, '2026-07-20T06:42:41.524Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/23a9c3c9-945e-4910-83d5-37fcd7306917/920d4203-cd5d-44ed-8103-f5f2802de5e9-img_3796.jpeg', '[G35] img_3796.jpeg', 'image/jpeg', 'documentation', NULL, 3170448, '2026-07-20T06:42:42.803Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/23a9c3c9-945e-4910-83d5-37fcd7306917/b3f22ae3-eef5-41d6-96a6-242bf2caeb9b-img_3797.jpeg', '[G35] img_3797.jpeg', 'image/jpeg', 'documentation', NULL, 2923001, '2026-07-20T06:42:43.113Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/23a9c3c9-945e-4910-83d5-37fcd7306917/7a425c57-ee0a-4b27-bca3-90a32f1f5d7a-ul._bohater_w_getta_14_m._42_-_zmiany_sanitarne_-_polecenie_r.ptaszy_ski.pdf', '[G35] ul._bohater_w_getta_14_m._42_-_zmiany_sanitarne_-_polecenie_r.ptaszy_ski.pdf', 'application/pdf', 'documentation', NULL, 1476405, '2026-08-27T10:23:34.504Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/23a9c3c9-945e-4910-83d5-37fcd7306917/bcf628a4-f153-4167-9d34-547ba63a4350-ul._bohater_w_getta_14_m._42_-_zmiany_elektryczne_i_teletechniczne.pdf', '[G35] ul._bohater_w_getta_14_m._42_-_zmiany_elektryczne_i_teletechniczne.pdf', 'application/pdf', 'documentation', NULL, 1210058, '2026-08-27T10:23:51.759Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/57e98b3a-3e5f-4661-82d7-0cff6a75b43a/d0d5d8c3-3fc9-4ee9-bd54-08dfa9db4a48-image.jpg', '[G36] image.jpg', 'image/jpeg', 'documentation', NULL, 4933902, '2026-08-06T10:58:25.228Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/57e98b3a-3e5f-4661-82d7-0cff6a75b43a/58e524f9-5a50-4f0d-9fba-03abe9d67bf8-image.jpg', '[G36] image.jpg', 'image/jpeg', 'documentation', NULL, 3304709, '2026-08-06T10:58:31.862Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/57e98b3a-3e5f-4661-82d7-0cff6a75b43a/6da41f1d-0ce9-4c12-9b64-4cca29d48d19-ul._boh._getta_m._54_-_przer_bki_cianek_dzia_owych.pdf', '[G36] ul._boh._getta_m._54_-_przer_bki_cianek_dzia_owych.pdf', 'application/pdf', 'documentation', NULL, 551275, '2026-08-27T10:31:02.551Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/57e98b3a-3e5f-4661-82d7-0cff6a75b43a/57795a89-6156-433e-93e6-e749bab9d4f2-ul._boh._getta_m._54_-_zmiany_inst._elektr._teletech._poprawa.pdf', '[G36] ul._boh._getta_m._54_-_zmiany_inst._elektr._teletech._poprawa.pdf', 'application/pdf', 'documentation', NULL, 971709, '2026-08-27T10:31:03.355Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/57e98b3a-3e5f-4661-82d7-0cff6a75b43a/3cb50f33-c8b7-4520-b431-3c0d76e9b011-ul._boh._getta_m._54_-_zmiany_sanitarne_2_.pdf', '[G36] ul._boh._getta_m._54_-_zmiany_sanitarne_2_.pdf', 'application/pdf', 'documentation', NULL, 693334, '2026-08-27T10:31:03.812Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/935e3411-d8d7-407b-99f1-9f521c04f882/fcc443e6-49ff-406f-97ee-f4896e75ccd1-image.jpg', '[G37] image.jpg', 'image/jpeg', 'documentation', NULL, 2375990, '2026-08-24T07:08:15.749Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/935e3411-d8d7-407b-99f1-9f521c04f882/7d8ea2f3-2cff-4dfe-ad13-cee6cf13724a-ul._boh._getta_m._11_-_zmiany_inst._elektr._teletech..pdf', '[G37] ul._boh._getta_m._11_-_zmiany_inst._elektr._teletech..pdf', 'application/pdf', 'documentation', NULL, 379725, '2026-08-27T10:09:07.469Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/935e3411-d8d7-407b-99f1-9f521c04f882/54a61a1b-49bf-4771-b460-e8c5dfe9f886-ul._boh._getta_m._11_-_zmiany_w_posadzce.pdf', '[G37] ul._boh._getta_m._11_-_zmiany_w_posadzce.pdf', 'application/pdf', 'documentation', NULL, 355346, '2026-08-27T10:09:07.673Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/53d28664-2881-4abb-8f8b-eba5c39b1adc/58132c19-de53-48f1-a2c9-dcf8f2d649e2-ul._boh._getta_m._23_-_zmiany_inst._elektr._teletech..pdf', '[G38] ul._boh._getta_m._23_-_zmiany_inst._elektr._teletech..pdf', 'application/pdf', 'documentation', NULL, 448689, '2026-08-27T10:19:17.737Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/53d28664-2881-4abb-8f8b-eba5c39b1adc/5ca73670-86cc-42e8-a3f6-43488cae0644-ul._boh._getta_m._23_-_zmiany_sanitarne.pdf', '[G38] ul._boh._getta_m._23_-_zmiany_sanitarne.pdf', 'application/pdf', 'documentation', NULL, 722756, '2026-08-27T10:19:18.298Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/0bba28b1-e2ad-4040-866e-ec0e5403da4b/31dba460-5aa0-4698-8617-955f288b5d8e-ul._boh._getta_m._52_-_zmiany_instalacji_elektr._teletech..jpg', '[G39] ul._boh._getta_m._52_-_zmiany_instalacji_elektr._teletech..jpg', 'image/jpeg', 'documentation', NULL, 43939, '2026-08-27T10:27:42.846Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/5ec60811-73a0-42b6-89c4-086799f2b5c4/eeb2e1f5-789e-46f8-9c2a-31cd7bc9863a-ul._boh._getta_m._53_-_zmiany_inst._elektr._teletech._poprawa.pdf', '[G40] ul._boh._getta_m._53_-_zmiany_inst._elektr._teletech._poprawa.pdf', 'application/pdf', 'documentation', NULL, 397876, '2026-08-27T10:28:08.244Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/5ec60811-73a0-42b6-89c4-086799f2b5c4/7367e489-be65-40d6-a63e-1c695df38674-ul._boh._getta_m._53_-_zmiany_sanitarne_2_.pdf', '[G40] ul._boh._getta_m._53_-_zmiany_sanitarne_2_.pdf', 'application/pdf', 'documentation', NULL, 538825, '2026-08-27T10:28:08.914Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/c784cbe2-abd7-4cdc-8793-ed12ce94389e/33184d1b-1b47-4c74-8a94-ffb0a90a848d-ul._boh._getta_m._62_-_zmiany_w_cianach_dzia_owych_ostateczne.pdf', '[G41] ul._boh._getta_m._62_-_zmiany_w_cianach_dzia_owych_ostateczne.pdf', 'application/pdf', 'documentation', NULL, 362906, '2026-08-27T10:32:32.109Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/c784cbe2-abd7-4cdc-8793-ed12ce94389e/803e5316-0d99-47f2-8f8c-e2104c79bf32-ul._boh._getta_m._62_-_zmiany_inst._elektr._teletech._ostateczna.pdf', '[G41] ul._boh._getta_m._62_-_zmiany_inst._elektr._teletech._ostateczna.pdf', 'application/pdf', 'documentation', NULL, 2351693, '2026-08-27T10:32:33.130Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/tasks/27c47975-0226-4342-a16f-41ed691db3a7/317fa650-16b5-4eb9-958c-b9e17c69d1c7-image.jpg', '[T01] image.jpg', 'image/jpeg', 'documentation', NULL, 2873725, '2026-08-19T12:21:20.513Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/tasks/dc31bbc7-ef57-4ca2-836d-bab3fa611239/c32c51f5-c950-4d1b-824a-6d95bb2dc260-image.jpg', '[T02] image.jpg', 'image/jpeg', 'documentation', NULL, 3789014, '2026-08-20T12:00:24.625Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/tasks/937288a5-fbdf-4ab3-9be7-0a21144198c5/28d59381-5cb6-49bd-8a08-17722206bf3b-image.jpg', '[T03] image.jpg', 'image/jpeg', 'documentation', NULL, 2878265, '2026-08-20T12:04:55.936Z'),
    ('6adeb5b6-361d-4adc-b1c9-a55b1354b0b9/tasks/a323a51b-743a-401a-ab8b-6ec9b0dd5eea/d52b93aa-573c-4973-a642-796be33e994b-image.jpg', '[T04] image.jpg', 'image/jpeg', 'documentation', NULL, 2917169, '2026-08-20T12:08:42.711Z')
),
ctx AS (
  SELECT p.id AS project_id, t.created_by AS uploader
  FROM projects p
  JOIN teams t ON t.id = p.team_id
  WHERE p.name = current_setting('app.project_name')
)
INSERT INTO files (
  project_id, location_id, floor_id, task_id, issue_id,
  name, storage_path, mime_type, size_bytes,
  uploaded_by, created_at, storage_provider, category
)
SELECT
  ctx.project_id,
  NULL::uuid,   -- location_id: the old location is gone
  f.id,         -- floor_id: NULL for project-level rows (src.level was NULL)
  NULL::uuid,   -- task_id: the old task is gone
  NULL::uuid,   -- issue_id
  src.name,
  src.storage_path,
  src.mime_type,
  src.size_bytes,
  ctx.uploader,
  src.created_at,
  'r2',
  src.category
FROM src
CROSS JOIN ctx
LEFT JOIN floors f
  ON src.level IS NOT NULL
 AND f.project_id = ctx.project_id
 AND f.kind = 'floor'
 AND f.level = src.level
WHERE NOT EXISTS (
  SELECT 1 FROM files x WHERE x.storage_path = src.storage_path
);

-- ============================================================
-- 3. Post-insert assertions (inside the transaction - rolls back on mismatch)
-- ============================================================

DO $$
DECLARE
  v_name    text := current_setting('app.project_name');
  v_project uuid;
  v_total   integer;
  v_floor   integer;
  v_proj    integer;
  v_nonr2   integer;
  r         record;
BEGIN
  SELECT id INTO v_project FROM projects WHERE name = v_name;

  SELECT count(*) INTO v_total FROM files WHERE project_id = v_project;
  IF v_total <> 212 THEN
    RAISE EXCEPTION
      'Verification FAILED: expected 212 files for project %, found %. Rolling back.',
      v_name, v_total;
  END IF;

  SELECT count(*) INTO v_floor FROM files WHERE project_id = v_project AND floor_id IS NOT NULL;
  IF v_floor <> 76 THEN
    RAISE EXCEPTION
      'Verification FAILED: expected 76 floor-level files, found %. Rolling back.', v_floor;
  END IF;

  SELECT count(*) INTO v_proj
  FROM files
  WHERE project_id = v_project
    AND floor_id IS NULL AND location_id IS NULL AND task_id IS NULL;
  IF v_proj <> 136 THEN
    RAISE EXCEPTION
      'Verification FAILED: expected 136 project-level files, found %. Rolling back.', v_proj;
  END IF;

  SELECT count(*) INTO v_nonr2
  FROM files WHERE project_id = v_project AND storage_provider <> 'r2';
  IF v_nonr2 <> 0 THEN
    RAISE EXCEPTION
      'Verification FAILED: % rows are not storage_provider=r2. Rolling back.', v_nonr2;
  END IF;

  -- Per-level distribution must match the approved mapping exactly.
  FOR r IN
    SELECT x.level, x.expected, count(fi.id) AS actual
    FROM (VALUES
      (-2, 3),
      (-1, 4),
      (0, 4),
      (1, 8),
      (2, 15),
      (3, 7),
      (4, 8),
      (5, 13),
      (6, 11),
      (7, 3)
    ) AS x(level, expected)
    JOIN floors f
      ON f.project_id = v_project AND f.kind = 'floor' AND f.level = x.level
    LEFT JOIN files fi ON fi.floor_id = f.id
    GROUP BY x.level, x.expected
  LOOP
    IF r.actual <> r.expected THEN
      RAISE EXCEPTION
        'Verification FAILED on level %: expected % files, found %. Rolling back.',
        r.level, r.expected, r.actual;
    END IF;
  END LOOP;

  RAISE NOTICE 'Verification OK: 212 files (76 floor-level, 136 project-level).';
END $$;

COMMIT;

-- ============================================================
-- 4. Result summary (runs after COMMIT)
--    Re-set the name here too - set_config above was transaction-local.
-- ============================================================

SELECT set_config('app.project_name', 'Budynek A', false);

SELECT
  COALESCE('level ' || f.level::text, 'project level') AS target,
  count(*)                                             AS files,
  count(*) FILTER (WHERE fi.category = 'drawing')      AS drawings,
  count(*) FILTER (WHERE fi.category = 'documentation') AS documentation,
  pg_size_pretty(sum(fi.size_bytes))                   AS size
FROM files fi
JOIN projects p ON p.id = fi.project_id AND p.name = current_setting('app.project_name')
LEFT JOIN floors f ON f.id = fi.floor_id
GROUP BY f.level
ORDER BY f.level NULLS LAST;

-- Recovery groups, so the [G##] prefixes are greppable straight from the DB.
SELECT
  substring(fi.name from '^\[([GT][0-9]+)\]') AS recovery_group,
  count(*)                                     AS files,
  min(fi.created_at)::date                     AS first_upload,
  max(fi.created_at)::date                     AS last_upload
FROM files fi
JOIN projects p ON p.id = fi.project_id AND p.name = current_setting('app.project_name')
WHERE fi.name ~ '^\[[GT][0-9]+\]'
GROUP BY 1
ORDER BY 1;
