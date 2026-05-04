-- Migration 002: categories, recipe_categories, ingredients, recipe_ingredients
-- Adds type column to recipes and normalized relational tables
-- Run with: pnpm db:migrate

-- 1. Add type column to recipes (nullable — backward compat with existing rows)
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('cocina', 'pasteleria'));

-- 2. Categories lookup table
CREATE TABLE IF NOT EXISTS categories (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cocina', 'pasteleria')),
  CONSTRAINT categories_name_type_unique UNIQUE (name, type)
);

CREATE INDEX IF NOT EXISTS categories_name_idx ON categories (name);
CREATE INDEX IF NOT EXISTS categories_type_idx ON categories (type);

-- 3. Recipe ↔ categories join table
CREATE TABLE IF NOT EXISTS recipe_categories (
  recipe_id   INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, category_id)
);

CREATE INDEX IF NOT EXISTS recipe_categories_recipe_idx ON recipe_categories (recipe_id);
CREATE INDEX IF NOT EXISTS recipe_categories_category_idx ON recipe_categories (category_id);

-- 4. Normalized ingredients lookup table
CREATE TABLE IF NOT EXISTS ingredients (
  id              SERIAL PRIMARY KEY,
  name_normalized TEXT NOT NULL,
  CONSTRAINT ingredients_name_normalized_unique UNIQUE (name_normalized)
);

CREATE INDEX IF NOT EXISTS ingredients_name_normalized_idx ON ingredients (name_normalized);

-- 5. Recipe ↔ ingredients join table
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_idx ON recipe_ingredients (recipe_id);
CREATE INDEX IF NOT EXISTS recipe_ingredients_ingredient_idx ON recipe_ingredients (ingredient_id);

-- 6. Seed categories
INSERT INTO categories (name, type) VALUES
  -- PASTELERIA
  ('Bizcochos', 'pasteleria'),
  ('Bombones', 'pasteleria'),
  ('Cake pops', 'pasteleria'),
  ('Cakes', 'pasteleria'),
  ('Brownies', 'pasteleria'),
  ('Centros', 'pasteleria'),
  ('Chocolate', 'pasteleria'),
  ('Conservas', 'pasteleria'),
  ('Copas', 'pasteleria'),
  ('Cremas', 'pasteleria'),
  ('Cremosos', 'pasteleria'),
  ('Deshidratados', 'pasteleria'),
  ('Esferificaciones', 'pasteleria'),
  ('Espumas', 'pasteleria'),
  ('Ganaches', 'pasteleria'),
  ('Gelatinas', 'pasteleria'),
  ('Glaseos', 'pasteleria'),
  ('Hojaldre', 'pasteleria'),
  ('Individuales', 'pasteleria'),
  ('Jarabes', 'pasteleria'),
  ('Mantequillas', 'pasteleria'),
  ('Masas cocidas', 'pasteleria'),
  ('Masas fermentadas', 'pasteleria'),
  ('Masas de galletas', 'pasteleria'),
  ('Menús', 'pasteleria'),
  ('Merengues', 'pasteleria'),
  ('Mousse', 'pasteleria'),
  ('Natas montadas', 'pasteleria'),
  ('Pasteles buffet', 'pasteleria'),
  ('Petit four', 'pasteleria'),
  ('Postres tradicionales', 'pasteleria'),
  ('Salsas', 'pasteleria'),
  ('Tarta', 'pasteleria'),
  ('Troncos', 'pasteleria'),
  ('Varios', 'pasteleria'),
  ('Vasitos', 'pasteleria'),
  -- COCINA
  ('Aperitivos', 'cocina'),
  ('Carnes', 'cocina'),
  ('Catering', 'cocina'),
  ('Chutneys', 'cocina'),
  ('Cremas', 'cocina'),
  ('Crujientes', 'cocina'),
  ('Entrantes', 'cocina'),
  ('Gelatinas', 'cocina'),
  ('Hamburguesas', 'cocina'),
  ('Masas', 'cocina'),
  ('Masas fermentadas', 'cocina'),
  ('Primeros', 'cocina'),
  ('Quiches', 'cocina'),
  ('Salsas', 'cocina'),
  ('Segundos', 'cocina'),
  ('Verduras', 'cocina')
ON CONFLICT (name, type) DO NOTHING;
