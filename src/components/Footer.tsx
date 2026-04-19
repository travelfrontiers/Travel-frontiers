import Link from "next/link";

type FooterProps = {
    lang: "pt" | "en" | "fr";
};

export default function Footer({ lang }: FooterProps) {
    const content = {
        pt: {
            about: "Descubra novos horizontes com a Travel Frontiers. Há 15 anos a explorar o mundo, estamos hoje presentes em Portugal para o ajudar a planear a sua próxima aventura.",
            quickLinks: "Links Rápidos",
            contact: "Contacto",
            followMe: "Segue-me",
            whatsapp: "Contactar por WhatsApp",
            copyright: "© 2025 Travel Frontiers. Todos os direitos reservados.",
            rnavt: "iCligo Consultant - RNAVT 3301",
            privacy: "Política de Privacidade",
            terms: "Termos de Serviço",
        },
        en: {
            about: "Discover new horizons with Travel Frontiers. Exploring the world for 15 years, we are now in Portugal to help you plan your next adventure.",
            quickLinks: "Quick Links",
            contact: "Contact",
            followMe: "Follow me",
            whatsapp: "Contact via WhatsApp",
            copyright: "© 2025 Travel Frontiers. All rights reserved.",
            rnavt: "iCligo Consultant - RNAVT 3301",
            privacy: "Privacy Policy",
            terms: "Terms of Service",
        },
        fr: {
            about: "Découvrez de nouveaux horizons avec Travel Frontiers. Explorant le monde depuis 15 ans, nous sommes maintenant au Portugal pour vous aider à planifier votre prochaine aventure.",
            quickLinks: "Liens Rapides",
            contact: "Contact",
            followMe: "Suivez-moi",
            whatsapp: "Contacter par WhatsApp",
            copyright: "© 2025 Travel Frontiers. Tous droits réservés.",
            rnavt: "iCligo Consultant - RNAVT 3301",
            privacy: "Politique de Confidentialité",
            terms: "Conditions d'Utilisation",
        },
    };

    const t = content[lang];

    const navLinks = [
        { href: "https://www.travelfrontiers.pt/#home", label: { pt: "Início", en: "Home", fr: "Accueil" } },
        { href: "https://www.travelfrontiers.pt/#about", label: { pt: "Sobre", en: "About", fr: "À propos" } },
        { href: "https://www.travelfrontiers.pt/#services", label: { pt: "Serviços", en: "Services", fr: "Services" } },
        { href: "https://www.travelfrontiers.pt/#testimonials", label: { pt: "Testemunhos", en: "Testimonials", fr: "Témoignages" } },
        { href: "https://www.travelfrontiers.pt/#contact", label: { pt: "Contacto", en: "Contact", fr: "Contact" } },
    ];

    return (
        <footer className="bg-gray-900 text-white py-12">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* About Section */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 relative">
                                <img
                                    src="/logo-footer.png"
                                    alt="Travel Frontiers"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <span className="text-xl font-bold">Travel Frontiers</span>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed">{t.about}</p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">{t.quickLinks}</h3>
                        <ul className="space-y-2">
                            {navLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-gray-400 hover:text-orange-500 transition-colors duration-300 text-sm"
                                    >
                                        {link.label[lang]}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">{t.contact}</h3>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <a
                                    href="mailto:tf.travel.frontiers@gmail.com"
                                    className="text-gray-400 hover:text-orange-500 transition-colors duration-300 flex items-center gap-2"
                                >
                                    <span>📧</span>
                                    <span>tf.travel.frontiers@gmail.com</span>
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://www.instagram.com/travel.frontiers.pt"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-orange-500 transition-colors duration-300 flex items-center gap-2"
                                >
                                    <span>📷</span>
                                    <span>{t.followMe}</span>
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://wa.me/351918376604"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-400 hover:text-orange-500 transition-colors duration-300 flex items-center gap-2"
                                >
                                    <span>💬</span>
                                    <span>{t.whatsapp}</span>
                                </a>
                            </li>
                            <li className="text-gray-400 flex items-center gap-2">
                                <span>📍</span>
                                <span>Portugal</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Copyright and Legal */}
                <div className="mt-8 pt-8 border-t border-gray-800">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
                        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
                            <p>{t.copyright}</p>
                            <p className="hidden md:block">•</p>
                            <p>{t.rnavt}</p>
                        </div>
                        <div className="flex gap-6">
                            <Link href="#" className="hover:text-orange-500 transition-colors duration-300">
                                {t.privacy}
                            </Link>
                            <Link href="#" className="hover:text-orange-500 transition-colors duration-300">
                                {t.terms}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
