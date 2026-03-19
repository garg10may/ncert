import { NcertDownloaderApp } from "@/components/ncert-downloader-app";
import { NCERT_CATALOG } from "@/lib/ncert/catalog";

export default function Home() {
  return <NcertDownloaderApp catalog={NCERT_CATALOG} />;
}
