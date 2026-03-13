-- Add is_pinned column to conversations table
ALTER TABLE conversations ADD COLUMN is_pinned BOOLEAN DEFAULT false;
ALTER TABLE conversations ADD COLUMN pin_order INT DEFAULT 0;

-- Create an index for efficient sorting with pinned conversations first
CREATE INDEX idx_conversations_pin_order ON conversations(user_id, is_pinned DESC, pin_order DESC, updated_at DESC);
