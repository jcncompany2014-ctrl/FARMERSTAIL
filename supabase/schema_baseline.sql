-- ============================================================================
-- 파머스테일 스키마 기준선(baseline) — 프로덕션 실측 스냅샷 (2026-09-18)
-- ============================================================================
-- 왜 있나: supabase/migrations/ 는 2026-04-23 이후 기록만 있고, 기반 테이블(profiles·dogs·
--   orders…)과 초기 원격 마이그레이션 11건은 파일이 없다. 그래서 "마이그레이션만으로 새 DB 를
--   만든다"가 성립하지 않았다(2026-09-16 점검). 이 파일이 그 빈자리를 메운다.
-- 어떻게 만들었나: `supabase db dump` 가 아니라 프로덕션 카탈로그(pg_class·pg_attribute·
--   pg_constraint·pg_indexes·pg_policies·pg_proc·pg_trigger·pg_description·aclexplode·
--   storage.buckets)를 SQL 로 읽어 재구성했다. 원문 마이그레이션이 아니라 **현재 상태**다.
-- 쓰는 법: 빈 Supabase 프로젝트(auth·storage 스키마와 anon/authenticated/service_role 롤이
--   있는 상태)에서 이 파일을 통째로 실행한 뒤, 2026-09-18 이후의 supabase/migrations/ 파일만
--   순서대로 적용한다. 프로덕션에는 절대 실행하지 않는다(전부 IF NOT EXISTS/OR REPLACE 라
--   무해하지만 의미가 없다).
-- ★미검증: 새 환경에 실제로 적용해 본 적은 없다(빈 프로젝트가 없어서). 순서 오류가 나면
--   그 지점(함수→정책→트리거 순)부터 손본다. 데이터·시드는 포함하지 않는다.
-- 포함: 확장 4 · 테이블 65 · 제약/FK/인덱스 · 함수 67(+실행권한) · 뷰 1 · RLS+정책 185
--   (public 165 + storage 20) · 트리거 39 + auth 1 · 코멘트 · 테이블/컬럼 grant · 버킷 8
-- 제외: auth.config(대시보드 설정) · Edge Functions(없음) · pg_cron(없음, Vercel 크론 사용)
--   · default privileges · 데이터
-- ============================================================================

-- ===== extensions =====
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists "uuid-ossp" with schema extensions;

-- ===== tables =====
create table if not exists public.account_deletions (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  deleted_at timestamp with time zone default now() not null,
  reason text,
  email_hash text,
  open_order_count integer default 0,
  purged_at timestamp with time zone
);

create table if not exists public.activity_logs (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  activity_type text not null,
  occurred_at timestamp with time zone default now() not null,
  duration_min integer,
  amount numeric(6,2),
  unit text,
  note text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.addresses (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  label text,
  recipient_name text not null,
  phone text not null,
  zip text not null,
  address text not null,
  address_detail text,
  is_default boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.admin_audit_log (
  id uuid default gen_random_uuid() not null,
  actor_user_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  diff jsonb,
  ip text,
  user_agent text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.algorithm_breed_predispose (
  breed_key text not null,
  korean_label text not null,
  breed_keywords text[] not null,
  predispose_conditions text[] default ARRAY[]::text[] not null,
  cautions text[] default ARRAY[]::text[] not null,
  citations text[] default ARRAY[]::text[] not null,
  enabled boolean default true not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid
);

create table if not exists public.algorithm_chronic_severity (
  condition text not null,
  korean_label text not null,
  default_severity text not null,
  protein_factor numeric(3,2) default 1.0 not null,
  fat_factor numeric(3,2) default 1.0 not null,
  notes text,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid
);

create table if not exists public.algorithm_food_lines (
  line text not null,
  kcal_per_100g smallint not null,
  protein_pct_dm numeric(4,1) not null,
  fat_pct_dm numeric(4,1) not null,
  calcium_pct_dm numeric(4,2) default NULL::numeric,
  phosphorus_pct_dm numeric(4,2) default NULL::numeric,
  sodium_pct_dm numeric(4,3) default NULL::numeric,
  subtitle_override text,
  benefit_override text,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid,
  omega3_pct_dm numeric(4,2) default NULL::numeric,
  omega6_pct_dm numeric(4,2) default NULL::numeric,
  vitamin_d_iu_per_100g_dm smallint
);

create table if not exists public.algorithm_meta_weights (
  id uuid default gen_random_uuid() not null,
  version text not null,
  weights jsonb not null,
  source text default 'cron'::text not null,
  notes text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.analyses (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  survey_id uuid not null,
  user_id uuid not null,
  rer numeric,
  mer numeric,
  factor numeric,
  stage text,
  bcs_label text,
  bcs_score integer,
  protein_pct numeric,
  protein_g numeric,
  fat_pct numeric,
  fat_g numeric,
  carb_pct numeric,
  carb_g numeric,
  fiber_pct numeric,
  fiber_g numeric,
  feed_g numeric,
  micronutrients jsonb,
  ca_p_ratio numeric,
  supplements text[],
  created_at timestamp with time zone default now(),
  commentary text,
  structured_analysis jsonb,
  risk_flags text[] default ARRAY[]::text[],
  vet_consult_recommended boolean default false not null,
  next_review_date date,
  guideline_version text,
  factor_breakdown jsonb,
  structured_analysis_at timestamp with time zone
);

create table if not exists public.anthropic_usage (
  day date default CURRENT_DATE not null,
  route text not null,
  calls integer default 0 not null,
  input_tokens bigint default 0 not null,
  output_tokens bigint default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.automation_settings (
  id smallint default 1 not null,
  represcription_enabled boolean default true not null,
  marketing_push_hour smallint default 10 not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid
);

create table if not exists public.blog_categories (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  name text not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.blog_posts (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  title text not null,
  excerpt text,
  content text not null,
  cover_url text,
  category_id uuid,
  is_published boolean default false not null,
  published_at timestamp with time zone,
  views integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.chatbot_messages (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  dog_id uuid,
  role text not null,
  content text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.consent_log (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  channel text not null,
  granted boolean not null,
  granted_at timestamp with time zone default now() not null,
  policy_version text,
  source text,
  ip inet,
  user_agent text
);

create table if not exists public.cron_health (
  id uuid default gen_random_uuid() not null,
  path text not null,
  status text not null,
  duration_ms integer,
  error_message text,
  result_summary jsonb,
  executed_at timestamp with time zone default now() not null
);

create table if not exists public.cs_messages (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  sender text not null,
  sender_id uuid not null,
  body text not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.dog_checkins (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  cycle_number smallint not null,
  checkpoint text not null,
  stool_score smallint,
  coat_score smallint,
  appetite_score smallint,
  overall_satisfaction smallint,
  free_text text,
  photo_urls text[] default ARRAY[]::text[],
  responded_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.dog_diary (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  photo_urls text[] default '{}'::text[] not null,
  note text,
  mood smallint,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.dog_formulas (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  cycle_number smallint not null,
  formula jsonb not null,
  reasoning jsonb default '[]'::jsonb not null,
  transition_strategy text not null,
  algorithm_version text not null,
  user_adjusted boolean default false not null,
  daily_kcal smallint not null,
  daily_grams smallint not null,
  applied_from date,
  applied_until date,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  approval_status text default 'auto_applied'::text not null,
  approved_at timestamp with time zone,
  proposed_at timestamp with time zone,
  computed_at timestamp with time zone default now() not null
);

create table if not exists public.dog_medications (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  name text not null,
  dose text,
  schedule text not null,
  "time" text,
  enabled boolean default true not null,
  note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.dog_members (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  role text default 'member'::text not null,
  invited_by uuid,
  accepted_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.dog_reminders (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  type text not null,
  title text not null,
  notes text,
  next_date date not null,
  recur_interval_days integer,
  last_done_date date,
  enabled boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.dog_sensitivity_snapshots (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  snapshot_at timestamp with time zone default now() not null,
  baseline_state jsonb not null,
  results jsonb not null,
  top_variable text not null,
  top_delta integer not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.dog_vaccinations (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  vaccine text not null,
  date date not null,
  next_date date,
  note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.dogs (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  photo_url text,
  breed text,
  gender text,
  neutered boolean,
  birth_date date,
  age_value integer,
  age_unit text default 'years'::text,
  weight numeric(5,2),
  body_condition text,
  activity_level text,
  food_type text,
  snack_freq text,
  taste text,
  allergies text[],
  health_concerns text[],
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  breed_size text,
  prescription_diet text,
  weight_method text default 'unknown'::text not null,
  activity_method text default 'unknown'::text not null,
  feed_method text default 'unknown'::text not null,
  weight_measured_at timestamp with time zone,
  allergies_source text default 'self_suspected'::text,
  accuracy_user_boost numeric(3,2) default 0 not null,
  weight_measured_by text,
  activity_period text,
  walk_intensity text,
  treat_frequency text,
  treat_types text[],
  human_food_given boolean,
  user_method_lock jsonb default '{}'::jsonb not null
);

create table if not exists public.email_suppressions (
  email text not null,
  reason text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.faqs (
  id uuid default gen_random_uuid() not null,
  category text not null,
  question text not null,
  answer text not null,
  is_published boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.feeding_outcomes (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  cohort_id text default 'rolling'::text not null,
  source text not null,
  week_no integer,
  palatability text,
  rating_stars integer,
  bristol_score integer,
  weight_kg numeric(5,2),
  bcs_score integer,
  reason_category text,
  sku_code text,
  comment text,
  photo_url text,
  order_id uuid,
  subscription_id uuid,
  created_at timestamp with time zone default now() not null,
  reason_detail text
);

create table if not exists public.health_logs (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  logged_at date default CURRENT_DATE not null,
  poop_quality text,
  poop_count integer,
  activity_level text,
  mood text,
  appetite text,
  note text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.kibble_products (
  id uuid default gen_random_uuid() not null,
  brand text not null,
  product_name text not null,
  package_size text,
  kcal_per_100g numeric,
  crude_protein numeric,
  crude_fat numeric,
  crude_fiber numeric,
  moisture numeric,
  ash numeric,
  kcal_source text,
  search_keywords text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.kibble_requests (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  raw_input text not null,
  request_count integer default 1 not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.medical_records (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  visit_date date,
  diagnosis text[] default '{}'::text[] not null,
  medications jsonb default '[]'::jsonb not null,
  vet_notes text,
  weight_kg numeric(5,2),
  source text default 'manual'::text not null,
  ocr_confidence numeric(3,2),
  created_at timestamp with time zone default now() not null,
  attached_image_url text
);

create table if not exists public.meta_learning_events (
  id uuid default gen_random_uuid() not null,
  arm_id text not null,
  context text not null,
  reward numeric(4,3) not null,
  user_id uuid,
  meta jsonb,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.native_push_tokens (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  platform text not null,
  token text not null,
  device_id text,
  app_version text,
  os_version text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.newsletter_subscribers (
  id uuid default gen_random_uuid() not null,
  email text not null,
  user_id uuid,
  status text default 'pending'::text not null,
  confirm_token text,
  unsubscribe_token text default replace((gen_random_uuid())::text, '-'::text, ''::text) not null,
  last_sent_at timestamp with time zone,
  source text default 'web'::text,
  created_at timestamp with time zone default now() not null,
  confirmed_at timestamp with time zone,
  unsubscribed_at timestamp with time zone
);

create table if not exists public.order_items (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  product_image_url text,
  unit_price integer not null,
  quantity integer not null,
  line_total integer not null,
  created_at timestamp with time zone default now() not null,
  variant_id uuid,
  variant_name text,
  cancelled_at timestamp with time zone,
  refunded_amount integer default 0 not null
);

create table if not exists public.orders (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  order_number text not null,
  subtotal integer not null,
  shipping_fee integer default 0 not null,
  total_amount integer not null,
  recipient_name text not null,
  recipient_phone text not null,
  zip text not null,
  address text not null,
  address_detail text,
  delivery_memo text,
  payment_status text default 'pending'::text not null,
  payment_method text,
  payment_key text,
  paid_at timestamp with time zone,
  order_status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  subscription_id uuid,
  cancelled_at timestamp with time zone,
  cancel_reason text,
  tracking_number text,
  carrier text,
  shipped_at timestamp with time zone,
  delivered_at timestamp with time zone,
  discount_amount integer default 0 not null,
  coupon_code text,
  points_used integer default 0 not null,
  points_earned integer default 0 not null,
  cash_receipt_type text,
  cash_receipt_number text,
  receipt_url text,
  refunded_amount integer default 0 not null,
  virtual_account_bank text,
  virtual_account_number text,
  virtual_account_due_date timestamp with time zone,
  virtual_account_holder text,
  points_refunded integer default 0 not null,
  discount_reason text
);

create table if not exists public.partners (
  id uuid default gen_random_uuid() not null,
  region text not null,
  name text not null,
  ingredient text not null,
  body text not null,
  cert text,
  image_url text,
  is_published boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.payment_events (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  payment_key text,
  event_type text not null,
  amount integer not null,
  prev_status text,
  new_status text,
  source text not null,
  metadata jsonb,
  actor_user_id uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.payment_refund_queue (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  payment_key text not null,
  amount integer not null,
  reason text not null,
  attempts integer default 0 not null,
  last_error text,
  status text default 'pending'::text not null,
  next_retry_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.photo_request_tokens (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  created_by uuid not null,
  token text not null,
  expires_at timestamp with time zone default (now() + '7 days'::interval) not null,
  uploaded_photo_url text,
  uploaded_at timestamp with time zone,
  applied_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.point_ledger (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  delta integer not null,
  balance_after integer not null,
  reason text not null,
  reference_type text,
  reference_id uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.product_qna (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null,
  user_id uuid not null,
  question text not null,
  answer text,
  answered_by uuid,
  answered_at timestamp with time zone,
  is_private boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.products (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  description text,
  short_description text,
  price integer not null,
  sale_price integer,
  image_url text,
  category text,
  tags text[],
  stock integer default 0,
  is_subscribable boolean default false,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  gallery_urls text[] default '{}'::text[] not null,
  meta_description text,
  sales_count integer default 0 not null,
  origin text,
  manufacturer text,
  manufacturer_address text,
  manufacture_date_policy text,
  shelf_life_days integer,
  net_weight_g integer,
  ingredients text,
  nutrition_facts jsonb,
  allergens text[],
  storage_method text,
  feeding_guide text,
  pet_food_class text default '반려동물용 자가소비 사료'::text,
  certifications text[],
  country_of_packaging text,
  sku text,
  sales_channel text default 'own'::text not null
);

create table if not exists public.profiles (
  id uuid not null,
  email text,
  name text,
  phone text,
  zip text,
  address text,
  address_detail text,
  agree_sms boolean default false,
  agree_email boolean default false,
  role text default 'customer'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone,
  notifications_last_seen_at timestamp with time zone,
  birth_year smallint,
  agree_email_at timestamp with time zone,
  agree_sms_at timestamp with time zone,
  marketing_policy_version text,
  birth_month smallint,
  birth_day smallint,
  cumulative_spend bigint default 0 not null,
  tier text,
  tier_updated_at timestamp with time zone,
  onboarded_at timestamp with time zone,
  consent_level smallint default 1 not null,
  consent_max_rewarded_level smallint default 1 not null,
  stamp_count integer default 0 not null,
  admin_note text,
  welcome_email_sent_at timestamp with time zone
);

create table if not exists public.promotion_claims (
  id uuid default gen_random_uuid() not null,
  promotion_id uuid not null,
  user_id uuid not null,
  claimed_at timestamp with time zone default now() not null,
  redeemed_order_id uuid,
  redeemed_at timestamp with time zone
);

create table if not exists public.promotions (
  id uuid default gen_random_uuid() not null,
  code text not null,
  name text not null,
  discount_rate numeric not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  max_signups integer,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.push_campaigns (
  id uuid default gen_random_uuid() not null,
  title text not null,
  body text not null,
  url text,
  segment text not null,
  recipient_count integer default 0 not null,
  sent_count integer default 0 not null,
  failed_count integer default 0 not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.push_log (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  body text not null,
  url text,
  category text,
  metadata jsonb default '{}'::jsonb,
  sent_count smallint default 0 not null,
  read_at timestamp with time zone,
  sent_at timestamp with time zone default now() not null,
  nudge boolean default false not null
);

create table if not exists public.push_preferences (
  user_id uuid not null,
  notify_order boolean default true not null,
  notify_marketing boolean default false not null,
  quiet_hours_start smallint,
  quiet_hours_end smallint,
  updated_at timestamp with time zone default now() not null,
  notify_health boolean default true not null
);

create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.rate_limit_counters (
  bucket text not null,
  key text not null,
  window_start_ms bigint not null,
  count integer default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.refunds (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  user_id uuid not null,
  amount integer not null,
  reason text,
  toss_transaction_key text,
  refunded_at timestamp with time zone default now() not null,
  refunded_by uuid,
  status text default 'succeeded'::text not null,
  order_item_ids uuid[],
  is_partial boolean default false not null
);

create table if not exists public.reweighs (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  weight_kg numeric not null,
  baseline_weight_kg numeric not null,
  bcs integer,
  goal text not null,
  weight_delta_pct numeric not null,
  prev_der integer not null,
  new_der integer not null,
  adjust_note text,
  measured_at date not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.source_waitlist (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  dog_id uuid,
  concern text not null,
  created_at timestamp with time zone default now() not null,
  notified_at timestamp with time zone
);

create table if not exists public.stamps (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  order_id uuid,
  stamped_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.subscription_charges (
  id uuid default gen_random_uuid() not null,
  subscription_id uuid not null,
  user_id uuid not null,
  scheduled_for date not null,
  status text not null,
  payment_key text,
  order_id uuid,
  amount integer not null,
  error_code text,
  error_message text,
  attempted_at timestamp with time zone default now() not null,
  completed_at timestamp with time zone
);

create table if not exists public.subscription_items (
  id uuid default gen_random_uuid() not null,
  subscription_id uuid not null,
  product_id uuid not null,
  quantity integer not null,
  unit_price integer not null,
  product_name text not null,
  product_image_url text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  interval_weeks integer default 2 not null,
  status text default 'active'::text not null,
  next_delivery_date date,
  last_delivery_date date,
  total_deliveries integer default 0 not null,
  recipient_name text not null,
  recipient_phone text not null,
  zip text not null,
  address text not null,
  address_detail text,
  delivery_memo text,
  subtotal integer not null,
  shipping_fee integer default 0 not null,
  total_amount integer not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  cancelled_at timestamp with time zone,
  reminder_days_before integer default 2 not null,
  reminder_enabled boolean default true not null,
  dog_id uuid,
  coverage_weeks smallint default 2 not null,
  billing_key text,
  billing_customer_key uuid,
  billing_card_brand text,
  billing_card_last4 text,
  last_charged_at timestamp with time zone,
  failed_charge_count integer default 0 not null,
  last_failed_charge_at timestamp with time zone,
  last_failed_charge_reason text,
  requires_billing_key_renewal boolean default false not null,
  next_retry_at timestamp with time zone,
  last_failed_charge_code text,
  mix_ratio numeric(3,2),
  sku_size_g integer,
  fresh_ratio smallint,
  last_charge_lock_at timestamp with time zone,
  charge_key_seq integer default 0 not null
);

create table if not exists public.surveys (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  answers jsonb not null,
  created_at timestamp with time zone default now(),
  mcs_score smallint,
  bristol_stool_score smallint,
  chronic_conditions text[] default ARRAY[]::text[],
  current_medications text[] default ARRAY[]::text[],
  current_food_brand text,
  daily_walk_minutes smallint,
  coat_condition text,
  appetite text,
  pregnancy_status text,
  care_goal text,
  home_cooking_experience text,
  current_diet_satisfaction smallint,
  weight_trend_6mo text,
  gi_sensitivity text,
  preferred_proteins text[] default ARRAY[]::text[],
  indoor_activity text,
  expected_adult_weight_kg numeric(5,2),
  iris_stage smallint,
  pregnancy_week smallint,
  litter_size smallint,
  budget_tier text
);

create table if not exists public.user_integrations (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  provider text not null,
  external_user_id text,
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone,
  scope text,
  status text default 'pending'::text not null,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.vet_share_tokens (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  created_by uuid not null,
  token text not null,
  expires_at timestamp with time zone default (now() + '7 days'::interval) not null,
  accessed_count integer default 0 not null,
  last_accessed_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.webhook_events (
  id uuid default gen_random_uuid() not null,
  provider text default 'toss'::text not null,
  event_key text not null,
  order_id uuid,
  payment_key text,
  status text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.weight_logs (
  id uuid default gen_random_uuid() not null,
  dog_id uuid not null,
  user_id uuid not null,
  weight numeric(5,2) not null,
  measured_at date default CURRENT_DATE not null,
  note text,
  created_at timestamp with time zone default now() not null
);

-- ===== constraints (pk/unique/check) =====
alter table public.account_deletions add constraint account_deletions_pkey PRIMARY KEY (id);
alter table public.activity_logs add constraint activity_logs_pkey PRIMARY KEY (id);
alter table public.addresses add constraint addresses_pkey PRIMARY KEY (id);
alter table public.admin_audit_log add constraint admin_audit_log_pkey PRIMARY KEY (id);
alter table public.algorithm_breed_predispose add constraint algorithm_breed_predispose_pkey PRIMARY KEY (breed_key);
alter table public.algorithm_chronic_severity add constraint algorithm_chronic_severity_pkey PRIMARY KEY (condition);
alter table public.algorithm_food_lines add constraint algorithm_food_lines_pkey PRIMARY KEY (line);
alter table public.algorithm_meta_weights add constraint algorithm_meta_weights_pkey PRIMARY KEY (id);
alter table public.analyses add constraint analyses_pkey PRIMARY KEY (id);
alter table public.anthropic_usage add constraint anthropic_usage_pkey PRIMARY KEY (day, route);
alter table public.automation_settings add constraint automation_settings_pkey PRIMARY KEY (id);
alter table public.blog_categories add constraint blog_categories_pkey PRIMARY KEY (id);
alter table public.blog_posts add constraint blog_posts_pkey PRIMARY KEY (id);
alter table public.chatbot_messages add constraint chatbot_messages_pkey PRIMARY KEY (id);
alter table public.consent_log add constraint consent_log_pkey PRIMARY KEY (id);
alter table public.cron_health add constraint cron_health_pkey PRIMARY KEY (id);
alter table public.cs_messages add constraint cs_messages_pkey PRIMARY KEY (id);
alter table public.dog_checkins add constraint dog_checkins_pkey PRIMARY KEY (id);
alter table public.dog_diary add constraint dog_diary_pkey PRIMARY KEY (id);
alter table public.dog_formulas add constraint dog_formulas_pkey PRIMARY KEY (id);
alter table public.dog_medications add constraint dog_medications_pkey PRIMARY KEY (id);
alter table public.dog_members add constraint dog_members_pkey PRIMARY KEY (id);
alter table public.dog_reminders add constraint dog_reminders_pkey PRIMARY KEY (id);
alter table public.dog_sensitivity_snapshots add constraint dog_sensitivity_snapshots_pkey PRIMARY KEY (id);
alter table public.dog_vaccinations add constraint dog_vaccinations_pkey PRIMARY KEY (id);
alter table public.dogs add constraint dogs_pkey PRIMARY KEY (id);
alter table public.email_suppressions add constraint email_suppressions_pkey PRIMARY KEY (email);
alter table public.faqs add constraint faqs_pkey PRIMARY KEY (id);
alter table public.feeding_outcomes add constraint feeding_outcomes_pkey PRIMARY KEY (id);
alter table public.health_logs add constraint health_logs_pkey PRIMARY KEY (id);
alter table public.kibble_products add constraint kibble_products_pkey PRIMARY KEY (id);
alter table public.kibble_requests add constraint kibble_requests_pkey PRIMARY KEY (id);
alter table public.medical_records add constraint medical_records_pkey PRIMARY KEY (id);
alter table public.meta_learning_events add constraint meta_learning_events_pkey PRIMARY KEY (id);
alter table public.native_push_tokens add constraint native_push_tokens_pkey PRIMARY KEY (id);
alter table public.newsletter_subscribers add constraint newsletter_subscribers_pkey PRIMARY KEY (id);
alter table public.order_items add constraint order_items_pkey PRIMARY KEY (id);
alter table public.orders add constraint orders_pkey PRIMARY KEY (id);
alter table public.partners add constraint partners_pkey PRIMARY KEY (id);
alter table public.payment_events add constraint payment_events_pkey PRIMARY KEY (id);
alter table public.payment_refund_queue add constraint payment_refund_queue_pkey PRIMARY KEY (id);
alter table public.photo_request_tokens add constraint photo_request_tokens_pkey PRIMARY KEY (id);
alter table public.point_ledger add constraint point_ledger_pkey PRIMARY KEY (id);
alter table public.product_qna add constraint product_qna_pkey PRIMARY KEY (id);
alter table public.products add constraint products_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.promotion_claims add constraint promotion_claims_pkey PRIMARY KEY (id);
alter table public.promotions add constraint promotions_pkey PRIMARY KEY (id);
alter table public.push_campaigns add constraint push_campaigns_pkey PRIMARY KEY (id);
alter table public.push_log add constraint push_log_pkey PRIMARY KEY (id);
alter table public.push_preferences add constraint push_preferences_pkey PRIMARY KEY (user_id);
alter table public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);
alter table public.rate_limit_counters add constraint rate_limit_counters_pkey PRIMARY KEY (bucket, key, window_start_ms);
alter table public.refunds add constraint refunds_pkey PRIMARY KEY (id);
alter table public.reweighs add constraint reweighs_pkey PRIMARY KEY (id);
alter table public.source_waitlist add constraint source_waitlist_pkey PRIMARY KEY (id);
alter table public.stamps add constraint stamps_pkey PRIMARY KEY (id);
alter table public.subscription_charges add constraint subscription_charges_pkey PRIMARY KEY (id);
alter table public.subscription_items add constraint subscription_items_pkey PRIMARY KEY (id);
alter table public.subscriptions add constraint subscriptions_pkey PRIMARY KEY (id);
alter table public.surveys add constraint surveys_pkey PRIMARY KEY (id);
alter table public.user_integrations add constraint user_integrations_pkey PRIMARY KEY (id);
alter table public.vet_share_tokens add constraint vet_share_tokens_pkey PRIMARY KEY (id);
alter table public.webhook_events add constraint webhook_events_pkey PRIMARY KEY (id);
alter table public.weight_logs add constraint weight_logs_pkey PRIMARY KEY (id);
alter table public.blog_categories add constraint blog_categories_slug_key UNIQUE (slug);
alter table public.blog_posts add constraint blog_posts_slug_key UNIQUE (slug);
alter table public.dog_checkins add constraint dog_checkins_dog_id_cycle_number_checkpoint_key UNIQUE (dog_id, cycle_number, checkpoint);
alter table public.dog_formulas add constraint dog_formulas_dog_id_cycle_number_key UNIQUE (dog_id, cycle_number);
alter table public.dog_members add constraint dog_members_dog_id_user_id_key UNIQUE (dog_id, user_id);
alter table public.native_push_tokens add constraint native_push_user_device UNIQUE (user_id, device_id);
alter table public.newsletter_subscribers add constraint newsletter_subscribers_email_key UNIQUE (email);
alter table public.orders add constraint orders_order_number_key UNIQUE (order_number);
alter table public.photo_request_tokens add constraint photo_request_tokens_token_key UNIQUE (token);
alter table public.products add constraint products_slug_key UNIQUE (slug);
alter table public.promotion_claims add constraint promotion_claims_user_id_key UNIQUE (user_id);
alter table public.promotions add constraint promotions_code_key UNIQUE (code);
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key UNIQUE (endpoint);
alter table public.subscription_charges add constraint subscription_charges_idem UNIQUE (subscription_id, scheduled_for);
alter table public.user_integrations add constraint user_integrations_user_id_provider_key UNIQUE (user_id, provider);
alter table public.vet_share_tokens add constraint vet_share_tokens_token_key UNIQUE (token);
alter table public.activity_logs add constraint activity_logs_activity_type_check CHECK ((activity_type = ANY (ARRAY['meal'::text, 'walk'::text, 'poop'::text, 'play'::text, 'sleep'::text, 'water'::text, 'other'::text])));
alter table public.admin_audit_log add constraint admin_audit_log_action_check CHECK (((length(action) >= 3) AND (length(action) <= 80)));
alter table public.admin_audit_log add constraint admin_audit_log_entity_id_check CHECK (((entity_id IS NULL) OR ((length(entity_id) >= 1) AND (length(entity_id) <= 200))));
alter table public.admin_audit_log add constraint admin_audit_log_entity_type_check CHECK (((length(entity_type) >= 1) AND (length(entity_type) <= 40)));
alter table public.algorithm_chronic_severity add constraint algorithm_chronic_severity_default_severity_check CHECK ((default_severity = ANY (ARRAY['mild'::text, 'moderate'::text, 'severe'::text])));
alter table public.algorithm_chronic_severity add constraint algorithm_chronic_severity_fat_factor_check CHECK (((fat_factor >= 0.3) AND (fat_factor <= 2.0)));
alter table public.algorithm_chronic_severity add constraint algorithm_chronic_severity_protein_factor_check CHECK (((protein_factor >= 0.3) AND (protein_factor <= 2.0)));
alter table public.algorithm_food_lines add constraint algorithm_food_lines_calcium_pct_dm_check CHECK (((calcium_pct_dm IS NULL) OR ((calcium_pct_dm >= 0.1) AND (calcium_pct_dm <= (5)::numeric))));
alter table public.algorithm_food_lines add constraint algorithm_food_lines_fat_pct_dm_check CHECK (((fat_pct_dm >= (2)::numeric) AND (fat_pct_dm <= (40)::numeric)));
alter table public.algorithm_food_lines add constraint algorithm_food_lines_kcal_per_100g_check CHECK (((kcal_per_100g >= 50) AND (kcal_per_100g <= 500)));
alter table public.algorithm_food_lines add constraint algorithm_food_lines_line_check CHECK ((line = ANY (ARRAY['basic'::text, 'weight'::text, 'skin'::text, 'premium'::text, 'joint'::text])));
alter table public.algorithm_food_lines add constraint algorithm_food_lines_omega3_pct_dm_check CHECK (((omega3_pct_dm IS NULL) OR ((omega3_pct_dm >= (0)::numeric) AND (omega3_pct_dm <= (10)::numeric))));
alter table public.algorithm_food_lines add constraint algorithm_food_lines_omega6_pct_dm_check CHECK (((omega6_pct_dm IS NULL) OR ((omega6_pct_dm >= (0)::numeric) AND (omega6_pct_dm <= (15)::numeric))));
alter table public.algorithm_food_lines add constraint algorithm_food_lines_phosphorus_pct_dm_check CHECK (((phosphorus_pct_dm IS NULL) OR ((phosphorus_pct_dm >= 0.1) AND (phosphorus_pct_dm <= (4)::numeric))));
alter table public.algorithm_food_lines add constraint algorithm_food_lines_protein_pct_dm_check CHECK (((protein_pct_dm >= (5)::numeric) AND (protein_pct_dm <= (60)::numeric)));
alter table public.algorithm_food_lines add constraint algorithm_food_lines_sodium_pct_dm_check CHECK (((sodium_pct_dm IS NULL) OR ((sodium_pct_dm >= 0.01) AND (sodium_pct_dm <= (2)::numeric))));
alter table public.algorithm_food_lines add constraint algorithm_food_lines_vitamin_d_iu_per_100g_dm_check CHECK (((vitamin_d_iu_per_100g_dm IS NULL) OR ((vitamin_d_iu_per_100g_dm >= 0) AND (vitamin_d_iu_per_100g_dm <= 5000))));
alter table public.algorithm_meta_weights add constraint algorithm_meta_weights_source_check CHECK ((source = ANY (ARRAY['cron'::text, 'manual'::text, 'vet_calibration'::text])));
alter table public.automation_settings add constraint automation_settings_id_check CHECK ((id = 1));
alter table public.automation_settings add constraint automation_settings_marketing_push_hour_check CHECK (((marketing_push_hour >= 0) AND (marketing_push_hour <= 23)));
alter table public.chatbot_messages add constraint chatbot_messages_content_check CHECK ((char_length(content) <= 2000));
alter table public.chatbot_messages add constraint chatbot_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])));
alter table public.consent_log add constraint consent_log_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'push'::text, 'consent_level'::text, 'newsletter'::text])));
alter table public.cron_health add constraint cron_health_status_check CHECK ((status = ANY (ARRAY['success'::text, 'error'::text])));
alter table public.cs_messages add constraint cs_messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 2000)));
alter table public.cs_messages add constraint cs_messages_sender_check CHECK ((sender = ANY (ARRAY['admin'::text, 'user'::text])));
alter table public.dog_checkins add constraint dog_checkins_appetite_score_check CHECK (((appetite_score IS NULL) OR ((appetite_score >= 1) AND (appetite_score <= 5))));
alter table public.dog_checkins add constraint dog_checkins_checkpoint_check CHECK ((checkpoint = ANY (ARRAY['week_2'::text, 'week_4'::text])));
alter table public.dog_checkins add constraint dog_checkins_coat_score_check CHECK (((coat_score IS NULL) OR ((coat_score >= 1) AND (coat_score <= 5))));
alter table public.dog_checkins add constraint dog_checkins_cycle_number_check CHECK ((cycle_number >= 1));
alter table public.dog_checkins add constraint dog_checkins_overall_satisfaction_check CHECK (((overall_satisfaction IS NULL) OR ((overall_satisfaction >= 1) AND (overall_satisfaction <= 5))));
alter table public.dog_checkins add constraint dog_checkins_stool_score_check CHECK (((stool_score IS NULL) OR ((stool_score >= 1) AND (stool_score <= 7))));
alter table public.dog_diary add constraint dog_diary_mood_check CHECK (((mood IS NULL) OR ((mood >= 1) AND (mood <= 5))));
alter table public.dog_diary add constraint dog_diary_note_check CHECK ((char_length(note) <= 200));
alter table public.dog_formulas add constraint dog_formulas_approval_status_check CHECK ((approval_status = ANY (ARRAY['auto_applied'::text, 'pending_approval'::text, 'approved'::text, 'declined'::text])));
alter table public.dog_formulas add constraint dog_formulas_cycle_number_check CHECK ((cycle_number >= 1));
alter table public.dog_formulas add constraint dog_formulas_daily_grams_check CHECK ((daily_grams > 0));
alter table public.dog_formulas add constraint dog_formulas_daily_kcal_check CHECK ((daily_kcal > 0));
alter table public.dog_formulas add constraint dog_formulas_transition_strategy_check CHECK ((transition_strategy = ANY (ARRAY['aggressive'::text, 'gradual'::text, 'conservative'::text])));
alter table public.dog_medications add constraint dog_medications_schedule_check CHECK ((schedule = ANY (ARRAY['daily'::text, 'weekly'::text, 'asneeded'::text])));
alter table public.dog_members add constraint dog_members_role_check CHECK ((role = ANY (ARRAY['member'::text, 'viewer'::text])));
alter table public.dog_reminders add constraint dog_reminders_type_check CHECK ((type = ANY (ARRAY['vaccine'::text, 'medication'::text, 'checkup'::text, 'grooming'::text, 'custom'::text])));
alter table public.dogs add constraint dogs_accuracy_user_boost_check CHECK (((accuracy_user_boost >= (0)::numeric) AND (accuracy_user_boost <= 0.2)));
alter table public.dogs add constraint dogs_activity_method_check CHECK ((activity_method = ANY (ARRAY['pedometer'::text, 'gps'::text, 'subjective'::text, 'unknown'::text])));
alter table public.dogs add constraint dogs_activity_period_check CHECK (((activity_period IS NULL) OR (activity_period = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'unknown'::text]))));
alter table public.dogs add constraint dogs_allergies_source_check CHECK ((allergies_source = ANY (ARRAY['self_suspected'::text, 'vet_diagnosed'::text, 'unknown'::text])));
alter table public.dogs add constraint dogs_breed_size_check CHECK (((breed_size IS NULL) OR (breed_size = ANY (ARRAY['toy'::text, 'small'::text, 'medium'::text, 'large'::text, 'giant'::text]))));
alter table public.dogs add constraint dogs_feed_method_check CHECK ((feed_method = ANY (ARRAY['auto_delivery'::text, 'scale'::text, 'cup'::text, 'eyeball'::text, 'unknown'::text])));
alter table public.dogs add constraint dogs_treat_frequency_check CHECK (((treat_frequency IS NULL) OR (treat_frequency = ANY (ARRAY['none'::text, 'rare'::text, 'weekly'::text, 'daily'::text, 'unknown'::text]))));
alter table public.dogs add constraint dogs_walk_intensity_check CHECK (((walk_intensity IS NULL) OR (walk_intensity = ANY (ARRAY['walk'::text, 'jog'::text, 'run'::text, 'mixed'::text, 'unknown'::text]))));
alter table public.dogs add constraint dogs_weight_measured_by_check CHECK (((weight_measured_by IS NULL) OR (weight_measured_by = ANY (ARRAY['self'::text, 'family'::text, 'vet'::text, 'unknown'::text]))));
alter table public.dogs add constraint dogs_weight_method_check CHECK ((weight_method = ANY (ARRAY['vet_scale'::text, 'home_digital'::text, 'home_analog'::text, 'hold'::text, 'eyeball'::text, 'unknown'::text])));
alter table public.email_suppressions add constraint email_suppressions_reason_check CHECK ((reason = ANY (ARRAY['hard_bounce'::text, 'complaint'::text])));
alter table public.faqs add constraint faqs_category_check CHECK ((category = ANY (ARRAY['식단·영양'::text, '배송·환불'::text, '결제'::text, '정기배송'::text])));
alter table public.feeding_outcomes add constraint feeding_outcomes_bcs_score_check CHECK (((bcs_score >= 1) AND (bcs_score <= 9)));
alter table public.feeding_outcomes add constraint feeding_outcomes_bristol_score_check CHECK (((bristol_score >= 1) AND (bristol_score <= 7)));
alter table public.feeding_outcomes add constraint feeding_outcomes_palatability_check CHECK ((palatability = ANY (ARRAY['great'::text, 'ok'::text, 'poor'::text])));
alter table public.feeding_outcomes add constraint feeding_outcomes_rating_stars_check CHECK (((rating_stars >= 1) AND (rating_stars <= 5)));
alter table public.feeding_outcomes add constraint feeding_outcomes_reason_category_check CHECK ((reason_category = ANY (ARRAY['not_eating'::text, 'digestion_issue'::text, 'weight_change'::text, 'price'::text, 'lifestyle'::text, 'other'::text])));
alter table public.feeding_outcomes add constraint feeding_outcomes_source_check CHECK ((source = ANY (ARRAY['first_order'::text, 'first_box_checkin'::text, 'box_rating'::text, 'reorder'::text, 'subscription_pause'::text, 'subscription_cancel'::text, 'refund'::text, 'self_log'::text])));
alter table public.health_logs add constraint health_logs_activity_level_check CHECK ((activity_level = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text])));
alter table public.health_logs add constraint health_logs_appetite_check CHECK ((appetite = ANY (ARRAY['good'::text, 'normal'::text, 'low'::text, 'none'::text])));
alter table public.health_logs add constraint health_logs_mood_check CHECK ((mood = ANY (ARRAY['happy'::text, 'normal'::text, 'tired'::text, 'sick'::text])));
alter table public.health_logs add constraint health_logs_poop_quality_check CHECK ((poop_quality = ANY (ARRAY['good'::text, 'loose'::text, 'hard'::text, 'diarrhea'::text])));
alter table public.kibble_products add constraint kibble_products_kcal_source_check CHECK ((kcal_source = ANY (ARRAY['label'::text, 'atwater'::text, 'feeding_trial'::text])));
alter table public.kibble_requests add constraint kibble_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'added'::text])));
alter table public.medical_records add constraint medical_records_ocr_confidence_check CHECK (((ocr_confidence IS NULL) OR ((ocr_confidence >= (0)::numeric) AND (ocr_confidence <= (1)::numeric))));
alter table public.medical_records add constraint medical_records_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'ocr'::text, 'vet'::text])));
alter table public.meta_learning_events add constraint meta_learning_events_reward_check CHECK (((reward >= (0)::numeric) AND (reward <= (1)::numeric)));
alter table public.native_push_tokens add constraint native_push_tokens_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text])));
alter table public.newsletter_subscribers add constraint newsletter_subscribers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'unsubscribed'::text])));
alter table public.order_items add constraint order_items_quantity_check CHECK ((quantity > 0));
alter table public.orders add constraint orders_cash_receipt_type_check CHECK (((cash_receipt_type IS NULL) OR (cash_receipt_type = ANY (ARRAY['소득공제'::text, '지출증빙'::text]))));
alter table public.orders add constraint orders_discount_reason_check CHECK (((discount_reason IS NULL) OR (discount_reason = ANY (ARRAY['tier'::text, 'promotion'::text, 'none'::text]))));
alter table public.orders add constraint orders_order_status_check CHECK ((order_status = ANY (ARRAY['pending'::text, 'preparing'::text, 'shipping'::text, 'delivered'::text, 'cancelled'::text])));
alter table public.orders add constraint orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text, 'partially_refunded'::text])));
alter table public.payment_events add constraint payment_events_event_type_check CHECK ((event_type = ANY (ARRAY['paid'::text, 'refunded'::text, 'partial_refunded'::text, 'failed'::text, 'cancel_requested'::text, 'webhook_received'::text, 'admin_action'::text, 'cron_refund_queue'::text])));
alter table public.payment_events add constraint payment_events_source_check CHECK ((source = ANY (ARRAY['user_checkout'::text, 'toss_webhook'::text, 'user_cancel'::text, 'partial_cancel'::text, 'cron_refund_queue'::text, 'cron_subscription_charge'::text, 'cron_order_expire'::text, 'admin_panel'::text])));
alter table public.payment_refund_queue add constraint payment_refund_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'permanently_failed'::text])));
alter table public.products add constraint products_price_nonneg CHECK ((price >= 0));
alter table public.products add constraint products_sale_lte_price CHECK (((sale_price IS NULL) OR (sale_price <= price)));
alter table public.products add constraint products_sales_channel_check CHECK ((sales_channel = ANY (ARRAY['own'::text, 'external'::text])));
alter table public.products add constraint products_stock_nonneg CHECK ((stock >= 0));
alter table public.profiles add constraint profiles_birth_day_range CHECK (((birth_day IS NULL) OR ((birth_day >= 1) AND (birth_day <= 31))));
alter table public.profiles add constraint profiles_birth_month_range CHECK (((birth_month IS NULL) OR ((birth_month >= 1) AND (birth_month <= 12))));
alter table public.profiles add constraint profiles_birth_year_range CHECK (((birth_year IS NULL) OR ((birth_year >= 1900) AND (birth_year <= 2100))));
alter table public.profiles add constraint profiles_consent_level_check CHECK (((consent_level >= 1) AND (consent_level <= 4)));
alter table public.profiles add constraint profiles_consent_max_rewarded_level_check CHECK (((consent_max_rewarded_level >= 1) AND (consent_max_rewarded_level <= 4)));
alter table public.profiles add constraint profiles_tier_check CHECK ((tier = ANY (ARRAY['seed'::text, 'sprout'::text, 'bloom'::text, 'fruit'::text, 'mate'::text])));
alter table public.promotions add constraint promotions_check CHECK ((ends_at > starts_at));
alter table public.promotions add constraint promotions_discount_rate_check CHECK (((discount_rate > (0)::numeric) AND (discount_rate <= (1)::numeric)));
alter table public.promotions add constraint promotions_max_signups_check CHECK (((max_signups IS NULL) OR (max_signups >= 0)));
alter table public.push_campaigns add constraint push_campaigns_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 240)));
alter table public.push_campaigns add constraint push_campaigns_segment_check CHECK ((segment = ANY (ARRAY['all'::text, 'inactive_30d'::text, 'active_subscribers'::text])));
alter table public.push_campaigns add constraint push_campaigns_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 80)));
alter table public.push_preferences add constraint push_preferences_quiet_hours_range CHECK ((((quiet_hours_start IS NULL) AND (quiet_hours_end IS NULL)) OR ((quiet_hours_start IS NOT NULL) AND (quiet_hours_end IS NOT NULL) AND ((quiet_hours_start >= 0) AND (quiet_hours_start <= 23)) AND ((quiet_hours_end >= 0) AND (quiet_hours_end <= 23)) AND (quiet_hours_start <> quiet_hours_end))));
alter table public.refunds add constraint refunds_amount_check CHECK ((amount > 0));
alter table public.refunds add constraint refunds_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text])));
alter table public.reweighs add constraint reweighs_goal_check CHECK ((goal = ANY (ARRAY['maintain'::text, 'lose'::text, 'gain'::text])));
alter table public.source_waitlist add constraint source_waitlist_concern_check CHECK ((concern = ANY (ARRAY['skin'::text, 'joint'::text, 'digestion'::text, 'immune'::text])));
alter table public.subscription_charges add constraint subscription_charges_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text, 'skipped'::text])));
alter table public.subscription_items add constraint subscription_items_quantity_check CHECK ((quantity > 0));
alter table public.subscriptions add constraint subscriptions_biweekly_only CHECK (((interval_weeks = 2) AND (coverage_weeks = 2)));
alter table public.subscriptions add constraint subscriptions_coverage_weeks_check CHECK ((coverage_weeks = ANY (ARRAY[2, 4])));
alter table public.subscriptions add constraint subscriptions_interval_weeks_check CHECK ((interval_weeks = ANY (ARRAY[1, 2, 4])));
alter table public.subscriptions add constraint subscriptions_mix_ratio_check CHECK (((mix_ratio >= 0.30) AND (mix_ratio <= 1.00)));
alter table public.subscriptions add constraint subscriptions_sku_size_g_check CHECK ((sku_size_g = ANY (ARRAY[70, 100, 130, 170, 220, 280, 350])));
alter table public.subscriptions add constraint subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'cancelled'::text])));
alter table public.surveys add constraint surveys_appetite_check CHECK (((appetite IS NULL) OR (appetite = ANY (ARRAY['strong'::text, 'normal'::text, 'picky'::text, 'reduced'::text]))));
alter table public.surveys add constraint surveys_bristol_stool_score_check CHECK (((bristol_stool_score IS NULL) OR ((bristol_stool_score >= 1) AND (bristol_stool_score <= 7))));
alter table public.surveys add constraint surveys_budget_tier_check CHECK ((budget_tier = ANY (ARRAY['under_5000'::text, '5000_10000'::text, '10000_15000'::text, 'no_limit'::text])));
alter table public.surveys add constraint surveys_care_goal_check CHECK (((care_goal IS NULL) OR (care_goal = ANY (ARRAY['weight_management'::text, 'skin_coat'::text, 'joint_senior'::text, 'allergy_avoid'::text, 'general_upgrade'::text]))));
alter table public.surveys add constraint surveys_coat_condition_check CHECK (((coat_condition IS NULL) OR (coat_condition = ANY (ARRAY['healthy'::text, 'dull'::text, 'shedding'::text, 'itchy'::text, 'lesions'::text]))));
alter table public.surveys add constraint surveys_current_diet_satisfaction_check CHECK (((current_diet_satisfaction IS NULL) OR ((current_diet_satisfaction >= 1) AND (current_diet_satisfaction <= 5))));
alter table public.surveys add constraint surveys_daily_walk_minutes_check CHECK (((daily_walk_minutes IS NULL) OR (daily_walk_minutes >= 0)));
alter table public.surveys add constraint surveys_expected_adult_weight_kg_check CHECK (((expected_adult_weight_kg IS NULL) OR ((expected_adult_weight_kg >= 0.5) AND (expected_adult_weight_kg <= (100)::numeric))));
alter table public.surveys add constraint surveys_gi_sensitivity_check CHECK (((gi_sensitivity IS NULL) OR (gi_sensitivity = ANY (ARRAY['rare'::text, 'sometimes'::text, 'frequent'::text, 'always'::text]))));
alter table public.surveys add constraint surveys_home_cooking_experience_check CHECK (((home_cooking_experience IS NULL) OR (home_cooking_experience = ANY (ARRAY['first'::text, 'occasional'::text, 'frequent'::text]))));
alter table public.surveys add constraint surveys_indoor_activity_check CHECK (((indoor_activity IS NULL) OR (indoor_activity = ANY (ARRAY['calm'::text, 'moderate'::text, 'active'::text]))));
alter table public.surveys add constraint surveys_iris_stage_check CHECK (((iris_stage IS NULL) OR ((iris_stage >= 1) AND (iris_stage <= 4))));
alter table public.surveys add constraint surveys_litter_size_check CHECK (((litter_size IS NULL) OR ((litter_size >= 1) AND (litter_size <= 15))));
alter table public.surveys add constraint surveys_mcs_score_check CHECK (((mcs_score IS NULL) OR ((mcs_score >= 1) AND (mcs_score <= 4))));
alter table public.surveys add constraint surveys_pregnancy_status_check CHECK (((pregnancy_status IS NULL) OR (pregnancy_status = ANY (ARRAY['none'::text, 'pregnant'::text, 'lactating'::text]))));
alter table public.surveys add constraint surveys_pregnancy_week_check CHECK (((pregnancy_week IS NULL) OR ((pregnancy_week >= 1) AND (pregnancy_week <= 9))));
alter table public.surveys add constraint surveys_weight_trend_6mo_check CHECK (((weight_trend_6mo IS NULL) OR (weight_trend_6mo = ANY (ARRAY['stable'::text, 'gained'::text, 'lost'::text, 'unknown'::text]))));
alter table public.user_integrations add constraint user_integrations_provider_check CHECK ((provider = ANY (ARRAY['tractive'::text, 'fi'::text, 'whistle'::text, 'manual_pedometer'::text])));
alter table public.user_integrations add constraint user_integrations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'expired'::text, 'revoked'::text])));

-- ===== foreign keys =====
alter table public.account_deletions add constraint account_deletions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.activity_logs add constraint activity_logs_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.activity_logs add constraint activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.addresses add constraint addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.admin_audit_log add constraint admin_audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.algorithm_breed_predispose add constraint algorithm_breed_predispose_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
alter table public.algorithm_chronic_severity add constraint algorithm_chronic_severity_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
alter table public.algorithm_food_lines add constraint algorithm_food_lines_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
alter table public.analyses add constraint analyses_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.analyses add constraint analyses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE;
alter table public.analyses add constraint analyses_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.automation_settings add constraint automation_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
alter table public.blog_posts add constraint blog_posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE SET NULL;
alter table public.consent_log add constraint consent_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cs_messages add constraint cs_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.cs_messages add constraint cs_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.dog_checkins add constraint dog_checkins_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.dog_checkins add constraint dog_checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.dog_diary add constraint dog_diary_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.dog_formulas add constraint dog_formulas_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.dog_formulas add constraint dog_formulas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.dog_medications add constraint dog_medications_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.dog_medications add constraint dog_medications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.dog_members add constraint dog_members_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.dog_members add constraint dog_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.dog_members add constraint dog_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.dog_reminders add constraint dog_reminders_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.dog_reminders add constraint dog_reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.dog_sensitivity_snapshots add constraint dog_sensitivity_snapshots_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.dog_sensitivity_snapshots add constraint dog_sensitivity_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.dog_vaccinations add constraint dog_vaccinations_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.dog_vaccinations add constraint dog_vaccinations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.dogs add constraint dogs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.feeding_outcomes add constraint feeding_outcomes_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.feeding_outcomes add constraint feeding_outcomes_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table public.feeding_outcomes add constraint feeding_outcomes_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;
alter table public.feeding_outcomes add constraint feeding_outcomes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.health_logs add constraint health_logs_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.health_logs add constraint health_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.medical_records add constraint medical_records_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.medical_records add constraint medical_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.meta_learning_events add constraint meta_learning_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.native_push_tokens add constraint native_push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.newsletter_subscribers add constraint newsletter_subscribers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.order_items add constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.order_items add constraint order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
alter table public.orders add constraint orders_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;
alter table public.orders add constraint orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.payment_events add constraint payment_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.payment_events add constraint payment_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
alter table public.payment_refund_queue add constraint payment_refund_queue_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
alter table public.photo_request_tokens add constraint photo_request_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.photo_request_tokens add constraint photo_request_tokens_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.point_ledger add constraint point_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.product_qna add constraint product_qna_answered_by_fkey FOREIGN KEY (answered_by) REFERENCES auth.users(id);
alter table public.product_qna add constraint product_qna_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.product_qna add constraint product_qna_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.promotion_claims add constraint promotion_claims_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE;
alter table public.promotion_claims add constraint promotion_claims_redeemed_order_id_fkey FOREIGN KEY (redeemed_order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table public.promotion_claims add constraint promotion_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.push_campaigns add constraint push_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.push_log add constraint push_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.push_preferences add constraint push_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.refunds add constraint refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
alter table public.reweighs add constraint reweighs_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.source_waitlist add constraint source_waitlist_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE SET NULL;
alter table public.source_waitlist add constraint source_waitlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.stamps add constraint stamps_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table public.stamps add constraint stamps_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.subscription_charges add constraint subscription_charges_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE;
alter table public.subscription_items add constraint subscription_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
alter table public.subscription_items add constraint subscription_items_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE;
alter table public.subscriptions add constraint subscriptions_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE SET NULL;
alter table public.subscriptions add constraint subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.subscriptions add constraint subscriptions_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.surveys add constraint surveys_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.surveys add constraint surveys_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.user_integrations add constraint user_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.vet_share_tokens add constraint vet_share_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.vet_share_tokens add constraint vet_share_tokens_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.webhook_events add constraint webhook_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
alter table public.weight_logs add constraint weight_logs_dog_id_fkey FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE;
alter table public.weight_logs add constraint weight_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ===== indexes =====
CREATE INDEX IF NOT EXISTS account_deletions_email_hash ON public.account_deletions USING btree (email_hash);
CREATE INDEX IF NOT EXISTS account_deletions_purged_idx ON public.account_deletions USING btree (purged_at) WHERE (purged_at IS NULL);
CREATE INDEX IF NOT EXISTS account_deletions_time ON public.account_deletions USING btree (deleted_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_user_occurred_idx ON public.activity_logs USING btree (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_dog_id ON public.activity_logs USING btree (dog_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_occurred ON public.activity_logs USING btree (dog_id, occurred_at DESC);
CREATE UNIQUE INDEX addresses_one_default_per_user ON public.addresses USING btree (user_id) WHERE (is_default = true);
CREATE INDEX IF NOT EXISTS addresses_user_id_idx ON public.addresses USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log USING btree (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_created ON public.admin_audit_log USING btree (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON public.admin_audit_log USING btree (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_algorithm_meta_weights_recent ON public.algorithm_meta_weights USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_algorithm_meta_weights_version ON public.algorithm_meta_weights USING btree (version);
CREATE INDEX IF NOT EXISTS analyses_dog_created_idx ON public.analyses USING btree (dog_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analyses_next_review_idx ON public.analyses USING btree (next_review_date) WHERE (next_review_date IS NOT NULL);
CREATE INDEX IF NOT EXISTS analyses_risk_flags_idx ON public.analyses USING gin (risk_flags);
CREATE INDEX IF NOT EXISTS analyses_user_created_idx ON public.analyses USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS anthropic_usage_day_idx ON public.anthropic_usage USING btree (day DESC);
CREATE INDEX IF NOT EXISTS blog_posts_category_idx ON public.blog_posts USING btree (category_id, published_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_published_idx ON public.blog_posts USING btree (is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS chatbot_messages_user_created_idx ON public.chatbot_messages USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chatbot_messages_user_dog_idx ON public.chatbot_messages USING btree (user_id, dog_id, created_at DESC);
CREATE INDEX IF NOT EXISTS consent_log_user_time ON public.consent_log USING btree (user_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS cron_health_errors_idx ON public.cron_health USING btree (executed_at DESC) WHERE (status = 'error'::text);
CREATE INDEX IF NOT EXISTS cron_health_recent_idx ON public.cron_health USING btree (executed_at DESC);
CREATE INDEX IF NOT EXISTS cs_messages_admin_unread_idx ON public.cs_messages USING btree (created_at DESC) WHERE ((sender = 'user'::text) AND (read_at IS NULL));
CREATE INDEX IF NOT EXISTS cs_messages_user_recent_idx ON public.cs_messages USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dog_checkins_checkpoint_idx ON public.dog_checkins USING btree (checkpoint, responded_at DESC);
CREATE INDEX IF NOT EXISTS dog_checkins_dog_cycle_idx ON public.dog_checkins USING btree (dog_id, cycle_number DESC);
CREATE INDEX IF NOT EXISTS dog_checkins_user_idx ON public.dog_checkins USING btree (user_id, responded_at DESC);
CREATE INDEX IF NOT EXISTS dog_diary_dog_created_idx ON public.dog_diary USING btree (dog_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dog_diary_user_created_idx ON public.dog_diary USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dog_formulas_approved_idx ON public.dog_formulas USING btree (dog_id, approved_at DESC) WHERE (approval_status = ANY (ARRAY['auto_applied'::text, 'approved'::text]));
CREATE INDEX IF NOT EXISTS dog_formulas_pending_idx ON public.dog_formulas USING btree (proposed_at) WHERE (approval_status = 'pending_approval'::text);
CREATE INDEX IF NOT EXISTS dog_formulas_strategy_idx ON public.dog_formulas USING btree (transition_strategy) WHERE (transition_strategy IS NOT NULL);
CREATE INDEX IF NOT EXISTS dog_formulas_user_idx ON public.dog_formulas USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dog_medications_dog_id ON public.dog_medications USING btree (dog_id);
CREATE INDEX IF NOT EXISTS idx_dog_medications_enabled ON public.dog_medications USING btree (dog_id, enabled) WHERE (enabled = true);
CREATE INDEX IF NOT EXISTS idx_dog_medications_user_id ON public.dog_medications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_dog_members_dog ON public.dog_members USING btree (dog_id);
CREATE INDEX IF NOT EXISTS idx_dog_members_user ON public.dog_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS dog_reminders_dog_idx ON public.dog_reminders USING btree (dog_id, next_date);
CREATE INDEX IF NOT EXISTS dog_reminders_user_idx ON public.dog_reminders USING btree (user_id, next_date);
CREATE INDEX IF NOT EXISTS idx_sensitivity_dog ON public.dog_sensitivity_snapshots USING btree (dog_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensitivity_user ON public.dog_sensitivity_snapshots USING btree (user_id, snapshot_at DESC);
CREATE UNIQUE INDEX uq_sensitivity_dog_day ON public.dog_sensitivity_snapshots USING btree (dog_id, (((snapshot_at AT TIME ZONE 'Asia/Seoul'::text))::date));
CREATE INDEX IF NOT EXISTS idx_dog_vaccinations_dog_id ON public.dog_vaccinations USING btree (dog_id);
CREATE INDEX IF NOT EXISTS idx_dog_vaccinations_next ON public.dog_vaccinations USING btree (next_date) WHERE (next_date IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_dog_vaccinations_user_id ON public.dog_vaccinations USING btree (user_id);
CREATE INDEX IF NOT EXISTS dogs_user_created_idx ON public.dogs USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS faqs_published_idx ON public.faqs USING btree (is_published, category, sort_order);
CREATE INDEX IF NOT EXISTS idx_feeding_outcomes_cohort ON public.feeding_outcomes USING btree (cohort_id, source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feeding_outcomes_dog ON public.feeding_outcomes USING btree (dog_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feeding_outcomes_source ON public.feeding_outcomes USING btree (source, created_at DESC);
CREATE UNIQUE INDEX uq_first_box_checkin ON public.feeding_outcomes USING btree (dog_id) WHERE (source = 'first_box_checkin'::text);
CREATE INDEX IF NOT EXISTS health_logs_dog_idx ON public.health_logs USING btree (dog_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS health_logs_user_idx ON public.health_logs USING btree (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_records_dog ON public.medical_records USING btree (dog_id, visit_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_medical_records_user ON public.medical_records USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mle_arm ON public.meta_learning_events USING btree (context, arm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mle_recent ON public.meta_learning_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS native_push_tokens_token_idx ON public.native_push_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS native_push_tokens_user_idx ON public.native_push_tokens USING btree (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS newsletter_status_idx ON public.newsletter_subscribers USING btree (status);
CREATE INDEX IF NOT EXISTS newsletter_token_idx ON public.newsletter_subscribers USING btree (confirm_token);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON public.order_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON public.orders USING btree (payment_status);
CREATE INDEX IF NOT EXISTS orders_pending_expire_idx ON public.orders USING btree (created_at) WHERE ((payment_status = 'pending'::text) AND (order_status = 'pending'::text));
CREATE INDEX IF NOT EXISTS orders_shipping_tracking_idx ON public.orders USING btree (shipped_at) WHERE ((order_status = 'shipping'::text) AND (tracking_number IS NOT NULL) AND (delivered_at IS NULL));
CREATE INDEX IF NOT EXISTS orders_subscription_id_idx ON public.orders USING btree (subscription_id) WHERE (subscription_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS orders_user_created_idx ON public.orders USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_user_discount_reason_idx ON public.orders USING btree (user_id, discount_reason, paid_at) WHERE (discount_reason = ANY (ARRAY['tier'::text, 'birthday'::text]));
CREATE INDEX IF NOT EXISTS orders_user_updated_active_idx ON public.orders USING btree (user_id, updated_at DESC) WHERE (order_status = ANY (ARRAY['shipping'::text, 'delivered'::text]));
CREATE INDEX IF NOT EXISTS orders_virtual_account_due_date_idx ON public.orders USING btree (virtual_account_due_date) WHERE (virtual_account_due_date IS NOT NULL);
CREATE INDEX IF NOT EXISTS partners_published_idx ON public.partners USING btree (is_published, sort_order);
CREATE INDEX IF NOT EXISTS idx_payment_events_order_time ON public.payment_events USING btree (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_key ON public.payment_events USING btree (payment_key) WHERE (payment_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_payment_events_type_time ON public.payment_events USING btree (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_refund_queue_order ON public.payment_refund_queue USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_refund_queue_status_retry ON public.payment_refund_queue USING btree (status, next_retry_at) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX uq_payment_refund_queue_pending ON public.payment_refund_queue USING btree (payment_key, reason) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS idx_photo_request_dog ON public.photo_request_tokens USING btree (dog_id);
CREATE INDEX IF NOT EXISTS point_ledger_user_created_idx ON public.point_ledger USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX uq_point_ledger_reference ON public.point_ledger USING btree (user_id, reference_type, reference_id) WHERE (reference_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS product_qna_product_idx ON public.product_qna USING btree (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_qna_user_idx ON public.product_qna USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS products_active_price_idx ON public.products USING btree (price) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS products_active_sort_idx ON public.products USING btree (sort_order) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS products_allergens_gin ON public.products USING gin (allergens);
CREATE INDEX IF NOT EXISTS products_category_active_idx ON public.products USING btree (category, sort_order) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS products_origin_btree ON public.products USING btree (origin) WHERE (origin IS NOT NULL);
CREATE INDEX IF NOT EXISTS products_sales_count_idx ON public.products USING btree (sales_count DESC) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS products_sku_idx ON public.products USING btree (sku) WHERE (sku IS NOT NULL);
CREATE INDEX IF NOT EXISTS profiles_birthday_idx ON public.profiles USING btree (birth_month, birth_day) WHERE ((birth_month IS NOT NULL) AND (birth_day IS NOT NULL));
CREATE INDEX IF NOT EXISTS profiles_tier_idx ON public.profiles USING btree (tier);
CREATE INDEX IF NOT EXISTS promotion_claims_promo_idx ON public.promotion_claims USING btree (promotion_id);
CREATE INDEX IF NOT EXISTS promotions_code_idx ON public.promotions USING btree (code);
CREATE INDEX IF NOT EXISTS push_campaigns_recent_idx ON public.push_campaigns USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS push_log_nudge_window_idx ON public.push_log USING btree (user_id, sent_at DESC) WHERE nudge;
CREATE INDEX IF NOT EXISTS push_log_user_recent_idx ON public.push_log USING btree (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS push_log_user_unread_idx ON public.push_log USING btree (user_id, sent_at DESC) WHERE (read_at IS NULL);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_updated ON public.rate_limit_counters USING btree (updated_at);
CREATE INDEX IF NOT EXISTS refunds_order_idx ON public.refunds USING btree (order_id, refunded_at DESC);
CREATE INDEX IF NOT EXISTS refunds_status_idx ON public.refunds USING btree (status) WHERE (status <> 'succeeded'::text);
CREATE INDEX IF NOT EXISTS refunds_user_idx ON public.refunds USING btree (user_id, refunded_at DESC);
CREATE INDEX IF NOT EXISTS idx_reweighs_dog_created ON public.reweighs USING btree (dog_id, created_at DESC);
CREATE INDEX IF NOT EXISTS source_waitlist_pending_idx ON public.source_waitlist USING btree (concern) WHERE (notified_at IS NULL);
CREATE UNIQUE INDEX source_waitlist_uniq_user_concern ON public.source_waitlist USING btree (user_id, concern);
CREATE INDEX IF NOT EXISTS source_waitlist_user_idx ON public.source_waitlist USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX stamps_order_uniq ON public.stamps USING btree (order_id) WHERE (order_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS stamps_user_expires_idx ON public.stamps USING btree (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS subscription_charges_status_idx ON public.subscription_charges USING btree (status, attempted_at DESC);
CREATE INDEX IF NOT EXISTS subscription_charges_user_idx ON public.subscription_charges USING btree (user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS subscription_items_product_id_idx ON public.subscription_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS subscription_items_subscription_idx ON public.subscription_items USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS subscriptions_active_due_idx ON public.subscriptions USING btree (next_delivery_date) WHERE ((status = 'active'::text) AND (billing_key IS NOT NULL));
CREATE INDEX IF NOT EXISTS subscriptions_charge_due_idx ON public.subscriptions USING btree (next_delivery_date) WHERE ((status = 'active'::text) AND (requires_billing_key_renewal = false) AND (billing_key IS NOT NULL));
CREATE INDEX IF NOT EXISTS subscriptions_dog_active_idx ON public.subscriptions USING btree (dog_id, created_at DESC) WHERE ((dog_id IS NOT NULL) AND (status = ANY (ARRAY['active'::text, 'paused'::text])));
CREATE INDEX IF NOT EXISTS subscriptions_next_delivery_idx ON public.subscriptions USING btree (next_delivery_date) WHERE (status = 'active'::text);
CREATE UNIQUE INDEX subscriptions_one_live_per_dog ON public.subscriptions USING btree (dog_id) WHERE ((status = ANY (ARRAY['active'::text, 'paused'::text])) AND (dog_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions USING btree (status);
CREATE INDEX IF NOT EXISTS subscriptions_user_active_idx ON public.subscriptions USING btree (user_id, created_at DESC) WHERE (status = 'active'::text);
CREATE INDEX IF NOT EXISTS subscriptions_user_created_idx ON public.subscriptions USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS surveys_care_goal_idx ON public.surveys USING btree (care_goal) WHERE (care_goal IS NOT NULL);
CREATE INDEX IF NOT EXISTS surveys_chronic_idx ON public.surveys USING gin (chronic_conditions);
CREATE INDEX IF NOT EXISTS surveys_dog_created_idx ON public.surveys USING btree (dog_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider_status ON public.user_integrations USING btree (provider, status);
CREATE INDEX IF NOT EXISTS idx_user_integrations_user ON public.user_integrations USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_vet_share_tokens_active ON public.vet_share_tokens USING btree (dog_id, expires_at) WHERE (revoked_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_vet_share_tokens_dog ON public.vet_share_tokens USING btree (dog_id);
CREATE INDEX IF NOT EXISTS webhook_events_order_idx ON public.webhook_events USING btree (order_id, created_at DESC);
CREATE UNIQUE INDEX webhook_events_provider_key_uniq ON public.webhook_events USING btree (provider, event_key);
CREATE INDEX IF NOT EXISTS weight_logs_dog_idx ON public.weight_logs USING btree (dog_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS weight_logs_user_idx ON public.weight_logs USING btree (user_id);

-- ===== functions =====
CREATE OR REPLACE FUNCTION public.addresses_manage_default()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.addresses
      WHERE user_id = NEW.user_id AND is_default = true
    ) THEN
      NEW.is_default := true;
    END IF;
  END IF;

  IF NEW.is_default = true THEN
    UPDATE public.addresses
       SET is_default = false
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_user_ids()
 RETURNS TABLE(id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select u.id
  from auth.users u
  where u.raw_app_meta_data ->> 'role' = 'admin'
$function$
;

CREATE OR REPLACE FUNCTION public.apply_point_delta(p_user_id uuid, p_delta integer, p_reason text, p_reference_type text, p_reference_id uuid)
 RETURNS TABLE(balance_after integer, ok boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lock_key  BIGINT;
  v_prev      INTEGER;
  v_next      INTEGER;
  v_caller    UUID;
  v_is_admin  BOOLEAN;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = v_caller AND (u.raw_app_meta_data ->> 'role') = 'admin'
    ) INTO v_is_admin;

    IF p_user_id <> v_caller AND NOT v_is_admin THEN
      RAISE EXCEPTION 'forbidden: cannot modify other user point ledger'
        USING ERRCODE = '42501';
    END IF;

    IF p_reference_type = 'admin_adjustment' AND NOT v_is_admin THEN
      RAISE EXCEPTION 'forbidden: admin_adjustment requires admin role'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  v_lock_key := hashtext(p_user_id::text);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT pl.balance_after INTO v_prev
  FROM public.point_ledger pl
  WHERE pl.user_id = p_user_id
  ORDER BY pl.created_at DESC
  LIMIT 1;

  IF v_prev IS NULL THEN
    v_prev := 0;
  END IF;

  v_next := v_prev + p_delta;

  IF v_next < 0 THEN
    RETURN QUERY SELECT v_prev, FALSE, '포인트 잔액이 부족해요'::TEXT;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.point_ledger (
      user_id, delta, balance_after, reason, reference_type, reference_id
    ) VALUES (
      p_user_id, p_delta, v_next, p_reason, p_reference_type, p_reference_id
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN QUERY SELECT v_prev, TRUE, 'already_applied'::TEXT;
      RETURN;
  END;

  RETURN QUERY SELECT v_next, TRUE, NULL::TEXT;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.avg_daily_feed_grams(p_user_id uuid, p_window_days integer DEFAULT 30)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT COALESCE(
    SUM((oi.quantity * p.net_weight_g)::numeric) / GREATEST(p_window_days, 1),
    0
  )
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  JOIN public.products p ON p.id = oi.product_id
  WHERE o.user_id = p_user_id
    AND o.payment_status = 'paid'
    AND p.net_weight_g IS NOT NULL
    AND p.net_weight_g > 0
    AND o.paid_at IS NOT NULL
    AND o.paid_at >= NOW() - (p_window_days || ' days')::interval
$function$
;

CREATE OR REPLACE FUNCTION public.block_admin_audit_log_mutations()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION
    'admin_audit_log is insert-only — % blocked. ledger integrity preserved.',
    TG_OP
    USING ERRCODE = 'check_violation';
END $function$
;

CREATE OR REPLACE FUNCTION public.block_payment_events_mutations()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'payment_events is insert-only ledger; UPDATE/DELETE forbidden (op=%, id=%)',
    TG_OP, COALESCE(NEW.id, OLD.id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.block_point_ledger_mutations()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'point_ledger is insert-only; UPDATE/DELETE forbidden (op=%, id=%)',
    TG_OP, COALESCE(NEW.id, OLD.id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_promotion(p_code text)
 RETURNS TABLE(ok boolean, reason text, rate numeric, promo_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_promo public.promotions%ROWTYPE;
  v_count integer;
BEGIN
  -- 로그인 안 했으면 거부(fail-closed). 가입 직후 호출되는 함수다.
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'unauthenticated', 0::numeric, NULL::text;
    RETURN;
  END IF;

  -- 이미 프로모션을 받은 계정이면 조용히 끝낸다(계정당 1회).
  IF EXISTS (SELECT 1 FROM public.promotion_claims c WHERE c.user_id = v_uid) THEN
    RETURN QUERY SELECT false, 'already_claimed', 0::numeric, NULL::text;
    RETURN;
  END IF;

  -- ★ 행을 잠근다 — 이 잠금이 상한의 동시성을 막는다.
  SELECT * INTO v_promo FROM public.promotions p
   WHERE p.code = lower(trim(p_code))
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found', 0::numeric, NULL::text;
    RETURN;
  END IF;

  -- 게이트 — lib/promotions.ts promotionGate 와 **같은 순서·같은 경계**여야 한다.
  IF NOT v_promo.active THEN
    RETURN QUERY SELECT false, 'inactive', 0::numeric, v_promo.name; RETURN;
  END IF;
  IF now() < v_promo.starts_at THEN
    RETURN QUERY SELECT false, 'not_started', 0::numeric, v_promo.name; RETURN;
  END IF;
  IF now() > v_promo.ends_at THEN
    RETURN QUERY SELECT false, 'ended', 0::numeric, v_promo.name; RETURN;
  END IF;

  IF v_promo.max_signups IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.promotion_claims c
     WHERE c.promotion_id = v_promo.id;
    IF v_count >= v_promo.max_signups THEN
      RETURN QUERY SELECT false, 'full', 0::numeric, v_promo.name; RETURN;
    END IF;
  END IF;

  INSERT INTO public.promotion_claims (promotion_id, user_id)
  VALUES (v_promo.id, v_uid)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY SELECT true, 'claimed', v_promo.discount_rate, v_promo.name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cohort_ltv_weekly(weeks_back integer DEFAULT 12)
 RETURNS TABLE(cohort_week date, cohort_size bigint, ltv_d7 numeric, ltv_d30 numeric, ltv_d90 numeric, ltv_total numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 매출 지표다. admin 아니면 거부(fail-closed — 비로그인도 여기서 걸린다).
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH cohorts AS (
    SELECT
      date_trunc('week', p.created_at AT TIME ZONE 'Asia/Seoul')::date AS cohort_week,
      p.id AS user_id,
      (p.created_at AT TIME ZONE 'Asia/Seoul')::date AS join_date
    FROM public.profiles p
    WHERE p.created_at >= now() - (weeks_back || ' weeks')::interval
  ),
  spend AS (
    SELECT
      c.cohort_week,
      c.user_id,
      o.total_amount,
      EXTRACT(EPOCH FROM (o.created_at - (c.join_date::timestamp AT TIME ZONE 'Asia/Seoul'))) / 86400.0 AS days_since_join
    FROM cohorts c
    LEFT JOIN public.orders o
      ON o.user_id = c.user_id
     AND o.payment_status = 'paid'
  )
  SELECT
    s.cohort_week,
    COUNT(DISTINCT s.user_id) AS cohort_size,
    COALESCE(SUM(s.total_amount) FILTER (WHERE s.days_since_join < 7), 0)::numeric
      / NULLIF(COUNT(DISTINCT s.user_id), 0) AS ltv_d7,
    COALESCE(SUM(s.total_amount) FILTER (WHERE s.days_since_join < 30), 0)::numeric
      / NULLIF(COUNT(DISTINCT s.user_id), 0) AS ltv_d30,
    COALESCE(SUM(s.total_amount) FILTER (WHERE s.days_since_join < 90), 0)::numeric
      / NULLIF(COUNT(DISTINCT s.user_id), 0) AS ltv_d90,
    COALESCE(SUM(s.total_amount), 0)::numeric
      / NULLIF(COUNT(DISTINCT s.user_id), 0) AS ltv_total
  FROM spend s
  GROUP BY s.cohort_week
  ORDER BY s.cohort_week DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cohort_retention_weekly(p_max_cohorts integer DEFAULT 12)
 RETURNS TABLE(cohort_week date, cohort_size bigint, retention_w0 numeric, retention_w1 numeric, retention_w2 numeric, retention_w4 numeric, retention_w8 numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH cohorts AS (
    SELECT
      date_trunc('week', p.created_at AT TIME ZONE 'Asia/Seoul')::date AS cohort_week,
      p.id AS user_id,
      p.created_at AS joined_at
    FROM public.profiles p
    WHERE p.created_at >= now() - ((p_max_cohorts * 7) || ' days')::interval
  ),
  last_paid AS (
    SELECT
      c.cohort_week,
      c.user_id,
      c.joined_at,
      MAX(EXTRACT(EPOCH FROM (o.paid_at - c.joined_at)) / 604800.0) AS weeks_survived
    FROM cohorts c
    LEFT JOIN public.orders o
      ON o.user_id = c.user_id
     AND o.payment_status = 'paid'
     AND o.paid_at IS NOT NULL
    GROUP BY c.cohort_week, c.user_id, c.joined_at
  ),
  agg AS (
    SELECT
      lp.cohort_week AS cw,
      COUNT(*) AS csize,
      MIN(EXTRACT(EPOCH FROM (now() - lp.joined_at)) / 604800.0) AS weeks_observed,
      COUNT(*) FILTER (WHERE lp.weeks_survived IS NOT NULL) AS s0,
      COUNT(*) FILTER (WHERE lp.weeks_survived >= 1) AS s1,
      COUNT(*) FILTER (WHERE lp.weeks_survived >= 2) AS s2,
      COUNT(*) FILTER (WHERE lp.weeks_survived >= 4) AS s4,
      COUNT(*) FILTER (WHERE lp.weeks_survived >= 8) AS s8
    FROM last_paid lp
    GROUP BY lp.cohort_week
  )
  SELECT
    a.cw,
    a.csize,
    (a.s0::numeric / NULLIF(a.csize, 0)),
    CASE WHEN a.weeks_observed >= 1 THEN a.s1::numeric / NULLIF(a.csize, 0) END,
    CASE WHEN a.weeks_observed >= 2 THEN a.s2::numeric / NULLIF(a.csize, 0) END,
    CASE WHEN a.weeks_observed >= 4 THEN a.s4::numeric / NULLIF(a.csize, 0) END,
    CASE WHEN a.weeks_observed >= 8 THEN a.s8::numeric / NULLIF(a.csize, 0) END
  FROM agg a
  ORDER BY a.cw DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_user_snapshot(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_profile jsonb;
  v_dogs jsonb;
  v_subscription jsonb;
  v_attention jsonb;
begin
  -- ★가드는 fail-closed 다 (2026-07-16). 예전엔 fail-open 이라 anon 이 남의
  --   프로필·강아지·구독을 통째로 뽑을 수 있었다(실증).
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  select to_jsonb(p) into v_profile
  from (select name from public.profiles where id = p_user_id) p;

  select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at asc), '[]'::jsonb)
    into v_dogs
  from (
    select id, name, breed, birth_date, weight, created_at::text as created_at
    from public.dogs where user_id = p_user_id order by created_at asc limit 50
  ) d;

  -- ① 배송 정보 — 실제로 청구가 도는 구독. (옛 동작 보존)
  select to_jsonb(s) into v_subscription
  from (
    select
      s.id, s.status, s.next_delivery_date,
      (s.billing_key is not null) as has_billing_key,
      coalesce(s.failed_charge_count, 0) as failed_charge_count,
      coalesce(s.requires_billing_key_renewal, false) as requires_billing_key_renewal,
      coalesce((select jsonb_agg(jsonb_build_object('product_name', si.product_name))
                from public.subscription_items si where si.subscription_id = s.id),
               '[]'::jsonb) as subscription_items
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.status = 'active'
      -- 청구 크론과 같은 조건 — 이게 아니면 박스가 오지 않는다.
      and s.billing_key is not null
      and s.requires_billing_key_renewal = false
      and s.next_delivery_date is not null
    order by s.next_delivery_date asc, s.created_at desc
    limit 1
  ) s;

  -- ② 조치 알림 — 고객이 손을 써야 하는 구독 하나. 없으면 null.
  --    급한 순서: 결제 깨짐 > 카드 미등록 > 일시정지.
  select to_jsonb(a) into v_attention
  from (
    select
      s.id, s.status,
      (s.billing_key is not null) as has_billing_key,
      coalesce(s.failed_charge_count, 0) as failed_charge_count,
      coalesce(s.requires_billing_key_renewal, false) as requires_billing_key_renewal,
      s.next_delivery_date
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.status in ('active', 'paused')
      and (
        s.billing_key is null
        or s.requires_billing_key_renewal = true
        or coalesce(s.failed_charge_count, 0) > 0
        or s.status = 'paused'
      )
    order by
      case
        when s.requires_billing_key_renewal = true then 0
        when coalesce(s.failed_charge_count, 0) > 0 then 1
        when s.billing_key is null then 2
        else 3
      end,
      s.created_at desc
    limit 1
  ) a;

  return jsonb_build_object('profile', coalesce(v_profile, 'null'::jsonb),
                            'dogs', v_dogs,
                            'subscription', coalesce(v_subscription, 'null'::jsonb),
                            'attention', coalesce(v_attention, 'null'::jsonb));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_min_age_14()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  if new.birth_year is not null then
    if (extract(year from current_date)::int - new.birth_year::int) < 14 then
      raise exception 'UNDER_14: 만 14세 미만은 가입할 수 없어요'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.events_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.feed_intake_history(p_user_id uuid)
 RETURNS TABLE(paid_date date, total_grams bigint, product_count integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT
    DATE(o.paid_at AT TIME ZONE 'Asia/Seoul') AS paid_date,
    SUM((oi.quantity * COALESCE(p.net_weight_g, 0))::bigint) AS total_grams,
    COUNT(DISTINCT oi.product_id)::integer AS product_count
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  JOIN public.products p ON p.id = oi.product_id
  WHERE o.user_id = p_user_id
    AND o.payment_status = 'paid'
    AND p.net_weight_g IS NOT NULL
    AND p.net_weight_g > 0
    AND o.paid_at IS NOT NULL
  GROUP BY DATE(o.paid_at AT TIME ZONE 'Asia/Seoul')
  ORDER BY paid_date DESC
$function$
;

CREATE OR REPLACE FUNCTION public.fetch_photo_request(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tok RECORD;
  v_dog RECORD;
  v_owner_name text;
BEGIN
  SELECT * INTO v_tok FROM public.photo_request_tokens WHERE token = p_token LIMIT 1;
  IF v_tok IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found', 'message', '유효하지 않은 링크예요');
  END IF;
  IF v_tok.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked', 'message', '취소된 링크예요');
  END IF;
  IF v_tok.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired', 'message', '만료된 링크예요');
  END IF;
  IF v_tok.uploaded_photo_url IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_uploaded', 'message', '이미 사진이 업로드된 링크예요');
  END IF;

  SELECT name INTO v_dog FROM public.dogs WHERE id = v_tok.dog_id;
  SELECT name INTO v_owner_name FROM public.profiles WHERE id = v_tok.created_by LIMIT 1;

  RETURN jsonb_build_object('ok', true, 'dogName', v_dog.name, 'ownerName', v_owner_name, 'expiresAt', v_tok.expires_at);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fetch_vet_share(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tok RECORD;
  v_dog RECORD;
  v_analysis RECORD;
  v_weight_latest RECORD;
  v_owner_name text;
BEGIN
  SELECT * INTO v_tok FROM public.vet_share_tokens WHERE token = p_token LIMIT 1;
  IF v_tok IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found', 'message', '유효하지 않은 링크예요');
  END IF;
  IF v_tok.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked', 'message', '공유가 취소된 링크예요');
  END IF;
  IF v_tok.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired', 'message', '만료된 링크예요');
  END IF;

  UPDATE public.vet_share_tokens
  SET accessed_count = accessed_count + 1, last_accessed_at = now()
  WHERE id = v_tok.id;

  SELECT id, name, breed, gender, neutered, weight, birth_date,
         activity_level, allergies_source, weight_method, weight_measured_at,
         chronic_conditions, allergies
  INTO v_dog FROM public.dogs WHERE id = v_tok.dog_id;

  SELECT name INTO v_owner_name FROM public.profiles WHERE id = v_tok.created_by LIMIT 1;

  SELECT created_at, rer, mer, factor, stage, bcs_label, bcs_score,
         protein_pct, fat_pct, carb_pct, feed_g, ca_p_ratio, supplements,
         risk_flags, vet_consult_recommended, next_review_date
  INTO v_analysis FROM public.analyses
  WHERE dog_id = v_tok.dog_id ORDER BY created_at DESC LIMIT 1;

  SELECT weight, measured_at INTO v_weight_latest
  FROM public.weight_logs WHERE dog_id = v_tok.dog_id ORDER BY measured_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'token', jsonb_build_object('expiresAt', v_tok.expires_at, 'accessedCount', v_tok.accessed_count + 1),
    'owner', jsonb_build_object('name', v_owner_name),
    'dog', to_jsonb(v_dog),
    'analysis', CASE WHEN v_analysis IS NULL THEN NULL ELSE to_jsonb(v_analysis) END,
    'latestWeight', CASE WHEN v_weight_latest IS NULL THEN NULL ELSE to_jsonb(v_weight_latest) END
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_block_dog_delete_with_live_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  live_count int;
begin
  select count(*) into live_count
  from public.subscriptions s
  where s.dog_id = old.id
    and s.status in ('active', 'paused');

  if live_count > 0 then
    raise exception
      '진행 중인 정기배송이 있어 이 아이를 지울 수 없어요. 정기배송을 먼저 정리해 주세요.'
      using errcode = 'FT100';
  end if;

  return old;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_compute_tier(stamp_count bigint)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT CASE
    WHEN stamp_count >= 50 THEN 'mate'    -- 나무 · 스탬프 카드 5장
    WHEN stamp_count >= 40 THEN 'fruit'   -- 열매 · 4장
    WHEN stamp_count >= 30 THEN 'bloom'   -- 꽃   · 3장
    WHEN stamp_count >= 20 THEN 'sprout'  -- 새싹 · 2장
    WHEN stamp_count >= 10 THEN 'seed'    -- 씨앗 · 1장 = 멤버십 시작
    ELSE NULL                             -- 10개 미만 = 등급 없음
  END
$function$
;

CREATE OR REPLACE FUNCTION public.fn_expire_stamps()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  affected integer;
begin
  with live as (
    select p.id,
           (count(s.id) filter (where s.expires_at > now()))::int as n
    from public.profiles p
    left join public.stamps s on s.user_id = p.id
    group by p.id
  )
  update public.profiles p
     set stamp_count = live.n
    from live
   where live.id = p.id
     and p.stamp_count is distinct from live.n;
  get diagnostics affected = row_count;
  return affected;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_lock_completed_cards(uid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  loose_alive integer;
begin
  loop
    select count(*) into loose_alive
      from public.stamps
     where user_id = uid
       and expires_at > now()
       and expires_at <> 'infinity'::timestamptz;
    exit when loose_alive < 10;
    -- 가장 오래된 10개(현재 판을 채운 것)를 영구 잠금.
    update public.stamps
       set expires_at = 'infinity'::timestamptz
     where id in (
       select id from public.stamps
        where user_id = uid
          and expires_at > now()
          and expires_at <> 'infinity'::timestamptz
        order by stamped_at asc, id asc
        limit 10
     );
  end loop;
  -- 살아있는(잠금 포함) 개수로 캐시 갱신 → tg_profiles_sync_tier 로 등급 반영.
  perform public.fn_refresh_stamp_count(uid);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_refresh_stamp_count(uid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  n integer;
begin
  select count(*)::int into n
    from public.stamps
   where user_id = uid and expires_at > now();
  -- tg_profiles_sync_tier 가 여기에 걸려 tier 를 자동 갱신한다.
  update public.profiles set stamp_count = n where id = uid;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_tier_rank(t text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  select case t
    when 'mate'   then 5
    when 'fruit'  then 4
    when 'bloom'  then 3
    when 'sprout' then 2
    when 'seed'   then 1
    else 0
  end
$function$
;

CREATE OR REPLACE FUNCTION public.guard_subscription_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION
      'cancelled subscription cannot be reactivated (id=%); create a new subscription instead',
      OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.profiles (id, email, name, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'nickname',
      new.raw_user_meta_data->>'user_name'
    ),
    now(),
    now()
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.has_billing_key(subscriptions)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select $1.billing_key is not null
$function$
;

CREATE OR REPLACE FUNCTION public.has_dog_access(p_dog_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;
  IF EXISTS (
    SELECT 1 FROM public.dogs d
    WHERE d.id = p_dog_id AND d.user_id = v_uid
  ) THEN RETURN TRUE; END IF;
  IF EXISTS (
    SELECT 1 FROM public.dog_members m
    WHERE m.dog_id = p_dog_id AND m.user_id = v_uid
  ) THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_dog_role(p_dog_id uuid, p_min_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_my_role text;
BEGIN
  IF v_uid IS NULL THEN RETURN FALSE; END IF;
  IF EXISTS (
    SELECT 1 FROM public.dogs d
    WHERE d.id = p_dog_id AND d.user_id = v_uid
  ) THEN
    v_my_role := 'owner';
  ELSE
    SELECT role INTO v_my_role
    FROM public.dog_members
    WHERE dog_id = p_dog_id AND user_id = v_uid
    LIMIT 1;
  END IF;
  IF v_my_role IS NULL THEN RETURN FALSE; END IF;
  CASE p_min_role
    WHEN 'viewer' THEN RETURN v_my_role IN ('owner', 'member', 'viewer');
    WHEN 'member' THEN RETURN v_my_role IN ('owner', 'member');
    WHEN 'owner' THEN RETURN v_my_role = 'owner';
    ELSE RETURN FALSE;
  END CASE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.incr_anthropic_usage(p_route text, p_input_tokens bigint DEFAULT 0, p_output_tokens bigint DEFAULT 0, p_calls integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.anthropic_usage AS u (day, route, calls, input_tokens, output_tokens, updated_at)
  VALUES (CURRENT_DATE, p_route, p_calls, GREATEST(p_input_tokens, 0), GREATEST(p_output_tokens, 0), now())
  ON CONFLICT (day, route)
  DO UPDATE SET
    calls = u.calls + EXCLUDED.calls,
    input_tokens = u.input_tokens + EXCLUDED.input_tokens,
    output_tokens = u.output_tokens + EXCLUDED.output_tokens,
    updated_at = now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.incr_rate_limit_counter(p_bucket text, p_key text, p_window_start_ms bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO rate_limit_counters (bucket, key, window_start_ms, count, updated_at)
  VALUES (p_bucket, p_key, p_window_start_ms, 1, now())
  ON CONFLICT (bucket, key, window_start_ms)
  DO UPDATE SET
    count = rate_limit_counters.count + 1,
    updated_at = now()
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_blog_view(post_slug text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.blog_posts
     SET views = COALESCE(views, 0) + 1
   WHERE slug = post_slug
     AND is_published = true;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND (u.raw_app_meta_data ->> 'role') = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.pending_promotion_rate(p_user_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT p.discount_rate
    FROM public.promotion_claims c
    JOIN public.promotions p ON p.id = c.promotion_id
   WHERE c.user_id = p_user_id
     AND c.redeemed_order_id IS NULL
   LIMIT 1
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_profile_loyalty_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  IF NEW.stamp_count IS DISTINCT FROM OLD.stamp_count
     OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.tier_updated_at IS DISTINCT FROM OLD.tier_updated_at
     OR NEW.cumulative_spend IS DISTINCT FROM OLD.cumulative_spend
  THEN
    -- auth.uid() IS NULL = service_role / 트리거 내부(SECURITY DEFINER) → 허용.
    -- 도장·누적금액을 올리는 정상 경로가 전부 여기다.
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND (u.raw_app_meta_data ->> 'role') = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'forbidden: profiles 의 등급·도장·누적금액은 결제/도장 트리거와 admin 만 바꿀 수 있습니다'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND (u.raw_app_meta_data ->> 'role') = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'forbidden: profiles.role can only be changed by admin or service_role'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_vet_share_token_tampering()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.token IS DISTINCT FROM OLD.token THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.token is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.created_by is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.expires_at is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.dog_id IS DISTINCT FROM OLD.dog_id THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.dog_id is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.created_at is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.accessed_count IS DISTINCT FROM OLD.accessed_count THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.accessed_count immutable in user context' USING ERRCODE = '42501';
  END IF;
  IF NEW.last_accessed_at IS DISTINCT FROM OLD.last_accessed_at THEN
    RAISE EXCEPTION 'forbidden: vet_share_tokens.last_accessed_at immutable in user context' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.purge_user(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_deleted_at timestamptz;
  v_orders int := 0;
  v_events int := 0;
  v_ledger int := 0;
begin
  select deleted_at into v_deleted_at from public.profiles where id = p_user;
  if v_deleted_at is null then
    raise exception 'purge_user: % 는 탈퇴 상태가 아니다 (deleted_at null 또는 프로필 없음)', p_user;
  end if;
  if v_deleted_at > now() - interval '1825 days' then
    raise exception 'purge_user: % 는 아직 보관 기간이다 (deleted_at=%)', p_user, v_deleted_at;
  end if;

  delete from public.refunds where user_id = p_user;
  delete from public.payment_refund_queue
   where order_id in (select id from public.orders where user_id = p_user);

  alter table public.payment_events disable trigger payment_events_no_delete;
  alter table public.payment_events disable trigger payment_events_no_update;
  delete from public.payment_events
   where order_id in (select id from public.orders where user_id = p_user)
      or actor_user_id = p_user;
  get diagnostics v_events = row_count;
  alter table public.payment_events enable trigger payment_events_no_delete;
  alter table public.payment_events enable trigger payment_events_no_update;

  alter table public.point_ledger disable trigger point_ledger_no_delete;
  alter table public.point_ledger disable trigger point_ledger_no_update;
  delete from public.point_ledger where user_id = p_user;
  get diagnostics v_ledger = row_count;
  alter table public.point_ledger enable trigger point_ledger_no_delete;
  alter table public.point_ledger enable trigger point_ledger_no_update;

  delete from public.subscription_charges where user_id = p_user;
  delete from public.orders where user_id = p_user;
  get diagnostics v_orders = row_count;
  delete from public.subscriptions where user_id = p_user;

  delete from public.consent_log where user_id = p_user;
  delete from public.profiles where id = p_user;

  return jsonb_build_object('orders', v_orders, 'payment_events', v_events, 'point_ledger', v_ledger);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_reward_event(p_arm_id text, p_context text, p_reward numeric, p_user_id uuid DEFAULT NULL::uuid, p_meta jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.meta_learning_events (arm_id, context, reward, user_id, meta)
  VALUES (p_arm_id, p_context, LEAST(1, GREATEST(0, p_reward)), p_user_id, p_meta)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reserve_order_stock(items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  insufficient jsonb := '[]'::jsonb;
  it jsonb;
  pid uuid;
  q int;
  cur_stock int;
BEGIN
  IF items IS NULL OR jsonb_array_length(items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_items');
  END IF;

  PERFORM stock FROM public.products
    WHERE id IN (
      SELECT DISTINCT (val->>'product_id')::uuid
      FROM jsonb_array_elements(items) val
    )
    ORDER BY id
    FOR UPDATE;

  FOR it IN SELECT * FROM jsonb_array_elements(items) LOOP
    pid := (it->>'product_id')::uuid;
    q := COALESCE((it->>'qty')::int, 0);
    IF q <= 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'invalid_qty',
        'product_id', pid::text
      );
    END IF;
    SELECT stock INTO cur_stock FROM public.products WHERE id = pid;
    IF cur_stock IS NULL OR cur_stock < q THEN
      insufficient := insufficient || jsonb_build_array(
        jsonb_build_object(
          'product_id', pid::text,
          'requested', q,
          'available', COALESCE(cur_stock, 0)
        )
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(insufficient) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_stock',
      'insufficient', insufficient
    );
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(items) LOOP
    pid := (it->>'product_id')::uuid;
    q := (it->>'qty')::int;
    UPDATE public.products
      SET stock = stock - q,
          updated_at = now()
      WHERE id = pid;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_stock(p_product_id uuid, p_qty integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_stock int;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'restore_stock: qty must be positive (got %)', p_qty;
  END IF;
  UPDATE public.products
    SET stock = COALESCE(stock, 0) + p_qty,
        updated_at = now()
    WHERE id = p_product_id
  RETURNING stock INTO new_stock;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'restore_stock: product not found (%)', p_product_id;
  END IF;
  RETURN new_stock;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reviews_bump_helpful()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if tg_op = 'INSERT' then
    update public.reviews set helpful_count = helpful_count + 1 where id = new.review_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.reviews set helpful_count = greatest(helpful_count - 1, 0) where id = old.review_id;
    return old;
  end if;
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_consent_level(p_level smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prev smallint;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', '로그인이 필요해요');
  END IF;
  IF p_level < 1 OR p_level > 4 THEN
    RETURN jsonb_build_object('ok', false, 'message', '유효하지 않은 동의 단계예요');
  END IF;

  SELECT consent_level INTO v_prev FROM public.profiles WHERE id = v_uid;
  IF v_prev IS NULL THEN v_prev := 1; END IF;

  UPDATE public.profiles SET consent_level = p_level WHERE id = v_uid;

  INSERT INTO public.consent_log (user_id, channel, granted, policy_version, source)
  VALUES (v_uid, 'consent_level', p_level > 1, 'v1', 'set_consent_level');

  RETURN jsonb_build_object('ok', true, 'prev', v_prev, 'next', p_level, 'reward', 0, 'balanceAfter', null);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_marketing_consent(p_channel text, p_granted boolean, p_policy_version text DEFAULT NULL::text, p_source text DEFAULT 'mypage'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_channel not in ('email', 'sms') then
    raise exception 'INVALID_CHANNEL';
  end if;

  if p_channel = 'email' then
    update public.profiles
      set agree_email = p_granted,
          agree_email_at = case when p_granted then now() else null end,
          marketing_policy_version = coalesce(p_policy_version, marketing_policy_version)
      where id = v_uid;
  else
    update public.profiles
      set agree_sms = p_granted,
          agree_sms_at = case when p_granted then now() else null end,
          marketing_policy_version = coalesce(p_policy_version, marketing_policy_version)
      where id = v_uid;
  end if;

  insert into public.consent_log (user_id, channel, granted, policy_version, source)
    values (v_uid, p_channel, p_granted, p_policy_version, p_source);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_native_push_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_subscription_cancelled_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.status = 'cancelled'
     and old.status is distinct from 'cancelled'
     and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sha256_hex(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  select encode(digest(lower(trim(coalesce(input, ''))), 'sha256'), 'hex');
$function$
;

CREATE OR REPLACE FUNCTION public.submit_photo_request(p_token text, p_photo_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tok RECORD;
BEGIN
  -- 사진 URL 은 우리 스토리지 public URL 만 허용(임의/악성 외부 URL 주입 차단, 2026-07-17).
  IF p_photo_url IS NULL
     OR p_photo_url NOT LIKE 'https://adynmnrzffidoilnxutg.supabase.co/storage/v1/object/public/%' THEN
    RETURN jsonb_build_object('ok', false, 'message', '허용되지 않은 이미지 주소예요');
  END IF;

  SELECT * INTO v_tok FROM public.photo_request_tokens
  WHERE token = p_token LIMIT 1;

  IF v_tok IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', '유효하지 않은 링크예요');
  END IF;
  IF v_tok.revoked_at IS NOT NULL OR v_tok.expires_at < now()
     OR v_tok.uploaded_photo_url IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', '사용할 수 없는 링크예요');
  END IF;

  UPDATE public.photo_request_tokens
  SET uploaded_photo_url = p_photo_url,
      uploaded_at = now(),
      applied_at = now()
  WHERE id = v_tok.id;

  UPDATE public.dogs SET photo_url = p_photo_url WHERE id = v_tok.dog_id;

  RETURN jsonb_build_object('ok', true, 'dogId', v_tok.dog_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sum_anthropic_calls_today()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(calls), 0)::BIGINT
  FROM public.anthropic_usage
  WHERE day = CURRENT_DATE;
$function$
;

CREATE OR REPLACE FUNCTION public.sweep_rate_limit_counters()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limit_counters
  WHERE updated_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_collections_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_faqs_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin new.updated_at = now(); return new; end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_orders_apply_tier_spend()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  uid uuid;
  amount bigint;
begin
  uid := coalesce(new.user_id, old.user_id);
  if uid is null then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.payment_status = 'paid')
     or (tg_op = 'UPDATE'
         and old.payment_status is distinct from 'paid'
         and new.payment_status = 'paid')
  then
    amount := coalesce(new.total_amount, 0);
    update public.profiles
      set cumulative_spend = coalesce(cumulative_spend, 0) + amount
      where id = uid;
  end if;

  -- 'partially_refunded' 에서 넘어오는 전이도 잡는다(2단 환불).
  -- ★이미 회수된 만큼(old.refunded_amount)은 빼지 않는다 — 부분환불 비례
  --  차감(tg_refunds_apply_partial)과 합치면 이중 차감이 되기 때문.
  if (tg_op = 'UPDATE'
      and old.payment_status in ('paid', 'partially_refunded')
      and new.payment_status in ('cancelled', 'refunded'))
  then
    amount := greatest(
      0,
      coalesce(new.total_amount, 0) - coalesce(old.refunded_amount, 0)
    );
    if amount > 0 then
      update public.profiles
         set cumulative_spend = greatest(0, cumulative_spend - amount)
       where id = uid;
    end if;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_orders_increment_sales_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  rec record;
begin
  if (tg_op = 'INSERT' and new.payment_status = 'paid')
     or (tg_op = 'UPDATE'
         and old.payment_status is distinct from 'paid'
         and new.payment_status = 'paid')
  then
    for rec in
      select product_id, sum(quantity)::int as q
      from public.order_items
      where order_id = new.id
      group by product_id
    loop
      update public.products
        set sales_count = sales_count + rec.q
        where id = rec.product_id;
    end loop;
  end if;

  -- 'partially_refunded' 에서 넘어오는 전이도 잡는다(2단 환불).
  if (tg_op = 'UPDATE'
      and old.payment_status in ('paid', 'partially_refunded')
      and new.payment_status in ('cancelled', 'refunded'))
  then
    for rec in
      select product_id, sum(quantity)::int as q
      from public.order_items
      where order_id = new.id
      group by product_id
    loop
      update public.products
        set sales_count = greatest(0, sales_count - rec.q)
        where id = rec.product_id;
    end loop;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_orders_reclaim_promotion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'UPDATE'
     and old.payment_status in ('pending', 'paid', 'partially_refunded')
     and new.payment_status in ('cancelled', 'refunded')
     and new.payment_status is distinct from old.payment_status
  then
    -- redeemed_at 도 함께 지운다 — 안 지우면 원장에 "쓴 시각은 있는데 안 쓴
    -- 상태" 라는 모순된 행이 남는다.
    update public.promotion_claims
       set redeemed_order_id = null,
           redeemed_at = null
     where redeemed_order_id = new.id;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_orders_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  if new.user_id is null or new.subscription_id is null then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.payment_status = 'paid')
     or (tg_op = 'UPDATE'
         and old.payment_status is distinct from 'paid'
         and new.payment_status = 'paid')
  then
    insert into public.stamps (user_id, order_id, stamped_at, expires_at)
    values (
      new.user_id,
      new.id,
      coalesce(new.paid_at, now()),
      coalesce(new.paid_at, now()) + interval '1 year'
    )
    on conflict (order_id) where order_id is not null do nothing;

    perform public.fn_lock_completed_cards(new.user_id);
  end if;

  -- 회수 조건 — 금액으로 판정: 전액 무효 전이이거나 환불 누계 >= 결제액.
  -- (100원 부분환불로 도장이 영구 소멸하지 않게.)
  if (tg_op = 'UPDATE'
      and old.payment_status in ('paid', 'partially_refunded')
      and new.payment_status is distinct from old.payment_status
      and (
        new.payment_status in ('cancelled', 'refunded')
        or coalesce(new.refunded_amount, 0) >= coalesce(new.total_amount, 0)
      ))
  then
    delete from public.stamps where order_id = new.id;
    perform public.fn_refresh_stamp_count(new.user_id);
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_orders_subscription_delivery_revert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  if new.subscription_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.payment_status in ('paid', 'partially_refunded')
     and new.payment_status is distinct from old.payment_status
     and (
       new.payment_status in ('cancelled', 'refunded')
       or coalesce(new.refunded_amount, 0) >= coalesce(new.total_amount, 0)
     )
     and new.shipped_at is null
  then
    update public.subscriptions
       set total_deliveries = greatest(0, coalesce(total_deliveries, 0) - 1)
     where id = new.subscription_id;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_partners_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin new.updated_at = now(); return new; end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_product_qna_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_profiles_sync_tier()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  new_tier text;
begin
  new_tier := public.fn_compute_tier(new.stamp_count);
  if public.fn_tier_rank(new_tier) > public.fn_tier_rank(old.tier) then
    new.tier := new_tier;
    new.tier_updated_at := now();
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_refunds_apply_partial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
BEGIN
  IF NOT NEW.is_partial THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'succeeded' THEN
    RETURN NEW;
  END IF;

  IF NEW.order_item_ids IS NOT NULL AND array_length(NEW.order_item_ids, 1) > 0 THEN
    FOR rec IN
      SELECT product_id, sum(quantity)::int AS q
      FROM public.order_items
      WHERE id = ANY(NEW.order_item_ids)
      GROUP BY product_id
    LOOP
      UPDATE public.products
        SET sales_count = greatest(0, sales_count - rec.q)
      WHERE id = rec.product_id;
    END LOOP;
  END IF;

  IF NEW.user_id IS NOT NULL AND NEW.amount > 0 THEN
    UPDATE public.profiles
      SET cumulative_spend = greatest(0, cumulative_spend - NEW.amount)
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_stamps_refresh_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  perform public.fn_refresh_stamp_count(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_subscriptions_clear_billing_on_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  if new.status = 'cancelled' and coalesce(old.status, '') <> 'cancelled' then
    new.billing_key := null;
    new.billing_customer_key := null;
    new.requires_billing_key_renewal := false;
    new.next_retry_at := null;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_payment_refund_queue()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_user_integrations_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.weight_reminder_targets(cutoff_date date, max_rows integer DEFAULT 200)
 RETURNS TABLE(id uuid, user_id uuid, name text, last_weighed timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  select d.id, d.user_id, d.name::text, w.last_weighed
  from public.dogs d
  left join lateral (
    select max(wl.measured_at) as last_weighed
    from public.weight_logs wl
    where wl.dog_id = d.id
  ) w on true
  where w.last_weighed is null or (w.last_weighed at time zone 'Asia/Seoul')::date < cutoff_date
  order by w.last_weighed nulls first, d.id
  limit greatest(1, coalesce(max_rows, 200))
$function$
;

-- ===== function execute grants =====
revoke all on function public.addresses_manage_default() from public;
grant execute on function public.addresses_manage_default() to service_role;
revoke all on function public.admin_user_ids() from public;
grant execute on function public.admin_user_ids() to service_role;
revoke all on function public.apply_point_delta(p_user_id uuid, p_delta integer, p_reason text, p_reference_type text, p_reference_id uuid) from public;
grant execute on function public.apply_point_delta(p_user_id uuid, p_delta integer, p_reason text, p_reference_type text, p_reference_id uuid) to service_role;
revoke all on function public.avg_daily_feed_grams(p_user_id uuid, p_window_days integer) from public;
grant execute on function public.avg_daily_feed_grams(p_user_id uuid, p_window_days integer) to anon;
grant execute on function public.avg_daily_feed_grams(p_user_id uuid, p_window_days integer) to authenticated;
grant execute on function public.avg_daily_feed_grams(p_user_id uuid, p_window_days integer) to service_role;
revoke all on function public.block_admin_audit_log_mutations() from public;
grant execute on function public.block_admin_audit_log_mutations() to anon;
grant execute on function public.block_admin_audit_log_mutations() to authenticated;
grant execute on function public.block_admin_audit_log_mutations() to service_role;
revoke all on function public.block_payment_events_mutations() from public;
grant execute on function public.block_payment_events_mutations() to anon;
grant execute on function public.block_payment_events_mutations() to authenticated;
grant execute on function public.block_payment_events_mutations() to service_role;
revoke all on function public.block_point_ledger_mutations() from public;
grant execute on function public.block_point_ledger_mutations() to anon;
grant execute on function public.block_point_ledger_mutations() to authenticated;
grant execute on function public.block_point_ledger_mutations() to service_role;
revoke all on function public.claim_promotion(p_code text) from public;
grant execute on function public.claim_promotion(p_code text) to authenticated;
grant execute on function public.claim_promotion(p_code text) to service_role;
revoke all on function public.cohort_ltv_weekly(weeks_back integer) from public;
grant execute on function public.cohort_ltv_weekly(weeks_back integer) to service_role;
grant execute on function public.cohort_ltv_weekly(weeks_back integer) to authenticated;
revoke all on function public.cohort_retention_weekly(p_max_cohorts integer) from public;
grant execute on function public.cohort_retention_weekly(p_max_cohorts integer) to authenticated;
grant execute on function public.cohort_retention_weekly(p_max_cohorts integer) to service_role;
revoke all on function public.dashboard_user_snapshot(p_user_id uuid) from public;
grant execute on function public.dashboard_user_snapshot(p_user_id uuid) to authenticated;
grant execute on function public.dashboard_user_snapshot(p_user_id uuid) to service_role;
revoke all on function public.enforce_min_age_14() from public;
grant execute on function public.enforce_min_age_14() to anon;
grant execute on function public.enforce_min_age_14() to authenticated;
grant execute on function public.enforce_min_age_14() to service_role;
revoke all on function public.events_set_updated_at() from public;
grant execute on function public.events_set_updated_at() to anon;
grant execute on function public.events_set_updated_at() to authenticated;
grant execute on function public.events_set_updated_at() to service_role;
revoke all on function public.feed_intake_history(p_user_id uuid) from public;
grant execute on function public.feed_intake_history(p_user_id uuid) to anon;
grant execute on function public.feed_intake_history(p_user_id uuid) to authenticated;
grant execute on function public.feed_intake_history(p_user_id uuid) to service_role;
revoke all on function public.fetch_photo_request(p_token text) from public;
grant execute on function public.fetch_photo_request(p_token text) to anon;
grant execute on function public.fetch_photo_request(p_token text) to authenticated;
grant execute on function public.fetch_photo_request(p_token text) to service_role;
revoke all on function public.fetch_vet_share(p_token text) from public;
grant execute on function public.fetch_vet_share(p_token text) to anon;
grant execute on function public.fetch_vet_share(p_token text) to authenticated;
grant execute on function public.fetch_vet_share(p_token text) to service_role;
revoke all on function public.fn_block_dog_delete_with_live_subscription() from public;
grant execute on function public.fn_block_dog_delete_with_live_subscription() to anon;
grant execute on function public.fn_block_dog_delete_with_live_subscription() to authenticated;
grant execute on function public.fn_block_dog_delete_with_live_subscription() to service_role;
revoke all on function public.fn_compute_tier(stamp_count bigint) from public;
grant execute on function public.fn_compute_tier(stamp_count bigint) to anon;
grant execute on function public.fn_compute_tier(stamp_count bigint) to authenticated;
grant execute on function public.fn_compute_tier(stamp_count bigint) to service_role;
revoke all on function public.fn_expire_stamps() from public;
grant execute on function public.fn_expire_stamps() to service_role;
revoke all on function public.fn_lock_completed_cards(uid uuid) from public;
grant execute on function public.fn_lock_completed_cards(uid uuid) to service_role;
revoke all on function public.fn_refresh_stamp_count(uid uuid) from public;
grant execute on function public.fn_refresh_stamp_count(uid uuid) to service_role;
revoke all on function public.fn_tier_rank(t text) from public;
grant execute on function public.fn_tier_rank(t text) to anon;
grant execute on function public.fn_tier_rank(t text) to authenticated;
grant execute on function public.fn_tier_rank(t text) to service_role;
revoke all on function public.guard_subscription_status_transition() from public;
grant execute on function public.guard_subscription_status_transition() to anon;
grant execute on function public.guard_subscription_status_transition() to authenticated;
grant execute on function public.guard_subscription_status_transition() to service_role;
revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to service_role;
revoke all on function public.has_billing_key(subscriptions) from public;
grant execute on function public.has_billing_key(subscriptions) to anon;
grant execute on function public.has_billing_key(subscriptions) to authenticated;
grant execute on function public.has_billing_key(subscriptions) to service_role;
revoke all on function public.has_dog_access(p_dog_id uuid) from public;
grant execute on function public.has_dog_access(p_dog_id uuid) to anon;
grant execute on function public.has_dog_access(p_dog_id uuid) to authenticated;
grant execute on function public.has_dog_access(p_dog_id uuid) to service_role;
revoke all on function public.has_dog_role(p_dog_id uuid, p_min_role text) from public;
grant execute on function public.has_dog_role(p_dog_id uuid, p_min_role text) to anon;
grant execute on function public.has_dog_role(p_dog_id uuid, p_min_role text) to authenticated;
grant execute on function public.has_dog_role(p_dog_id uuid, p_min_role text) to service_role;
revoke all on function public.incr_anthropic_usage(p_route text, p_input_tokens bigint, p_output_tokens bigint, p_calls integer) from public;
grant execute on function public.incr_anthropic_usage(p_route text, p_input_tokens bigint, p_output_tokens bigint, p_calls integer) to service_role;
revoke all on function public.incr_rate_limit_counter(p_bucket text, p_key text, p_window_start_ms bigint) from public;
grant execute on function public.incr_rate_limit_counter(p_bucket text, p_key text, p_window_start_ms bigint) to service_role;
revoke all on function public.increment_blog_view(post_slug text) from public;
grant execute on function public.increment_blog_view(post_slug text) to anon;
grant execute on function public.increment_blog_view(post_slug text) to authenticated;
grant execute on function public.increment_blog_view(post_slug text) to service_role;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;
revoke all on function public.pending_promotion_rate(p_user_id uuid) from public;
grant execute on function public.pending_promotion_rate(p_user_id uuid) to service_role;
revoke all on function public.prevent_profile_loyalty_change() from public;
grant execute on function public.prevent_profile_loyalty_change() to service_role;
revoke all on function public.prevent_profile_role_change() from public;
grant execute on function public.prevent_profile_role_change() to service_role;
revoke all on function public.prevent_vet_share_token_tampering() from public;
grant execute on function public.prevent_vet_share_token_tampering() to service_role;
revoke all on function public.purge_user(p_user uuid) from public;
grant execute on function public.purge_user(p_user uuid) to service_role;
revoke all on function public.record_reward_event(p_arm_id text, p_context text, p_reward numeric, p_user_id uuid, p_meta jsonb) from public;
grant execute on function public.record_reward_event(p_arm_id text, p_context text, p_reward numeric, p_user_id uuid, p_meta jsonb) to service_role;
revoke all on function public.reserve_order_stock(items jsonb) from public;
grant execute on function public.reserve_order_stock(items jsonb) to service_role;
revoke all on function public.restore_stock(p_product_id uuid, p_qty integer) from public;
grant execute on function public.restore_stock(p_product_id uuid, p_qty integer) to service_role;
revoke all on function public.reviews_bump_helpful() from public;
grant execute on function public.reviews_bump_helpful() to anon;
grant execute on function public.reviews_bump_helpful() to authenticated;
grant execute on function public.reviews_bump_helpful() to service_role;
revoke all on function public.rls_auto_enable() from public;
grant execute on function public.rls_auto_enable() to service_role;
revoke all on function public.set_consent_level(p_level smallint) from public;
grant execute on function public.set_consent_level(p_level smallint) to anon;
grant execute on function public.set_consent_level(p_level smallint) to authenticated;
grant execute on function public.set_consent_level(p_level smallint) to service_role;
revoke all on function public.set_marketing_consent(p_channel text, p_granted boolean, p_policy_version text, p_source text) from public;
grant execute on function public.set_marketing_consent(p_channel text, p_granted boolean, p_policy_version text, p_source text) to anon;
grant execute on function public.set_marketing_consent(p_channel text, p_granted boolean, p_policy_version text, p_source text) to authenticated;
grant execute on function public.set_marketing_consent(p_channel text, p_granted boolean, p_policy_version text, p_source text) to service_role;
revoke all on function public.set_native_push_updated_at() from public;
grant execute on function public.set_native_push_updated_at() to service_role;
revoke all on function public.set_subscription_cancelled_at() from public;
grant execute on function public.set_subscription_cancelled_at() to anon;
grant execute on function public.set_subscription_cancelled_at() to authenticated;
grant execute on function public.set_subscription_cancelled_at() to service_role;
revoke all on function public.set_updated_at() from public;
grant execute on function public.set_updated_at() to anon;
grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.set_updated_at() to service_role;
revoke all on function public.sha256_hex(input text) from public;
grant execute on function public.sha256_hex(input text) to anon;
grant execute on function public.sha256_hex(input text) to authenticated;
grant execute on function public.sha256_hex(input text) to service_role;
revoke all on function public.submit_photo_request(p_token text, p_photo_url text) from public;
grant execute on function public.submit_photo_request(p_token text, p_photo_url text) to service_role;
revoke all on function public.sum_anthropic_calls_today() from public;
grant execute on function public.sum_anthropic_calls_today() to service_role;
revoke all on function public.sweep_rate_limit_counters() from public;
grant execute on function public.sweep_rate_limit_counters() to service_role;
revoke all on function public.tg_collections_set_updated_at() from public;
grant execute on function public.tg_collections_set_updated_at() to anon;
grant execute on function public.tg_collections_set_updated_at() to authenticated;
grant execute on function public.tg_collections_set_updated_at() to service_role;
revoke all on function public.tg_faqs_set_updated_at() from public;
grant execute on function public.tg_faqs_set_updated_at() to anon;
grant execute on function public.tg_faqs_set_updated_at() to authenticated;
grant execute on function public.tg_faqs_set_updated_at() to service_role;
revoke all on function public.tg_orders_apply_tier_spend() from public;
grant execute on function public.tg_orders_apply_tier_spend() to service_role;
revoke all on function public.tg_orders_increment_sales_count() from public;
grant execute on function public.tg_orders_increment_sales_count() to service_role;
revoke all on function public.tg_orders_reclaim_promotion() from public;
grant execute on function public.tg_orders_reclaim_promotion() to service_role;
revoke all on function public.tg_orders_stamp() from public;
grant execute on function public.tg_orders_stamp() to service_role;
revoke all on function public.tg_orders_subscription_delivery_revert() from public;
grant execute on function public.tg_orders_subscription_delivery_revert() to service_role;
revoke all on function public.tg_partners_set_updated_at() from public;
grant execute on function public.tg_partners_set_updated_at() to anon;
grant execute on function public.tg_partners_set_updated_at() to authenticated;
grant execute on function public.tg_partners_set_updated_at() to service_role;
revoke all on function public.tg_product_qna_set_updated_at() from public;
grant execute on function public.tg_product_qna_set_updated_at() to anon;
grant execute on function public.tg_product_qna_set_updated_at() to authenticated;
grant execute on function public.tg_product_qna_set_updated_at() to service_role;
revoke all on function public.tg_profiles_sync_tier() from public;
grant execute on function public.tg_profiles_sync_tier() to anon;
grant execute on function public.tg_profiles_sync_tier() to authenticated;
grant execute on function public.tg_profiles_sync_tier() to service_role;
revoke all on function public.tg_refunds_apply_partial() from public;
grant execute on function public.tg_refunds_apply_partial() to service_role;
revoke all on function public.tg_stamps_refresh_count() from public;
grant execute on function public.tg_stamps_refresh_count() to service_role;
revoke all on function public.tg_subscriptions_clear_billing_on_cancel() from public;
grant execute on function public.tg_subscriptions_clear_billing_on_cancel() to service_role;
revoke all on function public.touch_payment_refund_queue() from public;
grant execute on function public.touch_payment_refund_queue() to anon;
grant execute on function public.touch_payment_refund_queue() to authenticated;
grant execute on function public.touch_payment_refund_queue() to service_role;
revoke all on function public.touch_user_integrations_updated_at() from public;
grant execute on function public.touch_user_integrations_updated_at() to anon;
grant execute on function public.touch_user_integrations_updated_at() to authenticated;
grant execute on function public.touch_user_integrations_updated_at() to service_role;
revoke all on function public.update_updated_at_column() from public;
grant execute on function public.update_updated_at_column() to anon;
grant execute on function public.update_updated_at_column() to authenticated;
grant execute on function public.update_updated_at_column() to service_role;
revoke all on function public.weight_reminder_targets(cutoff_date date, max_rows integer) from public;
grant execute on function public.weight_reminder_targets(cutoff_date date, max_rows integer) to service_role;

-- ===== views =====
create or replace view public.arm_stats as
 SELECT context,
    arm_id,
    count(*) AS trials,
    (sum(reward))::numeric(10,3) AS total_reward,
    (avg(reward))::numeric(5,3) AS mean_reward,
    max(created_at) AS last_used_at
   FROM meta_learning_events
  GROUP BY context, arm_id;

-- ===== row level security =====
alter table public.account_deletions enable row level security;
alter table public.activity_logs enable row level security;
alter table public.addresses enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.algorithm_breed_predispose enable row level security;
alter table public.algorithm_chronic_severity enable row level security;
alter table public.algorithm_food_lines enable row level security;
alter table public.algorithm_meta_weights enable row level security;
alter table public.analyses enable row level security;
alter table public.anthropic_usage enable row level security;
alter table public.automation_settings enable row level security;
alter table public.blog_categories enable row level security;
alter table public.blog_posts enable row level security;
alter table public.chatbot_messages enable row level security;
alter table public.consent_log enable row level security;
alter table public.cron_health enable row level security;
alter table public.cs_messages enable row level security;
alter table public.dog_checkins enable row level security;
alter table public.dog_diary enable row level security;
alter table public.dog_formulas enable row level security;
alter table public.dog_medications enable row level security;
alter table public.dog_members enable row level security;
alter table public.dog_reminders enable row level security;
alter table public.dog_sensitivity_snapshots enable row level security;
alter table public.dog_vaccinations enable row level security;
alter table public.dogs enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.faqs enable row level security;
alter table public.feeding_outcomes enable row level security;
alter table public.health_logs enable row level security;
alter table public.kibble_products enable row level security;
alter table public.kibble_requests enable row level security;
alter table public.medical_records enable row level security;
alter table public.meta_learning_events enable row level security;
alter table public.native_push_tokens enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.order_items enable row level security;
alter table public.orders enable row level security;
alter table public.partners enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_refund_queue enable row level security;
alter table public.photo_request_tokens enable row level security;
alter table public.point_ledger enable row level security;
alter table public.product_qna enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.promotion_claims enable row level security;
alter table public.promotions enable row level security;
alter table public.push_campaigns enable row level security;
alter table public.push_log enable row level security;
alter table public.push_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.rate_limit_counters enable row level security;
alter table public.refunds enable row level security;
alter table public.reweighs enable row level security;
alter table public.source_waitlist enable row level security;
alter table public.stamps enable row level security;
alter table public.subscription_charges enable row level security;
alter table public.subscription_items enable row level security;
alter table public.subscriptions enable row level security;
alter table public.surveys enable row level security;
alter table public.user_integrations enable row level security;
alter table public.vet_share_tokens enable row level security;
alter table public.webhook_events enable row level security;
alter table public.weight_logs enable row level security;

-- ===== policies (public + storage) =====
create policy account_deletions_admin_select on public.account_deletions as permissive for select to public
  using (is_admin());

create policy activity_logs_delete_own on public.activity_logs as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy activity_logs_insert_own on public.activity_logs as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy activity_logs_select_own on public.activity_logs as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy activity_logs_update_own on public.activity_logs as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy addresses_self_delete on public.addresses as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy addresses_self_insert on public.addresses as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy addresses_self_select on public.addresses as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy addresses_self_update on public.addresses as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy admin_audit_log_insert on public.admin_audit_log as permissive for insert to public
  with check ((is_admin() AND (actor_user_id = ( SELECT auth.uid() AS uid))));

create policy admin_audit_log_select on public.admin_audit_log as permissive for select to public
  using (is_admin());

create policy algorithm_breed_predispose_admin_all on public.algorithm_breed_predispose as permissive for all to authenticated
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy algorithm_breed_predispose_admin_read on public.algorithm_breed_predispose as permissive for select to public
  using (is_admin());

create policy algorithm_chronic_severity_admin_all on public.algorithm_chronic_severity as permissive for all to authenticated
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy algorithm_chronic_severity_admin_read on public.algorithm_chronic_severity as permissive for select to public
  using (is_admin());

create policy algorithm_food_lines_admin_all on public.algorithm_food_lines as permissive for all to authenticated
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy algorithm_food_lines_admin_read on public.algorithm_food_lines as permissive for select to public
  using (is_admin());

create policy algorithm_meta_admin_select on public.algorithm_meta_weights as permissive for select to public
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy "Users can delete own analyses" on public.analyses as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can view own analyses" on public.analyses as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy analyses_insert_member on public.analyses as permissive for insert to authenticated
  with check (((( SELECT auth.uid() AS uid) = user_id) AND ((dog_id IS NULL) OR has_dog_role(dog_id, 'member'::text))));

create policy analyses_member_select on public.analyses as permissive for select to public
  using (has_dog_access(dog_id));

create policy analyses_update_member on public.analyses as permissive for update to authenticated
  using (((( SELECT auth.uid() AS uid) = user_id) AND ((dog_id IS NULL) OR has_dog_role(dog_id, 'member'::text))))
  with check (((( SELECT auth.uid() AS uid) = user_id) AND ((dog_id IS NULL) OR has_dog_role(dog_id, 'member'::text))));

create policy automation_settings_admin_read on public.automation_settings as permissive for select to public
  using (is_admin());

create policy automation_settings_admin_write on public.automation_settings as permissive for update to public
  using (is_admin())
  with check (is_admin());

create policy "blog_categories admin delete" on public.blog_categories as permissive for delete to authenticated
  using (is_admin());

create policy "blog_categories admin insert" on public.blog_categories as permissive for insert to authenticated
  with check (is_admin());

create policy "blog_categories admin update" on public.blog_categories as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());

create policy "blog_categories select all" on public.blog_categories as permissive for select to public
  using (true);

create policy "blog_posts admin delete" on public.blog_posts as permissive for delete to authenticated
  using (is_admin());

create policy "blog_posts admin insert" on public.blog_posts as permissive for insert to authenticated
  with check (is_admin());

create policy "blog_posts admin select all" on public.blog_posts as permissive for select to authenticated
  using (is_admin());

create policy "blog_posts admin update" on public.blog_posts as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());

create policy "blog_posts select published" on public.blog_posts as permissive for select to public
  using ((is_published = true));

create policy chatbot_delete_own on public.chatbot_messages as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy chatbot_insert_own on public.chatbot_messages as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy chatbot_select_own on public.chatbot_messages as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy consent_log_admin_select on public.consent_log as permissive for select to public
  using (is_admin());

create policy consent_log_self_insert on public.consent_log as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy consent_log_self_select on public.consent_log as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy cron_health_admin_select on public.cron_health as permissive for select to public
  using (is_admin());

create policy cs_messages_admin_insert on public.cs_messages as permissive for insert to authenticated
  with check (((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text) AND (sender = 'admin'::text) AND (( SELECT auth.uid() AS uid) = sender_id)));

create policy cs_messages_admin_select on public.cs_messages as permissive for select to authenticated
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy cs_messages_admin_update on public.cs_messages as permissive for update to authenticated
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy cs_messages_self_select on public.cs_messages as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy cs_messages_user_insert on public.cs_messages as permissive for insert to public
  with check (((( SELECT auth.uid() AS uid) = user_id) AND (sender = 'user'::text) AND (( SELECT auth.uid() AS uid) = sender_id)));

create policy cs_messages_user_mark_read on public.cs_messages as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy dog_checkins_admin_select on public.dog_checkins as permissive for select to authenticated
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy dog_checkins_self_insert on public.dog_checkins as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy dog_checkins_self_select on public.dog_checkins as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy dog_checkins_self_update on public.dog_checkins as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy dog_diary_delete_own on public.dog_diary as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy dog_diary_insert_own on public.dog_diary as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy dog_diary_select_own on public.dog_diary as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy dog_diary_update_own on public.dog_diary as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy dog_formulas_admin_select on public.dog_formulas as permissive for select to authenticated
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy dog_formulas_self_select on public.dog_formulas as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy dog_medications_delete_owner on public.dog_medications as permissive for delete to public
  using (has_dog_role(dog_id, 'owner'::text));

create policy dog_medications_insert_member on public.dog_medications as permissive for insert to public
  with check (((( SELECT auth.uid() AS uid) = user_id) AND has_dog_role(dog_id, 'member'::text)));

create policy dog_medications_select on public.dog_medications as permissive for select to public
  using (((( SELECT auth.uid() AS uid) = user_id) OR has_dog_access(dog_id)));

create policy dog_medications_update_member on public.dog_medications as permissive for update to public
  using (has_dog_role(dog_id, 'member'::text))
  with check (has_dog_role(dog_id, 'member'::text));

create policy dog_members_owner_write on public.dog_members as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM dogs d
  WHERE ((d.id = dog_members.dog_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))))
  with check ((EXISTS ( SELECT 1
   FROM dogs d
  WHERE ((d.id = dog_members.dog_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))));

create policy dog_members_select on public.dog_members as permissive for select to public
  using (((( SELECT auth.uid() AS uid) = user_id) OR (EXISTS ( SELECT 1
   FROM dogs d
  WHERE ((d.id = dog_members.dog_id) AND (d.user_id = ( SELECT auth.uid() AS uid)))))));

create policy "dog_reminders delete own" on public.dog_reminders as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "dog_reminders insert own" on public.dog_reminders as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "dog_reminders select own" on public.dog_reminders as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "dog_reminders update own" on public.dog_reminders as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy sensitivity_self_select on public.dog_sensitivity_snapshots as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy dog_vaccinations_delete_owner on public.dog_vaccinations as permissive for delete to public
  using (has_dog_role(dog_id, 'owner'::text));

create policy dog_vaccinations_insert_member on public.dog_vaccinations as permissive for insert to public
  with check (((( SELECT auth.uid() AS uid) = user_id) AND has_dog_role(dog_id, 'member'::text)));

create policy dog_vaccinations_select on public.dog_vaccinations as permissive for select to public
  using (((( SELECT auth.uid() AS uid) = user_id) OR has_dog_access(dog_id)));

create policy dog_vaccinations_update_member on public.dog_vaccinations as permissive for update to public
  using (has_dog_role(dog_id, 'member'::text))
  with check (has_dog_role(dog_id, 'member'::text));

create policy "Admins can view all dogs" on public.dogs as permissive for select to public
  using (is_admin());

create policy "Users can delete own dogs" on public.dogs as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can insert own dogs" on public.dogs as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can update own dogs" on public.dogs as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can view own dogs" on public.dogs as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "faqs admin all" on public.faqs as permissive for all to authenticated
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy "faqs public read" on public.faqs as permissive for select to anon, authenticated
  using ((is_published = true));

create policy feeding_outcomes_insert_own on public.feeding_outcomes as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy feeding_outcomes_select_own on public.feeding_outcomes as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy feeding_outcomes_update_own on public.feeding_outcomes as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "health_logs delete own" on public.health_logs as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "health_logs insert own" on public.health_logs as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "health_logs select own" on public.health_logs as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "health_logs update own" on public.health_logs as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy kibble_products_public_read on public.kibble_products as permissive for select to public
  using (true);

create policy kibble_requests_insert_own on public.kibble_requests as permissive for insert to public
  with check ((user_id = ( SELECT auth.uid() AS uid)));

create policy medical_records_self on public.medical_records as permissive for all to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy mle_admin_select on public.meta_learning_events as permissive for select to public
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy native_push_delete_own on public.native_push_tokens as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy native_push_insert_own on public.native_push_tokens as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy native_push_select_own on public.native_push_tokens as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy native_push_update_own on public.native_push_tokens as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id))
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "newsletter admin all" on public.newsletter_subscribers as permissive for all to authenticated
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy order_items_select_via_order on public.order_items as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND ((o.user_id = ( SELECT auth.uid() AS uid)) OR is_admin())))));

create policy orders_insert_own on public.orders as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy orders_select_own_or_admin on public.orders as permissive for select to public
  using (((( SELECT auth.uid() AS uid) = user_id) OR is_admin()));

create policy orders_update_own_or_admin on public.orders as permissive for update to public
  using (((( SELECT auth.uid() AS uid) = user_id) OR is_admin()));

create policy "partners admin all" on public.partners as permissive for all to authenticated
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy "partners public read" on public.partners as permissive for select to anon, authenticated
  using ((is_published = true));

create policy payment_events_select on public.payment_events as permissive for select to public
  using (((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = payment_events.order_id) AND (o.user_id = ( SELECT auth.uid() AS uid))))) OR is_admin()));

create policy payment_refund_queue_admin_read on public.payment_refund_queue as permissive for select to public
  using (is_admin());

create policy photo_request_owner_all on public.photo_request_tokens as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM dogs d
  WHERE ((d.id = photo_request_tokens.dog_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))))
  with check ((EXISTS ( SELECT 1
   FROM dogs d
  WHERE ((d.id = photo_request_tokens.dog_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))));

create policy "point_ledger select own" on public.point_ledger as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy product_qna_select_own_or_admin on public.product_qna as permissive for select to public
  using (((auth.uid() = user_id) OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

create policy "qna admin all" on public.product_qna as permissive for all to authenticated
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  with check ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy "qna user delete" on public.product_qna as permissive for delete to authenticated
  using (((( SELECT auth.uid() AS uid) = user_id) AND (answer IS NULL)));

create policy "qna user insert" on public.product_qna as permissive for insert to authenticated
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "qna user update" on public.product_qna as permissive for update to authenticated
  using (((( SELECT auth.uid() AS uid) = user_id) AND (answer IS NULL)))
  with check (((( SELECT auth.uid() AS uid) = user_id) AND (answer IS NULL)));

create policy "Admins can manage products" on public.products as permissive for all to public
  using (is_admin());

create policy "Anyone can view active products" on public.products as permissive for select to public
  using ((is_active = true));

create policy "Admins can view all profiles" on public.profiles as permissive for select to public
  using (is_admin());

create policy "Users can insert own profile" on public.profiles as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = id));

create policy "Users can update own profile" on public.profiles as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = id));

create policy "Users can view own profile" on public.profiles as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = id));

create policy promotion_claims_select_own on public.promotion_claims as permissive for select to public
  using (((auth.uid() = user_id) OR is_admin()));

create policy promotions_read_open on public.promotions as permissive for select to public
  using ((is_admin() OR (active AND (now() >= starts_at) AND (now() <= ends_at))));

create policy push_campaigns_admin_insert on public.push_campaigns as permissive for insert to authenticated
  with check ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy push_campaigns_admin_select on public.push_campaigns as permissive for select to authenticated
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy push_log_admin_select on public.push_log as permissive for select to authenticated
  using ((((( SELECT auth.jwt() AS jwt) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

create policy push_log_self_select on public.push_log as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy push_log_self_update on public.push_log as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy push_preferences_self_select on public.push_preferences as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy push_preferences_self_update on public.push_preferences as permissive for update to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy push_preferences_self_upsert on public.push_preferences as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "push_subscriptions delete own" on public.push_subscriptions as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "push_subscriptions insert own" on public.push_subscriptions as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "push_subscriptions select own" on public.push_subscriptions as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy refunds_admin_select on public.refunds as permissive for select to public
  using (is_admin());

create policy refunds_select_own on public.refunds as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy reweighs_select_own on public.reweighs as permissive for select to public
  using ((user_id = ( SELECT auth.uid() AS uid)));

create policy source_waitlist_admin_read on public.source_waitlist as permissive for select to public
  using (is_admin());

create policy source_waitlist_self_delete on public.source_waitlist as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy source_waitlist_self_insert on public.source_waitlist as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy source_waitlist_self_select on public.source_waitlist as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy stamps_select_own on public.stamps as permissive for select to public
  using ((auth.uid() = user_id));

create policy subscription_charges_admin_select on public.subscription_charges as permissive for select to public
  using (is_admin());

create policy subscription_charges_select_own on public.subscription_charges as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy sub_items_delete_via_sub on public.subscription_items as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM subscriptions s
  WHERE ((s.id = subscription_items.subscription_id) AND ((s.user_id = ( SELECT auth.uid() AS uid)) OR is_admin())))));

create policy sub_items_insert_via_sub on public.subscription_items as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM subscriptions s
  WHERE ((s.id = subscription_items.subscription_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))));

create policy sub_items_select_via_sub on public.subscription_items as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM subscriptions s
  WHERE ((s.id = subscription_items.subscription_id) AND ((s.user_id = ( SELECT auth.uid() AS uid)) OR is_admin())))));

create policy sub_items_update_via_sub on public.subscription_items as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM subscriptions s
  WHERE ((s.id = subscription_items.subscription_id) AND ((s.user_id = ( SELECT auth.uid() AS uid)) OR is_admin())))));

create policy subs_delete_admin on public.subscriptions as permissive for delete to public
  using (is_admin());

create policy subs_insert_own on public.subscriptions as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy subs_select_own_or_admin on public.subscriptions as permissive for select to public
  using (((( SELECT auth.uid() AS uid) = user_id) OR is_admin()));

create policy subs_update_own_or_admin on public.subscriptions as permissive for update to public
  using (((( SELECT auth.uid() AS uid) = user_id) OR is_admin()))
  with check (((( SELECT auth.uid() AS uid) = user_id) OR is_admin()));

create policy "Users can delete own surveys" on public.surveys as permissive for delete to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can insert own surveys" on public.surveys as permissive for insert to public
  with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "Users can view own surveys" on public.surveys as permissive for select to public
  using ((( SELECT auth.uid() AS uid) = user_id));

create policy surveys_member_select on public.surveys as permissive for select to public
  using (has_dog_access(dog_id));

create policy user_integrations_delete_own on public.user_integrations as permissive for delete to public
  using ((user_id = ( SELECT auth.uid() AS uid)));

create policy user_integrations_insert_own on public.user_integrations as permissive for insert to public
  with check ((user_id = ( SELECT auth.uid() AS uid)));

create policy user_integrations_select_own on public.user_integrations as permissive for select to public
  using ((user_id = ( SELECT auth.uid() AS uid)));

create policy user_integrations_update_own on public.user_integrations as permissive for update to public
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));

create policy vet_share_owner_delete on public.vet_share_tokens as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM dogs d
  WHERE ((d.id = vet_share_tokens.dog_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))));

create policy vet_share_owner_insert on public.vet_share_tokens as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM dogs d
  WHERE ((d.id = vet_share_tokens.dog_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))));

create policy vet_share_owner_select on public.vet_share_tokens as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM dogs d
  WHERE ((d.id = vet_share_tokens.dog_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))));

create policy vet_share_owner_update on public.vet_share_tokens as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM dogs d
  WHERE ((d.id = vet_share_tokens.dog_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))))
  with check ((EXISTS ( SELECT 1
   FROM dogs d
  WHERE ((d.id = vet_share_tokens.dog_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))));

create policy vet_share_tokens_owner on public.vet_share_tokens as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM dogs d
  WHERE ((d.id = vet_share_tokens.dog_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))))
  with check ((EXISTS ( SELECT 1
   FROM dogs d
  WHERE ((d.id = vet_share_tokens.dog_id) AND (d.user_id = ( SELECT auth.uid() AS uid))))));

create policy webhook_events_admin_read on public.webhook_events as permissive for select to public
  using (is_admin());

create policy weight_logs_delete_owner on public.weight_logs as permissive for delete to public
  using (has_dog_role(dog_id, 'owner'::text));

create policy weight_logs_insert_member on public.weight_logs as permissive for insert to public
  with check (((( SELECT auth.uid() AS uid) = user_id) AND has_dog_role(dog_id, 'member'::text)));

create policy weight_logs_select on public.weight_logs as permissive for select to public
  using (((( SELECT auth.uid() AS uid) = user_id) OR has_dog_access(dog_id)));

create policy weight_logs_update_member on public.weight_logs as permissive for update to public
  using (has_dog_role(dog_id, 'member'::text))
  with check (has_dog_role(dog_id, 'member'::text));

create policy blog_covers_admin_delete on storage.objects as permissive for delete to public
  using (((bucket_id = 'blog-covers'::text) AND is_admin()));

create policy blog_covers_admin_insert on storage.objects as permissive for insert to public
  with check (((bucket_id = 'blog-covers'::text) AND is_admin()));

create policy blog_covers_admin_update on storage.objects as permissive for update to public
  using (((bucket_id = 'blog-covers'::text) AND is_admin()));

create policy checkin_photos_admin_select on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'dog_checkin_photos'::text) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)));

create policy checkin_photos_self_delete on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'dog_checkin_photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy checkin_photos_self_insert on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'dog_checkin_photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy checkin_photos_self_select on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'dog_checkin_photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy dog_avatars_delete_own on storage.objects as permissive for delete to public
  using (((bucket_id = 'dog-avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy dog_avatars_insert_own on storage.objects as permissive for insert to public
  with check (((bucket_id = 'dog-avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy dog_avatars_update_own on storage.objects as permissive for update to public
  using (((bucket_id = 'dog-avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))
  with check (((bucket_id = 'dog-avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy dog_diary_photos_delete_own on storage.objects as permissive for delete to public
  using (((bucket_id = 'dog-diary-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy dog_diary_photos_insert_own on storage.objects as permissive for insert to public
  with check (((bucket_id = 'dog-diary-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy dog_diary_photos_select_own on storage.objects as permissive for select to public
  using (((bucket_id = 'dog-diary-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy "event-images admin delete" on storage.objects as permissive for delete to public
  using (((bucket_id = 'event-images'::text) AND is_admin()));

create policy "event-images admin insert" on storage.objects as permissive for insert to public
  with check (((bucket_id = 'event-images'::text) AND is_admin()));

create policy "event-images admin update" on storage.objects as permissive for update to public
  using (((bucket_id = 'event-images'::text) AND is_admin()))
  with check (((bucket_id = 'event-images'::text) AND is_admin()));

create policy medical_records_images_owner on storage.objects as permissive for all to authenticated
  using (((bucket_id = 'medical-records-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))
  with check (((bucket_id = 'medical-records-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

create policy products_admin_delete on storage.objects as permissive for delete to public
  using (((bucket_id = 'products'::text) AND is_admin()));

create policy products_admin_insert on storage.objects as permissive for insert to public
  with check (((bucket_id = 'products'::text) AND is_admin()));

create policy products_admin_update on storage.objects as permissive for update to public
  using (((bucket_id = 'products'::text) AND is_admin()));

-- ===== triggers =====
CREATE TRIGGER addresses_manage_default_ins BEFORE INSERT ON public.addresses FOR EACH ROW EXECUTE FUNCTION addresses_manage_default();
CREATE TRIGGER addresses_manage_default_upd AFTER UPDATE OF is_default ON public.addresses FOR EACH ROW WHEN ((new.is_default = true)) EXECUTE FUNCTION addresses_manage_default();
CREATE TRIGGER addresses_set_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER block_admin_audit_log_delete BEFORE DELETE ON public.admin_audit_log FOR EACH ROW EXECUTE FUNCTION block_admin_audit_log_mutations();
CREATE TRIGGER block_admin_audit_log_update BEFORE UPDATE ON public.admin_audit_log FOR EACH ROW EXECUTE FUNCTION block_admin_audit_log_mutations();
CREATE TRIGGER algorithm_breed_predispose_updated BEFORE UPDATE ON public.algorithm_breed_predispose FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER algorithm_chronic_severity_updated BEFORE UPDATE ON public.algorithm_chronic_severity FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER algorithm_food_lines_updated BEFORE UPDATE ON public.algorithm_food_lines FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER dog_formulas_updated_at_tr BEFORE UPDATE ON public.dog_formulas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER dog_medications_updated_at BEFORE UPDATE ON public.dog_medications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER dog_vaccinations_updated_at BEFORE UPDATE ON public.dog_vaccinations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_dogs_block_delete_with_live_subscription BEFORE DELETE ON public.dogs FOR EACH ROW EXECUTE FUNCTION fn_block_dog_delete_with_live_subscription();
CREATE TRIGGER faqs_set_updated_at BEFORE UPDATE ON public.faqs FOR EACH ROW EXECUTE FUNCTION tg_faqs_set_updated_at();
CREATE TRIGGER native_push_tokens_updated_at BEFORE UPDATE ON public.native_push_tokens FOR EACH ROW EXECUTE FUNCTION set_native_push_updated_at();
CREATE TRIGGER orders_apply_tier_spend AFTER INSERT OR UPDATE OF payment_status ON public.orders FOR EACH ROW EXECUTE FUNCTION tg_orders_apply_tier_spend();
CREATE TRIGGER orders_increment_sales_count AFTER INSERT OR UPDATE OF payment_status ON public.orders FOR EACH ROW EXECUTE FUNCTION tg_orders_increment_sales_count();
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_reclaim_promotion AFTER UPDATE OF payment_status ON public.orders FOR EACH ROW EXECUTE FUNCTION tg_orders_reclaim_promotion();
CREATE TRIGGER trg_orders_stamp AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION tg_orders_stamp();
CREATE TRIGGER trg_orders_subscription_delivery_revert AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION tg_orders_subscription_delivery_revert();
CREATE TRIGGER partners_set_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION tg_partners_set_updated_at();
CREATE TRIGGER payment_events_no_delete BEFORE DELETE ON public.payment_events FOR EACH ROW EXECUTE FUNCTION block_payment_events_mutations();
CREATE TRIGGER payment_events_no_update BEFORE UPDATE ON public.payment_events FOR EACH ROW EXECUTE FUNCTION block_payment_events_mutations();
CREATE TRIGGER trg_touch_payment_refund_queue BEFORE UPDATE ON public.payment_refund_queue FOR EACH ROW EXECUTE FUNCTION touch_payment_refund_queue();
CREATE TRIGGER point_ledger_no_delete BEFORE DELETE ON public.point_ledger FOR EACH ROW EXECUTE FUNCTION block_point_ledger_mutations();
CREATE TRIGGER point_ledger_no_update BEFORE UPDATE ON public.point_ledger FOR EACH ROW EXECUTE FUNCTION block_point_ledger_mutations();
CREATE TRIGGER product_qna_set_updated_at BEFORE UPDATE ON public.product_qna FOR EACH ROW EXECUTE FUNCTION tg_product_qna_set_updated_at();
CREATE TRIGGER profiles_enforce_min_age BEFORE INSERT OR UPDATE OF birth_year ON public.profiles FOR EACH ROW EXECUTE FUNCTION enforce_min_age_14();
CREATE TRIGGER profiles_lock_loyalty BEFORE UPDATE OF stamp_count, tier, tier_updated_at, cumulative_spend ON public.profiles FOR EACH ROW EXECUTE FUNCTION prevent_profile_loyalty_change();
CREATE TRIGGER profiles_sync_tier BEFORE UPDATE OF stamp_count ON public.profiles FOR EACH ROW WHEN ((new.stamp_count IS DISTINCT FROM old.stamp_count)) EXECUTE FUNCTION tg_profiles_sync_tier();
CREATE TRIGGER trg_prevent_profile_role_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION prevent_profile_role_change();
CREATE TRIGGER refunds_apply_partial AFTER INSERT ON public.refunds FOR EACH ROW EXECUTE FUNCTION tg_refunds_apply_partial();
CREATE TRIGGER trg_stamps_refresh_count AFTER INSERT OR DELETE OR UPDATE ON public.stamps FOR EACH ROW EXECUTE FUNCTION tg_stamps_refresh_count();
CREATE TRIGGER subscriptions_set_cancelled_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION set_subscription_cancelled_at();
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_guard_subscription_status BEFORE UPDATE OF status ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION guard_subscription_status_transition();
CREATE TRIGGER trg_subscriptions_clear_billing_on_cancel BEFORE UPDATE OF status ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION tg_subscriptions_clear_billing_on_cancel();
CREATE TRIGGER trg_user_integrations_updated BEFORE UPDATE ON public.user_integrations FOR EACH ROW EXECUTE FUNCTION touch_user_integrations_updated_at();
CREATE TRIGGER trg_prevent_vet_share_tampering BEFORE UPDATE ON public.vet_share_tokens FOR EACH ROW EXECUTE FUNCTION prevent_vet_share_token_tampering();

-- ===== auth 스키마 트리거 (가입 시 profiles 생성) =====
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===== comments =====
comment on column public.account_deletions.purged_at is '5년 보관 후 hard-delete 시점. NULL = 아직 transaction 데이터 보유.';
comment on column public.addresses.is_default is '기본 배송지 여부. user 당 최대 1. 트리거가 정합성 유지.';
comment on column public.addresses.label is '별칭 ("집", "회사"). 사용자 편의용. 빈 값 허용.';
comment on column public.admin_audit_log.action is '액션 종류. naming: <entity>_<verb>. 예: product_update, order_cancel, user_suspend';
comment on column public.admin_audit_log.diff is '변경 내용. { before: {...}, after: {...}, meta: {...} } 형태 권장. PII 최소화.';
comment on column public.algorithm_food_lines.omega3_pct_dm is 'EPA+DHA 합산 % DM. AAFCO 2024 성견 최소 0.1% DM. ACVIM cardiac 권장 40-65 mg/kg BW/day. NULL = 추후 batch lab.';
comment on column public.algorithm_food_lines.omega6_pct_dm is 'omega-6 % DM. NRC 2006 omega-6:3 ratio 5:1~10:1 (healthy), 2:1~5:1 (염증성).';
comment on column public.algorithm_food_lines.vitamin_d_iu_per_100g_dm is 'vitamin D IU / 100g DM. AAFCO 500-3000 IU/kg DM (대형 puppy 5000 IU/kg max).';
comment on column public.analyses.commentary is 'AI-generated Korean commentary summarizing the dog''s nutrition analysis (3-4 sentences). Lazily populated on first view.';
comment on column public.analyses.structured_analysis_at is 'AI 코멘트(structured_analysis) 를 실제로 생성한 시각. 강아지당 2주 1회 쿨다운의 기준 — 라우트가 같은 dog 의 최근 코멘트가 14일 내면 AI 를 안 부르고 재사용한다.';
comment on column public.dogs.accuracy_user_boost is '사용자 자기 표명 boost. overallReliability 에 합산. 0~0.2 범위.';
comment on column public.dogs.activity_method is '활동량 측정 도구. 발명 모듈 A.';
comment on column public.dogs.allergies_source is '알러지 출처 — self_suspected (자가 의심) / vet_diagnosed (수의사 진단).';
comment on column public.dogs.breed_size is '체형 분류 — toy(<5kg) / small(5-10) / medium(10-25) / large(25-45) / giant(45+).';
comment on column public.dogs.feed_method is '급여량 측정 도구. auto_delivery=자체 사료 자동 추적 (1.0).';
comment on column public.dogs.prescription_diet is '현재 복용 중인 처방식 이름 (없으면 NULL).';
comment on column public.dogs.user_method_lock is '변수별 측정도구 잠금. {"weight":true} 면 체중 변수 권유 push/nudge skip. voice-guidelines §9.';
comment on column public.dogs.weight_measured_at is '마지막 체중 측정 일자. W_recency 산출용 (1주 이내 1.0).';
comment on column public.dogs.weight_method is '체중 측정 도구. 발명 모듈 A. 신뢰도 점수의 W_method 입력.';
comment on column public.feeding_outcomes.reason_detail is '자유 입력 환불/해지 사유. ReasonCategory enum 보완 (R39e).';
comment on column public.order_items.cancelled_at is '항목 단위 취소 시각. NULL = 정상. 부분 취소 시 채워짐.';
comment on column public.order_items.refunded_amount is '항목 단위 환불 금액 (line_total <= 환불액 <= line_total). 합계는 orders.refunded_amount.';
comment on column public.orders.cash_receipt_number is '현금영수증 식별번호. 소득공제=휴대폰번호, 지출증빙=사업자등록번호.';
comment on column public.orders.cash_receipt_type is '현금영수증 용도. NULL=미신청, 소득공제=개인용(휴대폰), 지출증빙=사업자용.';
comment on column public.orders.discount_reason is '자동 할인 적용 사유(lib/discount.ts DiscountReason). first_order|tier|birthday|none, NULL=미기록(쿠폰 시절). 연 N회 한도 집계 + 주문 상세 표시에 사용.';
comment on column public.orders.points_refunded is '누적 환급된 사용 포인트(points_used 중 환급 완료분). 부분/전량 취소 중복 환급 방지 상한.';
comment on column public.orders.receipt_url is '토스가 제공하는 영수증 URL. 카드 결제는 카드매출전표, 가상계좌 결제는 현금영수증.';
comment on column public.orders.refunded_amount is '누적 환불 금액 (원). 전액 환불 시 total_amount와 같아지고 payment_status=refunded. 일부 환불 시 >0 이지만 total_amount 미만이며 payment_status=partially_refunded.';
comment on column public.orders.virtual_account_bank is 'Toss virtualAccount.bankCode — 한국은행 표준 2자리 금융기관 코드.';
comment on column public.orders.virtual_account_due_date is '가상계좌 입금 마감 일시.';
comment on column public.orders.virtual_account_holder is '가상계좌 예금주명.';
comment on column public.orders.virtual_account_number is '가상계좌번호. 최대 20자리 숫자/하이픈.';
comment on column public.products.gallery_urls is 'Additional product images shown after image_url (hero). Ordered.';
comment on column public.products.meta_description is 'SEO / OG meta description. Falls back to short_description.';
comment on column public.products.nutrition_facts is 'Pet Food 영양성분. JSON 키 (현행): protein_pct fat_pct fiber_pct ash_pct moisture_pct calories_kcal_per_100g calcium_pct phosphorus_pct. 추가 시 PDP 컴포넌트도 갱신.';
comment on column public.products.pet_food_class is '사료관리법 시행규칙 별표 1 분류. 기본 "반려동물용 자가소비 사료". 처방식이면 "수의사 처방용 사료" 등으로 교체.';
comment on column public.products.sales_channel is '판매 채널: own=자사몰 구독(화식), external=외부 채널 전용(스마트스토어·쿠팡 등)';
comment on column public.products.sku is 'R86-C1 (D7): 알고리즘 SKU 코드 (chronic-sku-mapper / allergy-sku-matrix 의 SkuKey 와 매핑). FT-prefix.';
comment on column public.profiles.admin_note is '사장님 운영 메모(상담 내용·주의사항). 고객 본인이 못 쓴다 — 쓰기는 PATCH /api/admin/users/[id]/note (관리자 검증 후 service_role). 2026-07-31.';
comment on column public.profiles.consent_level is '단계적 동의 1~4: basic/anonymous/academic/b2b.';
comment on column public.profiles.consent_max_rewarded_level is '이미 보상 받은 가장 높은 동의 단계. 같은 단계 재적립 차단.';
comment on column public.profiles.deleted_at is '탈퇴 시각. 서버(service_role)만 쓴다 — 고객이 직접 쓰면 계정은 탈퇴로 보이는데 구독 청구는 계속되는 상태가 만들어진다(2026-07-31).';
comment on column public.profiles.notifications_last_seen_at is 'Timestamp when user last opened the notifications inbox. Used as cutoff for unread count of order updates and other actionable signals.';
comment on column public.profiles.onboarded_at is '가입 후 첫 진입 튜토리얼 완료 시각. NULL = 아직 안 봄 → 다음 dashboard 진입 시 노출.';
comment on column public.profiles.stamp_count is '살아 있는(미만료) 스탬프 개수 캐시. stamps 트리거 + 매일 fn_expire_stamps() 크론이 갱신. 등급 상향의 트리거이지만 하향(강등)은 안 시킨다.';
comment on column public.profiles.tier is '회원 등급. **NULL = 아직 등급 없음**(스탬프 10개 미만, 2026-07-16). 기준은 stamp_count — 누적금액이 아니다.';
comment on column public.profiles.welcome_email_sent_at is '가입 환영 메일 발송 시각. null = 아직 안 보냄(첫 홈 진입에서 서버가 선점 후 발송). 기존 회원은 도입 시 now() 로 채움.';
comment on column public.push_log.nudge is '안 보내도 되는 권유성 알림(체중 재기 리마인더·체크인·설문 이어하기·광고)이면 true. 주 2건 상한은 이 표식에만 걸린다 — 건강 경보는 표시하지 않아 상한과 무관.';
comment on column public.push_preferences.notify_health is '건강 알림(체중 재기·체중 급변·검진 권고·개입 경보). 기본 ON — 배송 알림과 분리해야 배송을 꺼도 건강 경보는 남는다.';
comment on column public.subscription_items.unit_price is '한 팩 표시 단가(boxPricing 의 pricePerPack, 10원 올림). ⚠️ 청구 근거가 아니다 — 청구는 subscriptions.total_amount. 이 값들로 다시 합계를 만들면 올림이 누적돼 총액이 어긋난다.';
comment on column public.subscriptions.charge_key_seq is '청구 멱등키 접미사 앵커. 돈이 안 나간 게 보장된 실패(permanent·확정거절)에서만 증가하고 절대 리셋하지 않는다. unknown/타임아웃에는 증가시키지 말 것 — 이중청구가 된다.';
comment on column public.subscriptions.coverage_weeks is '박스가 담는 급여 기간(주). 2 고정 — interval_weeks 와 항상 같다.';
comment on column public.subscriptions.dog_id is '구독이 어떤 강아지 맞춤 박스에서 시작했는지 (NULL = 단일 SKU 구독). 강아지 삭제 시 SET NULL.';
comment on column public.subscriptions.fresh_ratio is '화식 비율 티어 (30=곁들임, 60=반반, 100=완전 화식). 2026-07-13 갈아엎기 박스 구독. null=레거시(coverage_weeks 로 근사).';
comment on column public.subscriptions.interval_weeks is '배송·결제 주기(주). 2 고정 — 박스가 14일치라 다른 주기는 성립하지 않는다(CHECK subscriptions_biweekly_only). 발송 요일은 화요일 고정(lib/shipping-schedule).';
comment on column public.subscriptions.last_charge_lock_at is '청구 크론이 이 구독의 청구 윈도우에 진입한 시각. UPDATE-with-RETURNING 선점용 — 배치 조회 후 상태가 바뀐 구독에 청구하지 않기 위한 것(2026-07-30). service_role 전용.';
comment on column public.subscriptions.last_failed_charge_code is 'Toss 에러 코드 (예: EXPIRED_CARD, INSUFFICIENT_BALANCE). 분류·알람 룰용.';
comment on column public.subscriptions.mix_ratio is '화식 비율 (0.30~1.00). 0.30=토퍼, 0.50=균형, 0.70=화식위주, 1.00=화식단독.';
comment on column public.subscriptions.next_delivery_date is 'NULL = 카드 등록 전이라 배송 일정 미정. billing-issue 가 카드 등록 성공 시 다음 화요일(lib/shipping-schedule.nextShipDate)로 채운다. 크론은 NULL 행을 건너뛴다.';
comment on column public.subscriptions.next_retry_at is '일시 실패 후 다음 retry 가능 시각. cron 이 이 시각 이전엔 skip.';
comment on column public.subscriptions.requires_billing_key_renewal is '카드 만료 등 영구 거절 시 true. 사용자가 /subscribe/billing-auth 에서 재발급 시 false 로 reset.';
comment on column public.subscriptions.sku_size_g is '1팩 사이즈 (g). 7종 lineup: 70/100/130/170/220/280/350. 대형견은 콤보 별도 처리.';
comment on column public.surveys.budget_tier is '일일 식비 예산 응답. 분석 페이지 default 시나리오(토퍼/mix50/mix70/full) 자동 매핑.';
comment on column public.surveys.expected_adult_weight_kg is '예상 성견 체중 kg. 대형견 puppy Ca:P 상한 룰 (≥25kg 성견 + <18mo puppy).';
comment on column public.surveys.iris_stage is 'IRIS CKD 단계 1-4. NULL = CKD 없음/미진단. IRIS 2019 Guidelines.';
comment on column public.surveys.litter_size is '산자수. lactation kcal multiplier (NRC 2006 Table 15-3).';
comment on column public.surveys.pregnancy_week is '임신 주차 1-9. ≥6주차 = late gestation (RER × 1.6-2.0).';
comment on table public.addresses is '유저 배송지. 다건 저장, 기본값 1개. RLS: 본인만.';
comment on table public.admin_audit_log is 'Admin 액션 audit log (insert-only). 누가 언제 어떤 액션을 했는지 추적.';
comment on table public.algorithm_breed_predispose is '품종별 predispose 매핑 — dogs.breed (자유 텍스트) 와 keyword ILIKE 매칭해
   해당 만성질환/주의 chip 자동 발화. admin GUI 로 편집 가능. enabled=false
   면 알고리즘이 무시 (운영 중 빠른 disable).';
comment on table public.algorithm_chronic_severity is '만성질환별 default 진단 강도 + 영양 factor. admin GUI 가 GUI 로 편집.
   사용자 입력 없을 때 default_severity 적용. 같은 질환도 mild vs severe
   다른 처방 강도.';
comment on table public.algorithm_food_lines is '2026-07-17: 준영업비밀(라인 영양계수). SELECT 를 authenticated USING(true) → admin 전용으로 조임. compute 는 service-role 로 읽음. 유저 공개 SELECT 로 되돌리지 말 것.';
comment on table public.algorithm_meta_weights is '발명 모듈 H — 메타학습 가중치 versioned 시계열. 월간 cron 이 적재.';
comment on table public.anthropic_usage is 'Anthropic AI 일별 사용량 누적 (호출수 + 토큰). (day, route) PK. 비용 가드 / 모니터링용. service_role 전용.';
comment on table public.arm_stats is 'meta_learning_events 의 context/arm_id 별 통계. SECURITY INVOKER (R38).';
comment on table public.automation_settings is '운영 자동화 스위치(싱글턴 id=1). 비어 있으면 코드 기본값 fallback — 지우면 안 되지만 지워도 무해.';
comment on table public.cron_health is 'cron 실행 audit log. admin 대시보드에서 최근 24h 실패 카운트 / 평균 duration 표시.';
comment on table public.dog_formulas is '강아지별 매 cycle 처방 이력. firstBox.ts 알고리즘 출력 + 사용자 조정.';
comment on table public.dog_members is '강아지 공동 케어자. dogs.user_id 는 owner. 이 테이블은 추가 member/viewer 만.';
comment on table public.dog_sensitivity_snapshots is '반사실 sensitivity 결과 시계열. 주간 cron 이 활성 dog 별 1건 저장.';
comment on table public.email_suppressions is 'R101-F: 하드바운스/스팸신고 주소 — sendEmail 이 조회해 전 발송 skip (도메인 평판 보호)';
comment on table public.feeding_outcomes is 'Phase 1-4 (2026-05-20): 베타 cohort + outcome 자동 추적. 사용자 부담 최소.';
comment on table public.medical_records is '의료 기록 시계열. manual / ocr / vet source 구분. P4 phase.';
comment on table public.meta_learning_events is '메타학습 reward 영구 적재. exploration.ts 가 cohort 단위 학습 시 참조.';
comment on table public.native_push_tokens is 'Capacitor 네이티브 앱 푸시 토큰 (APNs/FCM). PWA Web Push 는 push_subscriptions 별도.';
comment on table public.orders is '결제 원장. 고객 UPDATE 전면 회수(20260731000000) + INSERT 회수(20260808000300) — 쓰기는 service_role(청구 크론·웹훅·admin 라우트)만. 위조 paid 주문으로 도장·등급을 파밍하는 경로를 막는다.';
comment on table public.payment_events is '결제 원장 (insert-only ledger). 모든 결제 상태 변경 이벤트. R60.';
comment on table public.photo_request_tokens is '친구·가족에게 강아지 사진 부탁용 익명 업로드 토큰. P5 phase.';
comment on table public.product_qna is '2026-07-17: SELECT 가 is_private=false 를 anon 에 공개해 user_id·answered_by 가 노출되고 있었다(0행이라 실피해 없음, reviews 형제 취약점). 읽어서 보여주는 앱 코드가 없어 공개가 불필요했다. 공개 Q&A 가 필요해지면 user_id 를 뺀 뷰를 만들 것 — 정책을 anon 공개로 되돌리지 말 것.';
comment on table public.promotion_claims is '프로모션으로 가입한 계정. user_id unique = 계정당 1회(첫 주문 할인). redeemed_order_id 가 차면 실제 사용. 상한 카운트와 채널 성과(가입수 vs 결제수)의 근거.';
comment on table public.promotions is '오프라인·인스타 이벤트용 한시 할인. code 가 URL 파라미터(/start?p=code)로 쓰인다. 고객은 코드를 입력하지 않는다 — 링크가 곧 코드. 등급 할인과 섞지 않고 결제 시 더 큰 쪽 하나만 적용(lib/promotions pickBetterDiscount).';
comment on table public.push_log is '사용자별 푸시 발송 이력. /notifications 페이지가 조회. read_at 으로
   읽음 처리 (별도 RPC 가 mark-read 처리). 90일 후 자동 삭제 권장 (cron).';
comment on table public.push_preferences is '계정별 웹 푸시 선호. 카테고리 플래그 + quiet hours.';
comment on table public.source_waitlist is '기능성 소스(레이어 B) 출시 알림 대기열. concern 단위, (user,concern) 유니크.';
comment on table public.stamps is '구독 결제 1회 = 도장 1개. 느슨한 스탬프는 적립 + 1년 만료. 판(10개) 완성 시 그 10개는 영구 잠금(expires_at=infinity)돼 등급을 지킨다(2026-07-22). stamp_count = 잠금+느슨살아있음.';
comment on table public.subscription_charges is '정기배송 자동결제 시도 이력. (subscription_id, scheduled_for) 가 멱등 키.';
comment on table public.subscription_items is '구독 박스의 품목 스냅샷. 정본은 dog_formulas + lib/personalization/boxPricing 이고 이 표는 그 파생이다 — 처방이 승인되면 서버가 다시 만든다(/api/personalization/approve). 청구 크론이 order_items 로 복사하는 값이라 조작되면 주문 원장이 오염된다: UPDATE/DELETE 는 service_role 전용(2026-07-30). INSERT 는 가입 화면이 아직 직접 하므로 남아 있고, 구독 생성을 서버로 옮길 때 함께 회수한다.';
comment on table public.subscriptions is '정기배송. 금액·상태·배송일은 서버 소유 — 생성은 POST /api/subscriptions/create, 수정은 지정된 4칸만 고객이 UPDATE 가능(20260730000000). 청구는 저장된 total_amount 로 하므로 이 표에 클라이언트가 금액을 쓸 수 있으면 그대로 저청구가 된다(2026-07-30).';
comment on table public.user_integrations is '외부 서비스 OAuth 연동 (Tractive, Fi 등). 42 deferred #1 / 발명 모듈 A.';
comment on table public.vet_share_tokens is '견주가 발급한 수의사 공유 토큰. 가입 없이 read-only 보고서 열람.';
comment on table public.webhook_events is '결제 웹훅 멱등 게이트. event_key=paymentKey:status, (provider,event_key) 유니크로 동시·재시도 중복처리 차단.';

-- ===== table grants =====
grant delete on table public.account_deletions to anon;
grant insert on table public.account_deletions to anon;
grant maintain on table public.account_deletions to anon;
grant references on table public.account_deletions to anon;
grant select on table public.account_deletions to anon;
grant trigger on table public.account_deletions to anon;
grant truncate on table public.account_deletions to anon;
grant update on table public.account_deletions to anon;
grant delete on table public.account_deletions to authenticated;
grant insert on table public.account_deletions to authenticated;
grant maintain on table public.account_deletions to authenticated;
grant references on table public.account_deletions to authenticated;
grant select on table public.account_deletions to authenticated;
grant trigger on table public.account_deletions to authenticated;
grant truncate on table public.account_deletions to authenticated;
grant update on table public.account_deletions to authenticated;
grant delete on table public.account_deletions to service_role;
grant insert on table public.account_deletions to service_role;
grant maintain on table public.account_deletions to service_role;
grant references on table public.account_deletions to service_role;
grant select on table public.account_deletions to service_role;
grant trigger on table public.account_deletions to service_role;
grant truncate on table public.account_deletions to service_role;
grant update on table public.account_deletions to service_role;
grant delete on table public.activity_logs to anon;
grant insert on table public.activity_logs to anon;
grant maintain on table public.activity_logs to anon;
grant references on table public.activity_logs to anon;
grant select on table public.activity_logs to anon;
grant trigger on table public.activity_logs to anon;
grant truncate on table public.activity_logs to anon;
grant update on table public.activity_logs to anon;
grant delete on table public.activity_logs to authenticated;
grant insert on table public.activity_logs to authenticated;
grant maintain on table public.activity_logs to authenticated;
grant references on table public.activity_logs to authenticated;
grant select on table public.activity_logs to authenticated;
grant trigger on table public.activity_logs to authenticated;
grant truncate on table public.activity_logs to authenticated;
grant update on table public.activity_logs to authenticated;
grant delete on table public.activity_logs to service_role;
grant insert on table public.activity_logs to service_role;
grant maintain on table public.activity_logs to service_role;
grant references on table public.activity_logs to service_role;
grant select on table public.activity_logs to service_role;
grant trigger on table public.activity_logs to service_role;
grant truncate on table public.activity_logs to service_role;
grant update on table public.activity_logs to service_role;
grant delete on table public.addresses to anon;
grant insert on table public.addresses to anon;
grant maintain on table public.addresses to anon;
grant references on table public.addresses to anon;
grant select on table public.addresses to anon;
grant trigger on table public.addresses to anon;
grant truncate on table public.addresses to anon;
grant update on table public.addresses to anon;
grant delete on table public.addresses to authenticated;
grant insert on table public.addresses to authenticated;
grant maintain on table public.addresses to authenticated;
grant references on table public.addresses to authenticated;
grant select on table public.addresses to authenticated;
grant trigger on table public.addresses to authenticated;
grant truncate on table public.addresses to authenticated;
grant update on table public.addresses to authenticated;
grant delete on table public.addresses to service_role;
grant insert on table public.addresses to service_role;
grant maintain on table public.addresses to service_role;
grant references on table public.addresses to service_role;
grant select on table public.addresses to service_role;
grant trigger on table public.addresses to service_role;
grant truncate on table public.addresses to service_role;
grant update on table public.addresses to service_role;
grant delete on table public.admin_audit_log to anon;
grant insert on table public.admin_audit_log to anon;
grant maintain on table public.admin_audit_log to anon;
grant references on table public.admin_audit_log to anon;
grant select on table public.admin_audit_log to anon;
grant trigger on table public.admin_audit_log to anon;
grant truncate on table public.admin_audit_log to anon;
grant update on table public.admin_audit_log to anon;
grant delete on table public.admin_audit_log to authenticated;
grant insert on table public.admin_audit_log to authenticated;
grant maintain on table public.admin_audit_log to authenticated;
grant references on table public.admin_audit_log to authenticated;
grant select on table public.admin_audit_log to authenticated;
grant trigger on table public.admin_audit_log to authenticated;
grant truncate on table public.admin_audit_log to authenticated;
grant update on table public.admin_audit_log to authenticated;
grant delete on table public.admin_audit_log to service_role;
grant insert on table public.admin_audit_log to service_role;
grant maintain on table public.admin_audit_log to service_role;
grant references on table public.admin_audit_log to service_role;
grant select on table public.admin_audit_log to service_role;
grant trigger on table public.admin_audit_log to service_role;
grant truncate on table public.admin_audit_log to service_role;
grant update on table public.admin_audit_log to service_role;
grant delete on table public.algorithm_breed_predispose to anon;
grant insert on table public.algorithm_breed_predispose to anon;
grant maintain on table public.algorithm_breed_predispose to anon;
grant references on table public.algorithm_breed_predispose to anon;
grant select on table public.algorithm_breed_predispose to anon;
grant trigger on table public.algorithm_breed_predispose to anon;
grant truncate on table public.algorithm_breed_predispose to anon;
grant update on table public.algorithm_breed_predispose to anon;
grant delete on table public.algorithm_breed_predispose to authenticated;
grant insert on table public.algorithm_breed_predispose to authenticated;
grant maintain on table public.algorithm_breed_predispose to authenticated;
grant references on table public.algorithm_breed_predispose to authenticated;
grant select on table public.algorithm_breed_predispose to authenticated;
grant trigger on table public.algorithm_breed_predispose to authenticated;
grant truncate on table public.algorithm_breed_predispose to authenticated;
grant update on table public.algorithm_breed_predispose to authenticated;
grant delete on table public.algorithm_breed_predispose to service_role;
grant insert on table public.algorithm_breed_predispose to service_role;
grant maintain on table public.algorithm_breed_predispose to service_role;
grant references on table public.algorithm_breed_predispose to service_role;
grant select on table public.algorithm_breed_predispose to service_role;
grant trigger on table public.algorithm_breed_predispose to service_role;
grant truncate on table public.algorithm_breed_predispose to service_role;
grant update on table public.algorithm_breed_predispose to service_role;
grant delete on table public.algorithm_chronic_severity to anon;
grant insert on table public.algorithm_chronic_severity to anon;
grant maintain on table public.algorithm_chronic_severity to anon;
grant references on table public.algorithm_chronic_severity to anon;
grant select on table public.algorithm_chronic_severity to anon;
grant trigger on table public.algorithm_chronic_severity to anon;
grant truncate on table public.algorithm_chronic_severity to anon;
grant update on table public.algorithm_chronic_severity to anon;
grant delete on table public.algorithm_chronic_severity to authenticated;
grant insert on table public.algorithm_chronic_severity to authenticated;
grant maintain on table public.algorithm_chronic_severity to authenticated;
grant references on table public.algorithm_chronic_severity to authenticated;
grant select on table public.algorithm_chronic_severity to authenticated;
grant trigger on table public.algorithm_chronic_severity to authenticated;
grant truncate on table public.algorithm_chronic_severity to authenticated;
grant update on table public.algorithm_chronic_severity to authenticated;
grant delete on table public.algorithm_chronic_severity to service_role;
grant insert on table public.algorithm_chronic_severity to service_role;
grant maintain on table public.algorithm_chronic_severity to service_role;
grant references on table public.algorithm_chronic_severity to service_role;
grant select on table public.algorithm_chronic_severity to service_role;
grant trigger on table public.algorithm_chronic_severity to service_role;
grant truncate on table public.algorithm_chronic_severity to service_role;
grant update on table public.algorithm_chronic_severity to service_role;
grant delete on table public.algorithm_food_lines to anon;
grant insert on table public.algorithm_food_lines to anon;
grant maintain on table public.algorithm_food_lines to anon;
grant references on table public.algorithm_food_lines to anon;
grant select on table public.algorithm_food_lines to anon;
grant trigger on table public.algorithm_food_lines to anon;
grant truncate on table public.algorithm_food_lines to anon;
grant update on table public.algorithm_food_lines to anon;
grant delete on table public.algorithm_food_lines to authenticated;
grant insert on table public.algorithm_food_lines to authenticated;
grant maintain on table public.algorithm_food_lines to authenticated;
grant references on table public.algorithm_food_lines to authenticated;
grant select on table public.algorithm_food_lines to authenticated;
grant trigger on table public.algorithm_food_lines to authenticated;
grant truncate on table public.algorithm_food_lines to authenticated;
grant update on table public.algorithm_food_lines to authenticated;
grant delete on table public.algorithm_food_lines to service_role;
grant insert on table public.algorithm_food_lines to service_role;
grant maintain on table public.algorithm_food_lines to service_role;
grant references on table public.algorithm_food_lines to service_role;
grant select on table public.algorithm_food_lines to service_role;
grant trigger on table public.algorithm_food_lines to service_role;
grant truncate on table public.algorithm_food_lines to service_role;
grant update on table public.algorithm_food_lines to service_role;
grant delete on table public.algorithm_meta_weights to anon;
grant insert on table public.algorithm_meta_weights to anon;
grant maintain on table public.algorithm_meta_weights to anon;
grant references on table public.algorithm_meta_weights to anon;
grant select on table public.algorithm_meta_weights to anon;
grant trigger on table public.algorithm_meta_weights to anon;
grant truncate on table public.algorithm_meta_weights to anon;
grant update on table public.algorithm_meta_weights to anon;
grant delete on table public.algorithm_meta_weights to authenticated;
grant insert on table public.algorithm_meta_weights to authenticated;
grant maintain on table public.algorithm_meta_weights to authenticated;
grant references on table public.algorithm_meta_weights to authenticated;
grant select on table public.algorithm_meta_weights to authenticated;
grant trigger on table public.algorithm_meta_weights to authenticated;
grant truncate on table public.algorithm_meta_weights to authenticated;
grant update on table public.algorithm_meta_weights to authenticated;
grant delete on table public.algorithm_meta_weights to service_role;
grant insert on table public.algorithm_meta_weights to service_role;
grant maintain on table public.algorithm_meta_weights to service_role;
grant references on table public.algorithm_meta_weights to service_role;
grant select on table public.algorithm_meta_weights to service_role;
grant trigger on table public.algorithm_meta_weights to service_role;
grant truncate on table public.algorithm_meta_weights to service_role;
grant update on table public.algorithm_meta_weights to service_role;
grant delete on table public.analyses to anon;
grant insert on table public.analyses to anon;
grant maintain on table public.analyses to anon;
grant references on table public.analyses to anon;
grant select on table public.analyses to anon;
grant trigger on table public.analyses to anon;
grant truncate on table public.analyses to anon;
grant update on table public.analyses to anon;
grant delete on table public.analyses to authenticated;
grant insert on table public.analyses to authenticated;
grant maintain on table public.analyses to authenticated;
grant references on table public.analyses to authenticated;
grant select on table public.analyses to authenticated;
grant trigger on table public.analyses to authenticated;
grant truncate on table public.analyses to authenticated;
grant update on table public.analyses to authenticated;
grant delete on table public.analyses to service_role;
grant insert on table public.analyses to service_role;
grant maintain on table public.analyses to service_role;
grant references on table public.analyses to service_role;
grant select on table public.analyses to service_role;
grant trigger on table public.analyses to service_role;
grant truncate on table public.analyses to service_role;
grant update on table public.analyses to service_role;
grant delete on table public.anthropic_usage to anon;
grant insert on table public.anthropic_usage to anon;
grant maintain on table public.anthropic_usage to anon;
grant references on table public.anthropic_usage to anon;
grant select on table public.anthropic_usage to anon;
grant trigger on table public.anthropic_usage to anon;
grant truncate on table public.anthropic_usage to anon;
grant update on table public.anthropic_usage to anon;
grant delete on table public.anthropic_usage to authenticated;
grant insert on table public.anthropic_usage to authenticated;
grant maintain on table public.anthropic_usage to authenticated;
grant references on table public.anthropic_usage to authenticated;
grant select on table public.anthropic_usage to authenticated;
grant trigger on table public.anthropic_usage to authenticated;
grant truncate on table public.anthropic_usage to authenticated;
grant update on table public.anthropic_usage to authenticated;
grant delete on table public.anthropic_usage to service_role;
grant insert on table public.anthropic_usage to service_role;
grant maintain on table public.anthropic_usage to service_role;
grant references on table public.anthropic_usage to service_role;
grant select on table public.anthropic_usage to service_role;
grant trigger on table public.anthropic_usage to service_role;
grant truncate on table public.anthropic_usage to service_role;
grant update on table public.anthropic_usage to service_role;
grant delete on table public.arm_stats to anon;
grant insert on table public.arm_stats to anon;
grant maintain on table public.arm_stats to anon;
grant references on table public.arm_stats to anon;
grant select on table public.arm_stats to anon;
grant trigger on table public.arm_stats to anon;
grant truncate on table public.arm_stats to anon;
grant update on table public.arm_stats to anon;
grant delete on table public.arm_stats to authenticated;
grant insert on table public.arm_stats to authenticated;
grant maintain on table public.arm_stats to authenticated;
grant references on table public.arm_stats to authenticated;
grant select on table public.arm_stats to authenticated;
grant trigger on table public.arm_stats to authenticated;
grant truncate on table public.arm_stats to authenticated;
grant update on table public.arm_stats to authenticated;
grant delete on table public.arm_stats to service_role;
grant insert on table public.arm_stats to service_role;
grant maintain on table public.arm_stats to service_role;
grant references on table public.arm_stats to service_role;
grant select on table public.arm_stats to service_role;
grant trigger on table public.arm_stats to service_role;
grant truncate on table public.arm_stats to service_role;
grant update on table public.arm_stats to service_role;
grant delete on table public.automation_settings to anon;
grant insert on table public.automation_settings to anon;
grant maintain on table public.automation_settings to anon;
grant references on table public.automation_settings to anon;
grant select on table public.automation_settings to anon;
grant trigger on table public.automation_settings to anon;
grant truncate on table public.automation_settings to anon;
grant update on table public.automation_settings to anon;
grant delete on table public.automation_settings to authenticated;
grant insert on table public.automation_settings to authenticated;
grant maintain on table public.automation_settings to authenticated;
grant references on table public.automation_settings to authenticated;
grant select on table public.automation_settings to authenticated;
grant trigger on table public.automation_settings to authenticated;
grant truncate on table public.automation_settings to authenticated;
grant update on table public.automation_settings to authenticated;
grant delete on table public.automation_settings to service_role;
grant insert on table public.automation_settings to service_role;
grant maintain on table public.automation_settings to service_role;
grant references on table public.automation_settings to service_role;
grant select on table public.automation_settings to service_role;
grant trigger on table public.automation_settings to service_role;
grant truncate on table public.automation_settings to service_role;
grant update on table public.automation_settings to service_role;
grant delete on table public.blog_categories to anon;
grant insert on table public.blog_categories to anon;
grant maintain on table public.blog_categories to anon;
grant references on table public.blog_categories to anon;
grant select on table public.blog_categories to anon;
grant trigger on table public.blog_categories to anon;
grant truncate on table public.blog_categories to anon;
grant update on table public.blog_categories to anon;
grant delete on table public.blog_categories to authenticated;
grant insert on table public.blog_categories to authenticated;
grant maintain on table public.blog_categories to authenticated;
grant references on table public.blog_categories to authenticated;
grant select on table public.blog_categories to authenticated;
grant trigger on table public.blog_categories to authenticated;
grant truncate on table public.blog_categories to authenticated;
grant update on table public.blog_categories to authenticated;
grant delete on table public.blog_categories to service_role;
grant insert on table public.blog_categories to service_role;
grant maintain on table public.blog_categories to service_role;
grant references on table public.blog_categories to service_role;
grant select on table public.blog_categories to service_role;
grant trigger on table public.blog_categories to service_role;
grant truncate on table public.blog_categories to service_role;
grant update on table public.blog_categories to service_role;
grant delete on table public.blog_posts to anon;
grant insert on table public.blog_posts to anon;
grant maintain on table public.blog_posts to anon;
grant references on table public.blog_posts to anon;
grant select on table public.blog_posts to anon;
grant trigger on table public.blog_posts to anon;
grant truncate on table public.blog_posts to anon;
grant update on table public.blog_posts to anon;
grant delete on table public.blog_posts to authenticated;
grant insert on table public.blog_posts to authenticated;
grant maintain on table public.blog_posts to authenticated;
grant references on table public.blog_posts to authenticated;
grant select on table public.blog_posts to authenticated;
grant trigger on table public.blog_posts to authenticated;
grant truncate on table public.blog_posts to authenticated;
grant update on table public.blog_posts to authenticated;
grant delete on table public.blog_posts to service_role;
grant insert on table public.blog_posts to service_role;
grant maintain on table public.blog_posts to service_role;
grant references on table public.blog_posts to service_role;
grant select on table public.blog_posts to service_role;
grant trigger on table public.blog_posts to service_role;
grant truncate on table public.blog_posts to service_role;
grant update on table public.blog_posts to service_role;
grant delete on table public.chatbot_messages to anon;
grant insert on table public.chatbot_messages to anon;
grant maintain on table public.chatbot_messages to anon;
grant references on table public.chatbot_messages to anon;
grant select on table public.chatbot_messages to anon;
grant trigger on table public.chatbot_messages to anon;
grant truncate on table public.chatbot_messages to anon;
grant update on table public.chatbot_messages to anon;
grant delete on table public.chatbot_messages to authenticated;
grant insert on table public.chatbot_messages to authenticated;
grant maintain on table public.chatbot_messages to authenticated;
grant references on table public.chatbot_messages to authenticated;
grant select on table public.chatbot_messages to authenticated;
grant trigger on table public.chatbot_messages to authenticated;
grant truncate on table public.chatbot_messages to authenticated;
grant update on table public.chatbot_messages to authenticated;
grant delete on table public.chatbot_messages to service_role;
grant insert on table public.chatbot_messages to service_role;
grant maintain on table public.chatbot_messages to service_role;
grant references on table public.chatbot_messages to service_role;
grant select on table public.chatbot_messages to service_role;
grant trigger on table public.chatbot_messages to service_role;
grant truncate on table public.chatbot_messages to service_role;
grant update on table public.chatbot_messages to service_role;
grant delete on table public.consent_log to anon;
grant insert on table public.consent_log to anon;
grant maintain on table public.consent_log to anon;
grant references on table public.consent_log to anon;
grant select on table public.consent_log to anon;
grant trigger on table public.consent_log to anon;
grant truncate on table public.consent_log to anon;
grant update on table public.consent_log to anon;
grant delete on table public.consent_log to authenticated;
grant insert on table public.consent_log to authenticated;
grant maintain on table public.consent_log to authenticated;
grant references on table public.consent_log to authenticated;
grant select on table public.consent_log to authenticated;
grant trigger on table public.consent_log to authenticated;
grant truncate on table public.consent_log to authenticated;
grant update on table public.consent_log to authenticated;
grant delete on table public.consent_log to service_role;
grant insert on table public.consent_log to service_role;
grant maintain on table public.consent_log to service_role;
grant references on table public.consent_log to service_role;
grant select on table public.consent_log to service_role;
grant trigger on table public.consent_log to service_role;
grant truncate on table public.consent_log to service_role;
grant update on table public.consent_log to service_role;
grant delete on table public.cron_health to anon;
grant insert on table public.cron_health to anon;
grant maintain on table public.cron_health to anon;
grant references on table public.cron_health to anon;
grant select on table public.cron_health to anon;
grant trigger on table public.cron_health to anon;
grant truncate on table public.cron_health to anon;
grant update on table public.cron_health to anon;
grant delete on table public.cron_health to authenticated;
grant insert on table public.cron_health to authenticated;
grant maintain on table public.cron_health to authenticated;
grant references on table public.cron_health to authenticated;
grant select on table public.cron_health to authenticated;
grant trigger on table public.cron_health to authenticated;
grant truncate on table public.cron_health to authenticated;
grant update on table public.cron_health to authenticated;
grant delete on table public.cron_health to service_role;
grant insert on table public.cron_health to service_role;
grant maintain on table public.cron_health to service_role;
grant references on table public.cron_health to service_role;
grant select on table public.cron_health to service_role;
grant trigger on table public.cron_health to service_role;
grant truncate on table public.cron_health to service_role;
grant update on table public.cron_health to service_role;
grant delete on table public.cs_messages to anon;
grant insert on table public.cs_messages to anon;
grant maintain on table public.cs_messages to anon;
grant references on table public.cs_messages to anon;
grant select on table public.cs_messages to anon;
grant trigger on table public.cs_messages to anon;
grant truncate on table public.cs_messages to anon;
grant update on table public.cs_messages to anon;
grant delete on table public.cs_messages to authenticated;
grant insert on table public.cs_messages to authenticated;
grant maintain on table public.cs_messages to authenticated;
grant references on table public.cs_messages to authenticated;
grant select on table public.cs_messages to authenticated;
grant trigger on table public.cs_messages to authenticated;
grant truncate on table public.cs_messages to authenticated;
grant delete on table public.cs_messages to service_role;
grant insert on table public.cs_messages to service_role;
grant maintain on table public.cs_messages to service_role;
grant references on table public.cs_messages to service_role;
grant select on table public.cs_messages to service_role;
grant trigger on table public.cs_messages to service_role;
grant truncate on table public.cs_messages to service_role;
grant update on table public.cs_messages to service_role;
grant delete on table public.dog_checkins to anon;
grant insert on table public.dog_checkins to anon;
grant maintain on table public.dog_checkins to anon;
grant references on table public.dog_checkins to anon;
grant select on table public.dog_checkins to anon;
grant trigger on table public.dog_checkins to anon;
grant truncate on table public.dog_checkins to anon;
grant update on table public.dog_checkins to anon;
grant delete on table public.dog_checkins to authenticated;
grant insert on table public.dog_checkins to authenticated;
grant maintain on table public.dog_checkins to authenticated;
grant references on table public.dog_checkins to authenticated;
grant select on table public.dog_checkins to authenticated;
grant trigger on table public.dog_checkins to authenticated;
grant truncate on table public.dog_checkins to authenticated;
grant update on table public.dog_checkins to authenticated;
grant delete on table public.dog_checkins to service_role;
grant insert on table public.dog_checkins to service_role;
grant maintain on table public.dog_checkins to service_role;
grant references on table public.dog_checkins to service_role;
grant select on table public.dog_checkins to service_role;
grant trigger on table public.dog_checkins to service_role;
grant truncate on table public.dog_checkins to service_role;
grant update on table public.dog_checkins to service_role;
grant delete on table public.dog_diary to anon;
grant insert on table public.dog_diary to anon;
grant maintain on table public.dog_diary to anon;
grant references on table public.dog_diary to anon;
grant select on table public.dog_diary to anon;
grant trigger on table public.dog_diary to anon;
grant truncate on table public.dog_diary to anon;
grant update on table public.dog_diary to anon;
grant delete on table public.dog_diary to authenticated;
grant insert on table public.dog_diary to authenticated;
grant maintain on table public.dog_diary to authenticated;
grant references on table public.dog_diary to authenticated;
grant select on table public.dog_diary to authenticated;
grant trigger on table public.dog_diary to authenticated;
grant truncate on table public.dog_diary to authenticated;
grant update on table public.dog_diary to authenticated;
grant delete on table public.dog_diary to service_role;
grant insert on table public.dog_diary to service_role;
grant maintain on table public.dog_diary to service_role;
grant references on table public.dog_diary to service_role;
grant select on table public.dog_diary to service_role;
grant trigger on table public.dog_diary to service_role;
grant truncate on table public.dog_diary to service_role;
grant update on table public.dog_diary to service_role;
grant maintain on table public.dog_formulas to anon;
grant references on table public.dog_formulas to anon;
grant select on table public.dog_formulas to anon;
grant trigger on table public.dog_formulas to anon;
grant truncate on table public.dog_formulas to anon;
grant maintain on table public.dog_formulas to authenticated;
grant references on table public.dog_formulas to authenticated;
grant select on table public.dog_formulas to authenticated;
grant trigger on table public.dog_formulas to authenticated;
grant truncate on table public.dog_formulas to authenticated;
grant delete on table public.dog_formulas to service_role;
grant insert on table public.dog_formulas to service_role;
grant maintain on table public.dog_formulas to service_role;
grant references on table public.dog_formulas to service_role;
grant select on table public.dog_formulas to service_role;
grant trigger on table public.dog_formulas to service_role;
grant truncate on table public.dog_formulas to service_role;
grant update on table public.dog_formulas to service_role;
grant delete on table public.dog_medications to anon;
grant insert on table public.dog_medications to anon;
grant maintain on table public.dog_medications to anon;
grant references on table public.dog_medications to anon;
grant select on table public.dog_medications to anon;
grant trigger on table public.dog_medications to anon;
grant truncate on table public.dog_medications to anon;
grant update on table public.dog_medications to anon;
grant delete on table public.dog_medications to authenticated;
grant insert on table public.dog_medications to authenticated;
grant maintain on table public.dog_medications to authenticated;
grant references on table public.dog_medications to authenticated;
grant select on table public.dog_medications to authenticated;
grant trigger on table public.dog_medications to authenticated;
grant truncate on table public.dog_medications to authenticated;
grant update on table public.dog_medications to authenticated;
grant delete on table public.dog_medications to service_role;
grant insert on table public.dog_medications to service_role;
grant maintain on table public.dog_medications to service_role;
grant references on table public.dog_medications to service_role;
grant select on table public.dog_medications to service_role;
grant trigger on table public.dog_medications to service_role;
grant truncate on table public.dog_medications to service_role;
grant update on table public.dog_medications to service_role;
grant delete on table public.dog_members to anon;
grant insert on table public.dog_members to anon;
grant maintain on table public.dog_members to anon;
grant references on table public.dog_members to anon;
grant select on table public.dog_members to anon;
grant trigger on table public.dog_members to anon;
grant truncate on table public.dog_members to anon;
grant update on table public.dog_members to anon;
grant delete on table public.dog_members to authenticated;
grant insert on table public.dog_members to authenticated;
grant maintain on table public.dog_members to authenticated;
grant references on table public.dog_members to authenticated;
grant select on table public.dog_members to authenticated;
grant trigger on table public.dog_members to authenticated;
grant truncate on table public.dog_members to authenticated;
grant update on table public.dog_members to authenticated;
grant delete on table public.dog_members to service_role;
grant insert on table public.dog_members to service_role;
grant maintain on table public.dog_members to service_role;
grant references on table public.dog_members to service_role;
grant select on table public.dog_members to service_role;
grant trigger on table public.dog_members to service_role;
grant truncate on table public.dog_members to service_role;
grant update on table public.dog_members to service_role;
grant delete on table public.dog_reminders to anon;
grant insert on table public.dog_reminders to anon;
grant maintain on table public.dog_reminders to anon;
grant references on table public.dog_reminders to anon;
grant select on table public.dog_reminders to anon;
grant trigger on table public.dog_reminders to anon;
grant truncate on table public.dog_reminders to anon;
grant update on table public.dog_reminders to anon;
grant delete on table public.dog_reminders to authenticated;
grant insert on table public.dog_reminders to authenticated;
grant maintain on table public.dog_reminders to authenticated;
grant references on table public.dog_reminders to authenticated;
grant select on table public.dog_reminders to authenticated;
grant trigger on table public.dog_reminders to authenticated;
grant truncate on table public.dog_reminders to authenticated;
grant update on table public.dog_reminders to authenticated;
grant delete on table public.dog_reminders to service_role;
grant insert on table public.dog_reminders to service_role;
grant maintain on table public.dog_reminders to service_role;
grant references on table public.dog_reminders to service_role;
grant select on table public.dog_reminders to service_role;
grant trigger on table public.dog_reminders to service_role;
grant truncate on table public.dog_reminders to service_role;
grant update on table public.dog_reminders to service_role;
grant delete on table public.dog_sensitivity_snapshots to anon;
grant insert on table public.dog_sensitivity_snapshots to anon;
grant maintain on table public.dog_sensitivity_snapshots to anon;
grant references on table public.dog_sensitivity_snapshots to anon;
grant select on table public.dog_sensitivity_snapshots to anon;
grant trigger on table public.dog_sensitivity_snapshots to anon;
grant truncate on table public.dog_sensitivity_snapshots to anon;
grant update on table public.dog_sensitivity_snapshots to anon;
grant delete on table public.dog_sensitivity_snapshots to authenticated;
grant insert on table public.dog_sensitivity_snapshots to authenticated;
grant maintain on table public.dog_sensitivity_snapshots to authenticated;
grant references on table public.dog_sensitivity_snapshots to authenticated;
grant select on table public.dog_sensitivity_snapshots to authenticated;
grant trigger on table public.dog_sensitivity_snapshots to authenticated;
grant truncate on table public.dog_sensitivity_snapshots to authenticated;
grant update on table public.dog_sensitivity_snapshots to authenticated;
grant delete on table public.dog_sensitivity_snapshots to service_role;
grant insert on table public.dog_sensitivity_snapshots to service_role;
grant maintain on table public.dog_sensitivity_snapshots to service_role;
grant references on table public.dog_sensitivity_snapshots to service_role;
grant select on table public.dog_sensitivity_snapshots to service_role;
grant trigger on table public.dog_sensitivity_snapshots to service_role;
grant truncate on table public.dog_sensitivity_snapshots to service_role;
grant update on table public.dog_sensitivity_snapshots to service_role;
grant delete on table public.dog_vaccinations to anon;
grant insert on table public.dog_vaccinations to anon;
grant maintain on table public.dog_vaccinations to anon;
grant references on table public.dog_vaccinations to anon;
grant select on table public.dog_vaccinations to anon;
grant trigger on table public.dog_vaccinations to anon;
grant truncate on table public.dog_vaccinations to anon;
grant update on table public.dog_vaccinations to anon;
grant delete on table public.dog_vaccinations to authenticated;
grant insert on table public.dog_vaccinations to authenticated;
grant maintain on table public.dog_vaccinations to authenticated;
grant references on table public.dog_vaccinations to authenticated;
grant select on table public.dog_vaccinations to authenticated;
grant trigger on table public.dog_vaccinations to authenticated;
grant truncate on table public.dog_vaccinations to authenticated;
grant update on table public.dog_vaccinations to authenticated;
grant delete on table public.dog_vaccinations to service_role;
grant insert on table public.dog_vaccinations to service_role;
grant maintain on table public.dog_vaccinations to service_role;
grant references on table public.dog_vaccinations to service_role;
grant select on table public.dog_vaccinations to service_role;
grant trigger on table public.dog_vaccinations to service_role;
grant truncate on table public.dog_vaccinations to service_role;
grant update on table public.dog_vaccinations to service_role;
grant delete on table public.dogs to anon;
grant insert on table public.dogs to anon;
grant maintain on table public.dogs to anon;
grant references on table public.dogs to anon;
grant select on table public.dogs to anon;
grant trigger on table public.dogs to anon;
grant truncate on table public.dogs to anon;
grant update on table public.dogs to anon;
grant delete on table public.dogs to authenticated;
grant insert on table public.dogs to authenticated;
grant maintain on table public.dogs to authenticated;
grant references on table public.dogs to authenticated;
grant select on table public.dogs to authenticated;
grant trigger on table public.dogs to authenticated;
grant truncate on table public.dogs to authenticated;
grant update on table public.dogs to authenticated;
grant delete on table public.dogs to service_role;
grant insert on table public.dogs to service_role;
grant maintain on table public.dogs to service_role;
grant references on table public.dogs to service_role;
grant select on table public.dogs to service_role;
grant trigger on table public.dogs to service_role;
grant truncate on table public.dogs to service_role;
grant update on table public.dogs to service_role;
grant delete on table public.email_suppressions to anon;
grant insert on table public.email_suppressions to anon;
grant maintain on table public.email_suppressions to anon;
grant references on table public.email_suppressions to anon;
grant select on table public.email_suppressions to anon;
grant trigger on table public.email_suppressions to anon;
grant truncate on table public.email_suppressions to anon;
grant update on table public.email_suppressions to anon;
grant delete on table public.email_suppressions to authenticated;
grant insert on table public.email_suppressions to authenticated;
grant maintain on table public.email_suppressions to authenticated;
grant references on table public.email_suppressions to authenticated;
grant select on table public.email_suppressions to authenticated;
grant trigger on table public.email_suppressions to authenticated;
grant truncate on table public.email_suppressions to authenticated;
grant update on table public.email_suppressions to authenticated;
grant delete on table public.email_suppressions to service_role;
grant insert on table public.email_suppressions to service_role;
grant maintain on table public.email_suppressions to service_role;
grant references on table public.email_suppressions to service_role;
grant select on table public.email_suppressions to service_role;
grant trigger on table public.email_suppressions to service_role;
grant truncate on table public.email_suppressions to service_role;
grant update on table public.email_suppressions to service_role;
grant delete on table public.faqs to anon;
grant insert on table public.faqs to anon;
grant maintain on table public.faqs to anon;
grant references on table public.faqs to anon;
grant select on table public.faqs to anon;
grant trigger on table public.faqs to anon;
grant truncate on table public.faqs to anon;
grant update on table public.faqs to anon;
grant delete on table public.faqs to authenticated;
grant insert on table public.faqs to authenticated;
grant maintain on table public.faqs to authenticated;
grant references on table public.faqs to authenticated;
grant select on table public.faqs to authenticated;
grant trigger on table public.faqs to authenticated;
grant truncate on table public.faqs to authenticated;
grant update on table public.faqs to authenticated;
grant delete on table public.faqs to service_role;
grant insert on table public.faqs to service_role;
grant maintain on table public.faqs to service_role;
grant references on table public.faqs to service_role;
grant select on table public.faqs to service_role;
grant trigger on table public.faqs to service_role;
grant truncate on table public.faqs to service_role;
grant update on table public.faqs to service_role;
grant delete on table public.feeding_outcomes to anon;
grant insert on table public.feeding_outcomes to anon;
grant maintain on table public.feeding_outcomes to anon;
grant references on table public.feeding_outcomes to anon;
grant select on table public.feeding_outcomes to anon;
grant trigger on table public.feeding_outcomes to anon;
grant truncate on table public.feeding_outcomes to anon;
grant update on table public.feeding_outcomes to anon;
grant delete on table public.feeding_outcomes to authenticated;
grant insert on table public.feeding_outcomes to authenticated;
grant maintain on table public.feeding_outcomes to authenticated;
grant references on table public.feeding_outcomes to authenticated;
grant select on table public.feeding_outcomes to authenticated;
grant trigger on table public.feeding_outcomes to authenticated;
grant truncate on table public.feeding_outcomes to authenticated;
grant update on table public.feeding_outcomes to authenticated;
grant delete on table public.feeding_outcomes to service_role;
grant insert on table public.feeding_outcomes to service_role;
grant maintain on table public.feeding_outcomes to service_role;
grant references on table public.feeding_outcomes to service_role;
grant select on table public.feeding_outcomes to service_role;
grant trigger on table public.feeding_outcomes to service_role;
grant truncate on table public.feeding_outcomes to service_role;
grant update on table public.feeding_outcomes to service_role;
grant delete on table public.health_logs to anon;
grant insert on table public.health_logs to anon;
grant maintain on table public.health_logs to anon;
grant references on table public.health_logs to anon;
grant select on table public.health_logs to anon;
grant trigger on table public.health_logs to anon;
grant truncate on table public.health_logs to anon;
grant update on table public.health_logs to anon;
grant delete on table public.health_logs to authenticated;
grant insert on table public.health_logs to authenticated;
grant maintain on table public.health_logs to authenticated;
grant references on table public.health_logs to authenticated;
grant select on table public.health_logs to authenticated;
grant trigger on table public.health_logs to authenticated;
grant truncate on table public.health_logs to authenticated;
grant update on table public.health_logs to authenticated;
grant delete on table public.health_logs to service_role;
grant insert on table public.health_logs to service_role;
grant maintain on table public.health_logs to service_role;
grant references on table public.health_logs to service_role;
grant select on table public.health_logs to service_role;
grant trigger on table public.health_logs to service_role;
grant truncate on table public.health_logs to service_role;
grant update on table public.health_logs to service_role;
grant delete on table public.kibble_products to anon;
grant insert on table public.kibble_products to anon;
grant maintain on table public.kibble_products to anon;
grant references on table public.kibble_products to anon;
grant select on table public.kibble_products to anon;
grant trigger on table public.kibble_products to anon;
grant truncate on table public.kibble_products to anon;
grant update on table public.kibble_products to anon;
grant delete on table public.kibble_products to authenticated;
grant insert on table public.kibble_products to authenticated;
grant maintain on table public.kibble_products to authenticated;
grant references on table public.kibble_products to authenticated;
grant select on table public.kibble_products to authenticated;
grant trigger on table public.kibble_products to authenticated;
grant truncate on table public.kibble_products to authenticated;
grant update on table public.kibble_products to authenticated;
grant delete on table public.kibble_products to service_role;
grant insert on table public.kibble_products to service_role;
grant maintain on table public.kibble_products to service_role;
grant references on table public.kibble_products to service_role;
grant select on table public.kibble_products to service_role;
grant trigger on table public.kibble_products to service_role;
grant truncate on table public.kibble_products to service_role;
grant update on table public.kibble_products to service_role;
grant delete on table public.kibble_requests to anon;
grant insert on table public.kibble_requests to anon;
grant maintain on table public.kibble_requests to anon;
grant references on table public.kibble_requests to anon;
grant select on table public.kibble_requests to anon;
grant trigger on table public.kibble_requests to anon;
grant truncate on table public.kibble_requests to anon;
grant update on table public.kibble_requests to anon;
grant delete on table public.kibble_requests to authenticated;
grant insert on table public.kibble_requests to authenticated;
grant maintain on table public.kibble_requests to authenticated;
grant references on table public.kibble_requests to authenticated;
grant select on table public.kibble_requests to authenticated;
grant trigger on table public.kibble_requests to authenticated;
grant truncate on table public.kibble_requests to authenticated;
grant update on table public.kibble_requests to authenticated;
grant delete on table public.kibble_requests to service_role;
grant insert on table public.kibble_requests to service_role;
grant maintain on table public.kibble_requests to service_role;
grant references on table public.kibble_requests to service_role;
grant select on table public.kibble_requests to service_role;
grant trigger on table public.kibble_requests to service_role;
grant truncate on table public.kibble_requests to service_role;
grant update on table public.kibble_requests to service_role;
grant delete on table public.medical_records to anon;
grant insert on table public.medical_records to anon;
grant maintain on table public.medical_records to anon;
grant references on table public.medical_records to anon;
grant select on table public.medical_records to anon;
grant trigger on table public.medical_records to anon;
grant truncate on table public.medical_records to anon;
grant update on table public.medical_records to anon;
grant delete on table public.medical_records to authenticated;
grant insert on table public.medical_records to authenticated;
grant maintain on table public.medical_records to authenticated;
grant references on table public.medical_records to authenticated;
grant select on table public.medical_records to authenticated;
grant trigger on table public.medical_records to authenticated;
grant truncate on table public.medical_records to authenticated;
grant update on table public.medical_records to authenticated;
grant delete on table public.medical_records to service_role;
grant insert on table public.medical_records to service_role;
grant maintain on table public.medical_records to service_role;
grant references on table public.medical_records to service_role;
grant select on table public.medical_records to service_role;
grant trigger on table public.medical_records to service_role;
grant truncate on table public.medical_records to service_role;
grant update on table public.medical_records to service_role;
grant delete on table public.meta_learning_events to anon;
grant insert on table public.meta_learning_events to anon;
grant maintain on table public.meta_learning_events to anon;
grant references on table public.meta_learning_events to anon;
grant select on table public.meta_learning_events to anon;
grant trigger on table public.meta_learning_events to anon;
grant truncate on table public.meta_learning_events to anon;
grant update on table public.meta_learning_events to anon;
grant delete on table public.meta_learning_events to authenticated;
grant insert on table public.meta_learning_events to authenticated;
grant maintain on table public.meta_learning_events to authenticated;
grant references on table public.meta_learning_events to authenticated;
grant select on table public.meta_learning_events to authenticated;
grant trigger on table public.meta_learning_events to authenticated;
grant truncate on table public.meta_learning_events to authenticated;
grant update on table public.meta_learning_events to authenticated;
grant delete on table public.meta_learning_events to service_role;
grant insert on table public.meta_learning_events to service_role;
grant maintain on table public.meta_learning_events to service_role;
grant references on table public.meta_learning_events to service_role;
grant select on table public.meta_learning_events to service_role;
grant trigger on table public.meta_learning_events to service_role;
grant truncate on table public.meta_learning_events to service_role;
grant update on table public.meta_learning_events to service_role;
grant delete on table public.native_push_tokens to anon;
grant insert on table public.native_push_tokens to anon;
grant maintain on table public.native_push_tokens to anon;
grant references on table public.native_push_tokens to anon;
grant select on table public.native_push_tokens to anon;
grant trigger on table public.native_push_tokens to anon;
grant truncate on table public.native_push_tokens to anon;
grant update on table public.native_push_tokens to anon;
grant delete on table public.native_push_tokens to authenticated;
grant insert on table public.native_push_tokens to authenticated;
grant maintain on table public.native_push_tokens to authenticated;
grant references on table public.native_push_tokens to authenticated;
grant select on table public.native_push_tokens to authenticated;
grant trigger on table public.native_push_tokens to authenticated;
grant truncate on table public.native_push_tokens to authenticated;
grant update on table public.native_push_tokens to authenticated;
grant delete on table public.native_push_tokens to service_role;
grant insert on table public.native_push_tokens to service_role;
grant maintain on table public.native_push_tokens to service_role;
grant references on table public.native_push_tokens to service_role;
grant select on table public.native_push_tokens to service_role;
grant trigger on table public.native_push_tokens to service_role;
grant truncate on table public.native_push_tokens to service_role;
grant update on table public.native_push_tokens to service_role;
grant delete on table public.newsletter_subscribers to anon;
grant maintain on table public.newsletter_subscribers to anon;
grant references on table public.newsletter_subscribers to anon;
grant select on table public.newsletter_subscribers to anon;
grant trigger on table public.newsletter_subscribers to anon;
grant truncate on table public.newsletter_subscribers to anon;
grant update on table public.newsletter_subscribers to anon;
grant delete on table public.newsletter_subscribers to authenticated;
grant insert on table public.newsletter_subscribers to authenticated;
grant maintain on table public.newsletter_subscribers to authenticated;
grant references on table public.newsletter_subscribers to authenticated;
grant select on table public.newsletter_subscribers to authenticated;
grant trigger on table public.newsletter_subscribers to authenticated;
grant truncate on table public.newsletter_subscribers to authenticated;
grant update on table public.newsletter_subscribers to authenticated;
grant delete on table public.newsletter_subscribers to service_role;
grant insert on table public.newsletter_subscribers to service_role;
grant maintain on table public.newsletter_subscribers to service_role;
grant references on table public.newsletter_subscribers to service_role;
grant select on table public.newsletter_subscribers to service_role;
grant trigger on table public.newsletter_subscribers to service_role;
grant truncate on table public.newsletter_subscribers to service_role;
grant update on table public.newsletter_subscribers to service_role;
grant delete on table public.order_items to anon;
grant maintain on table public.order_items to anon;
grant references on table public.order_items to anon;
grant select on table public.order_items to anon;
grant trigger on table public.order_items to anon;
grant truncate on table public.order_items to anon;
grant update on table public.order_items to anon;
grant delete on table public.order_items to authenticated;
grant maintain on table public.order_items to authenticated;
grant references on table public.order_items to authenticated;
grant select on table public.order_items to authenticated;
grant trigger on table public.order_items to authenticated;
grant truncate on table public.order_items to authenticated;
grant update on table public.order_items to authenticated;
grant delete on table public.order_items to service_role;
grant insert on table public.order_items to service_role;
grant maintain on table public.order_items to service_role;
grant references on table public.order_items to service_role;
grant select on table public.order_items to service_role;
grant trigger on table public.order_items to service_role;
grant truncate on table public.order_items to service_role;
grant update on table public.order_items to service_role;
grant delete on table public.orders to anon;
grant maintain on table public.orders to anon;
grant references on table public.orders to anon;
grant select on table public.orders to anon;
grant trigger on table public.orders to anon;
grant truncate on table public.orders to anon;
grant delete on table public.orders to authenticated;
grant maintain on table public.orders to authenticated;
grant references on table public.orders to authenticated;
grant select on table public.orders to authenticated;
grant trigger on table public.orders to authenticated;
grant truncate on table public.orders to authenticated;
grant delete on table public.orders to service_role;
grant insert on table public.orders to service_role;
grant maintain on table public.orders to service_role;
grant references on table public.orders to service_role;
grant select on table public.orders to service_role;
grant trigger on table public.orders to service_role;
grant truncate on table public.orders to service_role;
grant update on table public.orders to service_role;
grant delete on table public.partners to anon;
grant insert on table public.partners to anon;
grant maintain on table public.partners to anon;
grant references on table public.partners to anon;
grant select on table public.partners to anon;
grant trigger on table public.partners to anon;
grant truncate on table public.partners to anon;
grant update on table public.partners to anon;
grant delete on table public.partners to authenticated;
grant insert on table public.partners to authenticated;
grant maintain on table public.partners to authenticated;
grant references on table public.partners to authenticated;
grant select on table public.partners to authenticated;
grant trigger on table public.partners to authenticated;
grant truncate on table public.partners to authenticated;
grant update on table public.partners to authenticated;
grant delete on table public.partners to service_role;
grant insert on table public.partners to service_role;
grant maintain on table public.partners to service_role;
grant references on table public.partners to service_role;
grant select on table public.partners to service_role;
grant trigger on table public.partners to service_role;
grant truncate on table public.partners to service_role;
grant update on table public.partners to service_role;
grant delete on table public.payment_events to anon;
grant insert on table public.payment_events to anon;
grant maintain on table public.payment_events to anon;
grant references on table public.payment_events to anon;
grant select on table public.payment_events to anon;
grant trigger on table public.payment_events to anon;
grant truncate on table public.payment_events to anon;
grant update on table public.payment_events to anon;
grant delete on table public.payment_events to authenticated;
grant insert on table public.payment_events to authenticated;
grant maintain on table public.payment_events to authenticated;
grant references on table public.payment_events to authenticated;
grant select on table public.payment_events to authenticated;
grant trigger on table public.payment_events to authenticated;
grant truncate on table public.payment_events to authenticated;
grant update on table public.payment_events to authenticated;
grant delete on table public.payment_events to service_role;
grant insert on table public.payment_events to service_role;
grant maintain on table public.payment_events to service_role;
grant references on table public.payment_events to service_role;
grant select on table public.payment_events to service_role;
grant trigger on table public.payment_events to service_role;
grant truncate on table public.payment_events to service_role;
grant update on table public.payment_events to service_role;
grant delete on table public.payment_refund_queue to anon;
grant insert on table public.payment_refund_queue to anon;
grant maintain on table public.payment_refund_queue to anon;
grant references on table public.payment_refund_queue to anon;
grant select on table public.payment_refund_queue to anon;
grant trigger on table public.payment_refund_queue to anon;
grant truncate on table public.payment_refund_queue to anon;
grant update on table public.payment_refund_queue to anon;
grant delete on table public.payment_refund_queue to authenticated;
grant insert on table public.payment_refund_queue to authenticated;
grant maintain on table public.payment_refund_queue to authenticated;
grant references on table public.payment_refund_queue to authenticated;
grant select on table public.payment_refund_queue to authenticated;
grant trigger on table public.payment_refund_queue to authenticated;
grant truncate on table public.payment_refund_queue to authenticated;
grant update on table public.payment_refund_queue to authenticated;
grant delete on table public.payment_refund_queue to service_role;
grant insert on table public.payment_refund_queue to service_role;
grant maintain on table public.payment_refund_queue to service_role;
grant references on table public.payment_refund_queue to service_role;
grant select on table public.payment_refund_queue to service_role;
grant trigger on table public.payment_refund_queue to service_role;
grant truncate on table public.payment_refund_queue to service_role;
grant update on table public.payment_refund_queue to service_role;
grant delete on table public.photo_request_tokens to anon;
grant insert on table public.photo_request_tokens to anon;
grant maintain on table public.photo_request_tokens to anon;
grant references on table public.photo_request_tokens to anon;
grant select on table public.photo_request_tokens to anon;
grant trigger on table public.photo_request_tokens to anon;
grant truncate on table public.photo_request_tokens to anon;
grant update on table public.photo_request_tokens to anon;
grant delete on table public.photo_request_tokens to authenticated;
grant insert on table public.photo_request_tokens to authenticated;
grant maintain on table public.photo_request_tokens to authenticated;
grant references on table public.photo_request_tokens to authenticated;
grant select on table public.photo_request_tokens to authenticated;
grant trigger on table public.photo_request_tokens to authenticated;
grant truncate on table public.photo_request_tokens to authenticated;
grant update on table public.photo_request_tokens to authenticated;
grant delete on table public.photo_request_tokens to service_role;
grant insert on table public.photo_request_tokens to service_role;
grant maintain on table public.photo_request_tokens to service_role;
grant references on table public.photo_request_tokens to service_role;
grant select on table public.photo_request_tokens to service_role;
grant trigger on table public.photo_request_tokens to service_role;
grant truncate on table public.photo_request_tokens to service_role;
grant update on table public.photo_request_tokens to service_role;
grant delete on table public.point_ledger to anon;
grant insert on table public.point_ledger to anon;
grant maintain on table public.point_ledger to anon;
grant references on table public.point_ledger to anon;
grant select on table public.point_ledger to anon;
grant trigger on table public.point_ledger to anon;
grant truncate on table public.point_ledger to anon;
grant update on table public.point_ledger to anon;
grant delete on table public.point_ledger to authenticated;
grant insert on table public.point_ledger to authenticated;
grant maintain on table public.point_ledger to authenticated;
grant references on table public.point_ledger to authenticated;
grant select on table public.point_ledger to authenticated;
grant trigger on table public.point_ledger to authenticated;
grant truncate on table public.point_ledger to authenticated;
grant update on table public.point_ledger to authenticated;
grant delete on table public.point_ledger to service_role;
grant insert on table public.point_ledger to service_role;
grant maintain on table public.point_ledger to service_role;
grant references on table public.point_ledger to service_role;
grant select on table public.point_ledger to service_role;
grant trigger on table public.point_ledger to service_role;
grant truncate on table public.point_ledger to service_role;
grant update on table public.point_ledger to service_role;
grant delete on table public.product_qna to anon;
grant insert on table public.product_qna to anon;
grant maintain on table public.product_qna to anon;
grant references on table public.product_qna to anon;
grant select on table public.product_qna to anon;
grant trigger on table public.product_qna to anon;
grant truncate on table public.product_qna to anon;
grant update on table public.product_qna to anon;
grant delete on table public.product_qna to authenticated;
grant insert on table public.product_qna to authenticated;
grant maintain on table public.product_qna to authenticated;
grant references on table public.product_qna to authenticated;
grant select on table public.product_qna to authenticated;
grant trigger on table public.product_qna to authenticated;
grant truncate on table public.product_qna to authenticated;
grant update on table public.product_qna to authenticated;
grant delete on table public.product_qna to service_role;
grant insert on table public.product_qna to service_role;
grant maintain on table public.product_qna to service_role;
grant references on table public.product_qna to service_role;
grant select on table public.product_qna to service_role;
grant trigger on table public.product_qna to service_role;
grant truncate on table public.product_qna to service_role;
grant update on table public.product_qna to service_role;
grant delete on table public.products to anon;
grant insert on table public.products to anon;
grant maintain on table public.products to anon;
grant references on table public.products to anon;
grant select on table public.products to anon;
grant trigger on table public.products to anon;
grant truncate on table public.products to anon;
grant update on table public.products to anon;
grant delete on table public.products to authenticated;
grant insert on table public.products to authenticated;
grant maintain on table public.products to authenticated;
grant references on table public.products to authenticated;
grant select on table public.products to authenticated;
grant trigger on table public.products to authenticated;
grant truncate on table public.products to authenticated;
grant update on table public.products to authenticated;
grant delete on table public.products to service_role;
grant insert on table public.products to service_role;
grant maintain on table public.products to service_role;
grant references on table public.products to service_role;
grant select on table public.products to service_role;
grant trigger on table public.products to service_role;
grant truncate on table public.products to service_role;
grant update on table public.products to service_role;
grant delete on table public.profiles to anon;
grant insert on table public.profiles to anon;
grant maintain on table public.profiles to anon;
grant references on table public.profiles to anon;
grant select on table public.profiles to anon;
grant trigger on table public.profiles to anon;
grant truncate on table public.profiles to anon;
grant delete on table public.profiles to authenticated;
grant insert on table public.profiles to authenticated;
grant maintain on table public.profiles to authenticated;
grant references on table public.profiles to authenticated;
grant select on table public.profiles to authenticated;
grant trigger on table public.profiles to authenticated;
grant truncate on table public.profiles to authenticated;
grant delete on table public.profiles to service_role;
grant insert on table public.profiles to service_role;
grant maintain on table public.profiles to service_role;
grant references on table public.profiles to service_role;
grant select on table public.profiles to service_role;
grant trigger on table public.profiles to service_role;
grant truncate on table public.profiles to service_role;
grant update on table public.profiles to service_role;
grant delete on table public.promotion_claims to anon;
grant insert on table public.promotion_claims to anon;
grant maintain on table public.promotion_claims to anon;
grant references on table public.promotion_claims to anon;
grant select on table public.promotion_claims to anon;
grant trigger on table public.promotion_claims to anon;
grant truncate on table public.promotion_claims to anon;
grant update on table public.promotion_claims to anon;
grant delete on table public.promotion_claims to authenticated;
grant insert on table public.promotion_claims to authenticated;
grant maintain on table public.promotion_claims to authenticated;
grant references on table public.promotion_claims to authenticated;
grant select on table public.promotion_claims to authenticated;
grant trigger on table public.promotion_claims to authenticated;
grant truncate on table public.promotion_claims to authenticated;
grant update on table public.promotion_claims to authenticated;
grant delete on table public.promotion_claims to service_role;
grant insert on table public.promotion_claims to service_role;
grant maintain on table public.promotion_claims to service_role;
grant references on table public.promotion_claims to service_role;
grant select on table public.promotion_claims to service_role;
grant trigger on table public.promotion_claims to service_role;
grant truncate on table public.promotion_claims to service_role;
grant update on table public.promotion_claims to service_role;
grant delete on table public.promotions to anon;
grant insert on table public.promotions to anon;
grant maintain on table public.promotions to anon;
grant references on table public.promotions to anon;
grant select on table public.promotions to anon;
grant trigger on table public.promotions to anon;
grant truncate on table public.promotions to anon;
grant update on table public.promotions to anon;
grant delete on table public.promotions to authenticated;
grant insert on table public.promotions to authenticated;
grant maintain on table public.promotions to authenticated;
grant references on table public.promotions to authenticated;
grant select on table public.promotions to authenticated;
grant trigger on table public.promotions to authenticated;
grant truncate on table public.promotions to authenticated;
grant update on table public.promotions to authenticated;
grant delete on table public.promotions to service_role;
grant insert on table public.promotions to service_role;
grant maintain on table public.promotions to service_role;
grant references on table public.promotions to service_role;
grant select on table public.promotions to service_role;
grant trigger on table public.promotions to service_role;
grant truncate on table public.promotions to service_role;
grant update on table public.promotions to service_role;
grant delete on table public.push_campaigns to anon;
grant insert on table public.push_campaigns to anon;
grant maintain on table public.push_campaigns to anon;
grant references on table public.push_campaigns to anon;
grant select on table public.push_campaigns to anon;
grant trigger on table public.push_campaigns to anon;
grant truncate on table public.push_campaigns to anon;
grant update on table public.push_campaigns to anon;
grant delete on table public.push_campaigns to authenticated;
grant insert on table public.push_campaigns to authenticated;
grant maintain on table public.push_campaigns to authenticated;
grant references on table public.push_campaigns to authenticated;
grant select on table public.push_campaigns to authenticated;
grant trigger on table public.push_campaigns to authenticated;
grant truncate on table public.push_campaigns to authenticated;
grant update on table public.push_campaigns to authenticated;
grant delete on table public.push_campaigns to service_role;
grant insert on table public.push_campaigns to service_role;
grant maintain on table public.push_campaigns to service_role;
grant references on table public.push_campaigns to service_role;
grant select on table public.push_campaigns to service_role;
grant trigger on table public.push_campaigns to service_role;
grant truncate on table public.push_campaigns to service_role;
grant update on table public.push_campaigns to service_role;
grant delete on table public.push_log to anon;
grant insert on table public.push_log to anon;
grant maintain on table public.push_log to anon;
grant references on table public.push_log to anon;
grant select on table public.push_log to anon;
grant trigger on table public.push_log to anon;
grant truncate on table public.push_log to anon;
grant update on table public.push_log to anon;
grant delete on table public.push_log to authenticated;
grant insert on table public.push_log to authenticated;
grant maintain on table public.push_log to authenticated;
grant references on table public.push_log to authenticated;
grant select on table public.push_log to authenticated;
grant trigger on table public.push_log to authenticated;
grant truncate on table public.push_log to authenticated;
grant update on table public.push_log to authenticated;
grant delete on table public.push_log to service_role;
grant insert on table public.push_log to service_role;
grant maintain on table public.push_log to service_role;
grant references on table public.push_log to service_role;
grant select on table public.push_log to service_role;
grant trigger on table public.push_log to service_role;
grant truncate on table public.push_log to service_role;
grant update on table public.push_log to service_role;
grant delete on table public.push_preferences to anon;
grant insert on table public.push_preferences to anon;
grant maintain on table public.push_preferences to anon;
grant references on table public.push_preferences to anon;
grant select on table public.push_preferences to anon;
grant trigger on table public.push_preferences to anon;
grant truncate on table public.push_preferences to anon;
grant update on table public.push_preferences to anon;
grant delete on table public.push_preferences to authenticated;
grant insert on table public.push_preferences to authenticated;
grant maintain on table public.push_preferences to authenticated;
grant references on table public.push_preferences to authenticated;
grant select on table public.push_preferences to authenticated;
grant trigger on table public.push_preferences to authenticated;
grant truncate on table public.push_preferences to authenticated;
grant update on table public.push_preferences to authenticated;
grant delete on table public.push_preferences to service_role;
grant insert on table public.push_preferences to service_role;
grant maintain on table public.push_preferences to service_role;
grant references on table public.push_preferences to service_role;
grant select on table public.push_preferences to service_role;
grant trigger on table public.push_preferences to service_role;
grant truncate on table public.push_preferences to service_role;
grant update on table public.push_preferences to service_role;
grant delete on table public.push_subscriptions to anon;
grant insert on table public.push_subscriptions to anon;
grant maintain on table public.push_subscriptions to anon;
grant references on table public.push_subscriptions to anon;
grant select on table public.push_subscriptions to anon;
grant trigger on table public.push_subscriptions to anon;
grant truncate on table public.push_subscriptions to anon;
grant update on table public.push_subscriptions to anon;
grant delete on table public.push_subscriptions to authenticated;
grant insert on table public.push_subscriptions to authenticated;
grant maintain on table public.push_subscriptions to authenticated;
grant references on table public.push_subscriptions to authenticated;
grant select on table public.push_subscriptions to authenticated;
grant trigger on table public.push_subscriptions to authenticated;
grant truncate on table public.push_subscriptions to authenticated;
grant update on table public.push_subscriptions to authenticated;
grant delete on table public.push_subscriptions to service_role;
grant insert on table public.push_subscriptions to service_role;
grant maintain on table public.push_subscriptions to service_role;
grant references on table public.push_subscriptions to service_role;
grant select on table public.push_subscriptions to service_role;
grant trigger on table public.push_subscriptions to service_role;
grant truncate on table public.push_subscriptions to service_role;
grant update on table public.push_subscriptions to service_role;
grant delete on table public.rate_limit_counters to anon;
grant insert on table public.rate_limit_counters to anon;
grant maintain on table public.rate_limit_counters to anon;
grant references on table public.rate_limit_counters to anon;
grant select on table public.rate_limit_counters to anon;
grant trigger on table public.rate_limit_counters to anon;
grant truncate on table public.rate_limit_counters to anon;
grant update on table public.rate_limit_counters to anon;
grant delete on table public.rate_limit_counters to authenticated;
grant insert on table public.rate_limit_counters to authenticated;
grant maintain on table public.rate_limit_counters to authenticated;
grant references on table public.rate_limit_counters to authenticated;
grant select on table public.rate_limit_counters to authenticated;
grant trigger on table public.rate_limit_counters to authenticated;
grant truncate on table public.rate_limit_counters to authenticated;
grant update on table public.rate_limit_counters to authenticated;
grant delete on table public.rate_limit_counters to service_role;
grant insert on table public.rate_limit_counters to service_role;
grant maintain on table public.rate_limit_counters to service_role;
grant references on table public.rate_limit_counters to service_role;
grant select on table public.rate_limit_counters to service_role;
grant trigger on table public.rate_limit_counters to service_role;
grant truncate on table public.rate_limit_counters to service_role;
grant update on table public.rate_limit_counters to service_role;
grant delete on table public.refunds to anon;
grant insert on table public.refunds to anon;
grant maintain on table public.refunds to anon;
grant references on table public.refunds to anon;
grant select on table public.refunds to anon;
grant trigger on table public.refunds to anon;
grant truncate on table public.refunds to anon;
grant update on table public.refunds to anon;
grant delete on table public.refunds to authenticated;
grant insert on table public.refunds to authenticated;
grant maintain on table public.refunds to authenticated;
grant references on table public.refunds to authenticated;
grant select on table public.refunds to authenticated;
grant trigger on table public.refunds to authenticated;
grant truncate on table public.refunds to authenticated;
grant update on table public.refunds to authenticated;
grant delete on table public.refunds to service_role;
grant insert on table public.refunds to service_role;
grant maintain on table public.refunds to service_role;
grant references on table public.refunds to service_role;
grant select on table public.refunds to service_role;
grant trigger on table public.refunds to service_role;
grant truncate on table public.refunds to service_role;
grant update on table public.refunds to service_role;
grant delete on table public.reweighs to anon;
grant insert on table public.reweighs to anon;
grant maintain on table public.reweighs to anon;
grant references on table public.reweighs to anon;
grant select on table public.reweighs to anon;
grant trigger on table public.reweighs to anon;
grant truncate on table public.reweighs to anon;
grant update on table public.reweighs to anon;
grant delete on table public.reweighs to authenticated;
grant insert on table public.reweighs to authenticated;
grant maintain on table public.reweighs to authenticated;
grant references on table public.reweighs to authenticated;
grant select on table public.reweighs to authenticated;
grant trigger on table public.reweighs to authenticated;
grant truncate on table public.reweighs to authenticated;
grant update on table public.reweighs to authenticated;
grant delete on table public.reweighs to service_role;
grant insert on table public.reweighs to service_role;
grant maintain on table public.reweighs to service_role;
grant references on table public.reweighs to service_role;
grant select on table public.reweighs to service_role;
grant trigger on table public.reweighs to service_role;
grant truncate on table public.reweighs to service_role;
grant update on table public.reweighs to service_role;
grant delete on table public.source_waitlist to anon;
grant insert on table public.source_waitlist to anon;
grant maintain on table public.source_waitlist to anon;
grant references on table public.source_waitlist to anon;
grant select on table public.source_waitlist to anon;
grant trigger on table public.source_waitlist to anon;
grant truncate on table public.source_waitlist to anon;
grant update on table public.source_waitlist to anon;
grant delete on table public.source_waitlist to authenticated;
grant insert on table public.source_waitlist to authenticated;
grant maintain on table public.source_waitlist to authenticated;
grant references on table public.source_waitlist to authenticated;
grant select on table public.source_waitlist to authenticated;
grant trigger on table public.source_waitlist to authenticated;
grant truncate on table public.source_waitlist to authenticated;
grant update on table public.source_waitlist to authenticated;
grant delete on table public.source_waitlist to service_role;
grant insert on table public.source_waitlist to service_role;
grant maintain on table public.source_waitlist to service_role;
grant references on table public.source_waitlist to service_role;
grant select on table public.source_waitlist to service_role;
grant trigger on table public.source_waitlist to service_role;
grant truncate on table public.source_waitlist to service_role;
grant update on table public.source_waitlist to service_role;
grant delete on table public.stamps to anon;
grant insert on table public.stamps to anon;
grant maintain on table public.stamps to anon;
grant references on table public.stamps to anon;
grant select on table public.stamps to anon;
grant trigger on table public.stamps to anon;
grant truncate on table public.stamps to anon;
grant update on table public.stamps to anon;
grant delete on table public.stamps to authenticated;
grant insert on table public.stamps to authenticated;
grant maintain on table public.stamps to authenticated;
grant references on table public.stamps to authenticated;
grant select on table public.stamps to authenticated;
grant trigger on table public.stamps to authenticated;
grant truncate on table public.stamps to authenticated;
grant update on table public.stamps to authenticated;
grant delete on table public.stamps to service_role;
grant insert on table public.stamps to service_role;
grant maintain on table public.stamps to service_role;
grant references on table public.stamps to service_role;
grant select on table public.stamps to service_role;
grant trigger on table public.stamps to service_role;
grant truncate on table public.stamps to service_role;
grant update on table public.stamps to service_role;
grant delete on table public.subscription_charges to anon;
grant insert on table public.subscription_charges to anon;
grant maintain on table public.subscription_charges to anon;
grant references on table public.subscription_charges to anon;
grant select on table public.subscription_charges to anon;
grant trigger on table public.subscription_charges to anon;
grant truncate on table public.subscription_charges to anon;
grant update on table public.subscription_charges to anon;
grant delete on table public.subscription_charges to authenticated;
grant insert on table public.subscription_charges to authenticated;
grant maintain on table public.subscription_charges to authenticated;
grant references on table public.subscription_charges to authenticated;
grant select on table public.subscription_charges to authenticated;
grant trigger on table public.subscription_charges to authenticated;
grant truncate on table public.subscription_charges to authenticated;
grant update on table public.subscription_charges to authenticated;
grant delete on table public.subscription_charges to service_role;
grant insert on table public.subscription_charges to service_role;
grant maintain on table public.subscription_charges to service_role;
grant references on table public.subscription_charges to service_role;
grant select on table public.subscription_charges to service_role;
grant trigger on table public.subscription_charges to service_role;
grant truncate on table public.subscription_charges to service_role;
grant update on table public.subscription_charges to service_role;
grant maintain on table public.subscription_items to anon;
grant references on table public.subscription_items to anon;
grant select on table public.subscription_items to anon;
grant trigger on table public.subscription_items to anon;
grant truncate on table public.subscription_items to anon;
grant maintain on table public.subscription_items to authenticated;
grant references on table public.subscription_items to authenticated;
grant select on table public.subscription_items to authenticated;
grant trigger on table public.subscription_items to authenticated;
grant truncate on table public.subscription_items to authenticated;
grant delete on table public.subscription_items to service_role;
grant insert on table public.subscription_items to service_role;
grant maintain on table public.subscription_items to service_role;
grant references on table public.subscription_items to service_role;
grant select on table public.subscription_items to service_role;
grant trigger on table public.subscription_items to service_role;
grant truncate on table public.subscription_items to service_role;
grant update on table public.subscription_items to service_role;
grant delete on table public.subscriptions to anon;
grant maintain on table public.subscriptions to anon;
grant references on table public.subscriptions to anon;
grant select on table public.subscriptions to anon;
grant trigger on table public.subscriptions to anon;
grant truncate on table public.subscriptions to anon;
grant delete on table public.subscriptions to authenticated;
grant maintain on table public.subscriptions to authenticated;
grant references on table public.subscriptions to authenticated;
grant select on table public.subscriptions to authenticated;
grant trigger on table public.subscriptions to authenticated;
grant truncate on table public.subscriptions to authenticated;
grant delete on table public.subscriptions to service_role;
grant insert on table public.subscriptions to service_role;
grant maintain on table public.subscriptions to service_role;
grant references on table public.subscriptions to service_role;
grant select on table public.subscriptions to service_role;
grant trigger on table public.subscriptions to service_role;
grant truncate on table public.subscriptions to service_role;
grant update on table public.subscriptions to service_role;
grant delete on table public.surveys to anon;
grant insert on table public.surveys to anon;
grant maintain on table public.surveys to anon;
grant references on table public.surveys to anon;
grant select on table public.surveys to anon;
grant trigger on table public.surveys to anon;
grant truncate on table public.surveys to anon;
grant update on table public.surveys to anon;
grant delete on table public.surveys to authenticated;
grant insert on table public.surveys to authenticated;
grant maintain on table public.surveys to authenticated;
grant references on table public.surveys to authenticated;
grant select on table public.surveys to authenticated;
grant trigger on table public.surveys to authenticated;
grant truncate on table public.surveys to authenticated;
grant update on table public.surveys to authenticated;
grant delete on table public.surveys to service_role;
grant insert on table public.surveys to service_role;
grant maintain on table public.surveys to service_role;
grant references on table public.surveys to service_role;
grant select on table public.surveys to service_role;
grant trigger on table public.surveys to service_role;
grant truncate on table public.surveys to service_role;
grant update on table public.surveys to service_role;
grant delete on table public.user_integrations to anon;
grant insert on table public.user_integrations to anon;
grant maintain on table public.user_integrations to anon;
grant references on table public.user_integrations to anon;
grant select on table public.user_integrations to anon;
grant trigger on table public.user_integrations to anon;
grant truncate on table public.user_integrations to anon;
grant update on table public.user_integrations to anon;
grant delete on table public.user_integrations to authenticated;
grant insert on table public.user_integrations to authenticated;
grant maintain on table public.user_integrations to authenticated;
grant references on table public.user_integrations to authenticated;
grant select on table public.user_integrations to authenticated;
grant trigger on table public.user_integrations to authenticated;
grant truncate on table public.user_integrations to authenticated;
grant update on table public.user_integrations to authenticated;
grant delete on table public.user_integrations to service_role;
grant insert on table public.user_integrations to service_role;
grant maintain on table public.user_integrations to service_role;
grant references on table public.user_integrations to service_role;
grant select on table public.user_integrations to service_role;
grant trigger on table public.user_integrations to service_role;
grant truncate on table public.user_integrations to service_role;
grant update on table public.user_integrations to service_role;
grant delete on table public.vet_share_tokens to anon;
grant insert on table public.vet_share_tokens to anon;
grant maintain on table public.vet_share_tokens to anon;
grant references on table public.vet_share_tokens to anon;
grant select on table public.vet_share_tokens to anon;
grant trigger on table public.vet_share_tokens to anon;
grant truncate on table public.vet_share_tokens to anon;
grant update on table public.vet_share_tokens to anon;
grant delete on table public.vet_share_tokens to authenticated;
grant insert on table public.vet_share_tokens to authenticated;
grant maintain on table public.vet_share_tokens to authenticated;
grant references on table public.vet_share_tokens to authenticated;
grant select on table public.vet_share_tokens to authenticated;
grant trigger on table public.vet_share_tokens to authenticated;
grant truncate on table public.vet_share_tokens to authenticated;
grant update on table public.vet_share_tokens to authenticated;
grant delete on table public.vet_share_tokens to service_role;
grant insert on table public.vet_share_tokens to service_role;
grant maintain on table public.vet_share_tokens to service_role;
grant references on table public.vet_share_tokens to service_role;
grant select on table public.vet_share_tokens to service_role;
grant trigger on table public.vet_share_tokens to service_role;
grant truncate on table public.vet_share_tokens to service_role;
grant update on table public.vet_share_tokens to service_role;
grant delete on table public.webhook_events to anon;
grant insert on table public.webhook_events to anon;
grant maintain on table public.webhook_events to anon;
grant references on table public.webhook_events to anon;
grant select on table public.webhook_events to anon;
grant trigger on table public.webhook_events to anon;
grant truncate on table public.webhook_events to anon;
grant update on table public.webhook_events to anon;
grant delete on table public.webhook_events to authenticated;
grant insert on table public.webhook_events to authenticated;
grant maintain on table public.webhook_events to authenticated;
grant references on table public.webhook_events to authenticated;
grant select on table public.webhook_events to authenticated;
grant trigger on table public.webhook_events to authenticated;
grant truncate on table public.webhook_events to authenticated;
grant update on table public.webhook_events to authenticated;
grant delete on table public.webhook_events to service_role;
grant insert on table public.webhook_events to service_role;
grant maintain on table public.webhook_events to service_role;
grant references on table public.webhook_events to service_role;
grant select on table public.webhook_events to service_role;
grant trigger on table public.webhook_events to service_role;
grant truncate on table public.webhook_events to service_role;
grant update on table public.webhook_events to service_role;
grant delete on table public.weight_logs to anon;
grant insert on table public.weight_logs to anon;
grant maintain on table public.weight_logs to anon;
grant references on table public.weight_logs to anon;
grant select on table public.weight_logs to anon;
grant trigger on table public.weight_logs to anon;
grant truncate on table public.weight_logs to anon;
grant update on table public.weight_logs to anon;
grant delete on table public.weight_logs to authenticated;
grant insert on table public.weight_logs to authenticated;
grant maintain on table public.weight_logs to authenticated;
grant references on table public.weight_logs to authenticated;
grant select on table public.weight_logs to authenticated;
grant trigger on table public.weight_logs to authenticated;
grant truncate on table public.weight_logs to authenticated;
grant update on table public.weight_logs to authenticated;
grant delete on table public.weight_logs to service_role;
grant insert on table public.weight_logs to service_role;
grant maintain on table public.weight_logs to service_role;
grant references on table public.weight_logs to service_role;
grant select on table public.weight_logs to service_role;
grant trigger on table public.weight_logs to service_role;
grant truncate on table public.weight_logs to service_role;
grant update on table public.weight_logs to service_role;

-- ===== column-level grants (whitelist) =====
grant update (read_at) on table public.cs_messages to authenticated;
grant update (name, phone, zip, address, address_detail, agree_sms, agree_email, birth_year, agree_email_at, agree_sms_at, marketing_policy_version, birth_month, birth_day, onboarded_at) on table public.profiles to authenticated;
grant update (status, next_delivery_date, reminder_enabled, last_failed_charge_reason) on table public.subscriptions to authenticated;

-- ===== storage buckets =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('blog-covers', 'blog-covers', t, 8388608, '{image/jpeg,image/png,image/webp,image/gif,image/avif}'::text[]) on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('dog_checkin_photos', 'dog_checkin_photos', f, 5242880, '{image/jpeg,image/png,image/webp}'::text[]) on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('dog-avatars', 'dog-avatars', t, 3145728, '{image/jpeg,image/png,image/webp,image/gif}'::text[]) on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('dog-diary-photos', 'dog-diary-photos', f, 5242880, '{image/jpeg,image/png,image/webp,image/heic,image/heif}'::text[]) on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('event-images', 'event-images', t, 8388608, '{image/jpeg,image/png,image/webp,image/gif,image/avif}'::text[]) on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('medical-records-images', 'medical-records-images', f, 10485760, '{image/jpeg,image/png,image/webp}'::text[]) on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('products', 'products', t, 8388608, '{image/*}'::text[]) on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('review-photos', 'review-photos', f, 5242880, '{image/jpeg,image/png,image/webp,image/gif}'::text[]) on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
