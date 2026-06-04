-- ============================================================
-- 外贸猎客 (Claw) - Supabase 数据库 Schema
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本
-- ============================================================

-- 1. 用户积分账户表
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  total_recharged INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 索引
CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);

-- 2. 使用记录表
CREATE TABLE IF NOT EXISTS usage_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  credits INTEGER NOT NULL,        -- 正数=充值/赠送，负数=消耗
  type TEXT NOT NULL CHECK (type IN ('use', 'recharge', 'reward', 'refund')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);

-- 3. 客户表
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  region TEXT,
  industry TEXT,
  website TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'negotiating', 'won', 'lost')),
  score INTEGER,
  note TEXT,
  source TEXT,                    -- 来源：search/manual/import
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_country ON clients(country);

-- 4. 开发信历史表
CREATE TABLE IF NOT EXISTS email_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_company TEXT NOT NULL,
  target_contact TEXT,
  product TEXT,
  email_type TEXT,                -- intro/followup/quote
  tone TEXT,                      -- professional/friendly/concise
  subject TEXT,
  content TEXT NOT NULL,
  tokens_used INTEGER,
  credits_cost INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_history_user_id ON email_history(user_id);
CREATE INDEX idx_email_history_created_at ON email_history.created_at);

-- 5. 充值订单表
CREATE TABLE IF NOT EXISTS recharge_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pkg_key TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  credits INTEGER NOT NULL,
  payment_method TEXT,            -- wechat/alipay/stripe
  payment_id TEXT,                -- 第三方支付单号
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_recharge_orders_user_id ON recharge_orders(user_id);
CREATE INDEX idx_recharge_orders_status ON recharge_orders(status);

-- ============================================================
-- 数据库函数（原子操作）
-- ============================================================

-- 扣除积分（带余额校验）
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_action TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- 行级锁，防止并发扣减
  SELECT balance INTO v_balance FROM user_credits WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户积分账户不存在';
  END IF;

  IF v_balance < p_amount THEN
    RETURN FALSE;  -- 余额不足
  END IF;

  -- 扣减余额
  UPDATE user_credits SET
    balance = balance - p_amount,
    total_used = total_used + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- 记录使用日志
  INSERT INTO usage_logs (user_id, action, credits, type)
  VALUES (p_user_id, p_action, -p_amount, 'use');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 充值积分
CREATE OR REPLACE FUNCTION recharge_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_price DECIMAL(10,2),
  p_pkg_key TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- 增加余额
  INSERT INTO user_credits (user_id, balance, total_recharged, total_used)
  VALUES (p_user_id, p_amount, p_amount, 0)
  ON CONFLICT (user_id) DO UPDATE SET
    balance = user_credits.balance + p_amount,
    total_recharged = user_credits.total_recharged + p_amount,
    updated_at = now();

  -- 记录充值日志
  INSERT INTO usage_logs (user_id, action, credits, type, metadata)
  VALUES (
    p_user_id,
    '充值 - ' || p_amount || '积分 (' || p_pkg_key || ')',
    p_amount,
    'recharge',
    jsonb_build_object('price', p_price, 'pkg_key', p_pkg_key)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Row Level Security（RLS）
-- ============================================================

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE recharge_orders ENABLE ROW LEVEL SECURITY;

-- 用户只能操作自己的数据
CREATE POLICY "Users can view own credits" ON user_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own logs" ON usage_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own clients" ON clients FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own emails" ON email_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own orders" ON recharge_orders FOR ALL USING (auth.uid() = user_id);

-- 允许注册时创建积分账户（通过服务端函数处理）
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================
-- 触发器：自动更新 updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_credits_updated_at ON user_credits;
CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON user_credits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
