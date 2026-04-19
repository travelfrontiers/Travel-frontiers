"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

    // Navigation links matching travelfrontiers.pt
    const navLinks = [
        { href: "https://www.travelfrontiers.pt/#home", label: { pt: "Início", en: "Home", fr: "Accueil" } },
        { href: "https://www.travelfrontiers.pt/#about", label: { pt: "Sobre", en: "About", fr: "À propos" } },
        { href: "https://www.travelfrontiers.pt/#services", label: { pt: "Serviços", en: "Services", fr: "Services" } },
        { href: "https://www.travelfrontiers.pt/#testimonials", label: { pt: "Testemunhos", en: "Testimonials", fr: "Témoignages" } },
        { href: "https://www.travelfrontiers.pt/#contact", label: { pt: "Contacto", en: "Contact", fr: "Contact" } },
        { href: `/${lang}`, label: { pt: "Promoções", en: "Promotions", fr: "Promotions" } },
    ];

    const switchLanguage = (newLang: string) => {
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
        <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/80 border-b border-white/20 shadow-sm">
            <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                {/* Logo - Official Image + Brand name */}
                <Link href="https://www.travelfrontiers.pt/" className="flex items-center gap-3 group">
                    <div className="relative w-12 h-12 group-hover:scale-110 transition-transform duration-300">
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

                {/* Navigation - Center aligned */}
                <nav className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-gray-700 hover:text-orange-600 font-medium transition-colors duration-300 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-orange-600 hover:after:w-full after:transition-all after:duration-300"
                        >
                            {link.label[lang]}
                        </Link>
                    ))}
                </nav>

                {/* Language Switcher with Globe Icon */}
                <div className="relative group">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300">
                        <span className="text-sm">🌐</span>
                        <span>{languageNames[lang]}</span>
                    </button>
                    <div className="absolute right-0 mt-2 w-32 rounded-lg bg-white shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300">
                        {(["pt", "en", "fr"] as const).map((l) => (
                            <button
                                key={l}
                                onClick={() => switchLanguage(l)}
                                className={`w-full px-4 py-2 text-left hover:bg-orange-50 hover:text-orange-600 transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg ${l === lang ? "bg-orange-50 text-orange-600 font-semibold" : "text-gray-700"
                                    }`}
                            >
                                {languageNames[l]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </header>
    );
}
