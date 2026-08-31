"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAnimatedNumber } from "@/lib/use-animated-number";

const HIDE_VALUES_STORAGE_KEY = "js-conciliacao-hide-values";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export interface SummaryCardData {
  label: string;
  tone: "default" | "success" | "danger";
  href: string;
  value: number;
}

function toneClass(tone: SummaryCardData["tone"]): string {
  if (tone === "success") return "text-success";
  if (tone === "danger") return "text-danger";
  return "text-foreground";
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
        <circle cx="12" cy="12" r="2.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 5.2A9.9 9.9 0 0 1 12 5c6 0 9.5 7 9.5 7a15.6 15.6 0 0 1-3.15 4.2M6.5 6.7C3.6 8.5 2.5 12 2.5 12S6 19 12 19a9.7 9.7 0 0 0 4-.85M9.6 9.6a2.75 2.75 0 0 0 3.9 3.9" />
    </svg>
  );
}

function AnimatedValue({ value, hidden, className }: { value: number; hidden: boolean; className: string }) {
  const animated = useAnimatedNumber(value);

  if (hidden) {
    return <span className={className}>R$ ••••••</span>;
  }

  return <span className={className}>{currencyFormatter.format(animated)}</span>;
}

export function MobileBalanceSummary({ cards }: { cards: SummaryCardData[] }) {
  const [balanceCard, ...carouselCards] = cards;
  const [hidden, setHidden] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const stored = window.localStorage.getItem(HIDE_VALUES_STORAGE_KEY);
    if (stored === "1") setHidden(true);
  }, []);

  function toggleHidden() {
    setHidden((current) => {
      const next = !current;
      window.localStorage.setItem(HIDE_VALUES_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(index);
  }

  return (
    <div className="flex flex-col gap-3 md:hidden">
      <Link
        href={balanceCard.href}
        className="block rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand hover:bg-surface-hover"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{balanceCard.label}</p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              toggleHidden();
            }}
            aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <EyeIcon open={!hidden} />
          </button>
        </div>
        <AnimatedValue
          value={balanceCard.value}
          hidden={hidden}
          className={`mt-2 block text-3xl font-semibold ${toneClass(balanceCard.tone)}`}
        />
        <p className="mt-3 text-xs font-medium text-brand">Ver detalhes →</p>
      </Link>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {carouselCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="block w-[85%] shrink-0 snap-center rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand hover:bg-surface-hover"
          >
            <p className="text-sm text-muted">{card.label}</p>
            <AnimatedValue
              value={card.value}
              hidden={hidden}
              className={`mt-2 block text-2xl font-semibold ${toneClass(card.tone)}`}
            />
            <p className="mt-3 text-xs font-medium text-brand">Ver detalhes →</p>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {carouselCards.map((card, index) => (
          <span
            key={card.label}
            className={`h-1.5 rounded-full transition-all ${
              index === activeIndex ? "w-4 bg-brand" : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
