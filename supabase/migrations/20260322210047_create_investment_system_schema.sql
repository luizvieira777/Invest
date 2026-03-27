/*
  # Investment Management System Schema

  1. New Tables
    - `economic_indicators`
      - `id` (uuid, primary key)
      - `indicator_type` (text) - 'CDI' or 'SELIC'
      - `value` (numeric) - annual percentage value
      - `reference_date` (date) - date of the indicator
      - `created_at` (timestamptz)
    
    - `investments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text) - investment name
      - `initial_value` (numeric) - initial investment amount
      - `current_value` (numeric) - current calculated value
      - `cdi_percentage` (numeric) - percentage of CDI (e.g., 100 for 100% CDI)
      - `start_date` (date) - investment start date
      - `end_date` (date) - investment end date
      - `monthly_contribution` (numeric) - monthly contribution amount
      - `apply_tax` (boolean) - whether to apply income tax
      - `investment_type` (text) - type of investment
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `contributions`
      - `id` (uuid, primary key)
      - `investment_id` (uuid, foreign key to investments)
      - `amount` (numeric) - contribution amount
      - `contribution_date` (date) - date of contribution
      - `created_at` (timestamptz)
    
    - `portfolios`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text) - portfolio name
      - `profile_type` (text) - 'conservative', 'moderate', 'aggressive'
      - `total_value` (numeric) - total portfolio value
      - `allocation` (jsonb) - asset allocation details
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create economic_indicators table
CREATE TABLE IF NOT EXISTS economic_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_type text NOT NULL,
  value numeric NOT NULL,
  reference_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(indicator_type, reference_date)
);

ALTER TABLE economic_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read economic indicators"
  ON economic_indicators FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service can insert economic indicators"
  ON economic_indicators FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create investments table
CREATE TABLE IF NOT EXISTS investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  initial_value numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  cdi_percentage numeric NOT NULL DEFAULT 100,
  start_date date NOT NULL,
  end_date date NOT NULL,
  monthly_contribution numeric DEFAULT 0,
  apply_tax boolean DEFAULT true,
  investment_type text DEFAULT 'CDB',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own investments"
  ON investments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own investments"
  ON investments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investments"
  ON investments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own investments"
  ON investments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create contributions table
CREATE TABLE IF NOT EXISTS contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id uuid REFERENCES investments(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  contribution_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contributions for their investments"
  ON contributions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM investments
      WHERE investments.id = contributions.investment_id
      AND investments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contributions for their investments"
  ON contributions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM investments
      WHERE investments.id = contributions.investment_id
      AND investments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete contributions for their investments"
  ON contributions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM investments
      WHERE investments.id = contributions.investment_id
      AND investments.user_id = auth.uid()
    )
  );

-- Create portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  profile_type text DEFAULT 'moderate',
  total_value numeric DEFAULT 0,
  allocation jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own portfolios"
  ON portfolios FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolios"
  ON portfolios FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolios"
  ON portfolios FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolios"
  ON portfolios FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_investment_id ON contributions(investment_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_economic_indicators_type_date ON economic_indicators(indicator_type, reference_date DESC);