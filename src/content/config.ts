import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    ogImage: z.string().optional(),
    description: z.string(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    pubDatetime: z.string(),
    readingTime: z.number().optional(),
    title: z.string(),
    publishDate: z.string(),
    modDatetime: z.string(),

  },
});

export const collections = { articles };
