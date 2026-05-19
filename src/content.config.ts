import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    publishDate: z.string(),
    readingTime: z.number().optional(),
    tags: z.array(z.string()).default([]),
    ogImage: z.string().optional(),
    chapter: z.number().optional(),
    sources: z.array(z.object({
      title: z.string(),
      url: z.string(),
      type: z.enum(['gov', 'paper', 'book', 'article', 'data']).default('article'),
    })).default([]),
  }),
});

export const collections = { articles };
