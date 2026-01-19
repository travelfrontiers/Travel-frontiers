export type Locale = 'pt' | 'en' | 'fr';

const dictionaries = {
    pt: {
        nav: {
            home: 'Início',
            about: 'Sobre',
            promotions: 'Promoções',
            contact: 'Contacto',
        },
        promo: {
            interested: 'Interessado nesta oferta?',
            contactText: 'Entre em contacto connosco para saber mais detalhes ou personalizar a sua viagem.',
            back: 'Voltar às promoções',
            validUntil: 'Válido até:',
        },
        cta: 'OFERTAS ESPECIAIS',
        footer: {
            rights: 'Todos os direitos reservados.',
        },
    },
    en: {
        nav: {
            home: 'Home',
            about: 'About',
            promotions: 'Promotions',
            contact: 'Contact',
        },
        promo: {
            interested: 'Interested in this offer?',
            contactText: 'Contact us to learn more details or customize your trip.',
            back: 'Back to promotions',
            validUntil: 'Valid until:',
        },
        cta: 'SPECIAL OFFERS',
        footer: {
            rights: 'All rights reserved.',
        },
    },
    fr: {
        nav: {
            home: 'Accueil',
            about: 'À propos',
            promotions: 'Promotions',
            contact: 'Contact',
        },
        promo: {
            interested: 'Intéressé par cette offre?',
            contactText: 'Contactez-nous pour en savoir plus ou pour personnaliser votre voyage.',
            back: 'Retour aux promotions',
            validUntil: 'Valable jusqu\'au:',
        },
        cta: 'OFFRES SPÉCIALES',
        footer: {
            rights: 'Tous droits réservés.',
        },
    },
};

export const getDictionary = (lang: Locale) => dictionaries[lang] || dictionaries.pt;
