"use client";
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import bwipjs from "bwip-js";
import { Analytics } from '@vercel/analytics/react';  // Koristi /react za plain React/Vite, ne /next
// =============================================================
// KONFIGURACIJA
// =============================================================
const CONFIG = {
  clubName: "KK Dinamo Zagreb",
  oib: "84603037305",
  supportContact: "Trener Mario Štirjan, 095 321 2241",
  iban: "HR5823600001101579632",
  bic: "",
  paymentModel: "HR00",
  paymentReferencePrefix: "DINAMO-OPREMA-",
  currency: "EUR",
  notificationEmails: ["oprema@kkdinamo.hr"],
  emailWebhook: "",
  deliveryLeadTimeDays: 30,
  theme: { primary: "#0A2A6B", dark: "#0B0E11" },
  products: {
    packages: [
      {
        id: "A",
        name: "Paket oprema Dinamo",
        price: 110,
        image: "/Paket1.jpg",
        includes: ["2 majice", "1 hoodica", "1 hlače", "1 double face dres"],
        spec: "Osnovni komplet za mlađe uzraste.",
      },
      {
        id: "B",
        name: "Paket oprema plus Dinamo",
        price: 180,
        image: "/Paket2.jpg",
        includes: ["4 majice", "2 hoodice", "1 hlače", "1 double face dres"],
        spec: "Prošireni komplet za mlađe uzraste.",
      },
    ],
    extras: [
      { id: "E_SHIRTS", label: "+2 majice", price: 20, image: "/majice2.jpg", sizes: ["110cm","122cm","134cm","146cm","158cm","S","M","L","XL","2XL","3XL"] },
      { id: "E_HOODIE_BLUE", label: "Hoodica plava", price: 45, image: "/hoodica_plava.jpg", sizes: ["110cm","122cm","134cm","146cm","158cm","S","M","L","XL","2XL","3XL"] },
      { id: "E_HOODIE_BLACK", label: "Hoodica crna", price: 45, image: "/hoodica_crna.jpg", sizes: ["110cm","122cm","134cm","146cm","158cm","S","M","L","XL","2XL","3XL"] },
      { id: "E_BACKPACK", label: "Ruksak", price: 35, image: "/ruksak.jpg" }, // bez sizes
      { id: "E_WINTER_HAT", label: "Zimska kapa", price: 8, image: "/zimska_kapa.jpg" }, // bez sizes, jedna veličina
    ],
  },
} as const;
// =============================================================
// TIPOVI
// =============================================================
type Pack = {
  id: string;
  name: string;
  price: number;
  image: string;
  spec: string;
  includes: ReadonlyArray<string>;
};
type Extra = {
  id: string;
  label: string;
  price: number;
  image: string;
  sizes?: ReadonlyArray<string>;
};
const Step = { Login: 0, Choose: 1, Extras: 2, Review: 3, Payment: 4 } as const;
// =============================================================
// VELIČINE PO TIPU
// =============================================================
const SHIRT_SIZES = ["110cm", "122cm", "134cm", "146cm", "158cm", "S", "M", "L", "XL", "2XL", "3XL"] as const;
const HOODIE_SIZES = ["110cm", "122cm", "134cm", "146cm", "158cm", "S", "M", "L", "XL", "2XL", "3XL"] as const;
const JERSEY_SIZES = ["110cm", "122cm", "134cm", "146cm", "158cm", "S", "M", "L", "XL", "2XL", "3XL", "4XL"] as const;
// =============================================================
// UTIL FUNKCIJE
// =============================================================
function formatCurrency(amount: number) {
  try {
    return new Intl.NumberFormat("hr-HR", { style: "currency", currency: CONFIG.currency }).format(amount);
  } catch {
    return `${CONFIG.currency} ${amount.toFixed(2)}`;
  }
}
function sanitizeHubText(input: string) {
  let s = input
    .replaceAll("č", "c").replaceAll("ć", "c").replaceAll("š", "s").replaceAll("đ", "d").replaceAll("ž", "z")
    .replaceAll("Č", "C").replaceAll("Ć", "C").replaceAll("Š", "S").replaceAll("Đ", "D").replaceAll("Ž", "Z");
  s = s.replace(/[–—]/g, "-");
  s = s.replace(/[^ -~]/g, "");
  return s;
}
function makeHub2DPayload(params: {
  amountEur: number;
  iban: string;
  model: string;
  reference: string;
  receiverName: string;
  description: string;
}) {
  const amountCents = Math.round(params.amountEur * 100);
  const amountField = String(amountCents).padStart(15, "0");
  const ibanClean = params.iban.replace(/\s+/g, "");
  const receiver = sanitizeHubText(params.receiverName);
  const description = sanitizeHubText(params.description).slice(0, 35);
  return [
    "HRVHUB30",
    "EUR",
    amountField,
    "",
    "",
    "",
    receiver,
    "",
    "",
    ibanClean,
    params.model || "",
    params.reference || "",
    "",
    description,
  ].join("\n");
}
function effectiveImage(p: Pack, overrideA: string | null, overrideB: string | null) {
  if (p.id === "A" && overrideA) return overrideA;
  if (p.id === "B" && overrideB) return overrideB;
  return p.image;
}
function buildOrderEmail(params: {
  orderId: string;
  firstName: string;
  lastName: string;
  coach: string;
  packName: string;
  jersey: string;
  shirt: string;
  hoodie: string;
  extrasWithSizes: string[];
  total: number;
  referenceNumber: string;
}) {
  const subject = `${CONFIG.clubName} – Narudžba ${params.orderId}`;
  const lines = [
    `${CONFIG.clubName} – potvrda narudžbe`,
    `Narudžba: ${params.orderId}`,
    `Dijete: ${params.firstName} ${params.lastName}`,
    `Trener: ${params.coach}`,
    `Paket: ${params.packName}`,
    `Veličine (paket): dres ${params.jersey}, majica ${params.shirt}, hoodica ${params.hoodie}`,
    `Dodatno: ${params.extrasWithSizes.length ? params.extrasWithSizes.join(", ") : "—"}`,
    `Ukupno: ${CONFIG.currency} ${params.total.toFixed(2)}`,
    `Poziv na broj: ${params.referenceNumber}`,
    `IBAN: ${CONFIG.iban}`,
  ];
  const text = lines.join("\n");
  const html = `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace">${lines.join("\n")}</pre>`;
  return { to: CONFIG.notificationEmails, subject, text, html };
}
// Widen union → treat all extras as `Extra` (sizes?: ...)
const EXTRAS: ReadonlyArray<Extra> = CONFIG.products.extras as ReadonlyArray<Extra>;
const extrasById: Record<string, Extra> = Object.fromEntries(EXTRAS.map((e) => [e.id, e]));
const extrasTotal = (selected: Set<string>) => Array.from(selected).reduce((s, id) => s + (extrasById[id]?.price || 0), 0);
// =============================================================
// KOMPONENTA
// =============================================================
export default function App() {
  const [step, setStep] = useState<number>(Step.Login);
  // PRIJAVA
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [coach, setCoach] = useState("");
  const firstRef = useRef<HTMLInputElement | null>(null);
  const lastRef = useRef<HTMLInputElement | null>(null);
  const coachRef = useRef<HTMLInputElement | null>(null);
  const [activeField, setActiveField] = useState<"" | "first" | "last" | "coach">("");
  // ODABIR
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [pkgSizes, setPkgSizes] = useState<{ jersey: string; shirt: string; hoodie: string }>({
    jersey: "",
    shirt: "",
    hoodie: "",
  });
  const [customImageA] = useState<string | null>(null);
  const [customImageB] = useState<string | null>(null);
  const [resolvedImageA, setResolvedImageA] = useState<string | null>(null);
  const [resolvedImageB, setResolvedImageB] = useState<string | null>(null);
  // DODATNI ARTIKLI
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
  const [extraSizes, setExtraSizes] = useState<Record<string, string>>({}); // id -> size
  // MAIL (bez UI-a)
  const emailedRef = useRef(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  // UPLATA
  const [referenceNumber, setReferenceNumber] = useState("");
  // helper čekanje refova
  async function waitForRefs(getOk: () => boolean, timeoutMs = 1500, intervalMs = 50): Promise<void> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const tick = () => {
        if (getOk()) return resolve();
        if (Date.now() - start > timeoutMs) return reject(new Error("Canvas/container refs not mounted yet"));
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }
  // barkod refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const barcodeRef = useRef<HTMLDivElement | null>(null);
  const handleCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
  }, []);
  const handleBarcodeRef = useCallback((node: HTMLDivElement | null) => {
    barcodeRef.current = node;
  }, []);
  // Scroll to top on each step change
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [step]);
  // Fokus zaštita
  useEffect(() => {
    if (step !== Step.Login || !activeField) return;
    const map = { first: firstRef, last: lastRef, coach: coachRef } as const;
    const el = map[activeField].current;
    if (el && document.activeElement !== el) {
      const pos = el.value.length;
      el.focus();
      try {
        el.setSelectionRange(pos, pos);
      } catch {}
    }
  });
  // Nađi slike u /public
  useEffect(() => {
    if (step !== Step.Choose) return;
    const preload = (url: string) =>
      new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => reject(null);
        img.src = url;
      });
    const chain = async (cands: string[], set: (v: string | null) => void) => {
      for (const u of cands) {
        try {
          const ok = await preload(u);
          set(ok);
          return;
        } catch {}
      }
      set(null);
    };
    if (!customImageA) chain(["/Paket1.jpg", "/paket1.jpg"], setResolvedImageA);
    if (!customImageB) chain(["/Paket2.jpg", "/paket2.jpg"], setResolvedImageB);
  }, [step, customImageA, customImageB]);
  const orderId = useMemo(
    () => `${CONFIG.paymentReferencePrefix}${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    []
  );
  const selectedPackage = useMemo(() => CONFIG.products.packages.find((p) => p.id === selectedPackageId) || null, [selectedPackageId]);
  const extrasWithSizesLabels = useMemo(() => {
    return Array.from(selectedExtras)
      .map((id) => {
        const ex = extrasById[id];
        if (!ex) return null;
        const size = ex.sizes ? extraSizes[id] || "" : "";
        return ex.sizes ? `${ex.label} (${size || "—"})` : ex.label;
      })
      .filter(Boolean) as string[];
  }, [selectedExtras, extraSizes]);
  const total = useMemo(() => (selectedPackage ? selectedPackage.price + extrasTotal(selectedExtras) : 0), [selectedPackage, selectedExtras]);
  const canContinueFromLogin = firstName.trim().length >= 1 && lastName.trim().length >= 1 && coach.trim().length >= 1;
  const canConfirmPackage =
    Boolean(selectedPackage) && pkgSizes.jersey !== "" && pkgSizes.shirt !== "" && pkgSizes.hoodie !== "";
  // svi odabrani extras koji imaju sizes moraju imati veličinu
  const allExtrasSizedOk = useMemo(() => {
    for (const id of selectedExtras) {
      const ex = extrasById[id];
      if (ex?.sizes && !(extraSizes[id] && extraSizes[id] !== "")) return false;
    }
    return true;
  }, [selectedExtras, extraSizes]);
  const hub2dPayload = useMemo(() => {
    if (!selectedPackage || !referenceNumber) return "";
    return makeHub2DPayload({
      amountEur: total,
      iban: CONFIG.iban,
      model: CONFIG.paymentModel,
      reference: referenceNumber,
      receiverName: CONFIG.clubName,
      description: `oprema ${firstName} ${lastName}`,
    });
  }, [selectedPackage, total, firstName, lastName, referenceNumber]);
  // Dodjela poziva na broj
  useEffect(() => {
    if (step === Step.Payment && !referenceNumber) {
      const rnd = Math.floor(1000 + Math.random() * 9000);
      setReferenceNumber(String(rnd));
    }
  }, [step, referenceNumber]);
  // Crtanje PDF417
  useEffect(() => {
    if (step !== Step.Payment) return;
    if (!hub2dPayload || !hub2dPayload.trim()) {
      console.warn("[PDF417] prazni hub2dPayload");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await waitForRefs(() => Boolean(canvasRef.current));
        if (cancelled) return;
        const canvas = canvasRef.current!;
        const container = barcodeRef.current;
        const w = 300, h = 150;
        canvas.style.display = "block";
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
        }
        if (container) {
          container.style.display = "none";
          container.innerHTML = "";
        }
        await bwipjs.toCanvas(canvas, {
          bcid: "pdf417",
          text: hub2dPayload,
          scale: 3,
          height: 10,
          includetext: false,
          columns: 6,
        });
        console.info("[PDF417] nacrtan OK. payload len =", hub2dPayload.length);
      } catch (e) {
        console.error("[PDF417] refs nisu spremni:", e);
        const c = canvasRef.current;
        const ctx = c?.getContext("2d");
        if (c && ctx) {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, c.width || 300, c.height || 150);
          ctx.fillStyle = "#900";
          ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText("Greška pri crtanju barkoda", 10, 20);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [step, hub2dPayload]);
  // Automatsko slanje emaila + zapis u Google Sheet
  async function sendOrderNotification() {
    if (!selectedPackage) return;
    if (emailedRef.current) return;
    setEmailStatus("sending");
    try {
      // --- 1) Email (ako je uključen webhook) ---
      if (CONFIG.emailWebhook) {
        const email = buildOrderEmail({
          orderId,
          firstName,
          lastName,
          coach,
          packName: selectedPackage.name,
          jersey: pkgSizes.jersey,
          shirt: pkgSizes.shirt,
          hoodie: pkgSizes.hoodie,
          extrasWithSizes: extrasWithSizesLabels,
          total,
          referenceNumber,
        });
        await fetch(CONFIG.emailWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(email),
        });
      }
      // --- 2) Google Sheet zapis (GET + no-cors) ---
      const scriptUrl = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL;
      const secret = import.meta.env.VITE_GOOGLE_SHEET_SECRET;
      if (scriptUrl) {
        const extrasJson = JSON.stringify(
          Array.from(selectedExtras).reduce<Record<string, string>>((acc, id) => {
            const ex = extrasById[id];
            acc[id] = ex?.sizes ? (extraSizes[id] || "") : "";
            return acc;
          }, {})
        );
        const params = new URLSearchParams({
          secret: secret || "",
          orderId,
          firstName,
          lastName,
          coach,
          packName: selectedPackage.name,
          jerseySize: pkgSizes.jersey,
          shirtSize: pkgSizes.shirt,
          hoodieSize: pkgSizes.hoodie,
          extras: extrasWithSizesLabels.join(", "),
          extrasJson,
          total: String(total),
          referenceNumber,
          iban: CONFIG.iban,
          model: CONFIG.paymentModel,
        });
        const fullUrl = `${scriptUrl}?${params.toString()}`;
        console.log("[Sheets] FULL GET URL ->", fullUrl);
        fetch(fullUrl, { method: "GET", mode: "no-cors" }).catch(() => {});
      }
      setEmailStatus("sent");
      emailedRef.current = true;
    } catch (e) {
      console.error("❌ Slanje nije uspjelo:", e);
      setEmailStatus("error");
    }
  }
  // Poziv slanja na ulazu u korak Payment
  useEffect(() => {
    if (step === Step.Payment) {
      if (!referenceNumber) {
        setReferenceNumber(String(Math.floor(1000 + Math.random() * 9000)));
        return;
      }
      sendOrderNotification();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, referenceNumber]);
  // --- DEV SMOKE TESTS ---
  useEffect(() => {
    try {
      const c = formatCurrency(123.45);
      if (typeof c !== "string" || !c) throw new Error("formatCurrency failed");
      const p = makeHub2DPayload({
        amountEur: 1,
        iban: CONFIG.iban,
        model: CONFIG.paymentModel,
        reference: "0001",
        receiverName: CONFIG.clubName,
        description: "Test plaćanje",
      });
      if (!p.includes("HRVHUB30")) throw new Error("HUB payload missing header");
      console.info("[Smoke] Basic runtime checks passed.");
    } catch (e) {
      console.error("[Smoke] Basic runtime checks failed:", e);
    }
  }, []);
  // UI helpers
  const PrimaryButton = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
      type="button"
      {...props}
      className="px-5 py-3 rounded-2xl shadow-md font-semibold tracking-wide transition-transform active:scale-95 border border-black/10"
      style={{ background: CONFIG.theme.primary, color: "white" }}
    >
      {children}
    </button>
  );
  const OutlineButton = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
      type="button"
      {...props}
      className="px-5 py-3 rounded-2xl border border-black/10 hover:border-black/30 transition-colors"
      style={{ color: CONFIG.theme.dark }}
    >
      {children}
    </button>
  );
  const Field = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
    <div className="mb-4">
      <label htmlFor={id} className="block mb-2 text-sm font-medium text-black/80">
        {label}
      </label>
      {children}
    </div>
  );
  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-black/10 shadow-sm overflow-hidden bg-white">{children}</div>
  );
  const PackageCard = ({ pkg }: { pkg: Pack }) => (
    <Card>
      <div className="grid grid-cols-1">
        <div className="relative" style={{ aspectRatio: "16 / 9" }}>
          <img
            src={pkg.image}
            alt={pkg.name}
            className="absolute inset-0 w-full h-full object-contain bg-white"
            onError={(e) => {
              const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="20" fill="#6b7280">Fotografija trenutno nije dostupna</text></svg>`;
              (e.currentTarget as HTMLImageElement).src = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
          <div className="absolute bottom-3 left-3">
            <div className="text-lg font-semibold text-white drop-shadow">{pkg.name}</div>
            <div className="mt-1 inline-flex items-center px-2.5 py-1 rounded-lg bg-white/95 text-black text-sm font-semibold shadow">
              {formatCurrency(pkg.price)}
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-black/80">{pkg.spec}</p>
          <ul className="text-sm text-black/70 list-disc pl-5">
            {pkg.includes.map((i) => (
              <li key={i}>
                {i}
                {i.toLowerCase().includes("double face dres") && (
                  <div className="text-xs text-red-600 mt-1">Napomena: Broj dresa se dogovara s trenerom!</div>
                )}
              </li>
            ))}
          </ul>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                const y = window.scrollY;
                setSelectedPackageId(pkg.id);
                requestAnimationFrame(() => {
                  try { window.scrollTo({ top: y, left: 0, behavior: "auto" }); } catch { window.scrollTo(0, y); }
                });
              }}
              className={`w-full py-2.5 rounded-xl font-medium transition-all border ${
                selectedPackageId === pkg.id ? "bg-black text-white border-black" : "bg-white hover:bg-black/5 border-black/10"
              }`}
            >
              {selectedPackageId === pkg.id ? "Odabrano" : "Odaberi paket"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
  const ExtraCard = ({
    extra,
    checked,
    onToggle,
    sizeValue,
    onSizeChange,
  }: {
    extra: Extra;
    checked: boolean;
    onToggle: () => void;
    sizeValue: string;
    onSizeChange: (v: string) => void;
  }) => (
    <div className={`rounded-2xl border ${checked ? "border-black" : "border-black/10"} overflow-hidden bg-white shadow-sm transition-all`}>
      <div className="relative" style={{ aspectRatio: "1 / 1" }}>
        <img
          src={extra.image}
          alt={extra.label}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="20" fill="#6b7280">Fotografija nije dostupna</text></svg>`;
            (e.currentTarget as HTMLImageElement).src = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
        <div className="absolute bottom-3 left-3">
          <div className="font-semibold text-white drop-shadow">{extra.label}</div>
          <div className="mt-1 inline-flex items-center px-2 py-1 rounded-md bg-white/95 text-black text-xs font-semibold shadow">
            {formatCurrency(extra.price)}
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <button
          type="button"
          onClick={() => {
            const y = window.scrollY;
            onToggle();
            requestAnimationFrame(() => {
              try { window.scrollTo({ top: y, left: 0, behavior: "auto" }); } catch { window.scrollTo(0, y); }
            });
          }}
          className={`w-full py-2.5 rounded-xl font-medium transition-all border ${
            checked ? "bg-black text-white border-black" : "bg-white hover:bg-black/5 border-black/10"
          }`}
        >
          {checked ? "Ukloni" : "Dodaj"}
        </button>
        {checked && Array.isArray(extra.sizes) && (
          <Field id={`extra-size-${extra.id}`} label="Veličina">
            <select
              value={sizeValue}
              onChange={(e) => onSizeChange(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/10 bg-white"
            >
              <option value="" disabled>Odaberi veličinu</option>
              {(extra.sizes ?? []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
    </div>
  );
  return (
        <div className="min-h-screen bg-white text-black selection:bg-black/10">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white border-b border-black/10">
        <div className="w-full px-0 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 pl-4">
            <div
              className="w-10 h-10 rounded-xl border border-black/10 grid place-items-center font-black"
              style={{ color: "white", background: CONFIG.theme.primary }}
            >
              D
            </div>
            <div className="leading-tight">
              <div className="font-semibold">{CONFIG.clubName}</div>
              <div className="text-xs text-black/60">Odabir paketa opreme</div>
            </div>
          </div>
          <div className="text-xs text-black/60 pr-4">Privremena web stranica</div>
        </div>
      </header>
      {/* Main */}
      <main className="w-full px-0 py-8 pb-[max(7rem,env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait">
          {/* PRIJAVA */}
          {step === Step.Login && (
            <motion.section
              key="login"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <div className="mb-6 px-4">
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: CONFIG.theme.dark }}>
                  Prijava
                </h1>
                <p className="text-black/70 mt-1">Upiši podatke djeteta i trenera.</p>
              </div>
              <div className="px-4">
                <Card>
                  <form
                    className="p-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (canContinueFromLogin) setStep(Step.Choose);
                    }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field id="firstName" label="Ime djeteta">
                        <input
                          id="firstName"
                          autoComplete="given-name"
                          ref={firstRef}
                          value={firstName}
                          onFocus={() => setActiveField("first")}
                          onChange={(e) => { setFirstName(e.target.value); setActiveField("first"); }}
                          placeholder="npr. Luka"
                          className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </Field>
                      <Field id="lastName" label="Prezime djeteta">
                        <input
                          id="lastName"
                          autoComplete="family-name"
                          ref={lastRef}
                          value={lastName}
                          onFocus={() => setActiveField("last")}
                          onChange={(e) => { setLastName(e.target.value); setActiveField("last"); }}
                          placeholder="npr. Horvat"
                          className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </Field>
                      <Field id="coach" label="Ime trenera">
                        <input
                          id="coach"
                          autoComplete="off"
                          ref={coachRef}
                          value={coach}
                          onFocus={() => setActiveField("coach")}
                          onChange={(e) => { setCoach(e.target.value); setActiveField("coach"); }}
                          placeholder="npr. Marko"
                          className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </Field>
                    </div>
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-black/60">Podaci se koriste samo za identifikaciju narudžbe.</div>
                      <PrimaryButton
                        onClick={() => canContinueFromLogin && setStep(Step.Choose)}
                        disabled={!canContinueFromLogin}
                        title={!canContinueFromLogin ? "Ispuni sva polja" : "Nastavi"}
                        style={{ opacity: canContinueFromLogin ? 1 : 0.6, cursor: canContinueFromLogin ? "pointer" : "not-allowed" }}
                      >
                        Nastavi
                      </PrimaryButton>
                    </div>
                  </form>
                </Card>
                <Analytics />
              </div>
            </motion.section>
          )}
          {/* ODABIR PAKETA */}
          {step === Step.Choose && (
            <motion.section
              key="choose"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <div className="mb-6 px-4">
                <h2 className="text-2xl font-bold tracking-tight" style={{ color: CONFIG.theme.dark }}>
                  Oprema – odaberi paket
                </h2>
              </div>
              <div className="space-y-6 px-4">
                {CONFIG.products.packages
                  .map((p) => ({ ...p, image: effectiveImage(p, customImageA ?? resolvedImageA, customImageB ?? resolvedImageB) }))
                  .map((p) => (
                    <PackageCard key={p.id} pkg={p} />
                  ))}
              </div>
              <div className="mt-8 grid grid-cols-1 gap-4 px-4">
                <Card>
                  <div className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <Field label="Veličina dresa" id="jersey">
                        <select
                          value={pkgSizes.jersey}
                          onChange={(e) => setPkgSizes((prev) => ({ ...prev, jersey: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/10 bg-white"
                        >
                          <option value="" disabled>Odaberi veličinu</option>
                          {JERSEY_SIZES.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>
                      </Field>
                      <Field label="Veličina majice" id="shirt">
                        <select
                          value={pkgSizes.shirt}
                          onChange={(e) => setPkgSizes((prev) => ({ ...prev, shirt: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/10 bg-white"
                        >
                          <option value="" disabled>Odaberi veličinu</option>
                          {SHIRT_SIZES.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>
                      </Field>
                      <Field label="Veličina hoodice" id="hoodie">
                        <select
                          value={pkgSizes.hoodie}
                          onChange={(e) => setPkgSizes((prev) => ({ ...prev, hoodie: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/10 bg-white"
                        >
                          <option value="" disabled>Odaberi veličinu</option>
                          {HOODIE_SIZES.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>
                      </Field>
                      <div className="md:justify-self-end">
                        <div className="text-sm text-black/60 mb-2">Cijena paketa</div>
                        <div className="text-2xl font-bold">{formatCurrency(selectedPackage?.price ?? 0)}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-6">
                      <OutlineButton onClick={() => setStep(Step.Login)}>Natrag</OutlineButton>
                      <PrimaryButton
                        onClick={() => canConfirmPackage && setStep(Step.Extras)}
                        disabled={!canConfirmPackage}
                        title={!canConfirmPackage ? "Odaberi paket i sve veličine" : "Potvrdi"}
                        style={{ opacity: canConfirmPackage ? 1 : 0.6, cursor: canConfirmPackage ? "pointer" : "not-allowed" }}
                      >
                        Potvrdi
                      </PrimaryButton>
                    </div>
                  </div>
                </Card>
              </div>
            </motion.section>
          )}
          {/* DODATNI ARTIKLI */}
          {step === Step.Extras && (
            <motion.section
              key="extras"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <div className="mb-6 px-4">
                <h2 className="text-2xl font-bold tracking-tight" style={{ color: CONFIG.theme.dark }}>
                  Dodatni artikli (opcionalno)
                </h2>
                <p className="text-black/70 mt-1">Odaberi dodatne artikle. Ovaj korak možeš preskočiti.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4">
                {EXTRAS.map((ex) => (
                  <ExtraCard
                    key={ex.id}
                    extra={ex}
                    checked={selectedExtras.has(ex.id)}
                    sizeValue={extraSizes[ex.id] || ""}
                    onSizeChange={(v) => setExtraSizes((prev) => ({ ...prev, [ex.id]: v }))}
                    onToggle={() => {
                      setSelectedExtras((prev) => {
                        const next = new Set(prev);
                        if (next.has(ex.id)) {
                          next.delete(ex.id);
                          setExtraSizes((p) => {
                            const { [ex.id]: _, ...rest } = p;
                            return rest;
                          });
                        } else {
                          next.add(ex.id);
                          if (Array.isArray(ex.sizes) && !extraSizes[ex.id]) {
                            setExtraSizes((p) => ({ ...p, [ex.id]: "" }));
                          }
                        }
                        return next;
                      });
                    }}
                  />
                ))}
              </div>
              <div className="mt-8 grid grid-cols-1 gap-4 px-4">
                <Card>
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <OutlineButton onClick={() => setStep(Step.Choose)}>Natrag</OutlineButton>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-black/60">Ukupno</div>
                        <div className="text-2xl font-bold">{formatCurrency(total)}</div>
                        <PrimaryButton
                          onClick={() => allExtrasSizedOk && setStep(Step.Review)}
                          disabled={!allExtrasSizedOk}
                          title={!allExtrasSizedOk ? "Odaberi veličine za odabrane artikle" : "Potvrdi"}
                          style={{ opacity: allExtrasSizedOk ? 1 : 0.6, cursor: allExtrasSizedOk ? "pointer" : "not-allowed" }}
                        >
                          Potvrdi
                        </PrimaryButton>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </motion.section>
          )}
          {/* REKAPITULACIJA */}
          {step === Step.Review && (
            <motion.section
              key="review"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <div className="mb-6 px-4">
                <h2 className="text-2xl font-bold tracking-tight" style={{ color: CONFIG.theme.dark }}>
                  Rekapitulacija
                </h2>
                <p className="text-black/70 mt-1">Provjeri podatke prije narudžbe.</p>
              </div>
              <div className="px-4">
                <Card>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm text-black/60">Dijete</div>
                        <div className="font-medium">{firstName} {lastName}</div>
                      </div>
                      <div>
                        <div className="text-sm text-black/60">Trener</div>
                        <div className="font-medium">{coach}</div>
                      </div>
                      <div>
                        <div className="text-sm text-black/60">Paket</div>
                        <div className="font-medium">{selectedPackage?.name}</div>
                      </div>
                      <div>
                        <div className="text-sm text-black/60">Veličine (paket)</div>
                        <div className="font-medium">
                          Dres: {pkgSizes.jersey} · Majica: {pkgSizes.shirt} · Hoodica: {pkgSizes.hoodie}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-black/60">Sadržaj paketa</div>
                        <ul className="text-sm">
                          {selectedPackage?.includes ? (
                            selectedPackage.includes.map((i) => (
                              <li key={i}>
                                • {i}
                                {i.toLowerCase().includes("double face dres") && (
                                  <span className="text-red-600"> — Napomena: Broj dresa se dogovara s trenerom!</span>
                                )}
                              </li>
                            ))
                          ) : (
                            <li>—</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <div className="text-sm text-black/60">Dodatni artikli</div>
                        <ul className="text-sm">
                          {extrasWithSizesLabels.length ? (
                            extrasWithSizesLabels.map((l) => <li key={l}>• {l}</li>)
                          ) : (
                            <li>—</li>
                          )}
                        </ul>
                      </div>
                      <div className="pt-2 border-t border-black/10">
                        <div className="text-sm text-black/60">Ukupno</div>
                        <div className="text-3xl font-extrabold">{formatCurrency(total)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <OutlineButton onClick={() => setStep(Step.Extras)}>Natrag</OutlineButton>
                        <PrimaryButton onClick={() => setStep(Step.Payment)}>Naruči</PrimaryButton>
                      </div>
                      {CONFIG.emailWebhook ? (
                        <div className="text-xs text-black/70" aria-live="polite">
                          {emailStatus === "idle" && (
                            <>Narudžba je obvezujuća. Naručitelj se obvezuje uplatiti u roku od 7 dana. Detalji narudžbe bit će poslani na <b>oprema@kkdinamo.hr</b>.</>
                          )}
                          {emailStatus === "sending" && <>Šaljemo potvrdu narudžbe…</>}
                          {emailStatus === "sent" && <>Potvrda narudžbe poslana na e-mail.</>}
                          {emailStatus === "error" && (
                            <span className="text-red-600">Slanje potvrde nije uspjelo. Molimo napravite screenshot ove stranice.</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-black/70">Narudžba je obvezujuća. Naručitelj se obvezuje uplatiti u roku od 7 dana.</div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </motion.section>
          )}
          {/* UPLATA */}
          {step === Step.Payment && (
            <motion.section
              key="payment"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <div className="mb-6 px-4">
                <h2 className="text-2xl font-bold tracking-tight" style={{ color: CONFIG.theme.dark }}>
                  Podaci za uplatu
                </h2>
                <p className="text-black/70 mt-1">Detalji narudžbe i 2D kod za brzu uplatu.</p>
              </div>
              <div className="px-4">
                <Card>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm text-black/60">Narudžba</div>
                        <div className="font-semibold">{orderId}</div>
                      </div>
                      <div>
                        <div className="text-sm text-black/60">Dijete</div>
                        <div className="font-medium">{firstName} {lastName}</div>
                      </div>
                      <div>
                        <div className="text-sm text-black/60">Trener</div>
                        <div className="font-medium">{coach}</div>
                      </div>
                      <div>
                        <div className="text-sm text-black/60">Paket</div>
                        <div className="font-medium">
                          {selectedPackage?.name} (dres {pkgSizes.jersey}, majica {pkgSizes.shirt}, hoodica {pkgSizes.hoodie})
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-black/60">Dodatni artikli</div>
                        <ul className="text-sm">
                          {extrasWithSizesLabels.length ? extrasWithSizesLabels.map((l) => <li key={l}>• {l}</li>) : <li>—</li>}
                        </ul>
                        <div className="mt-3 text-sm text-black/70">
                          Kontakt za podršku: {CONFIG.supportContact}. Rok isporuke: {CONFIG.deliveryLeadTimeDays} dana od uplate.
                        </div>
                      </div>
                      <div className="pt-2 border-t border-black/10">
                        <div className="text-sm text-black/60">Ukupno za uplatu</div>
                        <div className="text-3xl font-extrabold">{formatCurrency(total)}</div>
                      </div>
                      <div className="pt-4">
                        <div className="text-sm text-black/60">Upute za uplatu (virman / mobilno bankarstvo)</div>
                        <ul className="text-sm leading-7">
                          <li><span className="font-medium">Primatelj:</span> {CONFIG.clubName}</li>
                          <li><span className="font-medium">IBAN:</span> {CONFIG.iban}</li>
                          {CONFIG.paymentModel && (<li><span className="font-medium">Model:</span> {CONFIG.paymentModel}</li>)}
                          <li><span className="font-medium">Poziv na broj:</span> {referenceNumber}</li>
                          <li><span className="font-medium">Opis uplate:</span> {orderId} – {firstName} {lastName}</li>
                          <li><span className="font-medium">Iznos:</span> {formatCurrency(total)}</li>
                        </ul>
                      </div>
                      <div className="flex gap-3">
                        <OutlineButton onClick={() => setStep(Step.Review)}>Natrag</OutlineButton>
                        <PrimaryButton onClick={() => (window as any).print()}>Ispis / PDF</PrimaryButton>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-2xl p-4 border border-black/10 shadow-sm barcode-surface" style={{ background: "#fff" }}>
                        <canvas ref={handleCanvasRef} className="block bg-white" style={{ width: 300, height: 150, background: "#fff" }} />
                        <div ref={handleBarcodeRef} style={{ width: 300, height: 150, display: "none", background: "#fff" }} />
                      </div>
                      <div className="text-xs text-black/60 text-center max-w-xs">
                        Skeniraj HUB 2D (PDF417) kod u mobilnoj aplikaciji. Ako skeniranje ne prepozna sve podatke,
                        upiši IBAN i iznos ručno, a u opis dodaj broj narudžbe.
                      </div>
                      <details className="text-xs text-black/60">
                        <summary className="cursor-pointer">Prikaži HUB 2D (tekstualni payload)</summary>
                        <pre className="mt-2 p-3 bg-black/5 rounded-xl overflow-auto text-[10px] leading-4">{hub2dPayload}</pre>
                      </details>
                    </div>
                  </div>
                </Card>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}