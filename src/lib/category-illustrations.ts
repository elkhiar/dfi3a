const categoryAliases: Record<string, string> = {
  environnement: 'environment',
  santé: 'health',
  'aide sociale': 'social-support',
  éducation: 'education',
  'culture et patrimoine': 'culture-heritage',
  'protection animale': 'animal-welfare',
  sport: 'sports',
  'urgence et aide humanitaire': 'emergency-humanitarian',
  'développement communautaire': 'community-development',
  autre: 'other',
}

const knownCategories = new Set([
  'environment',
  'health',
  'social-support',
  'education',
  'culture-heritage',
  'animal-welfare',
  'sports',
  'emergency-humanitarian',
  'community-development',
  'other',
])

export function getCategoryIllustrationPath(category: string) {
  const normalized = category.trim().toLocaleLowerCase('fr')
  const slug = knownCategories.has(normalized) ? normalized : categoryAliases[normalized] || 'other'
  return `/assets/categories/${slug}.svg`
}
