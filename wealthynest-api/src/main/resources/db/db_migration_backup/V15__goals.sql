CREATE TABLE goals (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    icon          VARCHAR(10),
    color         VARCHAR(7),
    target_amount DECIMAL(14,2) NOT NULL,
    saved_amount  DECIMAL(14,2) NOT NULL DEFAULT 0,
    target_date   DATE,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by    UUID,
    modified_by   UUID
);

CREATE INDEX idx_goals_user_id ON goals(user_id);
