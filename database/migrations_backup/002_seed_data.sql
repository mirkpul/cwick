-- Seed data for development

-- Insert super admin user (password: Admin123!)
INSERT INTO users (id, email, password_hash, full_name, role, is_active, email_verified)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'admin@digitaltwin.com', '$2b$10$qIY9K3kpsQCqhjDFUlLe8.fhVkGbvxdSEZIngu57F6fBjyBHvXoLe', 'Super Admin', 'super_admin', true, true);

-- Insert sample professional user (password: Professional123!)
INSERT INTO users (id, email, password_hash, full_name, role, is_active, email_verified)
VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'coach@example.com', '$2b$10$3JSHSzqCANxhxzBCeHBQ9uwe6HlKBOj0WUqqqpjboeqtykXPqq4kq', 'John Smith', 'professional', true, true);

-- Insert subscription for professional
INSERT INTO subscriptions (user_id, tier, monthly_message_limit, current_period_start, current_period_end)
VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'free', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days');

-- Insert sample digital twin
INSERT INTO digital_twins (
    id,
    user_id,
    name,
    profession,
    bio,
    llm_provider,
    llm_model,
    system_prompt,
    personality_traits,
    communication_style,
    capabilities,
    services,
    pricing_info
)
VALUES (
    '550e8400-e29b-41d4-a716-446655440100',
    '550e8400-e29b-41d4-a716-446655440001',
    'Coach John AI',
    'Life & Business Coach',
    'I am a digital twin of John Smith, a certified life and business coach with over 10 years of experience helping professionals achieve their goals.',
    'openai',
    'gpt-5-mini',
    'You are Coach John AI, a helpful and empathetic digital assistant representing John Smith, a professional life and business coach. Your role is to provide guidance, answer questions about coaching services, and help potential clients understand how coaching can benefit them. If you cannot adequately answer a question or if the user needs personalized coaching, offer to connect them with John directly.',
    '{"empathetic": true, "professional": true, "motivational": true, "patient": true}',
    'Warm, encouraging, and professional. Use active listening and ask clarifying questions.',
    '{"q_and_a": true, "scheduling": true, "consultation": true, "lead_qualification": true}',
    '[
        {"name": "1-on-1 Coaching", "description": "Personal coaching sessions", "duration": "60 min"},
        {"name": "Business Strategy", "description": "Business planning and strategy", "duration": "90 min"},
        {"name": "Career Transition", "description": "Career change guidance", "duration": "60 min"}
    ]',
    '{"currency": "USD", "session_rates": {"standard": 150, "package_5": 700, "package_10": 1300}}'
);

-- Insert sample knowledge base entries
INSERT INTO knowledge_base (twin_id, title, content, content_type)
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440100',
        'What is life coaching?',
        'Life coaching is a collaborative process where a coach helps individuals identify and achieve personal and professional goals. Unlike therapy, which often focuses on healing from the past, coaching is future-focused and action-oriented.',
        'faq'
    ),
    (
        '550e8400-e29b-41d4-a716-446655440100',
        'How long are coaching sessions?',
        'Standard coaching sessions are 60 minutes long. Business strategy sessions are 90 minutes. Sessions are conducted via video call or in-person based on your preference.',
        'faq'
    ),
    (
        '550e8400-e29b-41d4-a716-446655440100',
        'What is the coaching process?',
        'The coaching process typically involves: 1) Initial assessment to understand your goals and challenges, 2) Setting clear, measurable objectives, 3) Creating an action plan, 4) Regular sessions to track progress and adjust strategies, 5) Accountability and support between sessions.',
        'faq'
    ),
    (
        '550e8400-e29b-41d4-a716-446655440100',
        'Coaching specialties',
        'John specializes in: Leadership development, Career transitions, Work-life balance, Business growth strategies, Goal setting and achievement, Overcoming limiting beliefs, Time management and productivity.',
        'manual_entry'
    );
