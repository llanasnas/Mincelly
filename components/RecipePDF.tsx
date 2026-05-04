"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { Recipe, Nutrition } from "@/lib/schema";

// Mincely palette (OKLCH → hex)
const C = {
  red: "#C0312A",
  redDark: "#8B1E19",
  gold: "#C88A0C",
  dark: "#2A1808",
  medium: "#786058",
  light: "#F5F0EE",
  border: "#EAE0DA",
  white: "#FFFFFF",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: C.white,
  },

  // ── HEADER ──────────────────────────────────────
  header: {
    backgroundColor: C.red,
    paddingVertical: 28,
    paddingHorizontal: 36,
  },
  brandLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.gold,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  title: {
    fontFamily: "Times-Roman",
    fontSize: 26,
    color: C.white,
    lineHeight: 1.25,
    marginBottom: 10,
  },
  headerMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  headerPill: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  headerPillText: {
    fontSize: 8.5,
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0.3,
  },

  // ── GOLD ACCENT BAR ──────────────────────────────
  accentBar: {
    height: 4,
    backgroundColor: C.gold,
  },

  // ── BODY ─────────────────────────────────────────
  body: {
    paddingHorizontal: 36,
    paddingTop: 24,
    paddingBottom: 36,
  },

  // ── IMAGE ─────────────────────────────────────────
  heroImage: {
    width: "100%",
    height: 185,
    marginBottom: 20,
    objectFit: "cover",
  },

  // ── DESCRIPTION ──────────────────────────────────
  description: {
    fontFamily: "Times-Roman",
    fontSize: 11,
    color: C.medium,
    lineHeight: 1.6,
    fontStyle: "italic",
    marginBottom: 20,
  },

  // ── META TILES ────────────────────────────────────
  metaRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 26,
  },
  metaTile: {
    flex: 1,
    backgroundColor: C.light,
    borderRadius: 7,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.medium,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: C.dark,
    textAlign: "center",
  },
  metaSub: {
    fontSize: 7.5,
    color: C.medium,
    marginTop: 2,
  },

  // ── SECTION ──────────────────────────────────────
  section: {
    marginBottom: 22,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 11,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sectionBar: {
    width: 3,
    height: 16,
    backgroundColor: C.red,
    borderRadius: 2,
  },
  sectionAccent: {
    width: 3,
    height: 16,
    backgroundColor: C.gold,
    borderRadius: 2,
    marginLeft: -5,
  },
  sectionTitle: {
    fontFamily: "Times-Roman",
    fontSize: 15,
    color: C.dark,
    letterSpacing: 0.3,
  },

  // ── INGREDIENTS ──────────────────────────────────
  ingredientsGrid: {
    flexDirection: "column",
  },
  ingredientItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  ingredientDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.red,
    marginTop: 4,
    marginRight: 8,
    flexShrink: 0,
  },
  ingredientText: {
    fontSize: 10,
    color: C.dark,
    lineHeight: 1.45,
  },
  ingredientNote: {
    fontSize: 9,
    color: C.medium,
    fontStyle: "italic",
  },

  // ── STEPS ────────────────────────────────────────
  stepItem: {
    flexDirection: "row",
    gap: 11,
    marginBottom: 13,
  },
  stepBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNum: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.white,
  },
  stepBody: {
    flex: 1,
    paddingTop: 3,
  },
  stepText: {
    fontSize: 10,
    color: C.dark,
    lineHeight: 1.55,
  },
  stepDuration: {
    fontSize: 8.5,
    color: C.medium,
    marginTop: 3,
  },

  // ── NUTRITION TABLE ───────────────────────────────
  nutritionTable: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
  },
  nutritionTableHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: C.light,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  nutritionHeadText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.medium,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  nutritionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  nutritionRowAlt: {
    backgroundColor: "#FAF7F5",
  },
  nutritionLabel: {
    fontSize: 9.5,
    color: C.dark,
  },
  nutritionValue: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: C.dark,
  },

  // ── TAGS ─────────────────────────────────────────
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 18,
  },
  tag: {
    backgroundColor: C.light,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  tagText: {
    fontSize: 8.5,
    color: C.medium,
  },

  // ── FOOTER ───────────────────────────────────────
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerBrand: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.red,
    letterSpacing: 1,
  },
  footerDate: {
    fontSize: 8,
    color: C.medium,
  },
});

// ── DATA MAPS ──────────────────────────────────────────────────────
const DIFFICULTY = { easy: "Fácil", medium: "Intermedio", hard: "Difícil" } as const;

const NUTRITION_LABELS: Record<string, string> = {
  calories: "Calorías",
  protein: "Proteínas",
  fat: "Grasas totales",
  saturatedFat: "Grasas saturadas",
  carbohydrates: "Hidratos de carbono",
  sugar: "Azúcares",
  fiber: "Fibra",
  water: "Agua",
  dryExtract: "Extracto seco",
  sodium: "Sodio",
};
const NUTRITION_UNITS: Record<string, string> = {
  calories: "kcal",
  sodium: "mg",
  water: "g",
  dryExtract: "g",
};
const nutritionUnit = (key: string) => NUTRITION_UNITS[key] ?? "g";

// ── HELPERS ────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function nutritionRows(nutrition: Nutrition) {
  return Object.entries(nutrition)
    .filter(([, v]) => v != null && v > 0)
    .map(([key, value]) => ({
      label: NUTRITION_LABELS[key] ?? key,
      value: `${value} ${nutritionUnit(key)}`,
    }));
}

// ── DOCUMENT ──────────────────────────────────────────────────────
export function RecipePDF({ recipe }: { recipe: Recipe }) {
  const hasImage = !!recipe.imageUrl;
  const hasMeta =
    recipe.prepTime || recipe.cookTime || recipe.totalTime || recipe.servings || recipe.estimatedCost != null;
  const nutritionData = recipe.nutrition ? nutritionRows(recipe.nutrition) : [];
  const today = formatDate(new Date());

  return (
    <Document
      title={recipe.title}
      author="Mincely"
      creator="Mincely — Recipe Intelligence Engine"
    >
      <Page size="A4" style={s.page}>

        {/* HEADER */}
        <View style={s.header}>
          <Text style={s.brandLabel}>Mincely</Text>
          <Text style={s.title}>{recipe.title}</Text>
          <View style={s.headerMeta}>
            {recipe.cuisine && (
              <View style={s.headerPill}>
                <Text style={s.headerPillText}>{recipe.cuisine}</Text>
              </View>
            )}
            {recipe.difficulty && (
              <View style={s.headerPill}>
                <Text style={s.headerPillText}>
                  {DIFFICULTY[recipe.difficulty] ?? recipe.difficulty}
                </Text>
              </View>
            )}
            {recipe.type && (
              <View style={s.headerPill}>
                <Text style={s.headerPillText}>
                  {recipe.type.charAt(0).toUpperCase() + recipe.type.slice(1)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* GOLD ACCENT BAR */}
        <View style={s.accentBar} />

        {/* BODY */}
        <View style={s.body}>

          {/* Hero image */}
          {hasImage && (
            <Image src={recipe.imageUrl!} style={s.heroImage} />
          )}

          {/* Description */}
          {recipe.description && (
            <Text style={s.description}>{recipe.description}</Text>
          )}

          {/* Meta tiles */}
          {hasMeta && (
            <View style={s.metaRow}>
              {recipe.prepTime && (
                <View style={s.metaTile}>
                  <Text style={s.metaLabel}>Preparación</Text>
                  <Text style={s.metaValue}>{recipe.prepTime}</Text>
                </View>
              )}
              {recipe.cookTime && (
                <View style={s.metaTile}>
                  <Text style={s.metaLabel}>Cocción</Text>
                  <Text style={s.metaValue}>{recipe.cookTime}</Text>
                </View>
              )}
              {recipe.totalTime && (
                <View style={s.metaTile}>
                  <Text style={s.metaLabel}>Total</Text>
                  <Text style={s.metaValue}>{recipe.totalTime}</Text>
                </View>
              )}
              {recipe.servings && (
                <View style={s.metaTile}>
                  <Text style={s.metaLabel}>Raciones</Text>
                  <Text style={s.metaValue}>{recipe.servings}</Text>
                </View>
              )}
              {recipe.estimatedCost != null && (
                <View style={s.metaTile}>
                  <Text style={s.metaLabel}>
                    {recipe.servings ? `€ / ración` : "Coste est."}
                  </Text>
                  <Text style={s.metaValue}>
                    {recipe.servings
                      ? `${(recipe.estimatedCost / recipe.servings).toFixed(2)} €`
                      : `${recipe.estimatedCost.toFixed(2)} €`}
                  </Text>
                  {recipe.servings && (
                    <Text style={s.metaSub}>Total: {recipe.estimatedCost.toFixed(2)} €</Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Ingredients */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <View style={s.sectionBar} />
              <View style={s.sectionAccent} />
              <Text style={s.sectionTitle}>Ingredientes</Text>
            </View>
            <View style={s.ingredientsGrid}>
              {recipe.ingredients.map((ing, i) => (
                <View key={i} style={s.ingredientItem}>
                  <View style={s.ingredientDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.ingredientText}>
                      {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(" ")}
                    </Text>
                    {ing.notes && (
                      <Text style={s.ingredientNote}>({ing.notes})</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Steps */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <View style={s.sectionBar} />
              <View style={s.sectionAccent} />
              <Text style={s.sectionTitle}>Preparación</Text>
            </View>
            {recipe.steps.map((step) => (
              <View key={step.order} style={s.stepItem}>
                <View style={s.stepBubble}>
                  <Text style={s.stepNum}>{step.order}</Text>
                </View>
                <View style={s.stepBody}>
                  <Text style={s.stepText}>{step.instruction}</Text>
                  {step.duration && (
                    <Text style={s.stepDuration}>{step.duration}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Nutrition */}
          {nutritionData.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <View style={s.sectionBar} />
                <View style={s.sectionAccent} />
                <Text style={s.sectionTitle}>Información nutricional</Text>
              </View>
              <View style={s.nutritionTable}>
                <View style={s.nutritionTableHead}>
                  <Text style={s.nutritionHeadText}>Nutriente</Text>
                  <Text style={s.nutritionHeadText}>Por ración</Text>
                </View>
                {nutritionData.map(({ label, value }, i) => (
                  <View key={label} style={[s.nutritionRow, i % 2 === 1 ? s.nutritionRowAlt : {}]}>
                    <Text style={s.nutritionLabel}>{label}</Text>
                    <Text style={s.nutritionValue}>{value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <View style={s.tagsRow}>
              {recipe.tags.map((tag) => (
                <View key={tag} style={s.tag}>
                  <Text style={s.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Footer */}
          <View style={s.footer}>
            <Text style={s.footerBrand}>MINCELY</Text>
            <Text style={s.footerDate}>Generado el {today}</Text>
          </View>

        </View>
      </Page>
    </Document>
  );
}
