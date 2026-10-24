"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Globe } from "lucide-react";

type HeaderProps = {
    lang: "pt" | "en" | "fr";
};

const languageNames = {
    pt: "PT",
    en: "EN",
    fr: "FR",
};

export default function Header({ lang }: HeaderProps) {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Navigation links matching travelfrontiers.pt
    const navLinks = [
        { href: "https://www.travelfrontiers.pt/#home", label: { pt: "Início", en: "Home", fr: "Accueil" } },
        { href: "https://www.travelfrontiers.pt/#about", label: { pt: "Sobre", en: "About", fr: "À propos" } },
        { href: "https://www.travelfrontiers.pt/#services", label: { pt: "Serviços", en: "Services", fr: "Services" } },
        { href: "https://www.travelfrontiers.pt/forum/", label: { pt: "Guias", en: "Guides", fr: "Guides" } },
        { href: "https://www.travelfrontiers.pt/#testimonials", label: { pt: "Testemunhos", en: "Testimonials", fr: "Témoignages" } },
        { href: "https://www.travelfrontiers.pt/#contact", label: { pt: "Contacto", en: "Contact", fr: "Contact" } },
        { href: `/${lang}`, label: { pt: "Promoções", en: "Promotions", fr: "Promotions" } },
    ];

    const switchLanguage = (newLang: string) => {
        setMobileMenuOpen(false);
        // If we are on a promotion detail page, we can't just swap the lang segment
        // because slugs are localized. Best is to go back to the list in the new lang.
        if (pathname.includes("/promo/")) {
            window.location.href = `/${newLang}`;
            return;
        }

        // For other pages (like the home/list page), we can safely swap
        const segments = pathname.split("/");
        segments[1] = newLang;
        const newPath = segments.join("/");
        window.location.href = newPath;
    };

    return (
        <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/90 border-b border-gray-100 shadow-sm">
            <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                {/* Logo - Official Image + Brand name */}
                <Link href="https://www.travelfrontiers.pt/" className="flex items-center gap-3 group">
                    <div className="relative w-12 h-12 group-hover:scale-105 transition-transform duration-300">
                        <img
                            src="/logo.png"
                            alt="Travel Frontiers Logo"
                            className="w-full h-full object-contain filter drop-shadow-sm"
                        />
                    </div>
                    <span className="text-xl font-bold text-gray-900 group-hover:text-orange-600 transition-colors duration-300">
                        Travel Frontiers
                    </span>
                </Link>

                {/* Navigation - Center aligned desktop */}
                <nav className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => {
                        const isPromoLink = link.href === `/${lang}`;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`font-medium transition-colors duration-300 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:transition-all after:duration-300 ${
                                    isPromoLink
                                        ? "text-orange-600 after:w-full after:bg-orange-600 font-semibold"
                                        : "text-gray-700 hover:text-orange-600 after:w-0 hover:after:w-full after:bg-orange-600"
                                }`}
                            >
                                {link.label[lang]}
                            </Link>
                        );
                    })}
                </nav>

                {/* Right side controls: Language switcher & Mobile menu button */}
                <div className="flex items-center gap-3">
                    {/* Desktop & Mobile Language Switcher */}
                    <div className="relative group">
                        <button
                            type="button"
                            aria-label="Selecionar idioma"
                            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium text-sm shadow-sm hover:shadow-md transition-all duration-300"
                        >
                            <Globe className="w-4 h-4" />
                            <span>{languageNames[lang]}</span>
                        </button>
                        <div className="absolute right-0 mt-2 w-32 rounded-xl bg-white shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
                            {(["pt", "en", "fr"] as const).map((l) => (
                                <button
                                    key={l}
                                    onClick={() => switchLanguage(l)}
                                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-orange-50 hover:text-orange-600 transition-colors duration-200 ${
                                        l === lang ? "bg-orange-50 text-orange-600 font-semibold" : "text-gray-700"
                                    }`}
                                >
                                    {languageNames[l]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mobile Menu Toggle Button */}
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
                        aria-expanded={mobileMenuOpen}
                        className="md:hidden p-2 rounded-lg text-gray-700 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                    >
                        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Dropdown Menu */}
            {mobileMenuOpen && (
                <div className="md:hidden border-t border-gray-100 bg-white/98 backdrop-blur-md px-6 py-5 shadow-lg animate-in slide-in-from-top-2 duration-200">
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
                                            ? "bg-orange-50 text-orange-600 font-semibold"
                                            : "text-gray-700 hover:bg-gray-50 hover:text-orange-600"
                                    }`}
                                >
                                    {link.label[lang]}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Mobile language selector options */}
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
                        <span className="text-gray-500 font-medium">Idioma:</span>
                        <div className="flex gap-2">
                            {(["pt", "en", "fr"] as const).map((l) => (
                                <button
                                    key={l}
                                    onClick={() => switchLanguage(l)}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                        l === lang
                                            ? "bg-orange-600 text-white"
                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                >
                                    {languageNames[l]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
