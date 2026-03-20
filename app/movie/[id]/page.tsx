import { redirect } from "next/navigation";

type LegacyMovieDetailPageProps = {
  params: { id: string };
  searchParams: { why?: string };
};

export default function LegacyMovieDetailPage({ params, searchParams }: LegacyMovieDetailPageProps) {
  const whyQuery = searchParams.why ? `?why=${encodeURIComponent(searchParams.why)}` : "";
  redirect(`/details/movie/${params.id}${whyQuery}`);
}
