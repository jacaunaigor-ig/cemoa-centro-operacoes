import { redirect } from "next/navigation";
import { hrefComApresentacao } from "@/lib/apresentacao";

export default function ApresentacaoPage() {
  redirect(hrefComApresentacao("/", 0));
}
