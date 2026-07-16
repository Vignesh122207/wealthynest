-- Soft-delete for categories: deleting a category that still has expenses archives it instead of
-- removing the row, so those expenses keep their original label (expenses.category_id is NOT NULL).
-- Archived categories are hidden from pickers/lists; recreating one with the same name and type
-- un-archives it, reconnecting the old expenses.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false NOT NULL;
