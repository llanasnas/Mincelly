-- Migration 004: add bebidas type + new categories
-- Adds: type 'bebidas' with subcategories Batidos, Cóktails, Smoothies, Infusiones
-- Adds: Panadería (pasteleria)
-- Adds: Sin alérgenos and Sin azúcares to both cocina and pasteleria
-- Run with: pnpm db:migrate

-- 1. Widen CHECK constraint on recipes.type
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_type_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_type_check
  CHECK (type IN ('cocina', 'pasteleria', 'bebidas'));

-- 2. Widen CHECK constraint on categories.type
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;
ALTER TABLE categories ADD CONSTRAINT categories_type_check
  CHECK (type IN ('cocina', 'pasteleria', 'bebidas'));

-- 3. Insert new categories (ON CONFLICT DO NOTHING = idempotent)
INSERT INTO categories (name, type) VALUES
  -- BEBIDAS
  ('Batidos',     'bebidas'),
  ('Cóktails',    'bebidas'),
  ('Smoothies',   'bebidas'),
  ('Infusiones',  'bebidas'),
  -- PASTELERÍA
  ('Panadería',   'pasteleria'),
  ('Sin alérgenos', 'pasteleria'),
  ('Sin azúcares',  'pasteleria'),
  -- COCINA
  ('Sin alérgenos', 'cocina'),
  ('Sin azúcares',  'cocina')
ON CONFLICT (name, type) DO NOTHING;
