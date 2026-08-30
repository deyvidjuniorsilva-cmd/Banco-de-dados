import Link from "next/link";
import { Card } from "@/components/card";

export function ComingSoonDetail({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted transition-colors hover:text-brand"
        >
          ← Voltar ao dashboard
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted">{description}</p>
      </div>

      <Card className="flex min-h-64 flex-col items-center justify-center gap-2 border-dashed text-center">
        <p className="text-sm font-medium text-foreground">
          Ainda não há transações para detalhar
        </p>
        <p className="max-w-sm text-sm text-muted">
          Essa lista vai mostrar cada transação que compõe esse valor assim
          que o upload de extratos e a categorização (próxima fase) forem
          implementados.
        </p>
      </Card>
    </div>
  );
}
