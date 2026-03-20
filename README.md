# CineMatch: Niche Movie Recommendation Web App

Full-stack movie recommender built with Next.js App Router, TypeScript, Tailwind CSS, Prisma, and PostgreSQL.

## Features

- Movie search using TMDb API
- User selection flow (minimum 5 movies)
- Hidden-gem recommendation algorithm (genre similarity + niche weighting)
- Recommendation results page
- Movie detail page with:
  - poster
  - overview
  - genres
  - release year
  - why recommended explanation
  - related book adaptation info (mock integration)
- Prisma schema for persisting recommendation sessions/snapshots

## Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL

## Project Structure

```txt
app/
  api/
    movies/search/route.ts
    recommendations/route.ts
  movie/[id]/page.tsx
  recommendations/page.tsx
  layout.tsx
  page.tsx
components/
  MovieSearch.tsx
  SelectedMovies.tsx
  RecommendationCard.tsx
lib/
  prisma.ts
  tmdb.ts
  recommendation.ts
  image.ts
  types.ts
services/
  books.ts
prisma/
  schema.prisma
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill values:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cinematch?schema=public"
TMDB_API_KEY="your_tmdb_api_key_here"
TMDB_BASE_URL="https://api.themoviedb.org/3"
```

## Run Locally

```bash
npm install
npm run prisma:generate
npx prisma migrate dev --name init
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Notes

- Book adaptation data is currently mocked in `services/books.ts`.
- Recommendation logic is intentionally simple and modular to improve incrementally.
