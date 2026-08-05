-- Per-user opt-out for the "new sign-in" security email that used to fire unconditionally on
-- every password/Google login (see AuthServiceImpl.login / signInWithGooglePayload), plus a
-- single admin-controlled global kill switch that overrides every user's preference.

ALTER TABLE users
    ADD COLUMN login_alert_enabled BOOLEAN DEFAULT true NOT NULL;

-- Singleton row (id is always TRUE) holding system-wide feature toggles.
CREATE TABLE system_settings (
    id                         BOOLEAN     PRIMARY KEY DEFAULT true CHECK (id),
    login_alert_email_enabled  BOOLEAN     DEFAULT true NOT NULL,
    updated_at                 TIMESTAMPTZ DEFAULT now() NOT NULL
);

INSERT INTO system_settings (id) VALUES (true);
