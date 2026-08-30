import { Card } from "@/components/card";

const SUMMARY_CARDS = [
  { label: "Saldo do mês", tone: "default" as const },
  { label: "Receitas do mês", tone: "success" as const },
  { label: "Gastos do mês", tone: "danger" as const },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted">
          Resumo do mês atual. Envie um extrato para começar a ver seus dados
          aqui.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SUMMARY_CARDS.map((card) => (
          <Card key={card.label}>
            <p className="text-sm text-muted">{card.label}</p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                card.tone === "success"
                  ? "text-success"
                  : card.tone === "danger"
                    ? "text-danger"
                    : "text-foreground"
              }`}
            >
              —
            </p>
            <p className="mt-1 text-xs text-muted">Sem dados ainda</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="min-h-64">
          <h2 className="text-sm font-semibold text-foreground">
            Gastos por categoria
          </h2>
          <div className="mt-4 flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
            Disponível após o upload do primeiro extrato
          </div>
        </Card>

        <Card className="min-h-64">
          <h2 className="text-sm font-semibold text-foreground">
            Alertas de orçamento
          </h2>
          <div className="mt-4 flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
            Nenhum orçamento configurado ainda
          </div>
        </Card>
      </div>
    </div>
  );
}
