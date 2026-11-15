"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Globe } from "lucide-react";

type HeaderProps = {
    lang: "pt" | "en" | "fr";
    alternatePaths?: Record<string, string>;
};

const languageNames = {
    pt: "PT",
    en: "EN",
    fr: "FR",
};

export default function Header({ lang, alternatePaths }: HeaderProps) {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [languageOpen, setLanguageOpen] = useState(false);

    // Navigation links matching travelfrontiers.pt
    const navLinks = [
        { href: "https://www.travelfrontiers.pt/#home", label: { pt: "Início", en: "Home", fr: "Accueil" } },
        { href: "https://www.travelfrontiers.pt/#about", label: { pt: "Sobre", en: "About", fr: "À propos" } },
        { href: "https://www.travelfrontiers.pt/#services", label: { pt: "Serviços", en: "Services", fr: "Services" } },
        { href: `https://www.travelfrontiers.pt/forum/?lang=${lang}`, label: { pt: "Fórum", en: "Forum", fr: "Forum" } },
        { href: "https://www.travelfrontiers.pt/#testimonials", label: { pt: "Testemunhos", en: "Testimonials", fr: "Témoignages" } },
        { href: `https://promo.travelfrontiers.pt/${lang}/pedido`, label: { pt: "Contacto", en: "Contact", fr: "Contact" } },
        { href: `/${lang}`, label: { pt: "Promoções", en: "Promotions", fr: "Promotions" } },
    ];

    function languagePath(locale: string) {
        if (pathname.includes("/promo/")) return alternatePaths?.[locale] ?? `/${locale}`;
        const segments = pathname.split("/");
        segments[1] = locale;
        return segments.join("/");
    }

    return (
        <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/90 public-dark:bg-[#141c2a]/95 border-b border-gray-100 public-dark:border-slate-700 shadow-sm">
            <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-2">
                {/* Logo - Official Image + Brand name */}
                <Link href="https://www.travelfrontiers.pt/" className="flex items-center gap-2 sm:gap-3 group">
                    <div className="relative w-9 h-9 sm:w-12 sm:h-12 shrink-0 group-hover:scale-105 transition-transform duration-300">
                        <img
                            src="/logo.png"
                            alt="Travel Frontiers Logo"
                            className="w-full h-full object-contain filter drop-shadow-sm"
                        />
                    </div>
                    <span className="text-sm sm:text-xl font-bold text-gray-900 public-dark:text-slate-100 group-hover:text-orange-600 public-dark:group-hover:text-orange-300 transition-colors duration-300">
                        Travel Frontiers
                    </span>
                </Link>

                {/* Navigation - Center aligned desktop */}
                <nav className="hidden min-[1120px]:flex items-center gap-7">
                    {navLinks.map((link) => {
                        const isPromoLink = link.href === `/${lang}`;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`font-medium transition-colors duration-300 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:transition-all after:duration-300 ${
                                    isPromoLink
                                        ? "text-orange-600 public-dark:text-orange-300 after:w-full after:bg-orange-600 font-semibold"
                                        : "text-gray-700 public-dark:text-slate-200 hover:text-orange-600 public-dark:hover:text-orange-300 after:w-0 hover:after:w-full after:bg-orange-600"
                                }`}
                            >
                                {link.label[lang]}
                            </Link>
                        );
                    })}
                </nav>

                {/* Right side controls: Language switcher & Mobile menu button */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <button type="button" className="site-theme-button" data-theme-toggle>
                        <span className="theme-dark"><span aria-hidden="true">☾</span><span className="theme-action-label">
                            {{ pt: "Ativar modo escuro", en: "Switch to dark mode", fr: "Activer le mode sombre" }[lang]}
                        </span></span>
                        <span className="theme-light"><span aria-hidden="true">☀︎</span><span className="theme-action-label">
                            {{ pt: "Ativar modo claro", en: "Switch to light mode", fr: "Activer le mode clair" }[lang]}
                        </span></span>
                    </button>
                    {/* Desktop & Mobile Language Switcher */}
                    <div className="relative" onBlur={event => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setLanguageOpen(false);
                    }} onKeyDown={event => {
                        if (event.key === "Escape" && languageOpen) {
                            setLanguageOpen(false);
                            event.currentTarget.querySelector("button")?.focus();
                        }
                    }}>
                        <button
                            type="button"
                            aria-label={{ pt: "Selecionar idioma", en: "Choose language", fr: "Choisir la langue" }[lang]}
                            aria-expanded={languageOpen} aria-controls="site-languages"
                            onClick={() => setLanguageOpen(open => !open)}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium text-sm shadow-sm hover:shadow-md transition-all duration-300"
                        >
                            <Globe className="w-4 h-4" />
                            <span>{languageNames[lang]}</span>
                        </button>
                        <div id="site-languages" hidden={!languageOpen} className="absolute right-0 mt-2 w-32 rounded-xl border border-gray-100 public-dark:border-slate-700 bg-white public-dark:bg-[#1b2535] shadow-xl z-50 overflow-hidden">
                            {(["pt", "en", "fr"] as const).map((l) => (
                                <a
                                    key={l} href={languagePath(l)} hrefLang={l} lang={l}
                                    aria-current={l === lang ? "true" : undefined}
                                    onClick={() => { setLanguageOpen(false); setMobileMenuOpen(false); }}
                                    className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-orange-50 public-dark:hover:bg-orange-950 hover:text-orange-600 public-dark:hover:text-orange-300 transition-colors duration-200 ${
                                        l === lang ? "bg-orange-50 public-dark:bg-orange-950 text-orange-600 public-dark:text-orange-300 font-semibold" : "text-gray-700 public-dark:text-slate-200"
                                    }`}
                                >
                                    {languageNames[l]}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Mobile Menu Toggle Button */}
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
                        aria-expanded={mobileMenuOpen}
                        className="min-[1120px]:hidden p-2 rounded-lg text-gray-700 public-dark:text-slate-200 hover:text-orange-600 public-dark:hover:text-orange-300 hover:bg-orange-50 public-dark:hover:bg-orange-950 transition-colors"
                    >
                        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Dropdown Menu */}
            {mobileMenuOpen && (
                <div className="min-[1120px]:hidden border-t border-gray-100 public-dark:border-slate-700 bg-white/98 public-dark:bg-[#141c2a]/98 backdrop-blur-md px-6 py-5 shadow-lg animate-in slide-in-from-top-2 duration-200">
                    <nav className="flex flex-col space-y-3">
                        {navLinks.map((link) => {
                            const isPromoLink = link.href === `/${lang}`;
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`px-3 py-2.5 rounded-lg text-base font-medium transition-colors ${
                                        isPromoLink
                                            ? "bg-orange-50 public-dark:bg-orange-950 text-orange-600 public-dark:text-orange-300 font-semibold"
                                            : "text-gray-700 public-dark:text-slate-200 hover:bg-gray-50 public-dark:hover:bg-slate-800 hover:text-orange-600 public-dark:hover:text-orange-300"
                                    }`}
                                >
                                    {link.label[lang]}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Mobile language selector options */}
                    <div className="mt-4 pt-4 border-t border-gray-100 public-dark:border-slate-700 flex items-center justify-between text-sm">
                        <span className="text-gray-500 public-dark:text-slate-300 font-medium">{({ pt: "Idioma", en: "Language", fr: "Langue" })[lang]}</span>
                        <div className="flex gap-2">
                            {(["pt", "en", "fr"] as const).map((l) => (
                                <a
                                    key={l} href={languagePath(l)} hrefLang={l} lang={l}
                                    aria-current={l === lang ? "true" : undefined}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                        l === lang
                                            ? "bg-orange-600 text-white"
                                            : "bg-gray-100 public-dark:bg-slate-800 text-gray-600 public-dark:text-slate-300 hover:bg-gray-200 public-dark:hover:bg-slate-700"
                                    }`}
                                >
                                    {languageNames[l]}
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
