-- =====================================================
-- Shepard Advisor — Complete Database Schema
-- Run this in the Supabase SQL Editor
-- =====================================================

-- 1. PROFILES (touched by SessionContext every 60s)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user', 'admin'
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. USER SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'trader')),
    interval VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (interval IN ('monthly', 'quarterly', 'yearly')),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    active BOOLEAN NOT NULL DEFAULT true,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active ON user_subscriptions(user_id, active);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);

-- 3. USER USAGE DAILY (rate limiting)
CREATE TABLE IF NOT EXISTS user_usage_daily (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ai_analysis_count INTEGER NOT NULL DEFAULT 0,
    scanner_run_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_user_usage_daily_lookup ON user_usage_daily(user_id, usage_date);

ALTER TABLE user_usage_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage" ON user_usage_daily FOR SELECT USING (auth.uid() = user_id);

-- 4. COIN ANALYSES (main analysis results from Edge Function)
CREATE TABLE IF NOT EXISTS coin_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    indicator_json JSONB NOT NULL,
    risk_json JSONB NOT NULL,
    social_json JSONB,
    ai_summary_json JSONB,
    cause_json JSONB,
    market_microstructure_json JSONB,
    news_json JSONB,
    confidence_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coin_analyses_symbol ON coin_analyses(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_coin_analyses_expires ON coin_analyses(expires_at);
CREATE INDEX IF NOT EXISTS idx_coin_analyses_created ON coin_analyses(created_at DESC);

-- Allow Edge Functions (service role) full access; no RLS needed for server-only table
ALTER TABLE coin_analyses DISABLE ROW LEVEL SECURITY;

-- 5. CONTACT MESSAGES
CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name VARCHAR(200),
    email VARCHAR(255),
    satisfaction VARCHAR(20) CHECK (satisfaction IN ('happy', 'neutral', 'unhappy')),
    subject VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can insert contact messages" ON contact_messages FOR INSERT WITH CHECK (true);

-- 6. ANALYSIS JOBS (legacy queue — kept for reference / future use)
CREATE TABLE IF NOT EXISTS analysis_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    price_at_detection DECIMAL(20,8) NOT NULL,
    price_change DECIMAL(10,4) NOT NULL,
    volume_spike DECIMAL(10,4) NOT NULL,
    orderbook_json JSONB,
    social_json JSONB,
    risk_score INTEGER,
    summary TEXT,
    likely_source VARCHAR(100),
    actionable_insight TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_symbol ON analysis_jobs(symbol);

ALTER TABLE analysis_jobs DISABLE ROW LEVEL SECURITY;

-- 7. PUMP ALERTS (legacy alerts — kept for reference / future use)
CREATE TABLE IF NOT EXISTS pump_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    type VARCHAR(50),
    price DECIMAL(20,8),
    price_change DECIMAL(10,4),
    volume DECIMAL(20,4),
    avg_volume DECIMAL(20,4),
    volume_multiplier DECIMAL(10,4),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    market_state VARCHAR(50),
    orderbook_depth DECIMAL(20,2),
    ai_comment JSONB,
    ai_fetched_at TIMESTAMP WITH TIME ZONE,
    risk_score INTEGER,
    likely_source VARCHAR(100),
    actionable_insight TEXT,
    organic_probability INTEGER,
    risk_analysis TEXT,
    whale_movement BOOLEAN DEFAULT false
);

ALTER TABLE pump_alerts DISABLE ROW LEVEL SECURITY;

-- 8. Cleanup function for expired analyses
CREATE OR REPLACE FUNCTION cleanup_expired_analyses()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM coin_analyses WHERE expires_at < NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 9. Fix any existing constraint issues
ALTER TABLE pump_alerts ALTER COLUMN avg_volume DROP NOT NULL;
ALTER TABLE pump_alerts ALTER COLUMN volume DROP NOT NULL;
