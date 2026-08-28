-- KeySuite V4.14.10 — CHC G1 Independent Price List
-- Corrects V4.14.09 behaviour where G1 Price List followed mapped G2 prices.
--
-- CONFIRMED:
--   * CHC G1 has its OWN independent Price List.
--   * CHC G1 NEVER falls back to CHC G2 prices.
--   * CHC G2 price data / curve / technical data / dimensions / PDF remain unchanged.
--   * G1 technical/product master remains read-only; only the G1 Price List is owner-maintainable.
--   * G1 hydraulic Selection remains disabled.
--   * G1 price-list model set follows the supplied G1 Price List workbook: 374 rows.
--   * The supplied workbook pump-price cells are all 0, so initial production prices are stored as NULL
--     rather than RM0.00. Enter the real G1 prices in KeySuite Price List.
--
-- Safe to run more than once. Existing G1 price edits are preserved on rerun.

begin;

do $$
begin
  if to_regclass('public.ks_chc_generation_models_v41408') is null then
    raise exception 'V4.14.08 CHC G1 production data is missing. Run V41408_CHC_G1_PRODUCTION.sql first.';
  end if;
  if to_regclass('public.ks_products_chc') is null then
    raise exception 'Existing CHC G2 table public.ks_products_chc was not found.';
  end if;
end
$$;

create table if not exists public.ks_products_chc_g1 (
  id                text primary key,
  generation_code   text not null default 'G1' check (generation_code='G1'),
  product_category  text not null default 'CHC G1',
  model             text not null unique,
  source_row         integer,

  chc_usd            numeric,
  chcs_usd           numeric,
  chcn_usd           numeric,
  chc_rmb            numeric,
  chcs_rmb           numeric,
  chcn_rmb           numeric,
  chc_myr            numeric,
  chcs_myr           numeric,
  chcn_myr           numeric,

  chc_rarity_usd     text not null default 'common',
  chcs_rarity_usd    text not null default 'common',
  chcn_rarity_usd    text not null default 'common',
  chc_rarity_rmb     text not null default 'common',
  chcs_rarity_rmb    text not null default 'common',
  chcn_rarity_rmb    text not null default 'common',
  chc_rarity_myr     text not null default 'common',
  chcs_rarity_myr    text not null default 'common',
  chcn_rarity_myr    text not null default 'common',

  source_workbook    text not null default '010 - CHC G1 (Pricelist) - 260823 - V1.0.xlsx',
  updated_at         timestamptz not null default now(),
  updated_by         text,

  constraint ks_products_chc_g1_rarity_ck check (
    chc_rarity_usd in ('common','many','rare','fixed') and
    chcs_rarity_usd in ('common','many','rare','fixed') and
    chcn_rarity_usd in ('common','many','rare','fixed') and
    chc_rarity_rmb in ('common','many','rare','fixed') and
    chcs_rarity_rmb in ('common','many','rare','fixed') and
    chcn_rarity_rmb in ('common','many','rare','fixed') and
    chc_rarity_myr in ('common','many','rare','fixed') and
    chcs_rarity_myr in ('common','many','rare','fixed') and
    chcn_rarity_myr in ('common','many','rare','fixed')
  )
);

alter table public.ks_products_chc_g1 enable row level security;

-- Seed exactly the 374 models from the supplied G1 Price List.
-- DO NOTHING on conflict so rerunning this migration never overwrites prices entered later.
insert into public.ks_products_chc_g1
(id,model,source_row,
 chc_usd,chcs_usd,chcn_usd,
 chc_rmb,chcs_rmb,chcn_rmb,
 chc_myr,chcs_myr,chcn_myr)
values
('G1:CHC 1-1','CHC 1-1',5,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-2','CHC 1-2',6,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-3','CHC 1-3',7,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-4','CHC 1-4',8,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-5','CHC 1-5',9,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-6','CHC 1-6',10,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-7','CHC 1-7',11,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-8','CHC 1-8',12,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-9','CHC 1-9',13,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-10','CHC 1-10',14,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-11','CHC 1-11',15,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-12','CHC 1-12',16,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-13','CHC 1-13',17,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-14','CHC 1-14',18,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-15','CHC 1-15',19,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-16','CHC 1-16',20,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-17','CHC 1-17',21,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-18','CHC 1-18',22,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-19','CHC 1-19',23,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-20','CHC 1-20',24,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-21','CHC 1-21',25,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-22','CHC 1-22',26,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-23','CHC 1-23',27,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-24','CHC 1-24',28,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-25','CHC 1-25',29,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-26','CHC 1-26',30,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-27','CHC 1-27',31,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-28','CHC 1-28',32,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-29','CHC 1-29',33,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-30','CHC 1-30',34,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-31','CHC 1-31',35,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-32','CHC 1-32',36,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-33','CHC 1-33',37,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-34','CHC 1-34',38,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-35','CHC 1-35',39,null,null,null,null,null,null,null,null,null),
('G1:CHC 1-36','CHC 1-36',40,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-1','CHC 2-1',41,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-2','CHC 2-2',42,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-3','CHC 2-3',43,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-4','CHC 2-4',44,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-5','CHC 2-5',45,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-6','CHC 2-6',46,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-7','CHC 2-7',47,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-8','CHC 2-8',48,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-9','CHC 2-9',49,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-10','CHC 2-10',50,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-11','CHC 2-11',51,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-12','CHC 2-12',52,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-13','CHC 2-13',53,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-14','CHC 2-14',54,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-15','CHC 2-15',55,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-16','CHC 2-16',56,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-17','CHC 2-17',57,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-18','CHC 2-18',58,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-19','CHC 2-19',59,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-20','CHC 2-20',60,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-21','CHC 2-21',61,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-22','CHC 2-22',62,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-23','CHC 2-23',63,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-24','CHC 2-24',64,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-25','CHC 2-25',65,null,null,null,null,null,null,null,null,null),
('G1:CHC 2-26','CHC 2-26',66,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-1','CHC 3-1',67,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-2','CHC 3-2',68,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-3','CHC 3-3',69,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-4','CHC 3-4',70,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-5','CHC 3-5',71,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-6','CHC 3-6',72,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-7','CHC 3-7',73,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-8','CHC 3-8',74,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-9','CHC 3-9',75,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-10','CHC 3-10',76,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-11','CHC 3-11',77,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-12','CHC 3-12',78,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-13','CHC 3-13',79,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-14','CHC 3-14',80,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-15','CHC 3-15',81,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-16','CHC 3-16',82,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-17','CHC 3-17',83,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-18','CHC 3-18',84,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-19','CHC 3-19',85,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-20','CHC 3-20',86,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-21','CHC 3-21',87,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-22','CHC 3-22',88,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-23','CHC 3-23',89,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-24','CHC 3-24',90,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-25','CHC 3-25',91,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-26','CHC 3-26',92,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-27','CHC 3-27',93,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-28','CHC 3-28',94,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-29','CHC 3-29',95,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-30','CHC 3-30',96,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-31','CHC 3-31',97,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-32','CHC 3-32',98,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-33','CHC 3-33',99,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-34','CHC 3-34',100,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-35','CHC 3-35',101,null,null,null,null,null,null,null,null,null),
('G1:CHC 3-36','CHC 3-36',102,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-1','CHC 4-1',103,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-2','CHC 4-2',104,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-3','CHC 4-3',105,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-4','CHC 4-4',106,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-5','CHC 4-5',107,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-6','CHC 4-6',108,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-7','CHC 4-7',109,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-8','CHC 4-8',110,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-9','CHC 4-9',111,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-10','CHC 4-10',112,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-11','CHC 4-11',113,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-12','CHC 4-12',114,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-13','CHC 4-13',115,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-14','CHC 4-14',116,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-15','CHC 4-15',117,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-16','CHC 4-16',118,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-17','CHC 4-17',119,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-18','CHC 4-18',120,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-19','CHC 4-19',121,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-20','CHC 4-20',122,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-21','CHC 4-21',123,null,null,null,null,null,null,null,null,null),
('G1:CHC 4-22','CHC 4-22',124,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-1','CHC 5-1',125,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-2','CHC 5-2',126,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-3','CHC 5-3',127,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-4','CHC 5-4',128,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-5','CHC 5-5',129,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-5 (60Hz)','CHC 5-5 (60Hz)',130,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-6','CHC 5-6',131,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-7','CHC 5-7',132,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-8','CHC 5-8',133,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-9','CHC 5-9',134,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-10','CHC 5-10',135,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-11','CHC 5-11',136,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-12','CHC 5-12',137,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-13','CHC 5-13',138,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-14','CHC 5-14',139,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-15','CHC 5-15',140,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-16','CHC 5-16',141,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-17','CHC 5-17',142,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-18','CHC 5-18',143,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-19','CHC 5-19',144,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-20','CHC 5-20',145,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-21','CHC 5-21',146,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-22','CHC 5-22',147,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-23','CHC 5-23',148,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-24','CHC 5-24',149,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-25','CHC 5-25',150,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-26','CHC 5-26',151,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-27','CHC 5-27',152,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-28','CHC 5-28',153,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-29','CHC 5-29',154,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-30','CHC 5-30',155,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-31','CHC 5-31',156,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-32','CHC 5-32',157,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-33','CHC 5-33',158,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-34','CHC 5-34',159,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-35','CHC 5-35',160,null,null,null,null,null,null,null,null,null),
('G1:CHC 5-36','CHC 5-36',161,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-1','CHC 8-1',162,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-2','CHC 8-2',163,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-3','CHC 8-3',164,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-4','CHC 8-4',165,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-5','CHC 8-5',166,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-6','CHC 8-6',167,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-7','CHC 8-7',168,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-8','CHC 8-8',169,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-9','CHC 8-9',170,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-10','CHC 8-10',171,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-11','CHC 8-11',172,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-12','CHC 8-12',173,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-13','CHC 8-13',174,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-14','CHC 8-14',175,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-15','CHC 8-15',176,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-16','CHC 8-16',177,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-17','CHC 8-17',178,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-18','CHC 8-18',179,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-19','CHC 8-19',180,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-20','CHC 8-20',181,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-21','CHC 8-21',182,null,null,null,null,null,null,null,null,null),
('G1:CHC 8-22','CHC 8-22',183,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-2','CHC 12-2',184,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-3','CHC 12-3',185,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-4','CHC 12-4',186,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-5','CHC 12-5',187,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-6','CHC 12-6',188,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-7','CHC 12-7',189,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-8','CHC 12-8',190,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-9','CHC 12-9',191,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-10','CHC 12-10',192,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-11','CHC 12-11',193,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-12','CHC 12-12',194,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-13','CHC 12-13',195,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-14','CHC 12-14',196,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-15','CHC 12-15',197,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-16','CHC 12-16',198,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-17','CHC 12-17',199,null,null,null,null,null,null,null,null,null),
('G1:CHC 12-18','CHC 12-18',200,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-1','CHC 16-1',201,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-2','CHC 16-2',202,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-3','CHC 16-3',203,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-4','CHC 16-4',204,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-5','CHC 16-5',205,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-6','CHC 16-6',206,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-7','CHC 16-7',207,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-8','CHC 16-8',208,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-9','CHC 16-9',209,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-10','CHC 16-10',210,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-11','CHC 16-11',211,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-12','CHC 16-12',212,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-13','CHC 16-13',213,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-14','CHC 16-14',214,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-15','CHC 16-15',215,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-16','CHC 16-16',216,null,null,null,null,null,null,null,null,null),
('G1:CHC 16-17','CHC 16-17',217,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-1','CHC 20-1',218,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-2','CHC 20-2',219,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-3','CHC 20-3',220,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-4','CHC 20-4',221,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-5','CHC 20-5',222,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-6','CHC 20-6',223,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-7','CHC 20-7',224,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-8','CHC 20-8',225,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-9','CHC 20-9',226,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-10','CHC 20-10',227,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-11','CHC 20-11',228,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-12','CHC 20-12',229,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-13','CHC 20-13',230,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-14','CHC 20-14',231,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-15','CHC 20-15',232,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-16','CHC 20-16',233,null,null,null,null,null,null,null,null,null),
('G1:CHC 20-17','CHC 20-17',234,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-1-1','CHC 32-1-1',235,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-1','CHC 32-1',236,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-2-2','CHC 32-2-2',237,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-2','CHC 32-2',238,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-3-2','CHC 32-3-2',239,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-3','CHC 32-3',240,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-4-2','CHC 32-4-2',241,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-4','CHC 32-4',242,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-5-2','CHC 32-5-2',243,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-5','CHC 32-5',244,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-6-2','CHC 32-6-2',245,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-6','CHC 32-6',246,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-7-2','CHC 32-7-2',247,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-7','CHC 32-7',248,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-8-2','CHC 32-8-2',249,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-8','CHC 32-8',250,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-9-2','CHC 32-9-2',251,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-9','CHC 32-9',252,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-10-2','CHC 32-10-2',253,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-10','CHC 32-10',254,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-11-2','CHC 32-11-2',255,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-11','CHC 32-11',256,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-12-2','CHC 32-12-2',257,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-12','CHC 32-12',258,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-13-2','CHC 32-13-2',259,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-13','CHC 32-13',260,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-14-2','CHC 32-14-2',261,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-14','CHC 32-14',262,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-15-2','CHC 32-15-2',263,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-15','CHC 32-15',264,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-16-2','CHC 32-16-2',265,null,null,null,null,null,null,null,null,null),
('G1:CHC 32-16','CHC 32-16',266,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-1-1','CHC 45-1-1',267,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-1','CHC 45-1',268,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-2-2','CHC 45-2-2',269,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-2','CHC 45-2',270,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-3-2','CHC 45-3-2',271,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-3','CHC 45-3',272,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-4-2','CHC 45-4-2',273,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-4','CHC 45-4',274,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-5-2','CHC 45-5-2',275,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-5','CHC 45-5',276,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-6-2','CHC 45-6-2',277,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-6','CHC 45-6',278,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-7-2','CHC 45-7-2',279,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-7','CHC 45-7',280,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-8-2','CHC 45-8-2',281,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-8','CHC 45-8',282,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-9-2','CHC 45-9-2',283,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-9','CHC 45-9',284,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-10-2','CHC 45-10-2',285,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-10','CHC 45-10',286,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-11-2','CHC 45-11-2',287,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-11','CHC 45-11',288,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-12-2','CHC 45-12-2',289,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-12','CHC 45-12',290,null,null,null,null,null,null,null,null,null),
('G1:CHC 45-13-2','CHC 45-13-2',291,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-1-1','CHC 64-1-1',292,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-1','CHC 64-1',293,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-2-2','CHC 64-2-2',294,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-2-1','CHC 64-2-1',295,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-2','CHC 64-2',296,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-3-2','CHC 64-3-2',297,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-3-1','CHC 64-3-1',298,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-3','CHC 64-3',299,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-4-2','CHC 64-4-2',300,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-4-1','CHC 64-4-1',301,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-4','CHC 64-4',302,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-5-2','CHC 64-5-2',303,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-5-1','CHC 64-5-1',304,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-5','CHC 64-5',305,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-6-2','CHC 64-6-2',306,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-6-1','CHC 64-6-1',307,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-6','CHC 64-6',308,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-7-2','CHC 64-7-2',309,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-7-1','CHC 64-7-1',310,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-7','CHC 64-7',311,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-8-2','CHC 64-8-2',312,null,null,null,null,null,null,null,null,null),
('G1:CHC 64-8-1','CHC 64-8-1',313,null,null,null,null,null,null,null,null,null),
('G1:CHC 90-1-1','CHC 90-1-1',314,null,null,null,null,null,null,null,null,null),
('G1:CHC 90-1','CHC 90-1',315,null,null,null,null,null,null,null,null,null),
('G1:CHC 90-2-2','CHC 90-2-2',316,null,null,null,null,null,null,null,null,null),
('G1:CHC 90-2','CHC 90-2',317,null,null,null,null,null,null,null,null,null),
('G1:CHC 90-3-2','CHC 90-3-2',318,null,null,null,null,null,null,null,null,null),
('G1:CHC 90-3','CHC 90-3',319,null,null,null,null,null,null,null,null,null),
('G1:CHC 90-4-2','CHC 90-4-2',320,null,null,null,null,null,null,null,null,null),
('G1:CHC 90-4','CHC 90-4',321,null,null,null,null,null,null,null,null,null),
('G1:CHC 90-5-2','CHC 90-5-2',322,null,null,null,null,null,null,null,null,null),
('G1:CHC 90-5','CHC 90-5',323,null,null,null,null,null,null,null,null,null),
('G1:CHC 90-6-2','CHC 90-6-2',324,null,null,null,null,null,null,null,null,null),
('G1:CHC 90-6','CHC 90-6',325,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-1','CHC 120-1',326,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-2-2','CHC 120-2-2',327,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-2-1','CHC 120-2-1',328,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-2','CHC 120-2',329,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-3-2','CHC 120-3-2',330,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-3-1','CHC 120-3-1',331,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-3','CHC 120-3',332,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-4-2','CHC 120-4-2',333,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-4-1','CHC 120-4-1',334,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-4','CHC 120-4',335,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-5-2','CHC 120-5-2',336,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-5-1','CHC 120-5-1',337,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-5','CHC 120-5',338,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-6-2','CHC 120-6-2',339,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-6-1','CHC 120-6-1',340,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-6','CHC 120-6',341,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-7-2','CHC 120-7-2',342,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-7-1','CHC 120-7-1',343,null,null,null,null,null,null,null,null,null),
('G1:CHC 120-7','CHC 120-7',344,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-1-1','CHC 150-1-1',345,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-1','CHC 150-1',346,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-2-2','CHC 150-2-2',347,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-2-1','CHC 150-2-1',348,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-2','CHC 150-2',349,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-3-2','CHC 150-3-2',350,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-3-1','CHC 150-3-1',351,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-3','CHC 150-3',352,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-4-2','CHC 150-4-2',353,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-4-1','CHC 150-4-1',354,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-4','CHC 150-4',355,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-5-2','CHC 150-5-2',356,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-5-1','CHC 150-5-1',357,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-5','CHC 150-5',358,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-6-2','CHC 150-6-2',359,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-6-1','CHC 150-6-1',360,null,null,null,null,null,null,null,null,null),
('G1:CHC 150-6','CHC 150-6',361,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-1-B','CHC 200-1-B',362,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-1-A','CHC 200-1-A',363,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-1','CHC 200-1',364,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-2-2B','CHC 200-2-2B',365,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-2-2A','CHC 200-2-2A',366,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-2-A','CHC 200-2-A',367,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-2','CHC 200-2',368,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-3-2B','CHC 200-3-2B',369,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-3-A-B','CHC 200-3-A-B',370,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-3-2A','CHC 200-3-2A',371,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-3-B','CHC 200-3-B',372,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-3-A','CHC 200-3-A',373,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-3','CHC 200-3',374,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-4-2B','CHC 200-4-2B',375,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-4-2A','CHC 200-4-2A',376,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-4-A','CHC 200-4-A',377,null,null,null,null,null,null,null,null,null),
('G1:CHC 200-4','CHC 200-4',378,null,null,null,null,null,null,null,null,null)
on conflict (model) do nothing;

-- Read is allowed to authenticated KeySuite users; writes happen only through owner-checked RPC.
drop policy if exists ks_products_chc_g1_read_v41410 on public.ks_products_chc_g1;
create policy ks_products_chc_g1_read_v41410
on public.ks_products_chc_g1
for select to authenticated
using (true);

revoke all on public.ks_products_chc_g1 from anon,authenticated;
grant select on public.ks_products_chc_g1 to authenticated;

create or replace function public.keysuite_save_chc_g1_product_price_v41410(
  p_product_id text,
  p_currency text,
  p_chc_price numeric,
  p_chcs_price numeric,
  p_chcn_price numeric,
  p_chc_rarity text default 'common',
  p_chcs_rarity text default 'common',
  p_chcn_rarity text default 'common'
)
returns public.ks_products_chc_g1
language plpgsql
security definer
set search_path=public
as $$
declare
  v_email text;
  v_role text;
  v_currency text:=upper(trim(coalesce(p_currency,'')));
  v_chc_rarity text:=lower(trim(coalesce(p_chc_rarity,'common')));
  v_chcs_rarity text:=lower(trim(coalesce(p_chcs_rarity,'common')));
  v_chcn_rarity text:=lower(trim(coalesce(p_chcn_rarity,'common')));
  v_saved public.ks_products_chc_g1;
begin
  select lower(coalesce(u.email,'')) into v_email
  from auth.users u
  where u.id=auth.uid();

  select lower(coalesce(a.role,'')) into v_role
  from public.ks_user_access a
  where lower(a.email)=v_email
    and coalesce(a.active,false)=true
  limit 1;

  if coalesce(v_role,'') <> 'owner' then
    raise exception 'Owner permission is required to maintain CHC G1 Price List.';
  end if;

  if v_currency not in ('USD','RMB','MYR') then
    raise exception 'Unsupported currency: %',v_currency;
  end if;

  if coalesce(v_chc_rarity,'') not in ('common','many','rare','fixed')
     or coalesce(v_chcs_rarity,'') not in ('common','many','rare','fixed')
     or coalesce(v_chcn_rarity,'') not in ('common','many','rare','fixed') then
    raise exception 'Unsupported rarity value.';
  end if;

  if (p_chc_price is not null and p_chc_price < 0)
     or (p_chcs_price is not null and p_chcs_price < 0)
     or (p_chcn_price is not null and p_chcn_price < 0) then
    raise exception 'Price must be blank or zero and above.';
  end if;

  update public.ks_products_chc_g1
  set
    chc_usd = case when v_currency='USD' then p_chc_price else chc_usd end,
    chcs_usd = case when v_currency='USD' then p_chcs_price else chcs_usd end,
    chcn_usd = case when v_currency='USD' then p_chcn_price else chcn_usd end,

    chc_rmb = case when v_currency='RMB' then p_chc_price else chc_rmb end,
    chcs_rmb = case when v_currency='RMB' then p_chcs_price else chcs_rmb end,
    chcn_rmb = case when v_currency='RMB' then p_chcn_price else chcn_rmb end,

    chc_myr = case when v_currency='MYR' then p_chc_price else chc_myr end,
    chcs_myr = case when v_currency='MYR' then p_chcs_price else chcs_myr end,
    chcn_myr = case when v_currency='MYR' then p_chcn_price else chcn_myr end,

    chc_rarity_usd = case when v_currency='USD' then v_chc_rarity else chc_rarity_usd end,
    chcs_rarity_usd = case when v_currency='USD' then v_chcs_rarity else chcs_rarity_usd end,
    chcn_rarity_usd = case when v_currency='USD' then v_chcn_rarity else chcn_rarity_usd end,

    chc_rarity_rmb = case when v_currency='RMB' then v_chc_rarity else chc_rarity_rmb end,
    chcs_rarity_rmb = case when v_currency='RMB' then v_chcs_rarity else chcs_rarity_rmb end,
    chcn_rarity_rmb = case when v_currency='RMB' then v_chcn_rarity else chcn_rarity_rmb end,

    chc_rarity_myr = case when v_currency='MYR' then v_chc_rarity else chc_rarity_myr end,
    chcs_rarity_myr = case when v_currency='MYR' then v_chcs_rarity else chcs_rarity_myr end,
    chcn_rarity_myr = case when v_currency='MYR' then v_chcn_rarity else chcn_rarity_myr end,

    updated_at=now(),
    updated_by=v_email
  where id=p_product_id
  returning * into v_saved;

  if v_saved.id is null then
    raise exception 'CHC G1 Price List model was not found: %',p_product_id;
  end if;

  return v_saved;
end
$$;

revoke all on function public.keysuite_save_chc_g1_product_price_v41410(
  text,text,numeric,numeric,numeric,text,text,text
) from public,anon;

grant execute on function public.keysuite_save_chc_g1_product_price_v41410(
  text,text,numeric,numeric,numeric,text,text,text
) to authenticated;

-- V4.14.09 G1->G2 price projection is deprecated.
-- Keep the function for compatibility but make it return G1's own rows instead of G2.
create or replace function public.keysuite_v41409_chc_g1_pricelist()
returns table(
  generation_code text,
  model_code text,
  equivalent_model_code text,
  source_product_id text,
  source_missing boolean,
  chc_usd numeric,
  chcs_usd numeric,
  chcn_usd numeric,
  chc_rmb numeric,
  chcs_rmb numeric,
  chcn_rmb numeric,
  chc_myr numeric,
  chcs_myr numeric,
  chcn_myr numeric,
  chc_rarity_usd text,
  chcs_rarity_usd text,
  chcn_rarity_usd text,
  chc_rarity_rmb text,
  chcs_rarity_rmb text,
  chcn_rarity_rmb text,
  chc_rarity_myr text,
  chcs_rarity_myr text,
  chcn_rarity_myr text
)
language sql
stable
security definer
set search_path=public
as $$
  select
    'G1'::text,
    p.model::text,
    null::text,
    p.id::text,
    false::boolean,
    p.chc_usd,p.chcs_usd,p.chcn_usd,
    p.chc_rmb,p.chcs_rmb,p.chcn_rmb,
    p.chc_myr,p.chcs_myr,p.chcn_myr,
    p.chc_rarity_usd,p.chcs_rarity_usd,p.chcn_rarity_usd,
    p.chc_rarity_rmb,p.chcs_rarity_rmb,p.chcn_rarity_rmb,
    p.chc_rarity_myr,p.chcs_rarity_myr,p.chcn_rarity_myr
  from public.ks_products_chc_g1 p
  order by p.source_row,p.model
$$;

notify pgrst,'reload schema';

commit;
