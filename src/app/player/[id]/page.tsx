import PlayerClient from "./PlayerClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Player", robots: { index: false, follow: false } };

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayerClient slug={id} />;
}
