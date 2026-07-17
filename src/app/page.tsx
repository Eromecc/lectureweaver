import { LectureWeaver } from "@/components/lecture-weaver";
import { getPublicProviderCatalog } from "@/lib/ai/catalog";

export default function Home() {
  return <LectureWeaver providers={getPublicProviderCatalog()} />;
}
