// ─── Email Types ────────────────────────────────────────────────────────────

export type EmailCategory =
  | 'urgent'
  | 'needs_response'
  | 'follow_up'
  | 'fyi'
  | 'newsletter'
  | 'spam'
  | 'other';

export type PriorityLevel = 'high' | 'medium' | 'low';

export interface AIAnalysis {
  category: EmailCategory;
  priority_score: number; // 1-10
  priority_level: PriorityLevel;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number; // 0-1
  key_topics: string[];
  action_required: boolean;
  processed_at: string;
  is_phishing?: boolean;
  phishing_indicators?: string[];
  is_invoice?: boolean;
  invoice_amount?: string | null;
  invoice_due_date?: string | null;
  invoice_vendor?: string | null;
}

export interface Email {
  id: string;
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  subject: string;
  from_email: string;
  from_name: string;
  to_email: string;
  snippet: string;
  body_text: string;
  body_html?: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  snooze_until?: string | null;
  labels: string[];
  processed?: boolean;
  ai_analysis?: AIAnalysis;
  action_count?: number;
  created_at: string;
  updated_at: string;
}

export interface EmailStats {
  total_emails: number;
  urgent_count: number;
  needs_response_count: number;
  action_items_count: number;
  processed_today: number;
  avg_priority_score: number;
  category_breakdown: Record<EmailCategory, number>;
  emails_this_week: number;
  emails_last_week: number;
}

export interface PriorityInbox {
  urgent: Email[];
  needs_response: Email[];
  follow_up: Email[];
  low_priority: Email[];
}

// ─── Action Types ────────────────────────────────────────────────────────────

export type ActionStatus = 'pending' | 'completed' | 'dismissed';
export type ActionPriority = 'high' | 'medium' | 'low';

export interface Action {
  id: string;
  user_id?: string;
  email_id?: string;
  email?: Email;
  emails?: { subject?: string; user_id?: string };
  // Backend uses 'task'; frontend legacy used 'description'
  task: string;
  description?: string;
  action_type?: 'reply' | 'task' | 'meeting' | 'payment' | 'review' | 'other';
  priority: ActionPriority;
  status: ActionStatus;
  deadline?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
}

// ─── Reply Types ─────────────────────────────────────────────────────────────

export interface ReplyDraft {
  id: string;
  user_id: string;
  email_id: string;
  draft_content: string;
  tone: 'professional' | 'friendly' | 'concise';
  confidence_score: number; // 0-1
  is_sent: boolean;
  sent_at?: string;
  created_at: string;
  updated_at: string;
  voice_match_score?: number | null;
  voice_match_trend?: 'improving' | 'declining' | 'steady' | 'new';
}

// ─── User / Profile Types ─────────────────────────────────────────────────────

export type TonePreference = 'professional' | 'friendly' | 'concise';
export type NotificationFrequency = 'instant' | 'hourly' | 'daily' | 'never';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  company_name?: string;
  created_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  company_description: string;
  tone_preference: TonePreference;
  email_notifications: boolean;
  slack_notifications: boolean;
  notification_frequency: NotificationFrequency;
  auto_process_emails: boolean;
  priority_threshold: number;
  digest_enabled?: boolean;
  digest_frequency?: 'daily' | 'weekly';
  slack_webhook_url?: string;
  vacation_mode?: boolean;
  vacation_message?: string;
  email_signature?: string;
  // Gmail selective sync filters
  sync_labels?: string[] | null;
  sync_max_emails?: number | null;
  sync_days_back?: number | null;
  sync_sender_allowlist?: string[] | null;
  sync_sender_blocklist?: string[] | null;
  badge_enabled?: boolean;
  industry?: string | null;
  benchmark_opt_in?: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Integration Types ────────────────────────────────────────────────────────

export interface GmailStatus {
  connected: boolean;
  email?: string;
  last_sync?: string;
  total_synced?: number | null;
  auth_url?: string;
}

export interface SlackStatus {
  connected: boolean;
  webhook_url?: string;
  channel?: string;
  last_notified?: string;
}

export interface IntegrationStatus {
  gmail: GmailStatus;
  slack: SlackStatus;
}

// ─── Billing / Plan Types ─────────────────────────────────────────────────────

export type PlanId = 'free' | 'pro' | 'agency';

export interface Plan {
  id: PlanId;
  name: string;
  price_monthly: number;
  price_yearly?: number;
  email_limit: number | null; // null = unlimited
  gmail_accounts: number;
  features: string[];
}

export interface BillingStatus {
  current_plan: PlanId;
  plan_details: Plan;
  subscription_status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  emails_used_this_month: number;
  email_limit: number | null;
  subscription_id?: string;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface ApiError {
  detail: string;
  code?: string;
}

// ─── Filter / Query Types ─────────────────────────────────────────────────────

export interface EmailFilters {
  category?: EmailCategory;
  priority_level?: PriorityLevel;
  is_read?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: 'received_at' | 'priority_score';
  sort_order?: 'asc' | 'desc';
}

export interface ActionFilters {
  status?: ActionStatus;
  priority?: ActionPriority;
  email_id?: string;
}

// ─── CRM Types ────────────────────────────────────────────────────────────────

export interface ContactProfile {
  email: string;
  name: string;
  total_emails: number;
  last_email_at: string;
  categories: Record<string, number>;
  top_category: string;
  avg_priority: number;
  recent_subjects: string[];
}

export interface ClientTouchpoint {
  id: string;
  contact_email: string;
  contact_name: string | null;
  channel: 'call' | 'sms' | 'whatsapp' | 'meeting' | 'other';
  direction: 'inbound' | 'outbound';
  summary: string | null;
  duration_minutes: number | null;
  occurred_at: string;
  created_at: string;
}

export interface ContactDetail extends ContactProfile {
  replied_count: number;
  first_email_at: string;
  emails: Array<{
    id: string;
    subject: string;
    category: string | null;
    priority: number | null;
    received_at: string;
    ai_summary: string | null;
    is_read: boolean;
  }>;
  touchpoints: ClientTouchpoint[];
}

// ─── Quote / Proposal Types ───────────────────────────────────────────────────

export interface QuoteData {
  project_title: string;
  project_description: string;
  deliverables: string[];
  timeline: string;
  price_estimate: string;
  payment_terms: string;
  validity: string;
  notes?: string;
}

// ─── Team / Org Types ─────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  plan: string;
  slug: string;
  created_at: string;
}

export type OrgRole = 'owner' | 'admin' | 'member';

export interface OrgMember {
  id: string;
  org_id: string;
  user_id?: string;
  role: OrgRole;
  status: 'active' | 'pending' | 'removed';
  invited_email?: string;
  invite_token?: string;
  created_at: string;
  user_profiles?: { id: string; name: string; email: string };
}

export interface EmailAssignment {
  id: string;
  email_id: string;
  org_id: string;
  assigned_to?: string;
  assigned_by?: string;
  created_at: string;
  user_profiles?: { id: string; name: string; email: string };
}

export interface InternalNote {
  id: string;
  email_id: string;
  org_id: string;
  user_id: string;
  note: string;
  created_at: string;
  user_profiles?: { id: string; name: string; email: string };
}

export interface ActivityLogEntry {
  id: string;
  org_id: string;
  user_id?: string;
  actor_name?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface AdminStats {
  member_count: number;
  pending_invites: number;
  total_emails: number;
  emails_today: number;
  recent_activity: ActivityLogEntry[];
}

// ─── Calendar Types ───────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  status?: string;
}

// ─── Meeting Detection Types ──────────────────────────────────────────────────

export interface MeetingInfo {
  is_meeting_request: boolean;
  meeting_type: string | null;
  proposed_times: string[];
  duration_hint: string | null;
  agenda: string | null;
  suggested_reply_snippet: string | null;
}

// ─── Health Score Types ───────────────────────────────────────────────────────

export interface InboxHealthScore {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    read_score: number;
    processed_score: number;
    noise_score: number;
    urgent_unread: number;
    overdue_actions: number;
    total_emails_week: number;
    unread_count: number;
  };
  tips: string[];
}

// ─── Scheduled Send Types ─────────────────────────────────────────────────────

export interface ScheduledSend {
  id: string;
  user_id: string;
  to_email: string;
  subject: string;
  body: string;
  send_at: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at?: string | null;
  error?: string | null;
  created_at: string;
}

// ─── AI Search Types ──────────────────────────────────────────────────────────

export interface AISearchResult {
  items: Email[];
  total: number;
  page: number;
  page_size: number;
  parsed_query: Record<string, unknown>;
  original_query: string;
}

// ─── Relationship Types ───────────────────────────────────────────────────────
export interface RelationshipContact {
  contact_email: string;
  contact_name: string;
  health_score: number;
  health_label: 'excellent' | 'good' | 'fair' | 'at_risk';
  days_since_last_email: number;
  emails_30d: number;
  emails_90d: number;
  touchpoints_30d?: number;
  trend: 'growing' | 'stable' | 'declining' | 'new';
  last_email_at: string;
  alert: boolean;
  alert_message: string | null;
}

export interface Benchmark {
  industry: string | null;
  cohort_size: number;
  median_response_time: string | null;
  median_response_hours: number | null;
  fastest_quartile_hours?: number | null;
  message: string | null;
}

export interface EmailDebt {
  email_id: string;
  contact_email: string;
  contact_name: string;
  subject: string;
  category: string | null;
  days_owed: number;
  received_at: string;
}

export interface SentimentPoint {
  week: string;
  email_count: number;
  sentiment_score: number;
  avg_priority: number;
}

// ─── Revenue Types ────────────────────────────────────────────────────────────
export interface RevenueSignal {
  id: string;
  email_id: string;
  signal_type: 'quote' | 'invoice' | 'unpaid' | 'renewal' | 'upsell' | 'opportunity' | 'contract';
  description: string;
  amount: number | null;
  currency: string;
  due_date: string | null;
  urgency: 'high' | 'medium' | 'low';
  action_needed: string;
  status: 'open' | 'won' | 'lost' | 'dismissed';
  sender: string;
  subject: string;
  created_at: string;
}

export interface RevenueSummary {
  total_signals: number;
  total_pipeline_value: number;
  by_type: Record<string, number>;
  high_urgency_count: number;
  high_urgency: RevenueSignal[];
  signals: RevenueSignal[];
}

export interface RevenueAtRisk {
  contact_email: string;
  contact_name: string;
  total_amount: number;
  currency: string;
  signal_count: number;
  signal_types: string[];
  health_score: number;
  health_label: 'excellent' | 'good' | 'fair' | 'at_risk';
  trend: 'growing' | 'stable' | 'declining' | 'new';
  days_since_last_email: number;
}

export interface VoiceMatchSummary {
  score: number | null;
  trend: 'improving' | 'declining' | 'steady' | 'new';
  samples: number;
  history: { sent_at: string; score: number }[];
  message: string | null;
}

// ─── SLA Types ────────────────────────────────────────────────────────────────
export interface SLAConfig {
  id: string;
  tier_name: string;
  max_response_hours: number;
  sender_patterns: string[];
}

export interface SLAEmailEntry {
  id: string;
  sender: string;
  subject: string;
  received_at: string;
  sla_tier: string;
  max_response_hours: number;
  age_hours: number;
  pct_used: number;
}

export interface SLAStatus {
  breached: SLAEmailEntry[];
  warning: SLAEmailEntry[];
  ok: SLAEmailEntry[];
  configs: SLAConfig[];
  total_monitored: number;
}

// ─── Sequence Types ───────────────────────────────────────────────────────────
export interface SequenceStep {
  delay_days: number;
  subject_template: string;
  body_template: string;
}

export interface FollowUpSequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  active_enrollments: number;
  created_at: string;
}

export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  contact_email: string;
  current_step: number;
  next_send_at: string;
  status: 'active' | 'completed' | 'cancelled' | 'failed';
  follow_up_sequences?: { name: string };
}

// ─── Knowledge Types ──────────────────────────────────────────────────────────
export interface KnowledgeEntry {
  id: string;
  email_id: string;
  entry_type: 'decision' | 'agreement' | 'price' | 'commitment' | 'deadline' | 'contact_info' | 'process';
  title: string;
  content: string;
  parties: string[];
  tags: string[];
  sender: string;
  subject: string;
  created_at: string;
}

// ─── Brief Types ──────────────────────────────────────────────────────────────
export interface MeetingBrief {
  id: string;
  meeting_title: string;
  meeting_time: string;
  attendee_emails: string[];
  brief_content: string;
  created_at: string;
}

// ─── Quote Types ──────────────────────────────────────────────────────────────
export interface QuoteLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  unit: 'fixed' | 'hour' | 'day';
}

export interface Quote {
  id: string;
  email_id: string;
  project_title: string;
  client_name: string;
  client_email: string;
  scope_summary: string;
  line_items: QuoteLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  notes: string;
  payment_terms: string;
  validity_days: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  created_at: string;
}

// ─── Shop Types ───────────────────────────────────────────────────────────────
export interface ShopProductVariant {
  name: string;  // e.g. "S / Black"
}

export interface ShopProduct {
  id: string;
  name: string;
  description: string;
  price: number;        // INR display
  price_paise: number;  // INR × 100
  images: string[];
  category: 'apparel' | 'accessories' | 'stationery' | 'digital';
  variants: ShopProductVariant[];
  allows_custom: boolean;
  custom_label: string;
  available: boolean;
  tags: string[];
  created_at: string;
}

export interface ShopOrderItem {
  product_id: string;
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;   // paise
  customization: string | null;
}

export interface ShopOrder {
  id: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  items: ShopOrderItem[];
  total_paise: number;
  shipping_address: {
    name: string;
    email: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  notes: string | null;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
}

// ─── Workspace Types (docs / files / chat / settings) ──────────────────────────

export interface TeamDoc {
  id: string;
  title: string;
  content?: string;
  updated_at: string;
  updated_by?: string;
  created_by?: string;
  created_at?: string;
}

export interface TeamFile {
  id: string;
  filename: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

export interface TeamChannel {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface TeamMessage {
  id: string;
  channel_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface WorkspaceSettings {
  id: string;
  name: string;
  allowed_email_domains: string[] | null;
}
